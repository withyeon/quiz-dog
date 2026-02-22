// ⚠️ 이 컴포넌트는 선생님 대시보드(teacher/dashboard)의 인형뽑기 게임 현황 표시 전용입니다.
// 실제 플레이어용 인형뽑기 기계는 FishingMachine.tsx를 사용하세요.
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { Database } from '@/types/database.types'
import type { Doll } from '@/lib/game/fishing'
import { getTierColor, getTierName } from '@/lib/game/fishing'

type Player = Database['public']['Tables']['players']['Row'] & {
  caught_dolls?: Doll[]
  claw_points?: number
}

interface FishingPondProps {
  players: Player[]
  currentPlayerId: string | null
  currentPlayerCaughtDolls?: Doll[]
}

export default function FishingPond({
  players,
  currentPlayerId,
  currentPlayerCaughtDolls = [],
}: FishingPondProps) {
  // 점수 순으로 정렬
  const sortedPlayers = [...players].sort((a, b) => {
    const pointsA = (a as Player).claw_points || 0
    const pointsB = (b as Player).claw_points || 0
    return pointsB - pointsA
  })

  return (
    <div className="bg-gradient-to-b from-blue-400 via-blue-300 to-blue-500 rounded-2xl p-6 shadow-2xl border-4 border-blue-600 relative overflow-hidden">
      {/* 물결 애니메이션 */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bottom-0 w-full h-20 bg-white/20"
            style={{ left: `${i * 33}%` }}
            animate={{
              x: [0, 100, 0],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* 연못 제목 */}
      <div className="relative z-10 mb-6">
        <h3 className="text-2xl font-bold text-white text-center mb-2 flex items-center justify-center gap-2">
          <span className="text-3xl">🕹️</span>
          <span>인형뽑기 현황</span>
        </h3>
        <p className="text-white/80 text-center text-sm">
          정답을 맞추면 인형뽑기 기회가 생겨요!
        </p>
      </div>

      {/* 플레이어 순위 */}
      <div className="relative z-10 space-y-3">
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.id === currentPlayerId
          const points = (player as Player).claw_points || 0
          const caughtDolls = ((player as Player).caught_dolls as Doll[]) || []
          const dollCount = caughtDolls.length

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border-2 ${isCurrentPlayer
                  ? 'border-yellow-500 shadow-yellow-500/50 scale-105'
                  : 'border-gray-300'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* 순위 */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${index === 0
                        ? 'bg-yellow-500'
                        : index === 1
                          ? 'bg-gray-400'
                          : index === 2
                            ? 'bg-orange-600'
                            : 'bg-gray-500'
                      }`}
                  >
                    {index + 1}
                  </div>

                  {/* 아바타 */}
                  <div className="text-3xl">{player.avatar || '🐕'}</div>

                  {/* 닉네임 */}
                  <div>
                    <div className="font-bold text-gray-900">
                      {player.nickname}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-yellow-500">⭐</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      인형 {dollCount}개
                    </div>
                  </div>
                </div>

                {/* 점수 */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {points}점
                  </div>
                  <div className="text-xs text-gray-500">총 점수</div>
                </div>
              </div>

              {/* 뽑은 인형 미리보기 */}
              {caughtDolls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex gap-2 flex-wrap">
                    {caughtDolls.slice(-5).map((doll, dollIndex) => (
                      <motion.div
                        key={dollIndex}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`${getTierColor(
                          doll.tier
                        )} text-white px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1`}
                      >
                        <span>{doll.emoji}</span>
                        <span>{doll.name}</span>
                      </motion.div>
                    ))}
                    {caughtDolls.length > 5 && (
                      <div className="text-xs text-gray-500 flex items-center">
                        +{caughtDolls.length - 5}개
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* 현재 플레이어의 뽑은 인형 상세 */}
      {currentPlayerCaughtDolls.length > 0 && (
        <div className="relative z-10 mt-6 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border-2 border-yellow-500">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span>🕹️</span>
            <span>내가 뽑은 인형</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {currentPlayerCaughtDolls.map((doll, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: index * 0.1, type: 'spring' }}
                className={`${getTierColor(
                  doll.tier
                )} text-white p-3 rounded-lg text-center shadow-md`}
              >
                <div className="text-3xl mb-1">{doll.emoji}</div>
                <div className="text-xs font-bold mb-1">{doll.name}</div>
                <div className="text-xs opacity-90">
                  {getTierName(doll.tier)}
                </div>
                <div className="text-xs font-bold mt-1">+{doll.score}점</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
