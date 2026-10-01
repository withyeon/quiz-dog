'use client'

import { AnimatePresence, motion } from 'framer-motion'
import QuizView from '@/components/QuizView'
import { SUMMITS } from '@/lib/game/dontlookdown'
import type { DontLookDownQuestion, QuizFeedback } from '@/components/dontlookdown/types'

/** 정답·오답·추락 피드백 띠 (위 가운데). */
export function FeedbackToast({ feedback }: { feedback: QuizFeedback | null }) {
    return (
        <AnimatePresence>
            {feedback && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -12 }}
                    className={`absolute top-24 left-1/2 -translate-x-1/2 rounded-xl px-6 py-3 text-xl font-black text-white shadow-2xl ${
                        feedback.tone === 'good'
                            ? 'bg-emerald-500'
                            : 'bg-rose-500'
                    }`}
                >
                    {feedback.text}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/** 새 구역에 올라섰을 때 가운데에 뜨는 축하. */
export function SummitAlert({ summit }: { summit: number | null }) {
    return (
        <AnimatePresence>
            {summit && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 50 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                >
                    <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white px-12 py-6 rounded-2xl shadow-2xl">
                        <div className="text-4xl font-bold text-center mb-2">
                            🏔️ 구역 {summit} 도달!
                        </div>
                        <div className="text-xl text-center opacity-90">
                            {SUMMITS[summit - 1]?.name}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/** 오른쪽에 미끄러져 들어오는 빠른 충전 퀴즈. 열려 있는 동안 게임 루프는 그리기만 한다. */
export function QuizPanel({
    open,
    question,
    onAnswer,
    onClose,
}: {
    open: boolean
    question: DontLookDownQuestion | null
    onAnswer: (answer: string) => Promise<boolean>
    onClose: () => void
}) {
    return (
        <AnimatePresence>
            {open && question && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-4 top-24 z-50 w-[min(420px,calc(100%-2rem))]"
                >
                    <motion.div
                        initial={{ opacity: 0, x: 40, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 40, scale: 0.96 }}
                        className="rounded-2xl border-4 border-sky-300 bg-white/95 p-3 shadow-2xl pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-2 flex items-center justify-between px-1">
                            <div className="text-sm font-black text-sky-700">
                                빠른 충전 퀴즈
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                            >
                                닫기
                            </button>
                        </div>
                        <QuizView
                            question={question}
                            onAnswer={onAnswer}
                            timeLimit={30}
                            variant="glass"
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
