'use client'

import { motion } from 'framer-motion'

/**
 * 웨이브를 막아 냈을 때 맵 위에 뜨는 알림.
 * 게임(app/tower/page.tsx)과 튜토리얼 데모가 같이 쓴다. AnimatePresence 안에 key 와 함께 넣는다.
 */
export default function TowerWaveClearToast({ wave }: { wave: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center"
        >
            <div className="flex items-center gap-3 rounded-full bg-emerald-500 px-8 py-4 shadow-2xl shadow-emerald-300">
                <span className="text-3xl">⚔️</span>
                <span className="text-xl font-black text-white">웨이브 {wave} 클리어!</span>
            </div>
        </motion.div>
    )
}
