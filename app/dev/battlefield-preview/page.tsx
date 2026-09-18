'use client'

import { useEffect, useMemo, useState } from 'react'
import SnowBattlefield from '@/components/battle/SnowBattlefield'
import { emitRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import type { BattlefieldPlayer } from '@/lib/game/battlefield'
import type { Team } from '@/lib/game/battleRoyale'

/**
 * 눈밭 전장 미리보기 — 실제 방 없이 스프라이트 배치·눈뭉치 비행·탈락 연출을 본다.
 * ?n=24 로 인원, ?h=1 로 가로형(교사 대시보드), ?auto=1 로 자동 난전.
 */

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린', '시우', '수아', '준서', '지민', '현우', '유나', '은우', '채원', '지호', '다은', '선우', '하린', '건우', '소율', '태양', '나은', '이준', '아린', '우진', '서윤', '주원', '가은', '연우', '지안']

function makePlayers(n: number, teamed: boolean): BattlefieldPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i % NAMES.length],
    avatar: `/character/${(i % 24) + 1}.webp`,
    health: 100,
    player_class: (['ice_fist', 'rapid_fire', 'shield', 'hot_choco'] as const)[i % 4],
    team: teamed ? ((i % 2 === 0 ? 'red' : 'blue') as Team) : null,
  }))
}

export default function BattlefieldPreviewPage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const count = Math.max(2, Math.min(30, Number(params?.get('n') ?? 12)))
  const horizontal = params?.get('h') === '1'
  const auto = params?.get('auto') === '1'
  const spectator = params?.get('me') === '0'
  const [players, setPlayers] = useState(() => makePlayers(count, count >= 6))
  const [zoneLevel, setZoneLevel] = useState(1)
  const [locked, setLocked] = useState<string | null>(null)
  const me = spectator ? null : players[0]

  const fire = (attacker: BattlefieldPlayer, target: BattlefieldPlayer, isCritical = false, itemType: 'giant_ball' | null = null) => {
    const damage = Math.round((isCritical ? 2 : 1) * (10 + Math.random() * 18) * (itemType ? 3 : 1))
    emitRoomRuntimeEvent({
      type: 'battle:attacked', roomCode: 'preview', clientId: 'preview', playerId: attacker.id, sentAt: '', seq: 0,
      payload: { attackerId: attacker.id, attackerNickname: attacker.nickname, targetId: target.id, damage, isCritical, itemType },
    })
    setTimeout(() => {
      setPlayers((prev) => prev.map((p) => (p.id === target.id ? { ...p, health: Math.max(0, (p.health ?? 100) - damage) } : p)))
    }, 550)
  }

  const randomThrow = () => {
    const alive = players.filter((p) => (p.health ?? 100) > 0)
    const attacker = alive[Math.floor(Math.random() * alive.length)]
    if (!attacker) return
    const targets = alive.filter((p) => p.id !== attacker.id && (!attacker.team || p.team !== attacker.team))
    const target = targets[Math.floor(Math.random() * targets.length)]
    if (!target) return
    fire(attacker, target, Math.random() < 0.15, Math.random() < 0.08 ? 'giant_ball' : null)
  }

  useEffect(() => {
    if (!auto) return
    const t = setInterval(randomThrow, 900)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, players])

  const alive = useMemo(() => players.filter((p) => (p.health ?? 100) > 0).length, [players])

  return (
    <main className="battle-shell min-h-dvh p-4 font-bitbit">
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="battle-frost-panel flex flex-wrap items-center gap-2 p-3 text-sm font-black text-slate-800">
          <span>눈밭 전장 미리보기 · {players.length}명 · 생존 {alive}</span>
          <button type="button" className="rounded-full bg-sky-600 px-3 py-1 text-white" onClick={randomThrow}>아무나 던지기</button>
          <button type="button" className="rounded-full bg-amber-500 px-3 py-1 text-white" onClick={() => { const a = players[1], t = players[2]; fire(a, t, true) }}>크리티컬</button>
          <button type="button" className="rounded-full bg-orange-600 px-3 py-1 text-white" onClick={() => { const a = players[0], t = players[3]; fire(a, t, false, 'giant_ball') }}>왕눈덩이</button>
          <button type="button" className="rounded-full bg-slate-800 px-3 py-1 text-white" onClick={() => setPlayers((prev) => { const i = prev.findIndex((p) => (p.health ?? 100) > 0 && p.id !== me?.id); return prev.map((p, j) => (j === i ? { ...p, health: 0 } : p)) })}>한 명 탈락</button>
          <button type="button" className="rounded-full bg-emerald-600 px-3 py-1 text-white" onClick={() => setPlayers((prev) => { const i = prev.findIndex((p) => (p.health ?? 100) <= 0); return prev.map((p, j) => (j === i ? { ...p, health: 50 } : p)) })}>한 명 부활</button>
          <button type="button" className="rounded-full bg-sky-800 px-3 py-1 text-white" onClick={() => setZoneLevel((z) => z + 1)}>폭설 +1 ({zoneLevel})</button>
          <button type="button" className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-300" onClick={() => setPlayers(makePlayers(count, count >= 6))}>초기화</button>
        </div>
        <SnowBattlefield
          players={players}
          currentPlayerId={me?.id ?? null}
          lockedTarget={locked}
          onTargetSelect={(id) => setLocked((cur) => (cur === id ? null : id))}
          canAttack={Boolean(me)}
          zoneLevel={zoneLevel}
          orientation={horizontal ? 'horizontal' : 'vertical'}
          className={horizontal ? 'h-[clamp(300px,60vh,600px)]' : 'h-[clamp(280px,55vh,520px)]'}
        />
      </div>
    </main>
  )
}
