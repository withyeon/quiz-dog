'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MousePointer2 } from 'lucide-react'
import { useDemoPhaseIndex } from '@/components/tutorial/TutorialDemoFrame'

/**
 * 해적왕의 보물찾기 — 자동 재생되는 "플레이 영상" 데모.
 * 실제 게임 루프(퀴즈 → 정답 → 보물상자 선택 → 골드 보상 → 순위 상승)를
 * 실제 에셋으로 재현하여 반복 재생한다.
 */

type Phase = 'quiz' | 'correct' | 'chests' | 'reward' | 'score'

const PHASES: { key: Phase; duration: number; step: number; caption: string }[] = [
  { key: 'quiz', duration: 2000, step: 1, caption: '퀴즈가 나오면 정답을 골라요' },
  { key: 'correct', duration: 1700, step: 2, caption: '정답! 보물 상자를 열 기회를 얻어요' },
  { key: 'chests', duration: 1700, step: 3, caption: '상자 3개 중 하나를 골라요' },
  { key: 'reward', duration: 2400, step: 4, caption: '상자를 열면 골드 보상이 쏟아져요' },
  { key: 'score', duration: 2600, step: 5, caption: '골드를 모아 순위를 올려요. 1등이 목표!' },
]

const QUIZ = {
  question: '세종대왕이 백성을 위해 만든 글자는?',
  options: ['한글', '한자', '알파벳', '가나'],
  correctIndex: 0,
}

const BASE_GOLD = 120
const REWARD_GOLD = 40
const REWARD_IMAGE = '/gold-quest/gold-pile.svg'

function CountUp({ from, to, duration = 1200 }: { from: number; to: number; duration?: number }) {
  const [value, setValue] = useState(from)
  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, duration])
  return <>{value.toLocaleString()}</>
}

/** 손가락 탭 포인터 + 물결 효과 */
function TapPointer() {
  return (
    <motion.div
      className="pointer-events-none absolute -bottom-3 -right-2 z-20"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 18 }}
    >
      <motion.span
        className="absolute inset-0 -m-3 rounded-full bg-sky-400/40"
        initial={{ scale: 0.4, opacity: 0.7 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-sky-400">
        <MousePointer2 className="h-5 w-5 text-sky-500" />
      </div>
    </motion.div>
  )
}

