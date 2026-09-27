'use client'

import { motion } from 'framer-motion'
import { Eye, Radio, Users } from 'lucide-react'
import QuizSetName from '@/components/game/QuizSetName'
import PixelIcon from '@/components/ui/PixelIcon'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  StageCard,
  TapPointer,
  DEMO_SET_NAME,
  PLAYER_NAME,
  RIVALS,
  useDelayedFlag,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 쉿! 마피아 — 실제 MafiaView 화면과 같은 재료로 그린다:
 *   검은 상단 바(타이머·자금·다이아) · 행동 선택 카드(금고 열기/친구 조사) · 금고 3개 · 조직원 목록 · 도청 장치 로그
 *   (components/MafiaView.tsx)
 * 장면 3개는 튜토리얼 규칙 3장과 1:1.
 */

const FONT = { fontFamily: "'DNFBitBitv2', sans-serif" } as const
const VAULT_CASH = 300

function MafiaHeader({ cash }: { cash: number }) {
  return (
    <div className="border-b-2 border-yellow-600 bg-black/80 shadow-lg backdrop-blur-sm" style={FONT}>
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-white">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-yellow-400">06:52</span>
          <span className="inline-flex items-center gap-1 text-base font-bold text-yellow-300"><PixelIcon name="gold" size={18} alt="" />${cash}</span>
          <span className="text-base font-bold text-cyan-300">💎 0</span>
        </div>
        <div className="flex items-center gap-2">
          <QuizSetName title={DEMO_SET_NAME} tone="dark" />
          <span className="inline-flex items-center gap-1 text-sm font-bold text-slate-300"><Users className="h-4 w-4" />4명</span>
        </div>
      </div>
    </div>
  )
}

/** 실제 행동 선택 카드 (MafiaView 의 actionSelect 와 같은 클래스) */
function ActionCard({ pointer }: { pointer: boolean }) {
  return (
    <div className="rounded-xl border-4 border-yellow-600 bg-black/90 p-5 text-center" style={FONT}>
      <h2 className="mb-4 text-2xl font-bold text-yellow-400">정답입니다. 다음 행동을 고르세요.</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative flex h-24 items-center justify-center rounded-md bg-yellow-500 text-xl font-black text-black">
          <span className="flex flex-col items-center gap-1.5"><span className="text-4xl">🔐</span>금고 열기</span>
          {pointer && <TapPointer />}
        </div>
        <div className="flex h-24 items-center justify-center rounded-md bg-blue-600 text-xl font-black text-white">
          <span className="flex flex-col items-center gap-1.5"><Eye className="h-8 w-8" />친구 조사</span>
        </div>
      </div>
    </div>
  )
}

/** 규칙 1 — 목표: 퀴즈를 맞히고 금고를 열어 자금을 가장 많이 모은다 */
function QuizScene() {
  const answered = useDelayedFlag(1000)
  const chosen = useDelayedFlag(2400)
  if (!chosen) {
    return (
      <GlassQuizStep
        question="비밀을 지킬 때 내는 소리는?"
        options={['쉿', '와', '쾅', '딩동']}
        correctIndex={0}
        answered={answered}
      />
    )
  }
  return (
    <StageCard id="mafia-action" className="w-full max-w-xl">
      <ActionCard pointer />
    </StageCard>
  )
}

