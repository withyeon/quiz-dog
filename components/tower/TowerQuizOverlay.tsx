'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { TOWER_QUIZZES_PER_WAVE } from '@/lib/game/tower'

interface TowerQuizOverlayProps {
    /** 이번 웨이브에서 이미 푼 퀴즈 수 */
    answered: number
    /** 그중 맞힌 수 */
    correct: number
    /** 연속 정답 수 (2 이상이면 보너스 배지가 뜬다) */
    consecutiveCorrect: number
    /** 문제 카드 (QuizView) */
    children: ReactNode
}

/**
 * 웨이브 퀴즈 화면: 작전 화면을 어둡게 덮고 위쪽에 진행 배지를 띄운다.
 * 게임(app/tower/page.tsx)과 튜토리얼 데모가 같이 쓴다.
 */
export default function TowerQuizOverlay({ answered, correct, consecutiveCorrect, children }: TowerQuizOverlayProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 pt-16 backdrop-blur-md sm:p-6 sm:pt-20"
        >
            {/* 가운데 정렬은 바깥 div 가 맡는다. 배지에 -translate-x-1/2 를 주면 framer-motion 의 y 애니메이션이
                transform 을 덮어써 배지가 오른쪽으로 반 칸 밀려 있었다 */}
            <div className="pointer-events-none absolute inset-x-0 top-8 flex flex-col items-center gap-2 px-4">
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2 text-base font-black text-white shadow-xl"
                >
                    웨이브 퀴즈 {Math.min(answered + 1, TOWER_QUIZZES_PER_WAVE)}/{TOWER_QUIZZES_PER_WAVE} · 정답 {correct}/{TOWER_QUIZZES_PER_WAVE}
                </motion.div>
                {consecutiveCorrect >= 2 && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-base font-black text-white shadow-xl"
                    >
                        🔥 {consecutiveCorrect}연속 정답! 스킬 보너스 대기 중
                    </motion.div>
                )}
            </div>
            <div className="my-auto w-full">{children}</div>
        </motion.div>
    )
}
