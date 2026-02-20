'use client'

import { motion } from 'framer-motion'
import type { Database } from '@/types/database.types'
import {
  getCurrentStage,
  getCurrentWeather,
  TRACK_LENGTH,
  MAP_STAGES,
  type Obstacle,
  OBSTACLE_INFO,
} from '@/lib/game/schoolRacing'

type Player = Database['public']['Tables']['players']['Row'] & {
  position?: number
  lane?: number  // 추가: 차선 정보
}

interface SchoolRacingTrackProps {
  players: Player[]
  currentPlayerId: string | null
  obstacles?: Obstacle[]  // 추가: 장애물
  trackLength?: number
}

export default function SchoolRacingTrack({
  players,
  currentPlayerId,
  obstacles = [],
  trackLength = TRACK_LENGTH,
}: SchoolRacingTrackProps) {
  // 위치 순으로 정렬
  const sortedPlayers = [...players].sort((a, b) => {
    const posA = a.position || 0
    const posB = b.position || 0
    return posB - posA
  })

  const maxPosition = Math.max(...players.map(p => p.position || 0), 0)
  const finishLine = trackLength

  // 현재 플레이어 정보
  const currentPlayer = players.find(p => p.id === currentPlayerId)
  const currentStage = currentPlayer ? getCurrentStage(currentPlayer.position || 0) : MAP_STAGES[0]
  const currentWeather = currentPlayer ? getCurrentWeather(currentPlayer.position || 0) : null

  // 화면에 표시할 장애물 (현재 플레이어 기준 앞뒤 20m)
  const visibleObstacles = obstacles.filter(obs => {
    const playerPos = currentPlayer?.position || 0
    return obs.isActive && Math.abs(obs.position - playerPos) < 20
  })

  return (
    <div className="relative w-full rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-500">
      {/* 진행바 (상단) */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-blue-600 to-green-600 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-2xl">🏠</span>
          <span className="text-sm">집</span>
        </div>

        {/* 플레이어 위치 표시 */}
        <div className="flex-1 relative h-8 mx-4">
          {sortedPlayers.map((player, index) => {
            const position = player.position || 0
            const percentage = Math.min((position / finishLine) * 100, 100)
            const isCurrentPlayer = player.id === currentPlayerId

            return (
              <motion.div
                key={player.id}
                initial={{ left: '0%' }}
                animate={{ left: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`absolute transform -translate-x-1/2 ${isCurrentPlayer ? 'z-20' : 'z-10'
                  }`}
              >
                <div className={`text-2xl ${isCurrentPlayer ? 'scale-125' : ''}`}>
                  {player.avatar || '🏃'}
                </div>
                {isCurrentPlayer && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-yellow-300 bg-black/70 px-2 py-1 rounded whitespace-nowrap">
                    {player.nickname}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-sm">학교</span>
          <span className="text-2xl">🏫</span>
        </div>
      </div>

      {/* 날씨 표시 */}
      {currentWeather && (
        <div className="absolute top-20 right-4 z-40 bg-black/60 text-white px-3 py-2 rounded-lg flex items-center gap-2">
          <span className="text-2xl">{currentWeather.emoji}</span>
          <div>
            <div className="text-xs font-bold">{currentWeather.name}</div>
            <div className="text-xs opacity-80">속도 {Math.floor(currentWeather.speedModifier * 100)}%</div>
          </div>
        </div>
      )}

      {/* 배경 - 스테이지별 변경 */}
      <div className={`absolute inset-0 mt-16 ${currentStage.stage === 'home'
          ? 'bg-gradient-to-b from-pink-200 via-orange-200 to-yellow-200'
          : currentStage.stage === 'city'
            ? 'bg-gradient-to-b from-gray-300 via-gray-400 to-gray-500'
            : 'bg-gradient-to-b from-green-300 via-green-400 to-green-500'
        }`}>
        {/* 날씨 효과 */}
        {currentWeather?.type === 'RAINY' && (
          <>
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-4 bg-blue-400 opacity-60"
                style={{ left: `${i * 5}%` }}
                animate={{ y: [0, 600] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </>
        )}

        {currentWeather?.type === 'STORM' && (
          <>
            {/* 번개 효과 */}
            <motion.div
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
              className="absolute inset-0 bg-yellow-200/30"
            />
          </>
        )}

        {/* 스테이지별 배경 요소 */}
        {currentStage.stage === 'home' && (
          <>
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-6xl opacity-30"
                style={{ left: `${20 + i * 30}%`, top: '20%' }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3 + i, repeat: Infinity }}
              >
                🏠
              </motion.div>
            ))}
          </>
        )}

        {currentStage.stage === 'city' && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-5xl opacity-40"
                style={{ left: `${15 + i * 20}%`, top: '10%' }}
              >
                🏢
              </motion.div>
            ))}
          </>
        )}

        {currentStage.stage === 'school' && (
          <>
            <motion.div
              className="absolute right-10 top-10 text-8xl opacity-50"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🏫
            </motion.div>
          </>
        )}
      </div>

      {/* 3차선 도로 시스템 */}
      <div className="relative h-48 bg-gradient-to-b from-gray-600 via-gray-700 to-gray-800 mt-16">
        {/* 차선 구분선 */}
        <div className="absolute inset-0">
          {/* 상단 차선 경계 */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-white opacity-50" />
          {/* 중간 차선 경계 */}
          <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-yellow-400 opacity-70" />
          <div className="absolute top-2/3 left-0 right-0 h-0.5 bg-yellow-400 opacity-70" />
          {/* 하단 차선 경계 */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white opacity-50" />

          {/* 중앙선 애니메이션 */}
          <motion.div
            className="absolute top-1/2 transform -translate-y-1/2 h-1 left-0 right-0"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, yellow 0px, yellow 40px, transparent 40px, transparent 80px)',
            }}
            animate={{ backgroundPosition: ['0px 0px', '80px 0px'] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* 장애물 표시 */}
        {visibleObstacles.map(obstacle => {
          const playerPos = currentPlayer?.position || 0
          const relativePos = obstacle.position - playerPos
          const screenX = 50 + (relativePos / 20) * 40 // 화면 중앙 기준

          if (screenX < 0 || screenX > 100) return null

          const laneY = 16 + obstacle.lane * 33.3 // 차선별 Y 위치 (%)
          const info = OBSTACLE_INFO[obstacle.type]

          return (
            <motion.div
              key={obstacle.id}
              className="absolute transform -translate-x-1/2"
              style={{
                left: `${screenX}%`,
                top: `${laneY}%`,
              }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              {/* 장애물 아이콘 */}
              <div className="text-4xl drop-shadow-lg">
                {info.emoji}
              </div>
              {/* 경고 표시 (가까워지면) */}
              {Math.abs(relativePos) < 5 && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="absolute -top-6 left-1/2 transform -translate-x-1/2  text-red-500 text-xl"
                >
                  ⚠️
                </motion.div>
              )}
            </motion.div>
          )
        })}

        {/* 플레이어들 */}
        <div className="relative h-full">
          {sortedPlayers.map((player, index) => {
            const position = player.position || 0
            const percentage = Math.min((position / finishLine) * 100, 100)
            const isCurrentPlayer = player.id === currentPlayerId
            const isFinished = position >= finishLine
            const lane = player.lane || 1 // 기본 중간 차선
            const laneY = 16 + lane * 33.3

            return (
              <motion.div
                key={player.id}
                className={`absolute left-1/2 transform -translate-x-1/2 ${isCurrentPlayer ? 'z-20' : 'z-10'
                  }`}
                style={{
                  top: `${laneY}%`,
                }}
                animate={{ top: `${laneY}%` }}
                transition={{ duration: 0.3 }}
              >
                <div className={`relative ${isCurrentPlayer ? 'scale-125' : 'scale-100'
                  }`}>
                  {/* 흙먼지 효과 */}
                  {percentage > 5 && (
                    <>
                      <motion.div
                        animate={{
                          opacity: [0.3, 0.8, 0.3],
                          x: [-10, -20, -10]
                        }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                        className="absolute -left-8 top-1/2 transform -translate-y-1/2 text-3xl"
                      >
                        💨
                      </motion.div>
                    </>
                  )}

                  {/* 캐릭터 */}
                  <motion.div
                    animate={isFinished ? {
                      scale: [1, 1.3, 1],
                      rotate: [0, 360],
                    } : {
                      y: [0, -3, 0],
                    }}
                    transition={{
                      duration: isFinished ? 0.5 : 1,
                      repeat: isFinished ? 0 : Infinity,
                    }}
                    className={`relative ${isCurrentPlayer ? 'drop-shadow-2xl' : 'drop-shadow-lg'
                      }`}
                  >
                    <div className="relative text-4xl">
                      {player.avatar || '🏃'}
                      {/* 식빵 */}
                      <motion.div
                        animate={{ y: [0, -2, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xl"
                      >
                        🍞
                      </motion.div>
                      {/* 가방 */}
                      <div className="absolute -bottom-2 right-0 text-lg">
                        🎒
                      </div>
                    </div>

                    {/* 속도 효과 */}
                    {isCurrentPlayer && percentage > 20 && (
                      <motion.div
                        animate={{
                          rotate: [0, 360],
                          scale: [1, 1.3, 1]
                        }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="absolute -top-2 -right-2 text-xl z-10"
                      >
                        ⚡
                      </motion.div>
                    )}
                  </motion.div>

                  {/* 닉네임 */}
                  <div
                    className={`absolute -top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap ${isCurrentPlayer
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl border-2 border-white'
                        : 'bg-white/95 text-gray-800 px-2 py-1 rounded-md text-xs font-semibold shadow-md border border-gray-300'
                      }`}
                  >
                    {player.nickname}
                    {isCurrentPlayer && (
                      <span className="ml-1 text-xs">⭐</span>
                    )}
                  </div>

                  {/* 교문 통과 효과 */}
                  {isFinished && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 2, 1.5], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5 }}
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2"
                    >
                      <div className="text-4xl">🎉</div>
                      <div className="text-2xl font-bold text-yellow-400 text-center mt-2">
                        등교 성공!
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 교문 (결승선) */}
      <div className="absolute right-0 top-16 bottom-0 w-4 bg-gradient-to-r from-transparent via-red-400 to-red-500 border-l-4 border-dashed border-red-600 z-30 shadow-2xl">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-300 font-bold text-sm rotate-90 whitespace-nowrap drop-shadow-lg"
        >
          🚪 교문
        </motion.div>
      </div>

      {/* 하단 정보 바 */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 flex justify-between text-xs font-bold">
        <div className="flex items-center gap-2">
          <span>{currentStage.emoji}</span>
          <span>{currentStage.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>⏰</span>
          <span>8:59 AM - 교문 닫히는 중!</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🏁</span>
          <span>목표: {finishLine}m</span>
        </div>
      </div>

      {/* 차선 안내 (좌측 하단) */}
      <div className="absolute bottom-12 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
        <div className="flex items-center gap-1 text-yellow-300">
          <span>⬆️</span>
          <span>빠름</span>
        </div>
        <div className="flex items-center gap-1 text-green-300">
          <span>➡️</span>
          <span>보통</span>
        </div>
        <div className="flex items-center gap-1 text-blue-300">
          <span>⬇️</span>
          <span>안전</span>
        </div>
      </div>
    </div>
  )
}
