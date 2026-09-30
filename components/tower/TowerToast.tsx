'use client'

import { motion } from 'framer-motion'

/**
 * 화면 위쪽에 잠깐 뜨는 안내 (아이템 챙김 · 발동 · 못 쓰는 이유).
 * 게임(app/tower/page.tsx)과 튜토리얼 데모가 같이 쓴다. AnimatePresence 안에 key 와 함께 넣는다.
 */
export default function TowerToast({ message }: { message: string }) {
    // 가운데 정렬은 바깥 div 가 맡는다 (framer-motion 의 y 애니메이션이 -translate-x-1/2 를 덮어쓰기 때문)
    return (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: -18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 0.96 }}
                className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white shadow-2xl"
            >
                {message}
            </motion.div>
        </div>
    )
}
