'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import ChestView from '@/components/ChestView'
import PlayerSelector from '@/components/PlayerSelector'
import ShieldPromptModal from '@/components/ShieldPromptModal'
import {
  BOX_EVENT_IMAGE,
  CHEST_COUNT,
  GOLD_LOSS_RATE,
  GOLD_STEAL_RATE,
  MAX_GOLD_STACK,
  SHIELD_STREAK,
  toPercent,
  type BoxEvent,
} from '@/lib/game/goldQuest'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  PLAYER_NAME,
  PLAYER_AVATAR,
  RIVALS,
  type HudChip,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 해적왕의 보물찾기 — 자동 재생되는 "플레이 영상" 데모.
 * 실제 게임 화면을 만드는 컴포넌트를 그대로 가져와 그린다:
 *   ChestView(상자 고르기·보상 팝업) · PlayerSelector(상대 고르기) · ShieldPromptModal(방어권 질문)
 *   (lib/game/goldQuest.ts · app/game/page.tsx)
 * 장면 7개는 튜토리얼 규칙 7장과 1:1로 맞춰 두었습니다.
 * 선생님이 규칙을 넘기면 같은 번호의 장면이 뜹니다.
 * 화면에 나오는 숫자는 전부 상수에서 계산하므로 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

/** 데모에서 쓰는 시작 골드 — 실제 게임처럼 얻고 잃으며 오르내립니다. */
const START_GOLD = 120
/** 골드를 빼앗을 상대(냥냥이)가 들고 있는 골드 */
const RIVAL_GOLD = 200

const CROWN_GOLD = MAX_GOLD_STACK
const GOLD_AFTER_CROWN = START_GOLD + CROWN_GOLD
const DRAGON_LOSS = Math.floor(GOLD_AFTER_CROWN * GOLD_LOSS_RATE.DRAGON)
const GOLD_AFTER_DRAGON = GOLD_AFTER_CROWN - DRAGON_LOSS
const STEAL_GAIN = Math.floor(RIVAL_GOLD * GOLD_STEAL_RATE.WIZARD)
const GOLD_AFTER_STEAL = GOLD_AFTER_DRAGON + STEAL_GAIN

/** 골드는 왕관(+) → 드래곤(-) → 마법사(+) 순으로 오르내립니다. 실제 게임과 같은 흐름입니다. */
const GOLD_BY_PHASE: Record<string, { value: number; from?: number }> = {
  quiz: { value: START_GOLD },
  chest: { value: START_GOLD },
  gold: { value: GOLD_AFTER_CROWN, from: START_GOLD },
  trap: { value: GOLD_AFTER_DRAGON, from: GOLD_AFTER_CROWN },
  steal: { value: GOLD_AFTER_STEAL, from: GOLD_AFTER_DRAGON },
  shield: { value: GOLD_AFTER_STEAL },
  rank: { value: GOLD_AFTER_STEAL },
}

/** 손가락은 늘 가운데 상자를 누릅니다. */
const PICKED_CHEST_INDEX = Math.floor(CHEST_COUNT / 2)

/** 상자에서 나오는 결과 — 실제 generateBoxEvent 가 만드는 것과 같은 모양(문구도 같음) */
const CROWN_EVENT: BoxEvent = {
  type: 'GOLD_STACK',
  value: CROWN_GOLD,
  message: `전설의 황금 왕관을 발견했다! +${CROWN_GOLD} 골드`,
  itemName: '황금 왕관',
  icon: '💰',
  image: '/gold-quest/golden-crown.webp',
}
const DRAGON_EVENT: BoxEvent = {
  type: 'DRAGON',
  value: DRAGON_LOSS,
  message: `드래곤에게 습격당했다. -${DRAGON_LOSS} 골드`,
  itemName: '드래곤',
  icon: '🐉',
}

