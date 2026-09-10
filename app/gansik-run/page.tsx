'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import GansikRunGame, { type GansikRunQuestion } from '@/components/간식런Game'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import Countdown from '@/components/Countdown'
import GameTimeBadge from '@/components/GameTimeBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Target, Package } from 'lucide-react'
import { type GansikRunState, type ItemType, formatTime, ITEM_DEFS, GAME } from '@/lib/game/간식런'
import { useGameBase } from '@/hooks/useGameBase'
import type { Json } from '@/types/database.types'

const DUMMY_QUESTIONS: GansikRunQuestion[] = [
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

const ITEM_COUNT = Object.keys(ITEM_DEFS).length

type PageView = 'lobby' | 'playing' | 'result'

/**
 * 이 판의 제한 시간. 선생님이 방에 시간을 정했으면 그 남은 시간을 쓴다.
 * (게임은 시작 전 퀴즈를 푼 뒤에야 시작하므로 방 시작 시각보다 늦다.)
 * 시간이 없는 방이면 기본 5분.
 */
function resolveRunDuration(room: { started_at?: string | null; duration_seconds?: number | null } | null | undefined): number {
  const total = Number(room?.duration_seconds)
  if (!room?.started_at || !Number.isFinite(total) || total <= 0) return GAME.DURATION
  const startedMs = new Date(room.started_at).getTime()
  if (!Number.isFinite(startedMs)) return GAME.DURATION
  const remaining = Math.floor((startedMs + total * 1000 - Date.now()) / 1000)
  return Math.max(15, Math.min(total, remaining))
}

export default function GansikRunPage() {
  const router = useRouter()
  const {
    roomCode, playerId,
    room, playBGM, playSFX, questions: serverQuestions,
    questionsLoading, questionsError,
    preStartQuizQuestion, preStartSubmittedCount, preStartQuizTotal,
    shouldShowPreStartQuiz, isPreStartQuizComplete,
    handlePreStartQuizAnswer,
    showCountdown, handleCountdownComplete,
    players, currentPlayer, commitPlayerPatch, commitPlayerDelta, sendRoomEvent,
    recordAnswer,
  } = useGameBase({ expectedGameMode: 'treat_rush' })

  const [pageView, setPageView] = useState<PageView>('lobby')
  const [gameResult, setGameResult] = useState<GansikRunState | null>(null)
  const [runDuration, setRunDuration] = useState<number>(GAME.DURATION)
  // "다시 하기"는 점수를 이어서 달린다. 새 판이 0점부터 시작하면 5초마다
  // 올라가는 점수 동기화가 이전 판 점수를 덮어써 순위표가 뒤로 간다.
  const [carryScore, setCarryScore] = useState(0)

  // 시작 전 퀴즈가 앞의 N문제를 쓰므로, 게임 안 퀴즈는 그 다음 문제부터 돌린다 (바로 반복 방지)
  const gameQuestions = useMemo<GansikRunQuestion[]>(() => {
    if (serverQuestions.length === 0) return DUMMY_QUESTIONS
    const mapped = serverQuestions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      options: (q.options ?? []) as string[],
      answer: q.answer,
      type: q.type as GansikRunQuestion['type'],
    }))
    const offset = preStartQuizTotal % mapped.length
    return [...mapped.slice(offset), ...mapped.slice(0, offset)]
  }, [preStartQuizTotal, serverQuestions])

  // 게임 안 퀴즈 결과를 정답 기록에 남긴다 → 학생 결과·선생님 리포트의 정답률에 반영
  const handleQuizAnswered = useCallback((question: GansikRunQuestion, correct: boolean, answer: string) => {
    const questionIndex = serverQuestions.findIndex((q) => q.id === question.id)
    if (questionIndex < 0) return
    recordAnswer({ questionIndex, isCorrect: correct, selectedAnswer: answer })
  }, [recordAnswer, serverQuestions])

  const startRun = useCallback(() => {
    setRunDuration(resolveRunDuration(room))
    setPageView('playing')
    playBGM('game')
  }, [playBGM, room])

  // Room sync: 카운트다운(3초) → 시작 전 퀴즈 → 자동 출발.
  // 예전에는 카운트다운을 렌더하지 않아 isCountdownComplete가 영원히 false였고,
  // 그래서 시작 전 퀴즈 게이트가 간식런에서는 한 번도 뜨지 않았다.
  const canStart = room?.status === 'playing' && !showCountdown && isPreStartQuizComplete
  useEffect(() => {
    if (canStart && pageView === 'lobby') {
      startRun()
    } else if (room?.status === 'waiting' && pageView !== 'lobby') {
      setPageView('lobby')
    }
  }, [canStart, room?.status, pageView, startRun])

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
        return { message: '훔칠 점수가 없어요!' }
      }

      const stealAmount = Math.max(10, Math.min(120, Math.ceil((target.score ?? 0) * 0.2)))
      // 공격자 점수는 로컬 상태가 권위(scoreDelta로 로컬 반영 후 절대값 동기화)이므로 그대로 즉시 push.
      // 피해자는 (1) DB를 원자적 증분으로 깎고 (2) 이벤트로 피해자 화면의 로컬 점수도 깎는다.
      // (2)가 없으면 피해자의 다음 점수 동기화가 DB 감소를 도로 덮어쓴다.
      await Promise.all([
        commitPlayerPatch(playerId, {
          score: Math.max(0, Math.floor(state.score + stealAmount)),
        }, 'treat_rush_score_steal_gain'),
        commitPlayerDelta(target.id, { score: -stealAmount }, { reason: 'treat_rush_score_steal_loss' }),
        sendRoomEvent('game:effect', {
          mode: 'treat_rush',
          effect: 'score_steal',
          item,
          sourcePlayerId: playerId,
          sourceName: currentPlayer?.nickname ?? '친구',
          targetPlayerId: target.id,
          amount: stealAmount,
        }),
      ])

      return {
        scoreDelta: stealAmount,
        message: `${target.nickname}에게서 +${stealAmount}점!`,
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
  }, [commitPlayerPatch, commitPlayerDelta, currentPlayer?.nickname, playerId, players, sendRoomEvent])

  const handleGameEnd = useCallback((state: GansikRunState) => {
    syncGansikRunScore(state)
    setGameResult(state)
    setPageView('result')
    playSFX('correct')
  }, [playSFX, syncGansikRunScore])

  const handleRestart = () => {
    setCarryScore(Math.max(0, Math.floor(gameResult?.score ?? 0)))
    setGameResult(null)
    setPageView('lobby')
  }

  const handleExit = () => {
    if (roomCode && playerId) {
      router.push(`/student/game/${roomCode}/result?playerId=${playerId}`)
    } else {
      router.push('/')
    }
  }

  const displayScore = gameResult ? Math.max(0, gameResult.score) : 0
  const accuracy = gameResult && gameResult.quizTotal > 0
    ? Math.round((gameResult.quizCorrect / gameResult.quizTotal) * 100)
    : 0
  const roomMinutes = room?.duration_seconds ? Math.round(Number(room.duration_seconds) / 60) : GAME.DURATION / 60

  return (
    <div className="min-h-dvh relative overflow-hidden" style={{ fontFamily: "'DNFBitBitv2', sans-serif", background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 40%, #0f2027 100%)' }}>
      {/* 플레이 중에는 게임 HUD가 같은 시간을 보여주므로 상단 배지를 겹치지 않게 숨긴다 */}
      {pageView !== 'playing' && (
        <GameTimeBadge
          startedAt={room?.started_at}
          durationSeconds={room?.duration_seconds}
          status={room?.status}
        />
      )}
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

      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

      {shouldShowPreStartQuiz && (
        <PreStartQuizGate
          question={preStartQuizQuestion}
          submittedCount={preStartSubmittedCount}
          total={preStartQuizTotal}
          onAnswer={handlePreStartQuizAnswer}
          questionsLoading={questionsLoading}
          questionsError={questionsError}
        />
      )}

      <AnimatePresence mode="wait">
        {/* ── LOBBY ── */}
        {pageView === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-dvh flex items-center justify-center p-4">
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
                    <li className="flex items-start gap-2"><span>⬆️</span><span>위 키 또는 위 스와이프로 점프! (통나무 회피)</span></li>
                    <li className="flex items-start gap-2"><span>⬇️</span><span>아래 키 또는 아래 스와이프로 슬라이드! (공중 장애물 회피)</span></li>
                    <li className="flex items-start gap-2"><span>🦴</span><span>뼈다귀를 모아 점수를 올려요 (황금 뼈다귀는 10점!)</span></li>
                    <li className="flex items-start gap-2"><span>🚧</span><span>장애물에 부딪히면 -{GAME.HIT_PENALTY}점, 뒤의 고양이가 가까워져요</span></li>
                    <li className="flex items-start gap-2"><span>📝</span><span>{GAME.QUIZ_INTERVAL}초마다 퀴즈 등장! 정답 시 +50점과 아이템 박스!</span></li>
                    <li className="flex items-start gap-2"><span>❓</span><span>박스에서 부스터, 방어막, 자석 등 {ITEM_COUNT}가지 아이템 획득!</span></li>
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
                    { icon: <Clock className="h-5 w-5 mx-auto mb-1" style={{ color: '#818cf8' }} />, value: `${roomMinutes}분`, label: '플레이 시간', color: '#818cf8' },
                    { icon: <Target className="h-5 w-5 mx-auto mb-1" style={{ color: '#a78bfa' }} />, value: '3차선', label: '달리기 코스', color: '#a78bfa' },
                    { icon: <Package className="h-5 w-5 mx-auto mb-1" style={{ color: '#fbbf24' }} />, value: `${ITEM_COUNT}종`, label: '아이템', color: '#fbbf24' },
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

                <Button onClick={startRun} size="lg" disabled={!canStart}
                  className={`w-full text-white font-bold py-6 border-0 cursor-pointer disabled:opacity-60 disabled:cursor-default ${canStart ? 'text-2xl' : 'text-lg'}`}
                  style={{
                    background: canStart
                      ? 'linear-gradient(135deg, #f59e0b, #d97706, #b45309)'
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: canStart ? '0 0 20px rgba(245,158,11,0.3), 0 8px 24px rgba(0,0,0,0.3)' : 'none',
                  }}>
                  {canStart ? '⚡ 달리기 시작!' : '⏳ 선생님이 시작하면 자동으로 출발해요'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {pageView === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-full h-dvh">
            <GansikRunGame
              questions={gameQuestions}
              onGameEnd={handleGameEnd}
              playerId={playerId}
              durationSeconds={runDuration}
              initialScore={carryScore}
              onItemActivated={handleGansikRunItem}
              onScoreSnapshot={syncGansikRunScore}
              onQuizAnswered={handleQuizAnswered}
            />
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {pageView === 'result' && gameResult && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="min-h-dvh flex items-center justify-center p-4">
            <Card className="w-full max-w-lg border-0 shadow-2xl" style={{
              background: 'linear-gradient(135deg, rgba(15,15,35,0.95), rgba(25,15,50,0.95))',
              border: '2px solid rgba(139,92,246,0.3)',
              boxShadow: '0 0 40px rgba(139,92,246,0.15), 0 20px 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}>
              <CardHeader className="text-center pb-2">
                {/* spring은 키프레임 2개까지만 지원한다(motion 12) — 3개짜리 팝은 tween으로 */}
                <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.55, times: [0, 0.6, 1], ease: 'easeOut' }} className="mb-2">
                  <span className="text-7xl">{displayScore >= 500 ? '🏆' : displayScore >= 200 ? '⭐' : '🐕'}</span>
                </motion.div>
                <CardTitle className="text-4xl font-bold mb-1" style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>게임 종료!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center rounded-xl p-6" style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.1))',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}>
                  <div className="text-sm font-semibold" style={{ color: '#fbbf24' }}>최종 점수</div>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-5xl font-bold my-2" style={{ color: '#fbbf24' }}>
                    🦴 {displayScore.toLocaleString()}
                  </motion.div>
                  <div className="text-xs" style={{ color: 'rgba(200,200,230,0.5)' }}>
                    {formatTime(gameResult.elapsed)} 달림 · 최고 콤보 {gameResult.maxCombo}
                  </div>
                </div>

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
                    🔄 이어서 달리기
                  </Button>
                  <Button onClick={handleExit} size="lg" variant="outline"
                    className="flex-1 font-bold text-xl py-5 cursor-pointer"
                    style={{
                      border: '2px solid rgba(255,255,255,0.15)',
                      color: 'rgba(200,200,230,0.7)',
                      background: 'rgba(255,255,255,0.05)',
                    }}>
                    🏁 결과 보기
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
