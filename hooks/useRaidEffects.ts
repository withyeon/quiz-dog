'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RAID, type RaidFrenzyState, type RaidPlayerLike, type RaidState } from '@/lib/game/raid'
import { withJosa } from '@/lib/utils/korean'

/** 보스 위에 잠깐 떠오르는 타격 숫자. 내 것과 친구 것을 함께 띄운다 */
export type RaidHitPopup = {
  id: number
  damage: number
  /** 친구 타격이면 이름, 내 타격이면 null */
  nickname: string | null
  mine: boolean
  frenzy: boolean
  comboBonus: number
}

export type RaidEventKind =
  | 'boss_defeated'
  | 'boss_appeared'
  | 'shield_up'
  | 'shield_broken'
  | 'frenzy_start'
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
          pushHit({ damage: diff, nickname: player.nickname, mine: false, frenzy: false, comboBonus: 0 })
        }
      })
    }
    previousScoresRef.current = next
  }, [activePlayers, excludePlayerId, isPlaying, pushHit])

  return { hits, pushHit }
}

/**
 * 사건 배너 — 보스 처치·다음 보스 등장·방패 올라옴·방패 깨짐·집중 공격 시작.
 * 유도 상태의 "이전 값과의 차이"로 감지하므로 학생·선생님 화면이 같은 순간에 같은 배너를 본다.
 */
export function useRaidEvents(
  raidState: RaidState,
  frenzy: RaidFrenzyState,
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
  } | null>(null)

  useEffect(() => {
    const current = raidState.current
    const snapshot = {
      defeatedCount: raidState.defeatedCount,
      bossIndex: current?.def.index ?? -1,
      shieldActive: current?.shield.active ?? false,
      shieldBroken: current?.shield.broken ?? false,
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
    }
  }, [isPlaying, pushEvent, raidState])

  const previousFrenzyRef = useRef(false)
  useEffect(() => {
    if (frenzy.active && !previousFrenzyRef.current && isPlaying) {
      pushEvent('frenzy_start', `집중 공격! ${RAID.FRENZY_DURATION}초 동안 데미지 ${RAID.FRENZY_MULTIPLIER}배`)
    }
    previousFrenzyRef.current = frenzy.active
  }, [frenzy.active, isPlaying, pushEvent])

  return events
}

/** 1초마다 갱신되는 집중 공격 시계. 게임 중이 아니면 멈춘 상태를 돌려준다 */
export function useRaidFrenzyClock(
  startedAt: string | null | undefined,
  isPlaying: boolean,
  compute: (startedAt: string | null | undefined) => RaidFrenzyState,
): RaidFrenzyState {
  const [frenzy, setFrenzy] = useState<RaidFrenzyState>(() => compute(null))
  useEffect(() => {
    if (!isPlaying) {
      setFrenzy(compute(null))
      return
    }
    const tick = () => setFrenzy(compute(startedAt))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [compute, isPlaying, startedAt])
  return frenzy
}
