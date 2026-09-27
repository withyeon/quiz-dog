'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Snowflake } from 'lucide-react'
import SnowBattlefield from '@/components/battle/SnowBattlefield'
import ClassSelector from '@/components/ClassSelector'
import { PLAYER_CLASSES, TEAM_INFO } from '@/lib/game/battleRoyale'
import { ROOM_RUNTIME_EVENT } from '@/lib/realtime/roomChannel'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  StageCard,
  TapPointer,
  PLAYER_NAME,
  PLAYER_AVATAR,
  RIVALS,
  useDelayedFlag,
  type HudChip,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 눈싸움 대작전 — 실제 게임 화면을 만드는 컴포넌트를 그대로 가져와 그린다:
 *   ClassSelector(장비 고르기) · SnowBattlefield(눈밭 전장, 눈뭉치가 날아가는 연출까지 실제 그대로)
 *   (lib/game/battleRoyale.ts · app/battle/page.tsx)
 * 장면 4개는 튜토리얼 규칙 4장과 1:1.
 */

type FieldPlayers = Parameters<typeof SnowBattlefield>[0]['players']

const ME_ID = 'me'
const TARGET_ID = 'blue-0'
const DEMO_CLASS = 'ice_fist' as const
/** 실제 피해량은 장비·연속 정답으로 달라진다. 데모는 아이스 브레이커 한 방 기준 */
const HIT_DAMAGE = Math.round(20 * PLAYER_CLASSES[DEMO_CLASS].damageMultiplier)

function buildPlayers(targetHealth: number): FieldPlayers {
  const base = [
    { id: ME_ID, nickname: PLAYER_NAME, avatar: PLAYER_AVATAR, team: 'red', health: 100 },
    { id: 'red-1', nickname: RIVALS[0].name, avatar: RIVALS[0].avatar, team: 'red', health: 100 },
    { id: 'red-2', nickname: RIVALS[1].name, avatar: RIVALS[1].avatar, team: 'red', health: 80 },
    { id: TARGET_ID, nickname: RIVALS[2].name, avatar: RIVALS[2].avatar, team: 'blue', health: targetHealth },
    { id: 'blue-1', nickname: '초코', avatar: '/character/10.svg', team: 'blue', health: 100 },
    { id: 'blue-2', nickname: '보리', avatar: '/character/12.svg', team: 'blue', health: 65 },
  ]
  return base.map((p) => ({ ...p, player_class: DEMO_CLASS, is_online: true, score: 0, gold: 0 })) as unknown as FieldPlayers
}

const PLAYERS_FULL = buildPlayers(100)
const PLAYERS_HIT = buildPlayers(100 - HIT_DAMAGE)
const PLAYERS_SNOWMAN = buildPlayers(0)

/** 실제 전장은 방 이벤트(battle:attacked)를 받아 눈뭉치를 날린다. 데모도 같은 이벤트를 흘려 넣는다. */
function useThrowSnowball(active: boolean, delay: number) {
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(ROOM_RUNTIME_EVENT, {
          detail: {
            type: 'battle:attacked',
            payload: { attackerId: ME_ID, attackerNickname: PLAYER_NAME, targetId: TARGET_ID, damage: HIT_DAMAGE, isCritical: false, itemType: null },
          },
        }),
      )
    }, delay)
    return () => clearTimeout(timer)
  }, [active, delay])
}

