'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { Database } from '@/types/database.types'
import type { PlayerClass } from '@/lib/game/battleRoyale'

type Player = Database['public']['Tables']['players']['Row'] & {
  health?: number
  player_class?: PlayerClass
}

interface BattleArenaProps {
  players: Player[]
  currentPlayerId: string | null
  attackResult?: {
    attackerId: string
    targetId: string | null
    damage: number
    isCritical: boolean
  } | null
  onPlayerClick?: (playerId: string) => void
  canAttack?: boolean
}

export default function BattleArena({
  players,
  currentPlayerId,
  attackResult,
  onPlayerClick,
  canAttack = false,
}: BattleArenaProps) {
  // 체력 순으로 정렬 (높은 순)
  const sortedPlayers = [...players].sort((a, b) => {
    const healthA = a.health || 100
    const healthB = b.health || 100
    return healthB - healthA
  })

  const getHealthColor = (health: number) => {
    if (health > 70) return 'bg-green-500'
    if (health > 40) return 'bg-yellow-500'
    if (health > 0) return 'bg-red-500'
    return 'bg-gray-500'
  }

  const getHealthEmoji = (health: number) => {
    if (health > 70) return '🔥'
    if (health > 40) return '❄️'
    if (health > 0) return '🧊'
    return '⛄'
  }

  const getClassIcon = (playerClass?: PlayerClass) => {
    if (!playerClass) return '❄️'
    const classIcons: Record<PlayerClass, string> = {
      ice_fist: '🧊',
      rapid_fire: '💨',
      shield: '🛡️',
      hot_choco: '💊',
    }
    return classIcons[playerClass]
  }

  return (
    <div className="bg-gradient-to-br from-blue-900 via-cyan-800 to-blue-900 rounded-2xl p-6 shadow-2xl border-4 border-blue-400 relative overflow-hidden">
      {/* 눈 내리는 배경 효과 */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-white/10 to-transparent animate-pulse" />
        {/* 눈송이 애니메이션 */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-white text-2xl"
            style={{
              left: `${(i * 5) % 100}%`,
              top: `${-10 + (i * 3) % 20}%`,
            }}
            animate={{
              y: [0, window.innerHeight + 100],
              x: [0, Math.sin(i) * 50],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          >
            ❄️
          </motion.div>
        ))}
      </div>


      {/* 제목 */}
      <div className="relative z-10 text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
          <span className="text-3xl">❄️</span>
          배틀 아레나
        </h2>
        <p className="text-blue-200 text-xs">
          {sortedPlayers.filter(p => (p.health || 100) > 0).length}명 생존 중
        </p>
      </div>


      {/* 플레이어 목록 */}
      <div className="relative z-10 space-y-2">
        <AnimatePresence>
          {sortedPlayers.map((player, index) => {
            const health = player.health || 100
            const isAlive = health > 0
            const isCurrentPlayer = player.id === currentPlayerId
            const isAttacked = attackResult?.targetId === player.id
            const isAttacker = attackResult?.attackerId === player.id

            return (
              <motion.button
                key={player.id}
                onClick={() => {
                  if (canAttack && isAlive && !isCurrentPlayer && onPlayerClick) {
                    onPlayerClick(player.id)
                  }
                }}
                disabled={!canAttack || !isAlive || isCurrentPlayer}
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: isAlive ? 1 : 0.4,
                  x: 0,
                  scale: isAttacked ? [1, 1.05, 1] : 1,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
                whileHover={canAttack && isAlive && !isCurrentPlayer ? { scale: 1.02, x: 4 } : {}}
                className={`bg-white/10 backdrop-blur-sm rounded-lg p-3 border-2 transition-all ${isCurrentPlayer
                  ? 'border-yellow-400 shadow-lg shadow-yellow-400/30'
                  : isAlive
                    ? canAttack
                      ? 'border-blue-300 hover:border-green-400 cursor-pointer hover:bg-white/20'
                      : 'border-white/30'
                    : 'border-gray-500 opacity-40'
                  } ${isAttacked ? 'ring-2 ring-red-400 animate-pulse' : ''} ${!isAlive ? 'grayscale' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* 순위 배지 */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${index === 0 && isAlive
                    ? 'bg-yellow-400 text-yellow-900'
                    : index === 1 && isAlive
                      ? 'bg-gray-300 text-gray-800'
                      : index === 2 && isAlive
                        ? 'bg-amber-700 text-amber-100'
                        : isAlive
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-600 text-gray-300'
                    }`}>
                    {!isAlive ? '⛄' : index + 1}
                  </div>

                  {/* 아바타 */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <div className={`text-3xl ${!isAlive ? 'grayscale' : ''}`}>
                      {!isAlive ? '⛄' : player.avatar || '❄️'}
                    </div>
                    {player.player_class && isAlive && (
                      <div className="text-xs">
                        {getClassIcon(player.player_class)}
                      </div>
                    )}
                  </div>

                  {/* 플레이어 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-sm truncate ${isCurrentPlayer ? 'text-yellow-300' : 'text-white'
                        }`}>
                        {player.nickname}
                        {isCurrentPlayer && ' 👈'}
                      </span>
                      {isAttacker && (
                        <motion.span
                          initial={{ scale: 0, rotate: 0 }}
                          animate={{ scale: [0, 1.2, 1], rotate: [0, 180] }}
                          className="text-xl"
                        >
                          ❄️
                        </motion.span>
                      )}
                      {canAttack && isAlive && !isCurrentPlayer && (
                        <motion.span
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="text-xs bg-green-500 px-2 py-0.5 rounded text-white font-bold"
                        >
                          공격!
                        </motion.span>
                      )}
                    </div>

                    {/* 체력 바 */}
                    <div className="relative h-3">
                      <div className="h-full bg-gray-700/80 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: `${health}%` }}
                          animate={{ width: `${health}%` }}
                          transition={{ duration: 0.3 }}
                          className={`h-full ${getHealthColor(health)} transition-colors`}
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white drop-shadow-lg">
                          {getHealthEmoji(health)} {health}°C
                        </span>
                      </div>
                    </div>

                    {/* 공격 피드백 */}
                    {isAttacked && attackResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`mt-1 text-center font-bold text-xs ${attackResult.isCritical
                          ? 'text-yellow-300'
                          : 'text-red-300'
                          }`}
                      >
                        {attackResult.isCritical ? '💥 크리티컬! ' : '❄️ '} -{attackResult.damage}°C
                      </motion.div>
                    )}
                  </div>

                  {/* 점수 */}
                  <div className="text-right shrink-0">
                    <div className="text-white font-bold text-sm">
                      {player.score}
                    </div>
                    {!isAlive ? (
                      <div className="text-[10px] text-red-300 font-semibold">
                        탈락
                      </div>
                    ) : (
                      <div className="text-[10px] text-green-300 font-semibold">
                        생존
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      {/* 생존자 수 표시 */}
      <div className="relative z-10 mt-4 text-center">
        <div className="bg-blue-900/50 rounded-lg p-2 inline-block border-2 border-blue-400">
          <span className="text-white font-bold text-sm">
            ❄️ {sortedPlayers.filter(p => (p.health || 100) > 0).length} / {sortedPlayers.length}명
          </span>
        </div>
      </div>
    </div>
  )
}
