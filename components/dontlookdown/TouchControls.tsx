'use client'

import { motion } from 'framer-motion'
import type { GameKey } from '@/components/dontlookdown/useGameInput'

type TouchControlsProps = {
    onPress: (key: GameKey) => void
    onRelease: (key: GameKey) => void
    onOpenQuiz: () => void
}

function HoldButton({
    gameKey,
    label,
    ariaLabel,
    className,
    onPress,
    onRelease,
}: {
    gameKey: GameKey
    label: string
    ariaLabel: string
    className: string
    onPress: (key: GameKey) => void
    onRelease: (key: GameKey) => void
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => { e.preventDefault(); onPress(gameKey) }}
            onPointerUp={() => onRelease(gameKey)}
            onPointerLeave={() => onRelease(gameKey)}
            onPointerCancel={() => onRelease(gameKey)}
            className={className}
        >
            {label}
        </button>
    )
}

const MOVE_BUTTON = 'flex h-14 w-14 sm:h-16 sm:w-16 touch-none items-center justify-center rounded-2xl bg-white/85 text-3xl font-black text-slate-700 shadow-lg active:bg-white'

/** 터치 기기용 화면 버튼. 키보드와 같은 keysRef 입력 모델을 쓴다. */
export function TouchControls({ onPress, onRelease, onOpenQuiz }: TouchControlsProps) {
    return (
        <div className="absolute inset-x-2 bottom-3 z-40 flex select-none items-end justify-between gap-2 pointer-events-none">
            {/* 좌우 이동 */}
            <div className="flex gap-2 pointer-events-auto">
                <HoldButton gameKey="left" label="←" ariaLabel="왼쪽 이동" className={MOVE_BUTTON} onPress={onPress} onRelease={onRelease} />
                <HoldButton gameKey="right" label="→" ariaLabel="오른쪽 이동" className={MOVE_BUTTON} onPress={onPress} onRelease={onRelease} />
            </div>

            {/* 퀴즈 */}
            <button
                type="button"
                onClick={onOpenQuiz}
                className="pointer-events-auto shrink-0 whitespace-nowrap rounded-2xl bg-sky-500 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-black text-white shadow-lg active:bg-sky-600"
            >
                퀴즈 풀기
            </button>

            {/* 질주 + 점프 */}
            <div className="flex items-end gap-2 pointer-events-auto">
                <HoldButton
                    gameKey="shift"
                    label="질주"
                    ariaLabel="질주"
                    className="flex h-12 w-12 sm:h-14 sm:w-14 touch-none items-center justify-center rounded-2xl bg-white/85 text-xs font-black text-slate-700 shadow-lg active:bg-white"
                    onPress={onPress}
                    onRelease={onRelease}
                />
                <HoldButton
                    gameKey="jump"
                    label="점프"
                    ariaLabel="점프"
                    className="flex h-16 w-16 sm:h-20 sm:w-20 touch-none items-center justify-center rounded-full bg-amber-400 text-base font-black text-amber-950 shadow-xl active:bg-amber-500"
                    onPress={onPress}
                    onRelease={onRelease}
                />
            </div>
        </div>
    )
}

/** 키보드 기기용: 퀴즈 버튼 + 조작법 안내. */
export function KeyboardControls({ onOpenQuiz }: { onOpenQuiz: () => void }) {
    return (
        <>
            <motion.button
                onClick={onOpenQuiz}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="absolute bottom-4 left-4 bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg pointer-events-auto"
            >
                퀴즈 풀기
            </motion.button>

            <div className="absolute bottom-4 right-4 hidden md:block bg-black/70 text-white px-4 py-3 rounded-xl text-sm space-y-1">
                <div>←/→ 이동 · ↑/스페이스 점프</div>
                <div>⇧ 질주 · Q 퀴즈</div>
                <div>E/R 파워업 사용</div>
            </div>
        </>
    )
}
