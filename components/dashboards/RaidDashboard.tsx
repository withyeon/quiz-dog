'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Database } from '@/types/database.types'
import BossStage from '@/components/raid/BossStage'
import FirepowerPanel from '@/components/raid/teacher/FirepowerPanel'
import HeaderStrip from '@/components/raid/teacher/HeaderStrip'
import LegionPanel from '@/components/raid/teacher/LegionPanel'
import PartyWall from '@/components/raid/teacher/PartyWall'
import RaidCeremony from '@/components/raid/teacher/RaidCeremony'
import RecentFeed from '@/components/raid/teacher/RecentFeed'
import ShieldPanel from '@/components/raid/teacher/ShieldPanel'
import SkillPanel from '@/components/raid/teacher/SkillPanel'
import { useRaidScoreActivity } from '@/components/raid/teacher/useRaidScoreActivity'
import { useRaidEvents, useRaidHitPopups, useRaidSkill } from '@/hooks/useRaidEffects'
import { computeRaidState, parseRaidSettings } from '@/lib/game/raid'

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface RaidDashboardProps {
  players: Player[]
  room: Room
}

/** 마지막 펭귄을 쓰러뜨린 뒤 의식 화면으로 넘어가기 전에, 마지막 타격과 승리 배너를 보여 주는 시간(ms) */
const VICTORY_HOLD_MS = 3500

/**
 * 선생님 화면(프로젝터) — 반 전체가 같이 보는 보스 무대.
 * 학생 화면과 같은 computeRaidState·useRaidSkill 로 같은 보스를 보고, 타격·사건은 players 스냅샷 차이로 띄운다.
 * 화면에는 기여(반 전체 합·최근 공격)만 나온다. 누가 못 맞혔는지는 어디에도 나오지 않는다:
 *  - 필살기·방패 게이지는 익명 칸 수만, 파티 벽은 개인 숫자 없이 얼굴과 역할만 보여 준다.
 *  - 끝나면 의식 화면에서 모든 친구의 칭호를 한꺼번에 공개한다.
 */
export default function RaidDashboard({ players, room }: RaidDashboardProps) {
  const isPlaying = room.status === 'playing'
  const isFinished = room.status === 'finished'
  const isPaused = room.status === 'paused'
  const settings = useMemo(() => parseRaidSettings(room.settings), [room.settings])
  const activePlayers = useMemo(() => players.filter((player) => !player.is_kicked), [players])
  const raidState = useMemo(() => computeRaidState(activePlayers, settings), [activePlayers, settings])
  const skill = useRaidSkill(room.started_at, isPlaying, activePlayers, raidState)
  const { hits } = useRaidHitPopups(activePlayers, isPlaying)
  const events = useRaidEvents(raidState, skill, isPlaying)
  const { feed, pulses, recentHits } = useRaidScoreActivity(activePlayers, isPlaying)

  // 남은 시간
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (!isPlaying || !room.started_at || !room.duration_seconds) {
      setRemaining(null)
      return
    }
    const started = new Date(room.started_at).getTime()
    const total = Number(room.duration_seconds)
    const update = () => setRemaining(Math.max(0, total - Math.floor((Date.now() - started) / 1000)))
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [isPlaying, room.duration_seconds, room.started_at])

  // 방이 끝났거나 펭귄을 모두 쓰러뜨리면 의식 화면으로 넘어간다.
  // 다 쓰러뜨린 순간 바로 바꾸면 마지막 타격·승리 배너가 잘리므로, 아직 playing 이면 잠깐 무대를 보여 준 뒤 넘긴다.
  // 이미 다 쓰러뜨린 상태로 열었다면(새로고침) 기다리지 않는다.
  const [victoryHeld, setVictoryHeld] = useState(raidState.allDefeated)
  useEffect(() => {
    if (!raidState.allDefeated) {
      setVictoryHeld(false)
      return
    }
    const timer = window.setTimeout(() => setVictoryHeld(true), VICTORY_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [raidState.allDefeated])
  const showCeremony = isFinished || (raidState.allDefeated && victoryHeld)

  return (
    <section className="overflow-hidden rounded-xl border border-sky-200/30 bg-slate-950 text-white shadow-2xl shadow-sky-950/30">
      {showCeremony ? (
        <RaidCeremony raidState={raidState} players={activePlayers} />
      ) : (
        <>
          <HeaderStrip raidState={raidState} remaining={remaining} paused={isPaused} />

          <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:gap-4 2xl:p-4">
            {/* 큰 무대 + 그 아래 파티 벽 (30명도 1920×1080 한 화면에 들어오도록 벽은 촘촘하게) */}
            <div className="flex min-w-0 flex-col gap-3 2xl:gap-4">
              <BossStage
                boss={raidState.current}
                bossCount={raidState.roster.length}
                defeatedCount={raidState.defeatedCount}
                skill={skill}
                hits={hits}
                events={events}
                size="large"
              />
              <PartyWall players={activePlayers} pulses={pulses} />
            </div>

            <aside className="flex min-w-0 flex-col gap-3 2xl:gap-4">
              <SkillPanel skill={skill} paused={!isPlaying} />
              <ShieldPanel boss={raidState.current} />
              <LegionPanel raidState={raidState} />
              <FirepowerPanel recentHits={recentHits} activePlayerCount={raidState.activePlayerCount} />
              <RecentFeed feed={feed} />
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