type SelectorPlayers = Parameters<typeof PlayerSelector>[0]['players']
/** 상대 고르기 화면에 나오는 친구들 — 실제 players 행과 같은 필드만 채운다 */
const RIVAL_PLAYERS = [
  { id: 'rival-0', nickname: RIVALS[0].name, avatar: RIVALS[0].avatar, gold: RIVAL_GOLD, score: RIVAL_GOLD },
  { id: 'rival-1', nickname: RIVALS[1].name, avatar: RIVALS[1].avatar, gold: 90, score: 90 },
] as unknown as SelectorPlayers

/**
 * 장면이 뜬 뒤 한 박자 늦게 켜지는 스위치.
 * 장면은 넘어갈 때마다 새로 붙으므로, 붙는 순간부터 시간을 잰다.
 */
function useDelayedFlag(delay = 1000): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setOn(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  return on
}

/** 규칙 1 — 정답을 골라야 상자가 열립니다 */
function QuizScene() {
  const answered = useDelayedFlag(1100)
  return (
    <GlassQuizStep
      question="보물이 묻힌 곳을 알려주는 종이는?"
      options={['보물 지도', '일기장', '달력', '시간표']}
      correctIndex={0}
      answered={answered}
    />
  )
}

/**
 * 규칙 2·3·4 — 실제 ChestView 그대로.
 * reward 를 주면 실제 게임처럼 상자가 열리고 보상 팝업이 뜬다(프레임 안에 갇힘).
 */
function ChestScene({ reward }: { reward: BoxEvent | null }) {
  const picked = useDelayedFlag(900)
  const selected = reward && picked ? PICKED_CHEST_INDEX : null
  return (
    <StageCard id={`gold-quest-chest-${reward?.type ?? 'pick'}`} className="relative w-full max-w-2xl">
      {/* 데모 무대는 실제 화면보다 작으니 상자 패널을 zoom 으로 줄여 담는다 (transform 은 레이아웃 크기가 안 줄어 잘린다) */}
      <div style={{ zoom: 0.7 }}>
        <ChestView onChestSelect={() => {}} selectedChest={selected} reward={reward && picked ? reward : null} isProcessing={false} />
      </div>
      {!reward && (
        <div className="pointer-events-none absolute left-1/2 top-[58%]">
          <TapPointer className="left-0 top-0" />
        </div>
      )}
    </StageCard>
  )
}

/** 규칙 5 — 마법사를 찾으면 친구 골드를 가져옵니다 (실제 PlayerSelector 그대로) */
function StealScene() {
  const picked = useDelayedFlag(1400)
  return (
    <StageCard id="gold-quest-steal" className="relative w-full max-w-2xl">
      <div style={{ zoom: 0.85 }}>
        <PlayerSelector
          players={RIVAL_PLAYERS}
          currentPlayerId="me"
          onSelect={() => {}}
          title="마법사의 계약서"
          description={`골드 ${toPercent(GOLD_STEAL_RATE.WIZARD)}%를 가져올 상대를 선택하세요. (15초)`}
          icon="🧙"
          iconImage={BOX_EVENT_IMAGE.WIZARD}
        />
      </div>
      {!picked && (
        <div className="pointer-events-none absolute left-[30%] top-[62%]">
          <TapPointer className="left-0 top-0" />
        </div>
      )}
      {picked && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16 }}
          className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-lg border border-emerald-300/80 bg-emerald-100/95 px-5 py-3 text-center text-base font-black text-emerald-900 shadow-lg"
        >
          {RIVALS[0].name}님의 골드 {STEAL_GAIN}을 가져왔다!
        </motion.div>
      )}
    </StageCard>
  )
}

