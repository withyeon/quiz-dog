'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { History, Zap } from 'lucide-react'
import QuizView from '@/components/QuizView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import FishingMachine from '@/components/FishingMachine'
import { useGameBase } from '@/hooks/useGameBase'
import { useFishingGame } from '@/hooks/useFishingGame'
import { getTierColor, getMachineRankName, type Doll } from '@/lib/game/fishing'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  caught_dolls?: Doll[]
  claw_points?: number
}

export default function FishingPage() {
  const gameBase = useGameBase({ expectedGameMode: 'fishing' })
  const {
    roomCode, playerId, currentView, setCurrentView,
    showCountdown, players, roomLoading, playersLoading,
    currentPlayer, currentQuestion, playSFX,
    checkAnswer, handleWrongAnswer, handleCountdownComplete,
    goToNextQuestion, getElapsedSeconds,
  } = gameBase

  const fishing = useFishingGame({
    playerId, currentPlayer: currentPlayer as Player | null | undefined,
    checkAnswer, handleWrongAnswer, goToNextQuestion,
    getElapsedSeconds, playSFX, setCurrentView,
  })

  const {
    fishingState, caughtItem, fishingResult,
    caughtDolls, isFrenzyEvent, frenzyTimeLeft,
    activeItems, pendingItem, showItemModal,
    machineRank, handleAnswerSubmit, handleStartFishing,
    handleItemModalClose, handleResultCardClick,
  } = fishing

  // 정답 확인 후 클릭 시 인형뽑기로 이동 (QuizView 요구사항 충족)
  const handleCorrectAnswerClick = () => {}

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

  const currentPlayerTotalPoints = caughtDolls.reduce((sum, d) => sum + (d.score || 0), 0)

  return (
    <main className={`min-h-screen bg-slate-900 relative overflow-hidden transition-colors duration-1000 ${isFrenzyEvent ? 'bg-gradient-to-b from-purple-900 via-pink-900 to-blue-900' : ''}`}>
      <AnimatedBackground />

      {isFrenzyEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24, #f0932b, #eb4d4b)',
            backgroundSize: '400% 400%',
            animation: 'gradient 3s ease infinite',
          }}
        />
      )}

      <div className="relative z-10 p-4" style={{ fontFamily: 'OkDanDan, sans-serif' }}>
        <div className="max-w-6xl mx-auto mb-4">
          <div className={`bg-slate-800 rounded-xl p-4 shadow-2xl border-b-4 transition-all duration-500 ${isFrenzyEvent ? 'border-yellow-500 shadow-yellow-500/50' : 'border-pink-500'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">🕹️</div>
                <div>
                  <h1 className="text-3xl font-bold text-white">두근두근 인형뽑기</h1>
                  <p className="text-sm text-blue-100">방 코드: {roomCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-blue-500">
                  <div className="text-sm text-blue-300 font-semibold mb-1">기계 등급</div>
                  <div className="text-xl font-bold text-white">{getMachineRankName(machineRank)}</div>
                  <div className="text-sm text-gray-400">Rank {machineRank}</div>
                </div>

                {isFrenzyEvent && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-gradient-to-r from-yellow-400 to-pink-500 rounded-lg px-4 py-2 border-2 border-yellow-300">
                    <div className="flex items-center gap-2">
                      <Zap className="text-white" size={20} />
                      <div>
                        <div className="text-sm font-semibold text-white">대성공!</div>
                        <div className="text-sm text-white">{frenzyTimeLeft}초</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeItems.length > 0 && (
                  <div className="flex gap-1">
                    {activeItems.map((type, i) => {
                      const icons: Record<string, string> = { DOUBLE_SCORE: '⚡', LUCKY_BOOST: '⭐', SHIELD: '🍀' }
                      return (
                        <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }} className="bg-indigo-600 border-2 border-indigo-300 rounded-lg px-2 py-1 text-xl" title={type}>
                          {icons[type] ?? '🎁'}
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-pink-500">
                  <div className="text-base text-pink-300 font-semibold mb-1">{(currentPlayer as Player)?.nickname || '플레이어'}</div>
                  <div className="text-xl font-bold text-white">{currentPlayerTotalPoints.toLocaleString()} 점</div>
                </div>
                <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-green-500">
                  <div className="text-sm text-green-300 font-semibold mb-1">인형</div>
                  <div className="text-xl font-bold text-white">{caughtDolls.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {currentView === 'lobby' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-800 rounded-xl p-8 shadow-lg text-center border-4 border-pink-500">
              <h2 className="text-4xl font-bold mb-4 text-white">🕹️ 인형뽑기 준비 중...</h2>
              <p className="text-lg text-gray-300">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="space-y-4">
              <QuizView
                question={currentQuestion}
                onAnswer={handleAnswerSubmit}
                timeLimit={30}
                onCorrectClick={handleCorrectAnswerClick}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                  <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 text-lg">
                    <History size={18} /> 획득한 인형들
                  </h3>
                  <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                    {caughtDolls.length === 0 ? (
                      <div className="col-span-4 text-center text-gray-500 py-10 text-base">
                        아직 뽑은 인형이 없어요.<br />정답을 맞춰보세요!
                      </div>
                    ) : (
                      caughtDolls.map((item, idx) => (
                        <div key={idx} className={`aspect-square ${getTierColor(item.tier)} rounded-lg flex flex-col items-center justify-center border-2 border-white/20 relative group`}>
                          {item.image ? (
                            <Image src={item.image} alt={item.name} width={32} height={32} unoptimized className="w-8 h-8 object-contain" />
                          ) : (
                            <span className={`text-2xl ${item.color}`}>{item.emoji}</span>
                          )}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                            {item.name} (+{item.score})
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                  <h3 className="font-bold text-slate-300 mb-4 text-center text-lg">순위</h3>
                  <div className="space-y-2">
                    {players
                      .sort((a, b) => {
                        const pointsA = (a as Player).claw_points || 0
                        const pointsB = (b as Player).claw_points || 0
                        return pointsB - pointsA
                      })
                      .slice(0, 5)
                      .map((player, index) => {
                        const isCurrentPlayer = player.id === playerId
                        const points = (player as Player).claw_points || 0
                        const dolls = ((player as Player).caught_dolls as Doll[]) || []

                        return (
                          <div key={player.id} className={`p-3 rounded-lg ${isCurrentPlayer ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-slate-700 border border-slate-600'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base">#{index + 1}</span>
                                <span className="text-2xl">{player.avatar || '🎮'}</span>
                                <span className="text-base text-white">{player.nickname}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-white">{points}점</div>
                                <div className="text-sm text-gray-400">{dolls.length}개</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'claw' && (
            <div className="space-y-4">
              {fishingResult && fishingState === 'release' && fishingResult.doll ? (
                <div className="flex items-center justify-center min-h-[500px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    onClick={handleResultCardClick}
                    className="bg-orange-500 border-4 border-white rounded-2xl p-8 shadow-2xl cursor-pointer hover:scale-105 transition-transform max-w-md w-full"
                  >
                    <div className="text-center mb-4">
                      <div className="text-green-500 font-bold text-2xl mb-2">
                        {fishingResult.doll.tier === '일반' ? 'Easy One' :
                          fishingResult.doll.tier === '희귀' ? 'Great Catch' :
                            fishingResult.doll.tier === '영웅' ? 'Rare Find' :
                              fishingResult.doll.tier === '전설' ? 'Epic Grab' : 'Catch of the Day'}
                      </div>
                      <div className="text-white font-black text-5xl mb-6">{fishingResult.doll.name}</div>
                    </div>
                    <div className="flex justify-center mb-6">
                      <div className="bg-white/20 rounded-2xl p-6 flex items-center justify-center">
                        {fishingResult.doll.image ? (
                          <Image src={fishingResult.doll.image} alt={fishingResult.doll.name} width={96} height={96} unoptimized className="w-24 h-24 object-contain" />
                        ) : (
                          <span className="text-8xl">{fishingResult.doll.emoji}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-center mb-4">
                      <div className="text-white font-bold text-3xl">
                        {fishingResult.doll.tier === '일반' ? 'F' :
                          fishingResult.doll.tier === '희귀' ? 'D' :
                            fishingResult.doll.tier === '영웅' ? 'B' :
                              fishingResult.doll.tier === '전설' ? 'A' : 'S'} Tier
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold text-4xl">{fishingResult.doll.score} 점</div>
                    </div>
                    <div className="text-center mt-6 text-white/80 text-base">클릭하여 계속</div>
                  </motion.div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <FishingMachine
                      fishingState={fishingState}
                      caughtItem={caughtItem}
                      message={fishingState === 'idle' ? "클릭해서 퀴즈를 풀어보세요! 🎣" : fishingResult?.message || "집게가 움직입니다..."}
                      coins={0}
                      onQuizSolve={() => { }}
                      onStartFishing={handleStartFishing}
                      canInteract={fishingState === 'idle'}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                      <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 text-lg">
                        <History size={18} /> 획득한 인형들
                      </h3>
                      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                        {caughtDolls.length === 0 ? (
                          <div className="col-span-3 text-center text-gray-500 py-10 text-base">아직 뽑은 인형이 없어요.</div>
                        ) : (
                          caughtDolls.map((item, idx) => (
                            <div key={idx} className={`aspect-square ${getTierColor(item.tier)} rounded-lg flex flex-col items-center justify-center border-2 border-white/20 relative group`}>
                              {item.image ? (
                                <Image src={item.image} alt={item.name} width={32} height={32} unoptimized className="w-8 h-8 object-contain" />
                              ) : (
                                <span className={`text-2xl ${item.color}`}>{item.emoji}</span>
                              )}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                                {item.name} (+{item.score})
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                      <h3 className="font-bold text-slate-300 mb-4 text-center text-lg">순위</h3>
                      <div className="space-y-2">
                        {players
                          .sort((a, b) => {
                            const pointsA = (a as Player).claw_points || 0
                            const pointsB = (b as Player).claw_points || 0
                            return pointsB - pointsA
                          })
                          .slice(0, 5)
                          .map((player, index) => {
                            const isCurrentPlayer = player.id === playerId
                            const points = (player as Player).claw_points || 0
                            const dolls = ((player as Player).caught_dolls as Doll[]) || []

                            return (
                              <div key={player.id} className={`p-3 rounded-lg ${isCurrentPlayer ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-slate-700 border border-slate-600'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-base">#{index + 1}</span>
                                    <span className="text-2xl">{player.avatar || '🎮'}</span>
                                    <span className="text-base text-white">{player.nickname}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-base font-bold text-white">{points}점</div>
                                    <div className="text-sm text-gray-400">{dolls.length}개</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentView === 'wrong' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-800 rounded-xl p-8 shadow-lg text-center border-4 border-red-500">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-4xl font-bold text-white mb-2">틀렸습니다!</h2>
              <p className="text-xl text-gray-300">인형을 뽑을 기회를 놓쳤어요.</p>
            </motion.div>
          )}

          {currentView === 'result' && (
            <GameResult players={players} currentPlayerId={playerId} gameMode="fishing" />
          )}

          <AnimatePresence>
            {showItemModal && pendingItem && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={handleItemModalClose}
              >
                <motion.div
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-3xl p-8 max-w-sm w-full text-center border-4 border-purple-400 shadow-2xl shadow-purple-500/50"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="relative z-10">
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-4 ${pendingItem.rarity === '전설' ? 'bg-yellow-500 text-yellow-900' :
                      pendingItem.rarity === '희귀' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                      }`}>
                      {pendingItem.rarity} 아이템
                    </div>
                    <motion.div animate={{ y: [0, -12, 0], scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-8xl mb-4">
                      {pendingItem.emoji}
                    </motion.div>
                    <h2 className="text-3xl font-black text-white mb-2">{pendingItem.name}</h2>
                    <p className="text-purple-200 text-base mb-6">{pendingItem.description}</p>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleItemModalClose} className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl font-black text-white text-xl shadow-xl border-2 border-white/30">
                      {pendingItem.type === 'EXTRA_PULL' ? '🎰 바로 뽑기!' : pendingItem.type === 'COIN_RAIN' ? '🪙 받았어요!' : '✅ 확인!'}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </main>
  )
}
