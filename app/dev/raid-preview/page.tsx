'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Database } from '@/types/database.types'
import BossStage from '@/components/raid/BossStage'
import RaidHeader from '@/components/raid/RaidHeader'
import RaidLobbyPanel from '@/components/raid/RaidLobbyPanel'
import RaidResultPanel from '@/components/raid/RaidResultPanel'
import RoleSelector from '@/components/raid/RoleSelector'
import RaidDashboard from '@/components/dashboards/RaidDashboard'
import PartyStrip from '@/components/raid/PartyStrip'
import { useRaidEvents, useRaidHitPopups, useRaidSkill } from '@/hooks/useRaidEffects'
import {
  RAID_ROLE_ORDER,
  computeHitDamage,
  computeRaidState,
  getRaidRole,
  parseRaidSettings,
  type RaidRole,
} from '@/lib/game/raid'

/**
 * 황제 펭귄을 막아라! 미리보기 — 실제 방 없이 학생·선생님 화면을 본다.
 * ?view=student|teacher|lobby|roles|result, ?n=20 인원, ?auto=1 자동 공격, ?boss=3 보스 수,
 * ?dmg=0.6 시작 진행도(전체 체력 대비), ?skill=1 필살기 예고 직전으로 시작, ?finished=1 끝난 방(선생님 시상식).
 */

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린', '시우', '수아', '준서', '지민', '현우', '유나', '은우', '채원', '지호', '다은', '선우', '하린', '건우', '소율', '태양', '나은', '이준', '아린', '우진', '서윤', '주원', '가은', '연우', '지안']

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i % NAMES.length],
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: 0,
    gold: 0,
    defense: 0,
    combo_count: 0,
    player_class: RAID_ROLE_ORDER[i % 3],
    is_kicked: false,
  }) as unknown as Player)
}