/** 실제 화면의 팀 배지 줄 (홍팀 · 장비 · 눈뭉치 준비) */
function TeamBadges({ ready }: { ready: boolean }) {
  const cls = PLAYER_CLASSES[DEMO_CLASS]
  return (
    <div className="flex flex-wrap items-center gap-2 font-bitbit">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${TEAM_INFO.red.bg} ${TEAM_INFO.red.border} ${TEAM_INFO.red.color}`}>
        {TEAM_INFO.red.emoji} {TEAM_INFO.red.name}
        <span className="opacity-70">3명 생존 / 상대 3명</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">
        <Snowflake className="h-3.5 w-3.5" /> {cls.name}
      </span>
      {ready && (
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow"
        >
          ❄️ 눈뭉치 준비 완료
        </motion.span>
      )}
    </div>
  )
}

function Field({ players, canAttack, locked }: { players: FieldPlayers; canAttack: boolean; locked?: string | null }) {
  return (
    <SnowBattlefield
      players={players}
      currentPlayerId={ME_ID}
      lockedTarget={locked ?? null}
      canAttack={canAttack}
      orientation="horizontal"
      compact
      showTicker={false}
      className="h-[248px] sm:h-[280px]"
    />
  )
}

/** 규칙 1 — 팀과 장비를 고릅니다 (실제 ClassSelector 그대로) */
function LoadoutScene() {
  return (
    <StageCard id="battle-loadout" className="relative w-full max-w-2xl">
      <div style={{ zoom: 0.58 }}>
        <ClassSelector onSelect={() => {}} selectedClass={DEMO_CLASS} />
      </div>
      <div className="pointer-events-none absolute left-[24%] top-[52%]">
        <TapPointer className="left-0 top-0" />
      </div>
    </StageCard>
  )
}

/** 규칙 2 — 맞히면 던집니다: 퀴즈 → 정답 → 전장에서 상대를 눌러 눈뭉치가 날아간다 */
function AttackScene() {
  const answered = useDelayedFlag(1100)
  const onField = useDelayedFlag(2500)
  useThrowSnowball(onField, 900)
  if (!onField) {
    return (
      <GlassQuizStep
        question="눈은 무슨 색일까요?"
        options={['하얀색', '검은색', '파란색', '빨간색']}
        correctIndex={0}
        answered={answered}
      />
    )
  }
  return (
    <StageCard id="battle-throw" className="relative w-full max-w-2xl">
      <div className="mb-2"><TeamBadges ready /></div>
      <Field players={PLAYERS_HIT} canAttack locked={TARGET_ID} />
      <div className="pointer-events-none absolute right-[22%] top-[40%]">
        <TapPointer className="left-0 top-0" />
      </div>
    </StageCard>
  )
}

/** 규칙 3 — 체온이 0이 되면 눈사람 */
function SnowmanScene() {
  return (
    <StageCard id="battle-snowman" className="relative w-full max-w-2xl">
      <div className="mb-2"><TeamBadges ready={false} /></div>
      <Field players={PLAYERS_SNOWMAN} canAttack={false} />
    </StageCard>
  )
}

/** 규칙 4 — 상대 팀이 모두 눈사람이 되거나, 시간이 끝났을 때 생존자가 많은 팀이 이긴다 */
function WinScene() {
  const shown = useDelayedFlag(900)
  return (
    <StageCard id="battle-win" className="relative w-full max-w-2xl">
      <div className="mb-2"><TeamBadges ready={false} /></div>
      <Field players={PLAYERS_SNOWMAN} canAttack={false} />
      {shown && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          className={`pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-2xl border-4 px-8 py-4 text-center font-bitbit shadow-2xl ${TEAM_INFO.red.bg} ${TEAM_INFO.red.border}`}
        >
          <div className={`text-3xl font-black ${TEAM_INFO.red.color}`}>{TEAM_INFO.red.emoji} {TEAM_INFO.red.name} 승리!</div>
          <div className="mt-1 text-sm font-bold text-slate-600">생존 3명 vs 2명 — 눈사람이 적은 팀이 이겨요</div>
        </motion.div>
      )}
    </StageCard>
  )
}

function chipsFor(phase: string): HudChip[] {
  const alive = phase === 'snowman' || phase === 'win' ? '5/6' : '6/6'
  return [
    { label: '체온', value: '100°', emoji: '🌡️', tone: 'sky' },
    { label: '순위', value: 1, emoji: '🏆', tone: 'amber' },
    { label: '생존', value: alive, emoji: '👥' },
    { label: '장비', value: phase === 'loadout' ? '미선택' : PLAYER_CLASSES[DEMO_CLASS].name, emoji: '❄️' },
  ]
}

export default function BattleRoyaleTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="battle_royale"
      backgroundSrc="/background/battle-royale.webp"
      chips={chipsFor}
      /* 규칙 4장과 1:1 — lib/game/tutorials.ts 의 battle_royale 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'loadout', duration: 3000, step: 1, caption: '팀이 정해지면 오늘의 장비를 골라요' },
        { key: 'attack', duration: 5200, step: 2, caption: '정답! 전장에서 상대를 누르면 눈뭉치가 날아가요' },
        { key: 'snowman', duration: 3000, step: 3, caption: '체온이 0이 되면 눈사람이 돼요' },
        { key: 'win', duration: 3000, step: 4, caption: '상대 팀을 모두 눈사람으로 만들면 승리!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'loadout') return <LoadoutScene key="loadout" />
        if (phase === 'attack') return <AttackScene key="attack" />
        if (phase === 'snowman') return <SnowmanScene key="snowman" />
        return <WinScene key="win" />
      }}
    </TutorialDemoFrame>
  )
}

/** 전장이 그대로 보이게 첫 장면에서도 전장을 한 번 미리 그려 둔다 (이미지 미리 받기) */
export const BATTLE_DEMO_PLAYERS = PLAYERS_FULL
