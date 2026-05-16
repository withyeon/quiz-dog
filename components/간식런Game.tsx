'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type GansikRunState, type Lane, type ItemType,
  createInitialState, gameTick, moveLane, handleQuizResult,
  getCurrentSpeed, formatTime, GAME, ITEM_DEFS, OBSTACLE_EMOJIS, addFloatingText,
} from '@/lib/game/간식런'
import {
  type RenderState, createRenderState, project, laneX,
  drawSky, drawRoad, drawSideTrees, drawDog,
  drawObstacle, drawBone, drawBox,
  drawParticles, updateParticles, spawnParticles,
  drawSpeedLines, drawMagnetField,
} from '@/lib/game/간식런Renderer'
import ItemRoulette from '@/components/ItemRoulette'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import { checkQuestionAnswer } from '@/lib/services/questions'

interface GansikRunQuestion {
  id: string
  question_text: string
  options: string[]
  answer: string
}

interface GansikRunGameProps {
  questions: GansikRunQuestion[]
  onGameEnd: (state: GansikRunState) => void
  playerId?: string | null
  onItemActivated?: (
    item: ItemType,
    state: GansikRunState,
  ) => Promise<{ scoreDelta?: number; message?: string } | void> | { scoreDelta?: number; message?: string } | void
  onScoreSnapshot?: (state: GansikRunState) => void
}

type ScreenAttackType = 'screen_flip' | 'screen_shrink'

type GansikRunEffectPayload = {
  mode?: string
  effect?: ScreenAttackType
  item?: ItemType
  sourcePlayerId?: string | null
  sourceName?: string
  targetPlayerId?: string | null
  durationMs?: number
  expiresAt?: number
}

type ActiveScreenAttack = {
  id: string
  type: ScreenAttackType
  sourceName: string
  expiresAt: number
}