/** 규칙 2 — 플레이 방식: 금고 3개 중 하나를 열고(몰래보기도 가능), 친구를 조사해 잡아낸다 */
function VaultScene() {
  const opened = useDelayedFlag(1500)
  const vaults = [
    { id: 0, label: '금고 1', revealed: false },
    { id: 1, label: '금고 2', revealed: opened },
    { id: 2, label: '금고 3', revealed: false },
  ]
  return (
    <StageCard id="mafia-vault" className="relative w-full max-w-xl">
      <div className="rounded-xl border-4 border-yellow-600 bg-black/90 p-5" style={FONT}>
        <h2 className="mb-4 text-center text-2xl font-bold text-yellow-400">금고를 선택하세요</h2>
        <div className="grid grid-cols-3 gap-3">
          {vaults.map((v) => (
            <motion.div
              key={v.id}
              animate={v.revealed ? { scale: [1, 1.08, 1] } : {}}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border-4 p-2 ${
                v.revealed ? 'border-cyan-400 bg-cyan-900' : 'border-yellow-600 bg-yellow-900'
              } ${opened && !v.revealed ? 'opacity-50' : ''}`}
            >
              {v.revealed ? (
                <>
                  <PixelIcon name="gold" size={44} alt="" />
                  <span className="mt-1 text-xl font-black text-yellow-300">${VAULT_CASH}</span>
                </>
              ) : (
                <>
                  <span className="text-4xl">🔐</span>
                  <span className="mt-1 text-sm font-bold text-yellow-100">{v.label}</span>
                </>
              )}
              {!opened && v.id === 1 && <TapPointer />}
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-bold text-slate-200">
          <Eye className="h-4 w-4" /> 금고 몰래보기 — 들키면 조사당해요
        </div>
      </div>
    </StageCard>
  )
}

/** 규칙 3 — 승리 기준: 시간이 끝났을 때 자금이 가장 많은 사람 */
function ResultScene() {
  const members = [
    { name: PLAYER_NAME, cash: VAULT_CASH, me: true },
    { name: RIVALS[0].name, cash: 200 },
    { name: RIVALS[1].name, cash: 120 },
    { name: RIVALS[2].name, cash: 60 },
  ]
  return (
    <StageCard id="mafia-result" className="grid w-full max-w-2xl gap-3 sm:grid-cols-[1fr_1.1fr]">
      <div className="rounded-lg border-l-2 border-yellow-600 bg-black/60 p-4" style={FONT}>
        <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-yellow-400"><Users className="h-6 w-6" /> 조직원</h2>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={m.name} className={`rounded-md border-2 p-3 ${m.me ? 'border-yellow-400 bg-yellow-950/40' : 'border-gray-700 bg-gray-900/70'}`}>
              <div className="text-sm font-bold text-white">#{i + 1} {m.name}</div>
              <div className="mt-1 text-lg font-black text-yellow-300">${m.cash.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border-t-2 border-yellow-600 bg-black/90 p-3 text-xs text-slate-200" style={FONT}>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-yellow-400"><Radio className="h-4 w-4" /> 도청 장치</div>
          <p className="text-yellow-200">[오후 4:17] {PLAYER_NAME}이(가) {RIVALS[0].name}을(를) 조사했습니다.</p>
          <p className="text-red-300">[오후 4:17] {RIVALS[0].name}이(가) 금고를 몰래본 게 들통났습니다! 자금 환수</p>
          <p className="text-slate-400">[오후 4:16] 게임이 시작되었습니다. 정답을 맞히고 금고를 열거나 친구를 조사하세요.</p>
        </div>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.7 }}
          className="rounded-xl border-4 border-yellow-500 bg-yellow-400 px-5 py-4 text-center text-xl font-black text-black shadow-2xl"
          style={FONT}
        >
          🏆 자금 ${VAULT_CASH} — {PLAYER_NAME} 1등!
        </motion.div>
      </div>
    </StageCard>
  )
}

export default function MafiaTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/mafia.webp"
      dim
      header={({ phase }) => <MafiaHeader cash={phase === 'result' ? VAULT_CASH : 0} />}
      /* 규칙 3장과 1:1 — lib/game/tutorials.ts 의 mafia 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 4000, step: 1, caption: '정답을 맞히면 금고를 열거나 친구를 조사해요' },
        { key: 'vault', duration: 3400, step: 2, caption: `금고 ${3}개 중 하나 — 몰래보다 들키면 자금을 뺏겨요` },
        { key: 'result', duration: 3400, step: 3, caption: '시간이 끝났을 때 자금이 가장 많으면 1등!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'vault') return <VaultScene key="vault" />
        return <ResultScene key="result" />
      }}
    </TutorialDemoFrame>
  )
}
