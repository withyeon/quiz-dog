'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { STORE_BRAND_ICON } from '@/lib/game/storeAssets'

/** 선생님이 시작하기 전 대기 패널. */
export default function StoreLobbyPanel() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white/90 rounded-xl p-8 shadow-lg text-center"
    >
      <div className="mb-4 flex items-center justify-center gap-3">
        <Image src={STORE_BRAND_ICON} alt="편의점" width={48} height={48} unoptimized className="object-contain" />
        <h2 className="text-3xl font-bold">전설의 편의점</h2>
      </div>
      <p className="text-gray-600">3문제마다 상품을 받고, 9칸을 채운 뒤 더 좋은 상품으로 교체하세요!</p>
      <p className="text-sm text-gray-500 mt-2">선생님이 게임을 시작할 때까지 기다려주세요.</p>
    </motion.div>
  )
}
