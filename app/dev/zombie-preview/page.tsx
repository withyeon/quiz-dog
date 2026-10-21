'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import ZombieView from '@/components/ZombieView'
import type { Question } from '@/hooks/useGameBase'
import {
  GAME_CONSTANTS as Z,
  computeZombieRadio,
  roomPlayerToZombiePlayer,
  type RoomZombiePlayer,
  type ZombieActionKind,
  type ZombiePlayerMeta,
  type ZombieRoomState,
} from '@/lib/game/zombie'
import type { ZombieAttackResult, ZombieSabotageResult, ZombieVaccineResult } from '@/lib/services/playerMutations'
import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']

/**
 * 좀비를 피해라 학생 화면 미리보기. 방 없이 가짜 친구 6명으로 뜨고, 모든 답이 정답 처리된다.
 * 서버 RPC 대신 이 페이지가 같은 규칙을 흉내 내서(숨기·방어막 1장·백신 3발·방해·생존자 보정) 화면만 확인한다.
 * 진짜 규칙은 sql/20261021_zombie_radio_vaccine.sql — 여기 흉내는 대충이다.
 *
 *   /dev/zombie-preview?role=human|zombie&phase=searching|repairing|heli&hp=1(체력 숫자 공개)
 *
 * 프로덕션에서는 proxy.ts가 /dev/* 를 막는다.
 */

const START = Date.now()
// 검수 드라이버가 느린 dev 서버에서도 끝까지 돌 수 있게 넉넉히 (게임 30분)
const DURATION = 1800
const QUESTIONS = [
  { id: 'q1', type: 'CHOICE', question_text: '조선을 세운 인물은?', options: ['이성계', '왕건', '주몽', '박혁거세'] },
  { id: 'q2', type: 'CHOICE', question_text: '광합성에 필요하지 않은 것은?', options: ['빛', '물', '이산화탄소', '소금'] },
] as unknown as Question[]

function meta(role: 'human' | 'zombie', originalRole: 'human' | 'zombie', extra: Partial<ZombiePlayerMeta> = {}): ZombiePlayerMeta {
  return { role, originalRole, shield: 0, infectCount: 0, correctStreak: 0, totalCorrect: 3, totalWrong: 1, ...extra }
}

function row(id: string, nickname: string, m: ZombiePlayerMeta, health = 100): RoomZombiePlayer {
  return { id, nickname, health: m.role === 'zombie' ? 999 : health, attack_power: m.role === 'zombie' ? Z.ZOMBIE_BASE_ATTACK : 0, active_item: m }
}

function initialPlayers(role: 'human' | 'zombie'): RoomZombiePlayer[] {
  const soon = new Date(START + 8000).toISOString()
  return [
    row('me', '나', role === 'zombie' ? meta('zombie', 'zombie') : meta('human', 'human', { radio: 6, radioParts: 6 })),
    row('p1', '초코', meta('human', 'human', { radio: 9, radioParts: 9, shield: 1 }), 80),
    row('p2', '보리', meta('human', 'human', { radio: 4, radioParts: 4, hiddenUntil: soon }), 65),
    row('p3', '콩이', meta('zombie', 'human', { vaccine: 1 })),
    row('p4', '모카', meta(role === 'zombie' ? 'human' : 'zombie', role === 'zombie' ? 'human' : 'zombie')),
    row('p5', '두부', meta('human', 'human', { radio: 7, radioParts: 7 }), 100),
    row('p6', '감자', meta('human', 'human', { radio: 3, radioParts: 3 }), 30),
  ]
}

