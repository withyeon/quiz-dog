'use client'

import { motion } from 'framer-motion'
import QuizView from '@/components/QuizView'
import SchoolRacingTrack from '@/components/SchoolRacingTrack'
import ItemCard from '@/components/ItemCard'
import ItemEffectOverlay from '@/components/ItemEffectOverlay'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import { useGameBase } from '@/hooks/useGameBase'
import { useRacingGame } from '@/hooks/useRacingGame'
import { TRACK_LENGTH } from '@/lib/game/schoolRacing'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  position?: number
}

export default function RacingPage() {
  const gameBase = useGameBase({ expectedGameMode: 'racing' })
  const {
    roomCode, playerId, currentView, setCurrentView,
    showCountdown, consecutiveCorrect,
    players, room, roomLoading, playersLoading,
    currentPlayer, currentQuestion,
    playSFX, checkAnswer, handleWrongAnswer,
    goToNextQuestion, getElapsedSeconds,
  } = gameBase

  const racing = useRacingGame({
    playerId, roomCode, currentPlayer: currentPlayer as Player | null | undefined,
    players: players as Player[], room, currentView,
    consecutiveCorrect, checkAnswer, handleWrongAnswer,
    goToNextQuestion, getElapsedSeconds, playSFX, setCurrentView,
  })

  const {
    acquiredItem, activeItems, activeEffect,
    isStunned, isBlinded, isMinified, isFrozen,
    hasShield, spicyPepperCount, rankChange,
    showRankChange, showReversal, currentRank,
    handleAnswerSubmit, handleUseItem, handleSkipItem,
  } = racing

  if (!roomCode || !playerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">로딩 중...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 relative overflow-hidden">
      <AnimatedBackground />
      {activeEffect && (
        <ItemEffectOverlay
          effectType={activeEffect.type}
          fromPlayer={activeEffect.fromPlayer}
        />
      )}
      {isBlinded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-orange-900/80 backdrop-blur-sm z-50 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-6xl"
          >
            {activeEffect?.type === 'BLOOK_FIESTA' ? '🎉' : '🚧'}
          </motion.div>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-20 text-2xl font-bold text-white"
          >
            {activeEffect?.type === 'BLOOK_FIESTA'
              ? '블록 피에스타로 화면이 가려졌습니다!'
              : '공사중 표지판으로 화면이 가려졌습니다!'}
          </motion.div>
        </motion.div>
      )}
      {isMinified && (
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 0.7 }}
          exit={{ scale: 1 }}
          className="fixed inset-0 z-40 pointer-events-none"
        />
      )}
      {isStunned && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-red-900/50 backdrop-blur-sm z-50 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1], rotate: [0, 360] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-8xl"
          >
            ⏰
          </motion.div>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-20 text-2xl font-bold text-white"
          >
            자명종 소리가 너무 시끄러워서 문제를 못 풀겠어요!
          </motion.div>
        </motion.div>
      )}
      {showReversal && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2, 1.5], opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            className="text-9xl font-black text-yellow-400 drop-shadow-2xl"
            style={{ textShadow: '0 0 20px rgba(255, 215, 0, 0.8)' }}
          >
            역전!!
          </motion.div>
        </motion.div>
      )}

      <div className="relative z-10 p-4">
        {/* 헤더 */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-xl p-4 shadow-2xl border-4 border-yellow-500 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="h-full w-full" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
              }} />
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">🏃</div>
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    미션: 등교 임파서블
                  </h1>
                  <p className="text-xs text-yellow-300 font-semibold">방 코드: {roomCode} | 8:59 AM - 교문 닫히는 중!</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-yellow-500">
                  <div className="text-sm text-yellow-300 font-semibold mb-1">
                    {currentPlayer?.nickname || '플레이어'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">위치:</span>
                    <span className="text-lg font-bold text-white">
                      {Math.floor(currentPlayer?.position || 0)}m / {TRACK_LENGTH}m
                    </span>
                  </div>
                </div>

                <motion.div
                  animate={showRankChange ? {
                    scale: [1, 1.3, 1],
                    rotate: rankChange.type === 'up' ? [0, -10, 10, 0] : [0, 10, -10, 0]
                  } : {}}
                  transition={{ duration: 0.5 }}
                  className={`bg-black/50 rounded-lg px-4 py-2 border-2 ${rankChange.type === 'up' ? 'border-green-500 shadow-lg shadow-green-500/50' :
                    rankChange.type === 'down' ? 'border-red-500 shadow-lg shadow-red-500/50' :
                      'border-blue-500'
                    }`}
                >
                  <div className="text-xs text-blue-300 font-semibold mb-1">순위</div>
                  <div className="flex items-center gap-2">
                    <motion.div
                      key={currentRank}
                      initial={{ scale: 0.5, y: -20 }}
                      animate={{ scale: 1, y: 0 }}
                      className={`text-2xl font-bold ${rankChange.type === 'up' ? 'text-green-400' :
                        rankChange.type === 'down' ? 'text-red-400' : 'text-white'
                        }`}
                    >
                      #{currentRank || '-'}
                    </motion.div>
                    {showRankChange && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`text-lg font-bold ${rankChange.type === 'up' ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {rankChange.type === 'up' ? `↑${rankChange.value}` : `↓${rankChange.value}`}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {consecutiveCorrect >= 3 && (
                  <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-yellow-500">
                    <div className="text-xs text-yellow-300 font-semibold mb-1">연속 정답</div>
                    <div className="flex items-center gap-1">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-lg font-bold text-yellow-300">🔥</motion.div>
                      <div className="text-lg font-bold text-white">{consecutiveCorrect}연속!</div>
                    </div>
                  </div>
                )}

                {spicyPepperCount > 0 && (
                  <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-red-500">
                    <div className="text-xs text-red-300 font-semibold mb-1">매운 고추</div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg">🌶️</span>
                      <div className="text-lg font-bold text-white">{spicyPepperCount}문제 남음 (2배)</div>
                    </div>
                  </div>
                )}

                {hasShield && (
                  <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-yellow-500">
                    <div className="text-xs text-yellow-300 font-semibold mb-1">방패</div>
                    <div className="flex items-center gap-1">
                      <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity }} className="text-lg">🛡️</motion.div>
                      <div className="text-lg font-bold text-white">보호 중</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="max-w-6xl mx-auto">
          {showCountdown && (<Countdown onComplete={() => { }} />)}

          {currentView === 'lobby' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg text-center">
              <h2 className="text-3xl font-bold mb-4">🏃 등교 준비 중...</h2>
              <p className="text-gray-600">선생님이 게임을 시작할 때까지 기다려주세요.</p>
              <p className="text-sm text-gray-500 mt-2">8:59 AM까지 교문이 닫힙니다!</p>
            </motion.div>
          )}

          {showRankChange && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.5 }}
              className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 ${rankChange.type === 'up'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'bg-gradient-to-r from-red-500 to-rose-600'
                } text-white px-8 py-4 rounded-xl shadow-2xl border-4 border-white/50`}
            >
              <div className="flex items-center gap-3">
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 0.5 }} className="text-4xl">
                  {rankChange.type === 'up' ? '🚀' : '😢'}
                </motion.div>
                <div>
                  <div className="text-2xl font-bold">
                    {rankChange.type === 'up'
                      ? `역전!! ${rankChange.value}단계 상승!`
                      : `순위 ${rankChange.value}단계 하락...`}
                  </div>
                  <div className="text-sm opacity-90">현재 순위: #{currentRank}</div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'quiz' && !showCountdown && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {(isStunned || isFrozen) ? (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-900 rounded-xl p-8 shadow-lg text-center border-4 border-red-500">
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-6xl mb-4">
                    {isFrozen ? '❄️' : '⏰'}
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {isFrozen ? '얼어붙었다!' : '기절했다!'}
                  </h2>
                  <p className="text-red-200">
                    {isFrozen ? '7초간 문제를 못 풀겠어요...' : '너무 시끄러워서 문제를 못 풀겠어요...'}
                  </p>
                </motion.div>
              ) : currentQuestion ? (
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={goToNextQuestion}
                  timeLimit={30}
                />
              ) : (
                <div className="text-center p-8 bg-white/80 rounded-xl">
                  <p>문제를 불러오는 중이거나 문제가 없습니다.</p>
                </div>
              )}

              <div className="bg-gradient-to-br from-blue-100 to-green-100 rounded-2xl p-4 shadow-2xl border-4 border-gray-800">
                <SchoolRacingTrack
                  players={players as Player[]}
                  currentPlayerId={playerId}
                  trackLength={TRACK_LENGTH}
                />
              </div>

              {activeItems.length > 0 && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 rounded-xl p-4 shadow-2xl border-4 border-purple-400">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-sm font-bold text-white">활성 아이템:</h3>
                    <div className="flex gap-3">
                      {activeItems.map((item, index) => (
                        <motion.div key={index} animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }} className="text-3xl cursor-pointer" title={item.name}>
                          {item.icon}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {currentView === 'item' && acquiredItem && (
            <motion.div initial={{ opacity: 0, scale: 0.5, rotate: -180 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="relative">
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-2xl blur-3xl -z-10" />
              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 shadow-2xl border-4 border-yellow-500 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="h-full w-full" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px)' }} />
                </div>
                <div className="relative z-10">
                  <motion.h2 animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                    🎁 아이템 획득! 🎁
                  </motion.h2>
                  <div className="flex justify-center mb-8">
                    <motion.div animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                      <ItemCard item={acquiredItem} />
                    </motion.div>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <motion.button whileHover={{ scale: 1.1, y: -5 }} whileTap={{ scale: 0.95 }} onClick={() => handleUseItem(acquiredItem)} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-2xl hover:shadow-green-500/50 transition-all border-2 border-white/50 relative overflow-hidden">
                      <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <span className="relative z-10">⚡ 사용하기</span>
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1, y: -5 }} whileTap={{ scale: 0.95 }} onClick={handleSkipItem} className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-xl transition-all border-2 border-white/30">
                      건너뛰기
                    </motion.button>
                  </div>
                  <motion.div initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 5, ease: 'linear' }} className="mt-6 h-2 bg-yellow-500/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500" />
                  </motion.div>
                  <p className="text-center text-gray-400 text-sm mt-2">5초 후 자동으로 다음 문제로 진행됩니다</p>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-100 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다!</h2>
              <p className="text-gray-700">다음 문제로 넘어갑니다...</p>
            </motion.div>
          )}

          {currentView === 'result' && (
            <GameResult players={players} currentPlayerId={playerId} />
          )}
        </div>
      </div>
    </main>
  )
}
