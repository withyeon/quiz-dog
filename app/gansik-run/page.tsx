'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import GansikRunGame from '@/components/간식런Game'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Target, Package } from 'lucide-react'
import { type GansikRunState, type ItemType, formatTime, ITEM_DEFS } from '@/lib/game/간식런'
import { useGameBase } from '@/hooks/useGameBase'
import type { Json } from '@/types/database.types'

const DUMMY_QUESTIONS = [
  { id: '1', question_text: '한국의 수도는?', options: ['서울', '부산', '대구', '인천'], answer: '서울' },
  { id: '2', question_text: '태양계에서 가장 큰 행성은?', options: ['지구', '목성', '토성', '화성'], answer: '목성' },
  { id: '3', question_text: '2 + 2는?', options: ['3', '4', '5', '6'], answer: '4' },
  { id: '4', question_text: '한국의 광복절은?', options: ['3월 1일', '8월 15일', '10월 3일', '12월 25일'], answer: '8월 15일' },
  { id: '5', question_text: '지구의 위성은?', options: ['화성', '금성', '달', '태양'], answer: '달' },
  { id: '6', question_text: '물의 화학식은?', options: ['H2O', 'CO2', 'O2', 'NaCl'], answer: 'H2O' },
  { id: '7', question_text: '가장 큰 대륙은?', options: ['아시아', '아프리카', '유럽', '북아메리카'], answer: '아시아' },
  { id: '8', question_text: '1 + 1은?', options: ['1', '2', '3', '4'], answer: '2' },
  { id: '9', question_text: '빛의 속도에 가장 가까운 것은?', options: ['소리', '전파', '빛', '바람'], answer: '빛' },
  { id: '10', question_text: '대한민국 국기의 이름은?', options: ['태극기', '일장기', '성조기', '유니언잭'], answer: '태극기' },
]

type PageView = 'lobby' | 'playing' | 'result'