export default function GoldQuestTutorialDemo() {
  // 선생님이 규칙을 넘기면 그 순서를 따라가고, 아니면 스스로 넘어간다.
  const { phaseIndex, cycle } = useDemoPhaseIndex(PHASES)

  const phase = PHASES[phaseIndex].key

  const showQuiz = phase === 'quiz' || phase === 'correct'
  const showChests = phase === 'chests' || phase === 'reward'
  const showScore = phase === 'score'
  const isCorrect = phase === 'correct'
  const isReward = phase === 'reward'
  const goldNow = phase === 'reward' || phase === 'score' ? BASE_GOLD + REWARD_GOLD : BASE_GOLD

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl">
      {/* 배경 */}
      <Image
        src="/background/gold-quest.png"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 720px"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b2230]/55 via-[#0b2230]/30 to-[#0b2230]/70" />

      {/* HUD */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-7">
        <div className="flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 shadow-lg ring-1 ring-amber-200 backdrop-blur">
          <div className="relative h-7 w-7 overflow-hidden rounded-full bg-amber-100">
            <Image src="/assets/icons/mascot-pome-64.png" alt="밤톨이" fill className="object-contain" sizes="28px" />
          </div>
          <span className="text-sm font-black text-[#17262a]">밤톨이</span>
        </div>
        <motion.div
          key={`${goldNow}-${cycle}`}
          initial={{ scale: goldNow > BASE_GOLD ? 1.25 : 1 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          className="flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 shadow-lg ring-1 ring-amber-300 backdrop-blur"
        >
          <Image src="/gold-quest/gold-stack.svg" alt="" width={22} height={22} className="h-5 w-5" />
          <span className="text-base font-black tabular-nums text-amber-600">
            {phase === 'reward' || phase === 'score'
              ? <CountUp from={BASE_GOLD} to={goldNow} />
              : goldNow.toLocaleString()}
            <span className="ml-0.5 text-xs text-amber-500">G</span>
          </span>
        </motion.div>
      </div>

      {/* 무대 */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-4 sm:px-8">
        <AnimatePresence mode="wait">
          {showQuiz && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="lg-panel lg-ink-outline font-bitbit w-full max-w-xl p-5 sm:p-6"
            >
              <h3 className="lg-question-title text-center text-lg font-black leading-snug sm:text-xl">
                {QUIZ.question}
              </h3>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {QUIZ.options.map((option, index) => {
                  const isAnswer = index === QUIZ.correctIndex
                  const correctState = isCorrect && isAnswer
                  const dim = isCorrect && !isAnswer
                  return (
                    <div
                      key={option}
                      className={`lg-option relative flex items-center justify-center px-4 py-4 text-base font-black text-white sm:text-lg ${
                        correctState ? 'lg-option-correct' : dim ? 'lg-option-dim' : 'lg-option-idle'
                      }`}
                    >
                      {option}
                      {correctState && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </motion.span>
                      )}
                      {correctState && <TapPointer />}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {showChests && (
            <motion.div
              key="chests"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-full max-w-2xl"
            >
              <p className="mb-4 text-center text-base font-black text-white drop-shadow sm:text-lg">
                보물 상자 선택 🏴‍☠️
              </p>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[0, 1, 2].map((i) => {
                  const opened = isReward && i === 1
                  return (
                    <motion.div
                      key={i}
                      animate={opened ? { y: [0, -10, 0] } : {}}
                      transition={{ duration: 0.5 }}
                      className={`relative flex min-h-[150px] flex-col items-center justify-center rounded-2xl border-2 p-3 shadow-xl backdrop-blur sm:min-h-[180px] ${
                        opened
                          ? 'border-amber-400 bg-amber-50/95'
                          : isReward
                            ? 'border-white/40 bg-white/30 opacity-60'
                            : 'border-amber-200/70 bg-white/85'
                      }`}
                    >
                      <Image
                        src={opened ? REWARD_IMAGE : '/gold-quest/quest.svg'}
                        alt=""
                        width={110}
                        height={110}
                        className="h-20 w-20 drop-shadow-lg sm:h-24 sm:w-24"
                      />
                      {opened ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-center"
                        >
                          <div className="text-sm font-black text-amber-700">반짝이는 주머니</div>
                          <div className="text-lg font-black text-emerald-600">+{REWARD_GOLD} G</div>
                        </motion.div>
                      ) : (
                        <div className="mt-2 text-sm font-black text-slate-500">{i + 1}번 상자</div>
                      )}
                      {phase === 'chests' && i === 1 && <TapPointer />}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {showScore && (
            <motion.div
              key="score"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-full max-w-sm rounded-2xl border border-amber-200/70 bg-white/92 p-5 shadow-2xl backdrop-blur"
            >
              <p className="mb-4 text-center text-sm font-black text-slate-400">실시간 골드 순위</p>
              <div className="space-y-2.5">
                {[
                  { rank: 1, name: '밤톨이', gold: goldNow, me: true },
                  { rank: 2, name: '냥냥이', gold: 150, me: false },
                  { rank: 3, name: '뽀삐', gold: 90, me: false },
                ].map((row) => (
                  <motion.div
                    key={row.name}
                    layout
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      row.me ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-black ${row.rank === 1 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-base font-black text-[#17262a]">{row.name}</span>
                    </div>
                    <span className="text-base font-black tabular-nums text-amber-600">
                      {row.gold.toLocaleString()} G
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 캡션 / 진행 표시 */}
      <div className="relative z-10 px-5 pb-5 sm:px-7">
        <div className="flex items-center gap-1.5">
          {PHASES.map((p, i) => (
            <div
              key={p.key}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === phaseIndex ? 'bg-amber-400' : i < phaseIndex ? 'bg-amber-400/50' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-3 flex items-center justify-center gap-2.5 rounded-full bg-black/45 px-4 py-2.5 backdrop-blur"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-[#17262a]">
              {PHASES[phaseIndex].step}
            </span>
            <span className="text-sm font-black text-white sm:text-base">{PHASES[phaseIndex].caption}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