function ZombiePreview() {
  const params = useSearchParams()
  const role = params.get('role') === 'zombie' ? 'zombie' : 'human'
  const phase = params.get('phase') ?? 'repairing'
  const [players, setPlayers] = useState<RoomZombiePlayer[]>(() => initialPlayers(role))
  const [questionIndex, setQuestionIndex] = useState(0)
  const roomState: ZombieRoomState = useMemo(() => ({
    showHumanStatus: params.get('hp') === '1',
    durationSeconds: DURATION,
    radioGoal: phase === 'searching' ? null : 60,
    heliAt: phase === 'heli' ? new Date(START - 10_000).toISOString() : null,
  }), [params, phase])

  // 시작한 지 2분 지난 방 (헬기는 10초 전에 불렀음 — 게임 끝이 멀어서 45초 뒤에 도착)
  const startedAt = new Date(START - (phase === 'searching' ? 20_000 : 120_000)).toISOString()
  const radio = computeZombieRadio(players.map(roomPlayerToZombiePlayer), roomState, {
    startedAtMs: Date.parse(startedAt),
    gameEndMs: Date.parse(startedAt) + DURATION * 1000,
    durationSeconds: DURATION,
  })

  const update = useCallback((id: string, fn: (p: RoomZombiePlayer, m: ZombiePlayerMeta) => RoomZombiePlayer) => {
    let next: RoomZombiePlayer | null = null
    setPlayers((prev) => prev.map((p) => {
      if (p.id !== id) return p
      next = fn(p, p.active_item as ZombiePlayerMeta)
      return next
    }))
    return next
  }, [])

  const humanWeight = () => {
    const zp = players.map(roomPlayerToZombiePlayer)
    return zp.filter((p) => p.originalRole === 'human').length / Math.max(1, zp.filter((p) => p.role === 'human').length)
  }

  const onZombieAction = async (action: ZombieActionKind) => {
    const gain = action === 'correct' ? Z.RADIO_PER_CORRECT : action === 'repair' ? Z.RADIO_REPAIR_AMOUNT : 0
    const w = humanWeight()
    update('me', (p, m) => {
      if (m.role !== 'human') return p
      return {
        ...p,
        health: action === 'heal' ? Math.min(Z.HUMAN_MAX_HEALTH, (p.health ?? 100) + Z.HUMAN_HEAL_AMOUNT) : p.health,
        active_item: {
          ...m,
          shield: action === 'shield' ? 1 : m.shield,
          radio: (m.radio ?? 0) + gain * w,
          radioParts: (m.radioParts ?? 0) + gain,
        },
      }
    })
    return players.find((p) => p.id === 'me') ?? null
  }

  const onZombieAttack = async (_z: string, targetId: string): Promise<ZombieAttackResult> => {
    const target = players.find((p) => p.id === targetId)!
    const m = target.active_item as ZombiePlayerMeta
    if (m.hiddenUntil && Date.parse(m.hiddenUntil) > Date.now()) return { outcome: 'hidden', damage: 0, players: [] }
    const hide = new Date(Date.now() + Z.HIDE_SECONDS * 1000).toISOString()
    const damage = Math.round(Z.ZOMBIE_BASE_ATTACK * (roomState.heliAt ? Z.HELI_RUSH_MULTIPLIER : 1))
    if (m.shield > 0) {
      update(targetId, (p) => ({ ...p, active_item: { ...m, shield: 0, hiddenUntil: hide } }))
      return { outcome: 'blocked', damage: 0, players: [] }
    }
    const hp = (target.health ?? 100) - damage
    if (hp <= 0) {
      update(targetId, (p) => ({ ...p, health: 999, active_item: { ...m, role: 'zombie', vaccine: 0, hiddenUntil: null } }))
      return { outcome: 'infected', damage, players: [] }
    }
    const after = { ...target, health: hp, active_item: { ...m, hiddenUntil: hide } }
    update(targetId, () => after)
    return { outcome: 'damaged', damage, players: [after as unknown as PlayerRow] }
  }

  const onZombieVaccinate = async (_h: string, targetId: string): Promise<ZombieVaccineResult> => {
    const target = players.find((p) => p.id === targetId)!
    const m = target.active_item as ZombiePlayerMeta
    if (m.role !== 'zombie') return { outcome: 'not_zombie', doses: 0, players: [] }
    if (m.originalRole === 'zombie') return { outcome: 'immune', doses: 0, players: [] }
    const doses = (m.vaccine ?? 0) + 1
    if (doses >= Z.VACCINE_DOSES) {
      update(targetId, (p) => ({ ...p, health: Z.CURE_HEALTH, active_item: { ...m, role: 'human', vaccine: 0, hiddenUntil: new Date(Date.now() + Z.HIDE_SECONDS * 1000).toISOString() } }))
      return { outcome: 'cured', doses, players: [] }
    }
    update(targetId, (p) => ({ ...p, active_item: { ...m, vaccine: doses } }))
    return { outcome: 'dosed', doses, players: [] }
  }

  const onZombieSabotage = async (): Promise<ZombieSabotageResult> => {
    if (roomState.heliAt) return { outcome: 'locked', amount: 0, player: null }
    const amount = Math.min(Z.SABOTAGE_AMOUNT, radio.progress)
    update('me', (p, m) => ({ ...p, active_item: { ...m, sabotage: (m.sabotage ?? 0) + amount, sabotageCount: (m.sabotageCount ?? 0) + 1 } }))
    return { outcome: 'sabotaged', amount, player: null }
  }

  return (
    <ZombieView
      roomCode="123456"
      playerId="me"
      roomStatus="playing"
      roomStartedAt={startedAt}
      roomDurationSeconds={DURATION}
      roomPlayers={players}
      showHumanStatusToZombies={roomState.showHumanStatus}
      radio={radio}
      currentQuestion={QUESTIONS[questionIndex % QUESTIONS.length]}
      onAnswer={async () => true}
      onNextQuestion={() => setQuestionIndex((prev) => prev + 1)}
      onFinishRoom={async () => false}
      onZombieAction={onZombieAction}
      onZombieAttack={onZombieAttack}
      onZombieVaccinate={onZombieVaccinate}
      onZombieSabotage={onZombieSabotage}
      questionSetTitle="미리보기 문제집"
    />
  )
}

export default dynamic(() => Promise.resolve(ZombiePreview), { ssr: false })
