// ⚠️ 이 컴포넌트는 선생님 대시보드(teacher/dashboard)의 편의점 게임 순위 뷰 전용입니다.
// 실제 플레이어용 편의점 화면은 ConvenienceStore.tsx를 사용하세요.
'use client'

import { motion } from 'framer-motion'
import type { Database } from '@/types/database.types'
import {
  calculateTotalCPS,
  formatMoney,
  type Product,
} from '@/lib/game/convenienceStore'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'

type Player = Database['public']['Tables']['players']['Row'] & {
  factory_money?: number
  convenience_products?: unknown[] | null
  convenience_money?: number
}

interface FactoryViewProps {
  players: Player[]
  currentPlayerId: string | null
}

function getPlayerProducts(player: Player): Product[] {
  return Array.isArray(player.convenience_products)
    ? (player.convenience_products as Product[])
    : []
}

function getPlayerMoney(player: Player): number {
  return player.convenience_money ?? player.factory_money ?? player.score ?? 0
}

export default function FactoryView({
  players,
  currentPlayerId,
}: FactoryViewProps) {
  const sortedPlayers = [...players].sort((a, b) => getPlayerMoney(b) - getPlayerMoney(a))

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-200">
      <h3 className="text-xl font-bold mb-4">📊 부자 순위</h3>
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => {
          const playerMoney = getPlayerMoney(player)
          const products = getPlayerProducts(player)
          const productCount = products.length
          const legendaryCount = products.filter((p) => p?.tier === '전설').length
          const cps = calculateTotalCPS(products)
          const displayNickname = getPlayerDisplayNickname(player.nickname, player.avatar)

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                player.id === currentPlayerId
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    index === 0
                      ? 'bg-yellow-500 text-yellow-900'
                      : index === 1
                        ? 'bg-gray-400 text-white'
                        : index === 2
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-500 text-white'
                  }`}
                >
                  {index + 1}
                </div>
                <PlayerAvatarDisplay
                  avatar={player.avatar}
                  nickname={displayNickname}
                  fallback="🐕"
                  className="relative h-11 w-11 overflow-hidden rounded-xl bg-white text-2xl ring-1 ring-gray-200"
                  sizes="44px"
                />
                <div>
                  <div className="font-bold text-gray-900">
                    {displayNickname}
                    {player.id === currentPlayerId && (
                      <span className="ml-2 text-yellow-500">⭐</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-600">
                    <span>상품 {productCount}개</span>
                    {legendaryCount > 0 && (
                      <span className="font-bold text-amber-600">· 전설 {legendaryCount}</span>
                    )}
                    <span className="text-green-600">· ⚡ {formatMoney(cps)}/초</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {playerMoney.toLocaleString()}원
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