/** 규칙 6 — 방어권이 있으면 함정·도둑을 막을지 물어봅니다 (실제 ShieldPromptModal 그대로) */
function ShieldScene() {
  const [expiresAt] = useState(() => Date.now() + 5000)
  const [answered, setAnswered] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setAnswered(true), 2400)
    return () => clearTimeout(timer)
  }, [])
  return (
    <StageCard id="gold-quest-shield" className="relative w-full max-w-2xl">
      <div style={{ zoom: 0.7 }}>
        <ChestView onChestSelect={() => {}} selectedChest={null} reward={null} isProcessing={false} />
      </div>
      {!answered ? (
        <>
          <ShieldPromptModal message={`${RIVALS[1].name}님이 엘프 효과를 사용했습니다.`} expiresAt={expiresAt} onAnswer={() => {}} />
          <div className="pointer-events-none absolute left-[62%] top-[70%] z-[95]">
            <TapPointer className="left-0 top-0" />
          </div>
        </>
      ) : (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16 }}
          className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto flex w-fit -translate-y-1/2 items-center gap-3 rounded-lg border border-emerald-300/80 bg-emerald-100/95 px-5 py-4 text-center text-lg font-black text-emerald-900 shadow-lg"
        >
          <Image src="/gold-quest/shield.webp" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          {RIVALS[1].name}님의 공격을 방어권으로 막았습니다!
        </motion.div>
      )}
    </StageCard>
  )
}

function chipsFor(phase: string): HudChip[] {
  const gold = GOLD_BY_PHASE[phase] ?? { value: START_GOLD }
  const hasShield = phase === 'shield' || phase === 'rank'
  return [
    { label: '골드', value: gold.value, from: gold.from, icon: '/gold-quest/gold-stack.webp', tone: 'default' },
    { label: '방어권', value: hasShield ? '보유' : '없음', icon: '/gold-quest/shield.webp', tone: hasShield ? 'emerald' : 'default' },
  ]
}

export default function GoldQuestTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="gold_quest"
      backgroundSrc="/background/gold-quest.webp"
      chips={chipsFor}
      notice={(phase) =>
        phase === 'shield' ? (
          /* 실제 화면의 shieldNotice 띠와 같은 클래스 */
          <div className="rounded-lg border border-emerald-300/80 bg-emerald-100/90 px-4 py-2 text-center text-sm font-black text-emerald-900 shadow-lg shadow-emerald-950/10 sm:text-base">
            {SHIELD_STREAK}연속 정답 - 방어권 획득!
          </div>
        ) : null
      }
      /* 규칙 7장과 1:1 — lib/game/tutorials.ts 의 gold_quest 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 2800, step: 1, caption: '퀴즈를 맞히고 보물 상자를 열어요' },
        { key: 'chest', duration: 2400, step: 2, caption: `상자 ${CHEST_COUNT}개 중 하나를 골라요` },
        { key: 'gold', duration: 3000, step: 3, caption: `황금 왕관을 찾았어요! +${CROWN_GOLD}골드` },
        { key: 'trap', duration: 2800, step: 4, caption: '드래곤을 만나면 골드가 절반 줄어요' },
        { key: 'steal', duration: 3200, step: 5, caption: `마법사로 친구 골드 ${toPercent(GOLD_STEAL_RATE.WIZARD)}%를 가져와요` },
        { key: 'shield', duration: 3200, step: 6, caption: `${SHIELD_STREAK}연속 정답이면 방어권으로 막아요` },
        { key: 'rank', duration: 3000, step: 7, caption: '골드가 가장 많으면 1등!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'chest') return <ChestScene key="chest" reward={null} />
        if (phase === 'gold') return <ChestScene key="gold" reward={CROWN_EVENT} />
        if (phase === 'trap') return <ChestScene key="trap" reward={DRAGON_EVENT} />
        if (phase === 'steal') return <StealScene key="steal" />
        if (phase === 'shield') return <ShieldScene key="shield" />
        return (
          <MiniLeaderboard
            key="rank"
            title="골드 순위"
            suffix="골드"
            rows={[
              { name: PLAYER_NAME, value: GOLD_AFTER_STEAL, me: true, avatar: PLAYER_AVATAR },
              { name: RIVALS[0].name, value: RIVAL_GOLD - STEAL_GAIN, avatar: RIVALS[0].avatar },
              { name: RIVALS[1].name, value: 90, avatar: RIVALS[1].avatar },
            ]}
          />
        )
      }}
    </TutorialDemoFrame>
  )
}