function RaidPreview() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const view = params?.get('view') ?? 'student'
  const count = Math.max(1, Math.min(30, Number(params?.get('n') ?? 20)))
  const auto = params?.get('auto') === '1'
  const bossCount = Number(params?.get('boss') ?? 3)
  const startProgress = Math.max(0, Math.min(1, Number(params?.get('dmg') ?? 0)))
  const skillSoon = params?.get('skill') === '1'
  const finished = params?.get('finished') === '1'

  const [startedAt] = useState(() => new Date(Date.now() - (skillSoon ? 42_000 : 5_000)).toISOString())
  const room = useMemo(() => ({
    code: 'PREVIEW',
    status: view === 'lobby' ? 'waiting' : finished ? 'finished' : 'playing',
    started_at: startedAt,
    duration_seconds: 300,
    settings: { raid: { bossCount, playerCount: count } },
  }) as unknown as Room, [bossCount, count, finished, startedAt, view])
  const settings = useMemo(() => parseRaidSettings(room.settings), [room.settings])

  const [players, setPlayers] = useState<Player[]>(() => {
    const list = makePlayers(count)
    if (startProgress > 0) {
      const total = computeRaidState(list, settings).totalMaxHp * startProgress
      // 학생마다 기여가 다르게 (칭호가 갈리는지 보려고)
      const weights = list.map((_, i) => 0.4 + ((i * 7) % 5) * 0.3)
      const sum = weights.reduce((a, b) => a + b, 0)
      list.forEach((p, i) => {
        p.score = Math.round((total * weights[i]) / sum)
        p.gold = i % 9 === 8 ? 0 : Math.round(p.score / 12) + (i % 4)
        p.defense = i % 2 === 0 ? 1 : 0
        p.position = i % 3
      })
    }
    return list
  })
  const raidState = useMemo(() => computeRaidState(players, settings), [players, settings])
  const isPlaying = room.status === 'playing'
  const skill = useRaidSkill(startedAt, isPlaying, players, raidState)
  const { hits, pushHit } = useRaidHitPopups(players, isPlaying, view === 'student' ? 'p0' : null)
  const events = useRaidEvents(raidState, skill, isPlaying)
  const [streak, setStreak] = useState(0)
  const [role, setRole] = useState<RaidRole | null>('warrior')

  const strike = (index: number) => {
    setPlayers((prev) => prev.map((p, i) => {
      if (i !== index) return p
      const boss = raidState.current
      const hit = computeHitDamage({ role: getRaidRole(p), streak: 1 + (i % 6), groggy: skill.phase === 'groggy' })
      const defense = boss && boss.shield.active ? Math.max(p.defense ?? 0, boss.def.index + 1) : p.defense
      const joins = skill.inChargeWindow && (p.revival_streak ?? 0) < skill.cycle + 1
      return {
        ...p,
        score: (p.score ?? 0) + hit.damage,
        gold: (p.gold ?? 0) + 1,
        defense,
        revival_streak: joins ? skill.cycle + 1 : p.revival_streak,
        position: (p.position ?? 0) + (joins ? 1 : 0),
      }
    }))
  }

  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => strike(1 + Math.floor(Math.random() * (count - 1 || 1))), 450)
    return () => window.clearInterval(id)
  })

  const me = players[0]
  const myStrike = () => {
    const next = streak + 1
    setStreak(next)
    const hit = computeHitDamage({ role, streak: next, groggy: skill.phase === 'groggy' })
    pushHit({ damage: hit.damage, nickname: null, mine: true, groggy: hit.multiplier > 1, comboBonus: hit.comboBonus, role })
    strike(0)
  }

  const controls = (
    <div className="fixed bottom-3 right-3 z-[60] flex gap-2 rounded-xl bg-black/70 p-2 text-xs font-bold text-white">
      <button className="rounded bg-emerald-600 px-2 py-1" onClick={myStrike}>내 정답</button>
      <button className="rounded bg-sky-600 px-2 py-1" onClick={() => strike(1 + Math.floor(Math.random() * (count - 1 || 1)))}>친구 정답</button>
      <button className="rounded bg-rose-600 px-2 py-1" onClick={() => setStreak(0)}>오답</button>
    </div>
  )

  if (view === 'teacher') {
    return (
      <main className="min-h-dvh bg-slate-900 p-4">
        <RaidDashboard players={players} room={room} />
        {controls}
      </main>
    )
  }

  return (
    <main className="battle-shell raid-shell relative min-h-dvh overflow-x-hidden font-bitbit">
      <div className="relative z-10 px-3 py-4 sm:px-5 sm:py-6">
        <RaidHeader
          variant={view === 'student' ? 'hud' : 'intro'}
          questionSetTitle="미리보기 문제집"
          role={role}
          streak={streak}
          myDamage={me?.score ?? 0}
          myHits={me?.gold ?? 0}
          raidState={raidState}
          skill={skill}
        />
        <div className="mx-auto max-w-7xl">
          {view === 'lobby' && <RaidLobbyPanel players={players} settings={settings} />}
          {view === 'roles' && <RoleSelector onSelect={setRole} selectedRole={role} players={players} />}
          {view === 'student' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:gap-3 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start xl:gap-4">
              <div className="min-w-0 xl:sticky xl:top-4">
                <BossStage
                  boss={raidState.current}
                  bossCount={raidState.roster.length}
                  defeatedCount={raidState.defeatedCount}
                  skill={skill}
                  hits={hits}
                  events={events}
                  size="compact"
                />
                <div className="mt-2"><PartyStrip players={players} playerId="p0" /></div>
              </div>
              <div className="lg-panel lg-ink-outline mx-auto w-full max-w-3xl p-5 sm:p-7">
                <p className="text-xl font-black text-slate-900">Q. 대한민국의 수도는 어디일까요?</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {['서울', '부산', '대구', '광주'].map((a) => (
                    <button key={a} onClick={myStrike} className="rounded-xl bg-white/80 p-4 text-lg font-black text-slate-800 shadow">{a}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {view === 'result' && (
            <RaidResultPanel raidState={raidState} players={players} playerId="p0" role={role} onShowResult={() => {}} />
          )}
        </div>
      </div>
      {controls}
    </main>
  )
}

// 주소의 쿼리를 첫 렌더에서 읽으므로 서버 렌더를 끈다
export default dynamic(() => Promise.resolve(RaidPreview), { ssr: false })