export default function GansikRunGame({ questions, onGameEnd, playerId, onItemActivated, onScoreSnapshot }: GansikRunGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GansikRunState>(createInitialState())
  const renderRef = useRef<RenderState>(createRenderState())
  const animRef = useRef<number>(0)
  const questionIndexRef = useRef(0)
  const prevScoreRef = useRef(0)
  const [, forceUpdate] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ w: 400, h: 700 })
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQ, setCurrentQ] = useState<GansikRunQuestion | null>(null)
  const [quizTimer, setQuizTimer] = useState<number>(GAME.QUIZ_TIMEOUT)
  const [rouletteItem, setRouletteItem] = useState<ItemType | null>(null)
  const [showRoulette, setShowRoulette] = useState(false)
  const [screenAttacks, setScreenAttacks] = useState<ActiveScreenAttack[]>([])
  const [itemCutIn, setItemCutIn] = useState<ItemType | null>(null)

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const cutInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rouletteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAnsweringRef = useRef(false)

  // ─── 캔버스 크기 ───
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return
      const { clientWidth: w, clientHeight: h } = containerRef.current
      setCanvasSize({ w, h })
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ─── 키보드 입력 ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showQuiz) return
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault()
        stateRef.current = moveLane(stateRef.current, 'left')
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault()
        stateRef.current = moveLane(stateRef.current, 'right')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showQuiz])

  // ─── 터치 입력 ───
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || showQuiz) return
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      if (Math.abs(dx) > 30) {
        stateRef.current = moveLane(stateRef.current, dx < 0 ? 'left' : 'right')
      }
      touchStartRef.current = null
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [showQuiz])

  // ─── 퀴즈 트리거 ───
  useEffect(() => {
    const state = stateRef.current
    if (state.isQuizActive && !showQuiz) {
      const q = questions[questionIndexRef.current % questions.length]
      questionIndexRef.current++
      isAnsweringRef.current = false
      setCurrentQ(q)
      setShowQuiz(true)
      setQuizTimer(GAME.QUIZ_TIMEOUT)
    }
  })

  // ─── 퀴즈 답변 ───
  const handleAnswer = useCallback(async (answer: string) => {
    if (!currentQ || isAnsweringRef.current) return
    isAnsweringRef.current = true

    const submittedAnswer = answer.trim()
    let correct = false

    if (submittedAnswer) {
      const localAnswer = currentQ.answer.trim()
      if (localAnswer) {
        correct = submittedAnswer === localAnswer
      } else {
        try {
          correct = await checkQuestionAnswer(currentQ.id, submittedAnswer)
        } catch (error) {
          console.error('간식런 채점 실패:', error)
          correct = false
        }
      }
    }

    stateRef.current = handleQuizResult(stateRef.current, correct)
    setShowQuiz(false)
    setCurrentQ(null)
    isAnsweringRef.current = false
  }, [currentQ])

  // ─── 퀴즈 타이머 ───
  useEffect(() => {
    if (!showQuiz) return
    if (quizTimer <= 0) {
      void handleAnswer('')
      return
    }
    const t = setTimeout(() => setQuizTimer(q => q - 1), 1000)
    return () => clearTimeout(t)
  }, [showQuiz, quizTimer, handleAnswer])

  // ─── 아이템 룰렛 트리거 ───
  useEffect(() => {
    const s = stateRef.current
    if (s._lastBoxItem && !showRoulette) {
      const item = s._lastBoxItem
      setRouletteItem(item)
      setItemCutIn(item)
      setShowRoulette(false)
      delete s._lastBoxItem

      if (cutInTimerRef.current) clearTimeout(cutInTimerRef.current)
      if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current)
      cutInTimerRef.current = setTimeout(() => setItemCutIn(null), 500)
      rouletteTimerRef.current = setTimeout(() => setShowRoulette(true), 360)

      if (onItemActivated) {
        void Promise.resolve(onItemActivated(item, s)).then((result) => {
          if (!result) return
          const nextScore = Math.max(0, stateRef.current.score + (result.scoreDelta ?? 0))
          stateRef.current = {
            ...stateRef.current,
            score: nextScore,
          }
          if (result.message) {
            stateRef.current = addFloatingText(stateRef.current, result.message, 0.5, 180, '#fbbf24', 18)
          }
        })
      }
    }
  })

  useEffect(() => {
    return () => {
      if (cutInTimerRef.current) clearTimeout(cutInTimerRef.current)
      if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current)
    }
  }, [])

  // ─── 다른 친구가 보낸 화면 공격 수신 ───
  useEffect(() => {
    const unsubscribe = subscribeRoomRuntimeEvent((event) => {
      if (event.type !== 'game:effect') return
      const payload = event.payload as GansikRunEffectPayload | undefined
      if (!payload || payload.mode !== 'treat_rush') return
      if (payload.sourcePlayerId && payload.sourcePlayerId === playerId) return
      if (payload.targetPlayerId && payload.targetPlayerId !== playerId) return
      if (payload.effect !== 'screen_flip' && payload.effect !== 'screen_shrink') return

      const durationMs = payload.durationMs ?? 7000
      const expiresAt = payload.expiresAt ?? Date.now() + durationMs
      const attack: ActiveScreenAttack = {
        id: `${payload.effect}-${event.seq}-${Date.now()}`,
        type: payload.effect,
        sourceName: payload.sourceName ?? '친구',
        expiresAt,
      }

      setScreenAttacks((prev) => [
        ...prev.filter((item) => item.type !== attack.type || item.expiresAt > Date.now()),
        attack,
      ])

      window.setTimeout(() => {
        setScreenAttacks((prev) => prev.filter((item) => item.id !== attack.id))
      }, Math.max(0, expiresAt - Date.now()))
    })

    return unsubscribe
  }, [playerId])

  const handleRouletteComplete = useCallback(() => {
    setShowRoulette(false)
    setRouletteItem(null)
  }, [])

  // ─── 게임 루프 + 3D 캔버스 렌더링 ───
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h } = canvasSize
    canvas.width = w
    canvas.height = h
    const r = renderRef.current

    const loop = () => {
      // 게임 틱
      stateRef.current = gameTick(stateRef.current, h)
      const state = stateRef.current

      if (state.gameOver) {
        onGameEnd(state)
        return
      }

      if (state._events.includes('box_drop')) {
        r.shakeDuration = Math.max(r.shakeDuration, 16)
        r.cameraPunchFrames = 22
        r.cameraPunchMax = 22
        const dropY = h * 0.32
        for (let lane = 0; lane < 3; lane++) {
          const dropX = laneX(lane, 0.22, w)
          r.particles = spawnParticles(r.particles, dropX, dropY, 'sparkle', 10)
        }
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(35)
        }
      }

      if (state._events.includes('box_collect')) {
        r.shakeDuration = Math.max(r.shakeDuration, 8)
        const dogX = laneX(state.lane, 0.82, w)
        r.particles = spawnParticles(r.particles, dogX, h * 0.7, 'sparkle', 18)
      }

      if (state.frameCount > 0 && state.frameCount % 300 === 0) {
        onScoreSnapshot?.(state)
      }

      const speed = getCurrentSpeed(state.elapsed) * (state.isQuizActive ? GAME.SLOWMO_RATE : state.speedMultiplier)
      r.stripeOffset = (r.stripeOffset + speed * 2) % 600
      r.treeOffset = (r.treeOffset + speed * 1.5) % 960

      // 충돌 시 화면 흔들림
      if (state.score < prevScoreRef.current - 50) {
        r.shakeDuration = 12
      }
      prevScoreRef.current = state.score

      if (r.shakeDuration > 0) {
        r.shakeX = (Math.random() - 0.5) * 6 * (r.shakeDuration / 12)
        r.shakeY = (Math.random() - 0.5) * 6 * (r.shakeDuration / 12)
        r.shakeDuration--
      } else {
        r.shakeX = 0
        r.shakeY = 0
      }

      const cameraPunchProgress = r.cameraPunchMax > 0
        ? 1 - r.cameraPunchFrames / r.cameraPunchMax
        : 1
      const cameraZoom = r.cameraPunchFrames > 0
        ? 1 + Math.sin(cameraPunchProgress * Math.PI) * 0.075
        : 1
      if (r.cameraPunchFrames > 0) {
        r.cameraPunchFrames--
      }

      // 달리기 먼지 파티클 (3프레임마다)
      if (state.frameCount % 3 === 0) {
        const playerT = 0.82
        const px = laneX(state.lane, playerT, w)
        const py = h * 0.78
        r.particles = spawnParticles(r.particles, px + (Math.random() - 0.5) * 15, py + 15, 'dust', 1)
      }

      r.particles = updateParticles(r.particles)

      ctx.save()
      ctx.translate(r.shakeX, r.shakeY)
      if (cameraZoom > 1) {
        const focusX = w / 2
        const focusY = h * 0.58
        ctx.translate(focusX, focusY)
        ctx.scale(cameraZoom, cameraZoom)
        ctx.translate(-focusX, -focusY)
      }

      // ── 배경 ──
      drawSky(ctx, w, h, state.frameCount)

      // ── 도로 양옆 풀밭 ──
      const vy = h * 0.28
      const grassGrad = ctx.createLinearGradient(0, vy, 0, h)
      grassGrad.addColorStop(0, '#1a3a2a')
      grassGrad.addColorStop(1, '#2d5a3a')
      ctx.fillStyle = grassGrad
      ctx.fillRect(0, vy, w, h - vy)

      // ── 3D 도로 ──
      drawRoad(ctx, w, h, r.stripeOffset)

      // ── 나무 ──
      drawSideTrees(ctx, w, h, r.treeOffset)

      // ── 속도 라인 ──
      drawSpeedLines(ctx, w, h, state.speedMultiplier, state.frameCount)

      // ── 오브젝트 렌더링 (원근 적용) ──
      // 멀리 있는 것부터 (y가 작은 것부터) 그리기
      const sortedObjs = [...state.objects].filter(o => !o.collected).sort((a, b) => a.y - b.y)

      for (const obj of sortedObjs) {
        if (obj.y < -80 || obj.y > h + 80) continue
        const { screenY, scale } = project(obj.y, h)
        const t = Math.max(0, Math.min(1, (obj.y + 60) / (h + 160)))
        const ox = laneX(obj.lane, t, w)

        if (scale < 0.08) continue  // 너무 작으면 스킵

        if (obj.type === 'obstacle') {
          drawObstacle(ctx, ox, screenY, scale, 0)
        } else if (obj.type === 'bone') {
          drawBone(ctx, ox, screenY, scale, false, state.frameCount)
        } else if (obj.type === 'golden_bone') {
          drawBone(ctx, ox, screenY, scale, true, state.frameCount)
        } else if (obj.type === 'box') {
          drawBox(ctx, ox, screenY, scale, state.frameCount, state.frameCount - (obj.spawnedAt ?? state.frameCount))
        }
      }

      // ── 강아지 캐릭터 (고정 위치) ──
      const playerT = 0.82
      const dogX = laneX(state.lane, playerT, w)
      const dogY = h * 0.75
      const dogSize = 50

      // 자석 이펙트
      if (state.isMagnetActive) {
        drawMagnetField(ctx, dogX, dogY, dogSize, state.frameCount)
      }

      drawDog(ctx, dogX, dogY, dogSize,
        state.frameCount, state.isBigDog, state.hasShield, state.isDrone, state.invincibleTimer)

      // ── 파티클 ──
      drawParticles(ctx, r.particles)

      // ── 하단 비네트 ──
      const vignette = ctx.createLinearGradient(0, h - 80, 0, h)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.3)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, h - 80, w, 80)

      ctx.restore()

      forceUpdate(c => c + 1)
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [canvasSize, onGameEnd, onScoreSnapshot])

  const state = stateRef.current
  const displayScore = Math.max(0, state.score)
  const activeEffects = state.activeItems.filter(i => i.remaining > 0)
  const activeScreenAttacks = screenAttacks.filter((attack) => attack.expiresAt > Date.now())
  const isScreenFlipped = activeScreenAttacks.some((attack) => attack.type === 'screen_flip')
  const isScreenShrunk = activeScreenAttacks.some((attack) => attack.type === 'screen_shrink')

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ fontFamily: 'BMJUA, sans-serif' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{
          transform: `${isScreenFlipped ? 'rotate(180deg)' : ''} ${isScreenShrunk ? 'scale(0.68)' : ''}`.trim() || 'none',
          transformOrigin: 'center center',
          transition: 'transform 220ms ease',
        }}
      />

      <AnimatePresence>
        {activeScreenAttacks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-xl px-4 py-2 text-center text-sm font-bold text-white pointer-events-none"
            style={{
              background: 'rgba(15,23,42,0.82)',
              border: '1px solid rgba(251,191,36,0.45)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {isScreenFlipped && '🔄 화면 뒤집힘'}
            {isScreenFlipped && isScreenShrunk && ' + '}
            {isScreenShrunk && '🔍 화면 축소'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD ── */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        {/* 상단 바 */}
        <div className="flex items-center justify-between px-3 py-2" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
        }}>
          {/* 점수 */}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 0 8px rgba(245,158,11,0.5)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <ellipse cx="8" cy="7" rx="3" ry="2" />
                <circle cx="3.5" cy="5.5" r="2" />
                <circle cx="3.5" cy="8.5" r="2" />
                <circle cx="12.5" cy="5.5" r="2" />
                <circle cx="12.5" cy="8.5" r="2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tabular-nums" style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(245,158,11,0.3)',
            }}>
              {displayScore.toLocaleString()}
            </span>
          </div>

          {/* 타이머 */}
          <div className="flex items-center gap-1.5">
            <div className={`px-3 py-1 rounded-lg font-bold text-lg tabular-nums ${
              state.timeRemaining <= 30
                ? 'text-red-400 animate-pulse'
                : 'text-white'
            }`} style={{
              background: state.timeRemaining <= 30
                ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
              border: state.timeRemaining <= 30
                ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.15)',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}>
              {formatTime(state.timeRemaining)}
            </div>
          </div>

          {/* 활성 아이템 */}
          <div className="flex items-center gap-1">
            {activeEffects.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs" style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(4px)',
              }}>
                <span className="text-sm">{ITEM_DEFS[item.type].emoji}</span>
                <span className="text-white font-bold tabular-nums">{Math.ceil(item.remaining / 60)}s</span>
              </div>
            ))}
            {state.hasShield && (
              <div className="rounded-md px-1.5 py-0.5 text-sm" style={{
                background: 'rgba(6,182,212,0.25)',
                border: '1px solid rgba(6,182,212,0.4)',
              }}>🛡️</div>
            )}
          </div>
        </div>

        {/* 속도 인디케이터 */}
        {state.speedMultiplier > 1 && (
          <div className="flex justify-center mt-1">
            <div className="px-3 py-0.5 rounded-full text-xs font-bold text-white animate-pulse" style={{
              background: 'linear-gradient(90deg, rgba(249,115,22,0.8), rgba(239,68,68,0.8))',
              boxShadow: '0 0 12px rgba(249,115,22,0.4)',
            }}>
              ⚡ {state.speedMultiplier}x SPEED
            </div>
          </div>
        )}
      </div>

      {/* ── 카트라이더 스타일 아이템 룰렛 ── */}
      <AnimatePresence>
        {itemCutIn && (
          <motion.div
            key={`cutin-${itemCutIn}`}
            initial={{ opacity: 0, scale: 0.72, y: 16 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.72, 1.18, 1.06, 0.94], y: [16, 0, 0, -10] }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, times: [0, 0.22, 0.78, 1] }}
            className="absolute inset-0 z-[55] flex items-center justify-center pointer-events-none"
            style={{ fontFamily: 'BMJUA, sans-serif' }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(circle at center, rgba(251,191,36,0.24), rgba(0,0,0,0) 42%)',
            }} />
            <div className="relative flex items-center gap-4 px-7 py-4" style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(49,46,129,0.9))',
              border: '2px solid rgba(251,191,36,0.78)',
              boxShadow: '0 0 34px rgba(251,191,36,0.42), 0 18px 55px rgba(0,0,0,0.42)',
              transform: 'skew(-7deg)',
            }}>
              <div className="text-5xl" style={{ transform: 'skew(7deg)' }}>{ITEM_DEFS[itemCutIn].emoji}</div>
              <div style={{ transform: 'skew(7deg)' }}>
                <div className="text-xs font-black tracking-[0.22em] text-amber-200">ITEM GET</div>
                <div className="text-3xl font-black text-white leading-none">{ITEM_DEFS[itemCutIn].name}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoulette && rouletteItem && (
          <ItemRoulette
            key={`roulette-${rouletteItem}-${Date.now()}`}
            item={rouletteItem}
            onComplete={handleRouletteComplete}
          />
        )}
      </AnimatePresence>

      {/* ── 퀴즈 슬라이드업 ── */}
      <AnimatePresence>
        {showQuiz && currentQ && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-40"
            style={{
              maxHeight: '45%',
              background: 'linear-gradient(180deg, rgba(15,15,30,0.95) 0%, rgba(20,10,40,0.98) 100%)',
              backdropFilter: 'blur(16px)',
              borderTop: '3px solid rgba(139,92,246,0.6)',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -8px 32px rgba(139,92,246,0.3)',
            }}
          >
            <div className="p-4">
              {/* 퀴즈 타이머 */}
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold" style={{
                  background: 'linear-gradient(90deg, #a78bfa, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>⚡ QUIZ TIME</span>
                <div className={`px-3 py-1 rounded-full font-bold text-sm ${
                  quizTimer <= 3 ? 'animate-pulse' : ''
                }`} style={{
                  background: quizTimer <= 3
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'rgba(139,92,246,0.2)',
                  color: quizTimer <= 3 ? '#fff' : '#c4b5fd',
                  border: quizTimer <= 3
                    ? '1px solid rgba(239,68,68,0.5)'
                    : '1px solid rgba(139,92,246,0.3)',
                }}>
                  {quizTimer}초
                </div>
              </div>

              {/* 문제 */}
              <h3 className="text-lg font-bold text-white mb-3 leading-snug">{currentQ.question_text}</h3>

              {/* 4지선다 */}
              <div className="grid grid-cols-2 gap-2">
                {currentQ.options.map((opt, i) => {
                  const colors = [
                    ['#ef4444', '#dc2626'],
                    ['#3b82f6', '#2563eb'],
                    ['#f59e0b', '#d97706'],
                    ['#10b981', '#059669'],
                  ]
                  return (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAnswer(opt)}
                      className="rounded-xl px-3 py-3 text-left font-semibold text-white transition-all pointer-events-auto"
                      style={{
                        background: `linear-gradient(135deg, ${colors[i][0]}dd, ${colors[i][1]}dd)`,
                        border: `2px solid ${colors[i][0]}66`,
                        boxShadow: `0 4px 12px ${colors[i][0]}33`,
                      }}
                    >
                      <span className="font-bold mr-2 opacity-70">{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 모바일 조작 버튼 ── */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-between pointer-events-none md:hidden">
        <button
          onTouchStart={() => { stateRef.current = moveLane(stateRef.current, 'left') }}
          className="pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold active:scale-90 transition-transform"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >←</button>
        <button
          onTouchStart={() => { stateRef.current = moveLane(stateRef.current, 'right') }}
          className="pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold active:scale-90 transition-transform"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >→</button>
      </div>
    </div>
  )
}
