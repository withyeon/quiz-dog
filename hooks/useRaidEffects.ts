'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RAID, getRaidSkillState, type RaidPlayerLike, type RaidSkillState, type RaidState } from '@/lib/game/raid'
import { withJosa } from '@/lib/utils/korean'

/** 보스 위에 잠깐 떠오르는 타격 숫자. 내 것과 친구 것을 함께 띄운다 */
export type RaidHitPopup = {
  id: number
  damage: number
  /** 친구 타격이면 이름, 내 타격이면 null */
  nickname: string | null
  mine: boolean
  /** 펭귄이 기절해 있을 때(데미지 2배) 들어간 타격 */
  groggy: boolean
  comboBonus: number
  /** 때린 친구의 역할 (숫자 색). 모르면 null */
  role: string | null
}

export type RaidEventKind =
  | 'boss_defeated'
  | 'boss_appeared'
  | 'shield_up'
  | 'shield_broken'
  | 'skill_charge'
  | 'skill_interrupted'
  | 'skill_blizzard'
  | 'boss_enraged'
  | 'victory'

export type RaidEvent = {
  id: number
  kind: RaidEventKind
  text: string
}

const HIT_POPUP_MS = 1400
const EVENT_BANNER_MS = 2600

/**
 * 타격 팝업. 친구의 타격은 players.score 증가분으로 알아낸다 (실시간 이벤트가 아니라 스냅샷 차이라
 * 이벤트가 하나 유실돼도 다음 갱신에서 합쳐져 뜬다). 내 타격은 제출 순간 pushHit 으로 직접 띄운다.
 */
export function useRaidHitPopups(
  activePlayers: RaidPlayerLike[],
  isPlaying: boolean,
  excludePlayerId: string | null = null,
) {
  const [hits, setHits] = useState<RaidHitPopup[]>([])
  const hitIdRef = useRef(0)

  const pushHit = useCallback((hit: Omit<RaidHitPopup, 'id'>) => {
    const id = ++hitIdRef.current
    setHits((prev) => [...prev.slice(-5), { ...hit, id }])
    window.setTimeout(() => {
      setHits((prev) => prev.filter((item) => item.id !== id))
    }, HIT_POPUP_MS)
  }, [])

  const previousScoresRef = useRef<Map<string, number> | null>(null)
  useEffect(() => {
    const previous = previousScoresRef.current
    const next = new Map(activePlayers.map((player) => [player.id, player.score ?? 0]))
    if (previous && isPlaying) {
      activePlayers.forEach((player) => {
        if (player.id === excludePlayerId) return
        const before = previous.get(player.id)
        if (before === undefined) return
        const diff = (player.score ?? 0) - before
        if (diff > 0) {
          pushHit({ damage: diff, nickname: player.nickname, mine: false, groggy: false, comboBonus: 0, role: player.player_class ?? null })
        }
      })
    }
    previousScoresRef.current = next
  }, [activePlayers, excludePlayerId, isPlaying, pushHit])

  return { hits, pushHit }
}

/**
 * 사건 배너 — 보스 처치·다음 보스 등장·방패 올라옴·방패 깨짐·황제 분노·필살기 예고·끊기·눈보라.
 * 유도 상태의 "이전 값과의 차이"로 감지하므로 학생·선생님 화면이 같은 순간에 같은 배너를 본다.
 */