export default function GansikRunPage() {
  const router = useRouter()
  const {
    roomCode, playerId, currentView, setCurrentView,
    room, roomLoading, playBGM, playSFX, questions: serverQuestions,
    players, currentPlayer, commitPlayerPatch, sendRoomEvent,
  } = useGameBase({ expectedGameMode: 'treat_rush' })

  const [pageView, setPageView] = useState<PageView>('lobby')
  const [gameResult, setGameResult] = useState<GansikRunState | null>(null)

  const gameQuestions = serverQuestions.length > 0
    ? serverQuestions.map(q => ({ id: q.id, question_text: q.question_text, options: q.options as string[], answer: q.answer }))
    : DUMMY_QUESTIONS

  // Room sync
  useEffect(() => {
    if (room?.status === 'playing' && pageView === 'lobby') {
      setPageView('playing')
    } else if (room?.status === 'waiting' && pageView !== 'lobby') {
      setPageView('lobby')
    }
  }, [room?.status, pageView])

  const handleStart = () => setPageView('playing')

  const syncGansikRunScore = useCallback((state: GansikRunState) => {
    if (!playerId) return
    const itemEffects = state.activeItems.map((item) => ({
      type: item.type,
      remaining: item.remaining,
    })) as Json[]
    void commitPlayerPatch(playerId, {
      score: Math.max(0, Math.floor(state.score)),
      active_item: itemEffects[0] ?? null,
      item_effects: itemEffects,
    }, 'treat_rush_score_sync').catch((error) => {
      console.error('간식런 점수 동기화 실패:', error)
    })
  }, [commitPlayerPatch, playerId])

  const handleGansikRunItem = useCallback(async (item: ItemType, state: GansikRunState) => {
    if (!playerId) return

    if (item === 'score_steal') {
      const candidates = players.filter((player) =>
        player.id !== playerId
        && player.is_online !== false
        && (player.score ?? 0) > 0
      )
      const target = candidates[Math.floor(Math.random() * candidates.length)]

      if (!target) {
        return { message: '훔칠 점수 없음!' }
      }

      const stealAmount = Math.max(10, Math.min(120, Math.ceil((target.score ?? 0) * 0.2)))
      await Promise.all([
        commitPlayerPatch(playerId, {
          score: Math.max(0, Math.floor(state.score + stealAmount)),
        }, 'treat_rush_score_steal_gain'),
        commitPlayerPatch(target.id, {
          score: Math.max(0, (target.score ?? 0) - stealAmount),
        }, 'treat_rush_score_steal_loss'),
      ])

      return {
        scoreDelta: stealAmount,
        message: `${target.nickname}에게 +${stealAmount}점!`,
      }
    }

    if (item === 'screen_flip' || item === 'screen_shrink') {
      const durationMs = 7000
      const effect = item === 'screen_flip' ? 'screen_flip' : 'screen_shrink'
      await sendRoomEvent('game:effect', {
        mode: 'treat_rush',
        effect,
        item,
        sourcePlayerId: playerId,
        sourceName: currentPlayer?.nickname ?? '친구',
        durationMs,
        expiresAt: Date.now() + durationMs,
      })

      return {
        message: item === 'screen_flip' ? '친구들 화면 뒤집기!' : '친구들 화면 축소!',
      }
    }
  }, [commitPlayerPatch, currentPlayer?.nickname, playerId, players, sendRoomEvent])

  const handleGameEnd = useCallback((state: GansikRunState) => {
    syncGansikRunScore(state)
    setGameResult(state)
    setPageView('result')
    playSFX('correct')
  }, [playSFX, syncGansikRunScore])

  const handleRestart = () => {
    setGameResult(null)
    setPageView('lobby')
  }

  const displayScore = gameResult ? Math.max(0, gameResult.score) : 0
  const accuracy = gameResult && gameResult.quizTotal > 0
    ? Math.round((gameResult.quizCorrect / gameResult.quizTotal) * 100)
    : 0

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ fontFamily: 'BMJUA, sans-serif', background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 40%, #0f2027 100%)' }}>
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute rounded-full animate-pulse" style={{
            width: 2 + (i % 3) * 2,
            height: 2 + (i % 3) * 2,
            background: `rgba(${139 + i * 5},92,246,${0.15 + (i % 5) * 0.08})`,
            left: `${(i * 7.3) % 100}%`,
            top: `${(i * 11.7) % 100}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${2 + (i % 4)}s`,
          }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── LOBBY ── */}
        {pageView === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-2xl border-0" style={{
              background: 'linear-gradient(135deg, rgba(15,15,35,0.95), rgba(25,15,50,0.95))',
              border: '2px solid rgba(139,92,246,0.3)',
              boxShadow: '0 0 40px rgba(139,92,246,0.15), 0 20px 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}>
              <CardHeader className="text-center pb-2">
                <motion.div animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }} className="text-7xl mb-2">🐕</motion.div>
                <CardTitle className="text-4xl font-bold mb-1" style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: 'none',
                  filter: 'drop-shadow(0 2px 8px rgba(251,191,36,0.3))',
                }}>간식런!</CardTitle>
                <p className="text-base" style={{ color: 'rgba(200,200,230,0.7)' }}>달리며 퀴즈 풀고 아이템 박스 획득!</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl p-4" style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}>
                  <h3 className="font-bold text-lg mb-2" style={{ color: '#a78bfa' }}>⚡ 게임 방법</h3>
                  <ul className="space-y-1.5 text-sm" style={{ color: 'rgba(200,200,230,0.8)' }}>
                    <li className="flex items-start gap-2"><span>🐕</span><span>강아지가 3차선 도로를 달려요!</span></li>
                    <li className="flex items-start gap-2"><span>⬅️➡️</span><span>좌/우 키 또는 스와이프로 차선 변경</span></li>
                    <li className="flex items-start gap-2"><span>🦴</span><span>뼈다귀를 모아 점수를 올려요</span></li>
                    <li className="flex items-start gap-2"><span>🚧</span><span>장애물을 피하세요! (충돌 시 -100점)</span></li>
                    <li className="flex items-start gap-2"><span>📝</span><span>30초마다 퀴즈 등장! 정답 시 아이템 박스!</span></li>
                    <li className="flex items-start gap-2"><span>❓</span><span>박스에서 부스터, 방어막, 자석 등 획득!</span></li>
                  </ul>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(['booster', 'shield', 'magnet', 'golden_mode'] as ItemType[]).map(key => (
                    <div key={key} className="text-center p-2 rounded-lg" style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div className="text-2xl">{ITEM_DEFS[key].emoji}</div>
                      <div className="text-xs font-semibold mt-1" style={{ color: 'rgba(200,200,230,0.7)' }}>{ITEM_DEFS[key].name}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 text-center">
                  {[
                    { icon: <Clock className="h-5 w-5 mx-auto mb-1" style={{ color: '#818cf8' }} />, value: '5분', label: '플레이 시간', color: '#818cf8' },
                    { icon: <Target className="h-5 w-5 mx-auto mb-1" style={{ color: '#a78bfa' }} />, value: '3차선', label: '달리기 코스', color: '#a78bfa' },
                    { icon: <Package className="h-5 w-5 mx-auto mb-1" style={{ color: '#fbbf24' }} />, value: '8종', label: '아이템', color: '#fbbf24' },
                  ].map((item, i) => (
                    <div key={i} className="flex-1 rounded-lg p-2" style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      {item.icon}
                      <div className="text-lg font-bold" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-xs" style={{ color: 'rgba(200,200,230,0.5)' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleStart} size="lg"
                  className="w-full text-white font-bold text-2xl py-6 border-0 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706, #b45309)',
                    boxShadow: '0 0 20px rgba(245,158,11,0.3), 0 8px 24px rgba(0,0,0,0.3)',
                  }}>
                  ⚡ 달리기 시작!
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {pageView === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-full h-screen">
            <GansikRunGame
              questions={gameQuestions}
              onGameEnd={handleGameEnd}
              playerId={playerId}
              onItemActivated={handleGansikRunItem}
              onScoreSnapshot={syncGansikRunScore}
            />
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {pageView === 'result' && gameResult && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-lg border-0 shadow-2xl" style={{
              background: 'linear-gradient(135deg, rgba(15,15,35,0.95), rgba(25,15,50,0.95))',
              border: '2px solid rgba(139,92,246,0.3)',
              boxShadow: '0 0 40px rgba(139,92,246,0.15), 0 20px 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}>
              <CardHeader className="text-center pb-2">
                <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
                  transition={{ type: 'spring' }} className="mb-2">
                  <span className="text-7xl">{displayScore >= 500 ? '🏆' : displayScore >= 200 ? '⭐' : '🐕'}</span>
                </motion.div>
                <CardTitle className="text-4xl font-bold mb-1" style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>게임 종료!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 점수 */}
                <div className="text-center rounded-xl p-6" style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.1))',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}>
                  <div className="text-sm font-semibold" style={{ color: '#fbbf24' }}>최종 점수</div>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-5xl font-bold my-2" style={{ color: '#fbbf24' }}>
                    🦴 {displayScore.toLocaleString()}
                  </motion.div>
                </div>

                {/* 상세 통계 */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { emoji: '🦴', value: gameResult.bonesCollected, label: '뼈다귀', color: '#d1d5db' },
                    { emoji: '✨', value: gameResult.goldenBonesCollected, label: '황금 뼈다귀', color: '#fbbf24' },
                    { emoji: '📝', value: `${accuracy}%`, label: `정답률 (${gameResult.quizCorrect}/${gameResult.quizTotal})`, color: '#a78bfa' },
                    { emoji: '📦', value: gameResult.boxesOpened, label: '박스 획득', color: '#818cf8' },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl p-3 text-center" style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div className="text-2xl mb-1">{stat.emoji}</div>
                      <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="text-xs" style={{ color: 'rgba(200,200,230,0.5)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleRestart} size="lg"
                    className="flex-1 text-white font-bold text-xl py-5 border-0 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      boxShadow: '0 0 16px rgba(245,158,11,0.3)',
                    }}>
                    🔄 다시 하기
                  </Button>
                  <Button onClick={() => router.push('/teacher/dashboard')} size="lg" variant="outline"
                    className="flex-1 font-bold text-xl py-5 cursor-pointer"
                    style={{
                      border: '2px solid rgba(255,255,255,0.15)',
                      color: 'rgba(200,200,230,0.7)',
                      background: 'rgba(255,255,255,0.05)',
                    }}>
                    🏠 나가기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