export function useRaidEvents(
  raidState: RaidState,
  skill: RaidSkillState,
  isPlaying: boolean,
  onEvent?: (kind: RaidEventKind) => void,
) {
  const [events, setEvents] = useState<RaidEvent[]>([])
  const eventIdRef = useRef(0)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const pushEvent = useCallback((kind: RaidEventKind, text: string) => {
    const id = ++eventIdRef.current
    setEvents((prev) => [...prev.slice(-2), { id, kind, text }])
    onEventRef.current?.(kind)
    window.setTimeout(() => {
      setEvents((prev) => prev.filter((item) => item.id !== id))
    }, EVENT_BANNER_MS)
  }, [])

  const previousRef = useRef<{
    defeatedCount: number
    bossIndex: number
    shieldActive: boolean
    shieldBroken: boolean
    enraged: boolean
  } | null>(null)

  useEffect(() => {
    const current = raidState.current
    const snapshot = {
      defeatedCount: raidState.defeatedCount,
      bossIndex: current?.def.index ?? -1,
      shieldActive: current?.shield.active ?? false,
      shieldBroken: current?.shield.broken ?? false,
      enraged: current?.enraged ?? false,
    }
    const previous = previousRef.current
    previousRef.current = snapshot
    if (!previous || !isPlaying) return

    if (snapshot.defeatedCount > previous.defeatedCount) {
      const defeated = raidState.bosses[snapshot.defeatedCount - 1]
      pushEvent('boss_defeated', `${withJosa(defeated?.def.name ?? '펭귄', '을/를')} 쓰러뜨렸다!`)
      if (raidState.allDefeated) {
        window.setTimeout(() => pushEvent('victory', '펭귄 군단을 모두 물리쳤어요!'), 900)
      } else if (current) {
        const nextName = current.def.name
        window.setTimeout(() => pushEvent('boss_appeared', `${nextName} 등장!`), 900)
      }
      return
    }

    if (snapshot.bossIndex === previous.bossIndex) {
      if (snapshot.shieldActive && !previous.shieldActive) {
        pushEvent('shield_up', '얼음 방패! 더 많은 친구가 때려야 깨져요')
      }
      if (snapshot.shieldBroken && !previous.shieldBroken && previous.shieldActive) {
        pushEvent('shield_broken', '방패가 깨졌다! 마음껏 공격!')
      }
      if (snapshot.enraged && !previous.enraged && current) {
        pushEvent('boss_enraged', `${withJosa(current.def.name, '이/가')} 분노했다! 마지막 힘을 모아요`)
      }
    }
  }, [isPlaying, pushEvent, raidState])

  // 필살기: 예고 시작 · 끊기 성공 · 눈보라. 주기 번호와 단계가 바뀌는 순간만 본다
  const previousSkillRef = useRef<{ cycle: number; phase: RaidSkillState['phase'] } | null>(null)
  useEffect(() => {
    const previous = previousSkillRef.current
    previousSkillRef.current = { cycle: skill.cycle, phase: skill.phase }
    if (!previous || !isPlaying || !raidState.current) return
    if (skill.phase === previous.phase && skill.cycle === previous.cycle) return
    if (skill.phase === 'charging' && previous.phase !== 'charging') {
      pushEvent('skill_charge', `필살기 '${skill.skillName}' 예고! 친구 ${skill.required}명이 맞히면 끊어요`)
    } else if (skill.phase === 'groggy' && previous.phase !== 'groggy') {
      pushEvent('skill_interrupted', `필살기를 끊었다! 펭귄 기절 · 데미지 ${RAID.GROGGY_MULTIPLIER}배`)
    } else if (skill.phase === 'blizzard' && previous.phase !== 'blizzard') {
      pushEvent('skill_blizzard', '눈보라가 지나가요! 다음 필살기는 꼭 끊어 봐요')
    }
  }, [isPlaying, pushEvent, raidState, skill.cycle, skill.phase, skill.required, skill.skillName])

  return events
}

/**
 * 필살기 상태. 시간표는 0.5초마다, 끊기 게이지는 players 가 바뀔 때마다 다시 계산한다.
 * 게임 중이 아니면 멈춘 상태(대기)를 돌려준다.
 */
export function useRaidSkill(
  startedAt: string | null | undefined,
  isPlaying: boolean,
  activePlayers: RaidPlayerLike[],
  raidState: RaidState,
): RaidSkillState {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isPlaying) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [isPlaying])
  const sprite = raidState.current?.def.sprite ?? null
  return useMemo(
    () => getRaidSkillState(isPlaying ? startedAt : null, activePlayers, sprite, now),
    [activePlayers, isPlaying, now, sprite, startedAt],
  )
}
