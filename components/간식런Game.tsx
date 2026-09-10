'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isQuizAnswerMatch } from '@/lib/quiz/answerMatching'
import { displayBlankText } from '@/lib/quiz/blankText'
import { getOptionLabel } from '@/lib/quiz/optionLabels'
import {
  type GansikRunState, type ItemType,
  createInitialState, gameTick, moveLane, handleQuizResult, jump, slide,
  getCurrentSpeed, formatTime, GAME, ITEM_DEFS, addFloatingText, WORLD_H,
} from '@/lib/game/간식런'
import {
  type RenderState, createRenderState, project, laneX, playerRow, SIZE,
  drawSky, drawRoad, drawSideTrees, drawDog,
  drawObstacle, drawObstacleLow, drawObstacleHigh, drawBone, drawBox,
  drawParticles, updateParticles, spawnParticles,
  drawSpeedLines, drawMagnetField, drawChaser, drawChaserWarning,
  drawTunnelVision, drawGhostTrail, drawFloatingTexts, drawComboGauge,
} from '@/lib/game/간식런Renderer'
import { loadSprites, type SpriteSet } from '@/lib/game/간식런Sprites'
import ItemRoulette from '@/components/ItemRoulette'
import QuestionImage from '@/components/QuestionImage'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import { checkQuestionAnswer } from '@/lib/services/questions'

export interface GansikRunQuestion {
  id: string
  question_text: string
  options: string[]
  answer: string
  type?: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  image_url?: string | null
}

interface GansikRunGameProps {
  questions: GansikRunQuestion[]
  onGameEnd: (state: GansikRunState) => void
  playerId?: string | null
  /** 이 판의 제한 시간(초). 방에 시간이 정해져 있으면 남은 시간을 넘긴다. */
  durationSeconds?: number
  /** 이어서 달릴 때 시작 점수 */
  initialScore?: number
  onItemActivated?: (
    item: ItemType,
    state: GansikRunState,
  ) => Promise<{ scoreDelta?: number; message?: string } | void> | { scoreDelta?: number; message?: string } | void
  onScoreSnapshot?: (state: GansikRunState) => void
  /** 퀴즈를 풀 때마다 (정답 기록용) */
  onQuizAnswered?: (question: GansikRunQuestion, correct: boolean, answer: string) => void
}

type ScreenAttackType = 'screen_flip' | 'screen_shrink'

type GansikRunEffectPayload = {
  mode?: string
  effect?: ScreenAttackType | 'score_steal'
  item?: ItemType
  sourcePlayerId?: string | null
  sourceName?: string
  targetPlayerId?: string | null
  durationMs?: number
  expiresAt?: number
  amount?: number
}

type ActiveScreenAttack = {
  id: string
  type: ScreenAttackType
  sourceName: string
  expiresAt: number
}

const OPTION_COLORS = [
  ['#ef4444', '#dc2626'],
  ['#3b82f6', '#2563eb'],
  ['#f59e0b', '#d97706'],
  ['#10b981', '#059669'],
]

export default function GansikRunGame({
  questions, onGameEnd, playerId, durationSeconds, initialScore = 0, onItemActivated, onScoreSnapshot, onQuizAnswered,
}: GansikRunGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // 초기 상태는 한 번만 만든다 (createInitialState는 id 카운터를 리셋한다).
  const [initialState] = useState(() => {
    const s = createInitialState(durationSeconds ?? GAME.DURATION)
    return initialScore > 0 ? { ...s, score: Math.floor(initialScore), lastMilestone: Math.floor(initialScore / 100) * 100 } : s
  })
  const stateRef = useRef<GansikRunState>(initialState)
  const renderRef = useRef<RenderState>(createRenderState())
  const spritesRef = useRef<SpriteSet | null>(null)
  const animRef = useRef<number>(0)
  const questionIndexRef = useRef(0)
  const [, forceUpdate] = useState(0)
  const lastHudRef = useRef({ score: -1, time: -1, speed: -1, chaser: false, itemCount: -1, shield: false })
  const [canvasSize, setCanvasSize] = useState({ w: 400, h: 700 })
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQ, setCurrentQ] = useState<GansikRunQuestion | null>(null)
  const [quizTimer, setQuizTimer] = useState<number>(GAME.QUIZ_TIMEOUT)
  const [quizInput, setQuizInput] = useState('')
  const [rouletteItem, setRouletteItem] = useState<ItemType | null>(null)
  const [showRoulette, setShowRoulette] = useState(false)
  // 룰렛을 새로 열 때만 증가한다. key에 Date.now()를 쓰면 게임 루프가
  // HUD를 갱신하려고 리렌더할 때마다 key가 달라져서 룰렛이 통째로
  // 다시 마운트되고, 애니메이션이 처음부터 반복되며 끝나지 않는다.
  const [rouletteRound, setRouletteRound] = useState(0)
  const [screenAttacks, setScreenAttacks] = useState<ActiveScreenAttack[]>([])
  const [itemCutIn, setItemCutIn] = useState<ItemType | null>(null)
  const [isTouch, setIsTouch] = useState(false)

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const cutInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rouletteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAnsweringRef = useRef(false)
  const showQuizRef = useRef(false)

  // 부모가 매 렌더 새로 만드는 콜백이 게임 루프 effect의 의존성에 들어가면
  // 부모 리렌더마다 루프가 재시작된다. 전부 ref로 받는다.
  const questionsRef = useRef(questions)
  const onGameEndRef = useRef(onGameEnd)
  const onItemActivatedRef = useRef(onItemActivated)
  const onScoreSnapshotRef = useRef(onScoreSnapshot)
  const onQuizAnsweredRef = useRef(onQuizAnswered)
  useEffect(() => { onQuizAnsweredRef.current = onQuizAnswered }, [onQuizAnswered])
  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { onGameEndRef.current = onGameEnd }, [onGameEnd])
  useEffect(() => { onItemActivatedRef.current = onItemActivated }, [onItemActivated])
  useEffect(() => { onScoreSnapshotRef.current = onScoreSnapshot }, [onScoreSnapshot])

  // ─── 터치 기기 감지 (태블릿/폰에는 키보드가 없으므로 화면 버튼 제공) ───
  useEffect(() => {
    if (typeof window === 'undefined') return
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const forced = new URLSearchParams(window.location.search).get('touch') === '1'
    setIsTouch(forced || Boolean(coarse) || (navigator.maxTouchPoints ?? 0) > 0)
  }, [])

  // ─── 캔버스 크기 ───
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return
      const { clientWidth: w, clientHeight: h } = containerRef.current
      if (w > 0 && h > 0) setCanvasSize({ w, h })
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ─── 퀴즈 열기/답변 ───
  const openQuiz = useCallback(() => {
    const qs = questionsRef.current
    if (qs.length === 0) {
      const s = stateRef.current
      stateRef.current = { ...s, isQuizActive: false, nextQuizAt: s.elapsed + GAME.QUIZ_INTERVAL }
      return
    }
    const q = qs[questionIndexRef.current % qs.length]
    questionIndexRef.current++
    isAnsweringRef.current = false
    showQuizRef.current = true
    setQuizInput('')
    setCurrentQ(q)
    setQuizTimer(GAME.QUIZ_TIMEOUT)
    setShowQuiz(true)
  }, [])

  const handleAnswer = useCallback(async (answer: string) => {
    if (!currentQ || isAnsweringRef.current) return
    isAnsweringRef.current = true

    const submittedAnswer = answer.trim()
    let correct = false

    if (submittedAnswer) {
      const localAnswer = currentQ.answer.trim()
      if (localAnswer) {
        correct = isQuizAnswerMatch(submittedAnswer, localAnswer)
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
    onQuizAnsweredRef.current?.(currentQ, correct, submittedAnswer)
    showQuizRef.current = false
    setShowQuiz(false)
    setCurrentQ(null)
    setQuizInput('')
    isAnsweringRef.current = false
  }, [currentQ])

  const handleAnswerRef = useRef(handleAnswer)
  useEffect(() => { handleAnswerRef.current = handleAnswer }, [handleAnswer])
  const currentQRef = useRef(currentQ)
  useEffect(() => { currentQRef.current = currentQ }, [currentQ])

  // ─── 키보드 입력 ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showQuizRef.current) {
        // 객관식은 숫자키 1~4로도 고를 수 있다 (크롬북)
        const q = currentQRef.current
        const isChoice = q && (!q.type || q.type === 'CHOICE' || q.type === 'OX') && q.options.length > 0
        if (isChoice && /^[1-9]$/.test(e.key) && (e.target as HTMLElement | null)?.tagName !== 'INPUT') {
          const idx = Number(e.key) - 1
          if (idx < q.options.length) {
            e.preventDefault()
            void handleAnswerRef.current(q.options[idx])
          }
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        stateRef.current = moveLane(stateRef.current, 'left')
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        stateRef.current = moveLane(stateRef.current, 'right')
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        e.preventDefault()
        stateRef.current = jump(stateRef.current)
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        stateRef.current = slide(stateRef.current)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ─── 스와이프 입력 ───
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || showQuizRef.current) return
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        stateRef.current = moveLane(stateRef.current, dx < 0 ? 'left' : 'right')
      } else if (Math.abs(dy) > 30) {
        if (dy < 0) stateRef.current = jump(stateRef.current)
        else stateRef.current = slide(stateRef.current)
      }
      touchStartRef.current = null
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

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

  // ─── 아이템 획득 연출 (게임 루프에서 호출) ───
  const triggerItem = useCallback((item: ItemType, s: GansikRunState) => {
    setRouletteItem(item)
    setItemCutIn(item)
    setShowRoulette(false)

    if (cutInTimerRef.current) clearTimeout(cutInTimerRef.current)
    if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current)
    cutInTimerRef.current = setTimeout(() => setItemCutIn(null), 500)
    rouletteTimerRef.current = setTimeout(() => {
      setRouletteRound((prev) => prev + 1)
      setShowRoulette(true)
    }, 360)

    const callback = onItemActivatedRef.current
    if (callback) {
      void Promise.resolve(callback(item, s)).then((result) => {
        if (!result) return
        const nextScore = Math.max(0, stateRef.current.score + (result.scoreDelta ?? 0))
        stateRef.current = { ...stateRef.current, score: nextScore }
        if (result.message) {
          stateRef.current = addFloatingText(stateRef.current, result.message, 0.5, 200, '#fbbf24', 22, 90)
        }
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      if (cutInTimerRef.current) clearTimeout(cutInTimerRef.current)
      if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current)
    }
  }, [])

  // ─── 다른 친구가 보낸 공격 수신 ───
  useEffect(() => {
    const unsubscribe = subscribeRoomRuntimeEvent((event) => {
      if (event.type !== 'game:effect') return
      const payload = event.payload as GansikRunEffectPayload | undefined
      if (!payload || payload.mode !== 'treat_rush') return
      if (payload.sourcePlayerId && payload.sourcePlayerId === playerId) return
      if (payload.targetPlayerId && payload.targetPlayerId !== playerId) return

      // 점수 뺏기: 내 화면의 점수도 같이 깎여야 한다. 안 그러면 5초마다 올라가는
      // 내 점수 동기화가 서버의 감소를 도로 덮어써서 훔친 점수가 허공에서 생긴다.
      if (payload.effect === 'score_steal') {
        const amount = Math.max(0, Math.floor(payload.amount ?? 0))
        if (amount <= 0) return
        const s = stateRef.current
        stateRef.current = addFloatingText(
          { ...s, score: Math.max(0, s.score - amount) },
          `🕶️ ${payload.sourceName ?? '친구'}에게 -${amount}점!`,
          0.5, 200, '#f87171', 22, 90,
        )
        return
      }

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
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const { w, h } = canvasSize
    // 고해상도 화면(태블릿·크롬북 2x)에서 흐릿하지 않게 DPR 반영.
    // 단 캔버스 픽셀 수는 약 260만으로 제한 (2x 태블릿 세로 1600×2560은 너무 무겁다).
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(2.6e6 / (w * h))))
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const r = renderRef.current
    if (!spritesRef.current) spritesRef.current = loadSprites()
    const sprites = spritesRef.current
    const row = playerRow(w, h)
    const unitScale = row.unit / 150            // 파티클·텍스트 크기 보정
    const fontScale = Math.max(0.9, Math.min(1.7, unitScale))
    const yScale = h / WORLD_H
    const hudBottom = 104 // 상단 바 + 속도/추격자 배지 아래

    // 게임 틱은 실제 시간 기준 60Hz 고정. 프레임 수를 시간으로 쓰면 느린 기기에서
    // 게임이 슬로모션이 되고, 방의 실제 마감 시각과 어긋난다.
    const STEP_MS = 1000 / 60
    const MAX_STEPS = 4
    let lastTime = performance.now()
    let accumulator = 0

    const loop = (now: number) => {
      accumulator += Math.min(250, now - lastTime)
      lastTime = now
      const events: string[] = []
      let steps = 0
      while (accumulator >= STEP_MS && steps < MAX_STEPS && !stateRef.current.gameOver) {
        stateRef.current = gameTick(stateRef.current)
        accumulator -= STEP_MS
        steps++
        const ticked = stateRef.current
        if (ticked._events.length) events.push(...ticked._events)
        if (ticked.frameCount > 0 && ticked.frameCount % 300 === 0) {
          onScoreSnapshotRef.current?.(ticked)
        }
      }
      if (steps >= MAX_STEPS) accumulator = 0 // 아주 느린 기기: 밀린 틱은 버린다
      const state = stateRef.current

      if (state.gameOver) {
        onGameEndRef.current(state)
        return
      }

      // 퀴즈·아이템 연출은 루프에서 직접 연다. (React effect에 맡기면 부모가
      // 리렌더될 때까지 아무 일도 안 일어난다.)
      if (state.isQuizActive && !showQuizRef.current) openQuiz()
      if (state._lastBoxItem) {
        const item = state._lastBoxItem
        delete state._lastBoxItem
        triggerItem(item, state)
      }

      const dogLaneF = state.laneProgress < 1
        ? state.lane + (state.targetLane - state.lane) * state.laneProgress
        : state.lane
      const dogX = laneX(dogLaneF, row.t, w)
      const dogFeetY = row.screenY
      const dogW = row.unit * SIZE.dog

      if (events.includes('box_drop')) {
        r.shakeDuration = Math.max(r.shakeDuration, 16)
        r.cameraPunchFrames = 22
        r.cameraPunchMax = 22
        const drop = project(-30, w, h)
        for (let lane = 0; lane < 3; lane++) {
          r.particles = spawnParticles(r.particles, laneX(lane, drop.t, w), drop.screenY, 'sparkle', 10, unitScale)
        }
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(35)
        }
      }

      if (events.includes('box_collect')) {
        r.shakeDuration = Math.max(r.shakeDuration, 8)
        r.particles = spawnParticles(r.particles, dogX, dogFeetY - dogW * 0.5, 'sparkle', 18, unitScale)
      }

      if (events.includes('hit')) {
        r.shakeDuration = 12
        r.particles = spawnParticles(r.particles, dogX, dogFeetY - dogW * 0.4, 'hit', 14, unitScale)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(60)
        }
      }

      const speed = getCurrentSpeed(state.elapsed) * (state.isQuizActive ? GAME.SLOWMO_RATE : state.speedMultiplier)
      r.stripeOffset = (r.stripeOffset + speed * 2 * steps) % 600
      r.treeOffset = (r.treeOffset + speed * 1.5 * steps) % 960

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

      // 달리기 먼지 (3프레임마다)
      if (state.frameCount % 3 === 0 && state.jumpState === 'ground') {
        r.particles = spawnParticles(
          r.particles,
          dogX + (Math.random() - 0.5) * dogW * 0.4,
          dogFeetY + Math.random() * 4,
          'dust', 1, unitScale,
        )
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

      const vy = h * 0.28
      const grassGrad = ctx.createLinearGradient(0, vy, 0, h)
      grassGrad.addColorStop(0, '#1a3a2a')
      grassGrad.addColorStop(1, '#2d5a3a')
      ctx.fillStyle = grassGrad
      ctx.fillRect(0, vy, w, h - vy)

      drawRoad(ctx, w, h, r.stripeOffset)
      drawSideTrees(ctx, w, h, r.treeOffset)
      drawSpeedLines(ctx, w, h, state.speedMultiplier, state.frameCount)

      // ── 오브젝트 (멀리 있는 것부터) ──
      const sortedObjs = [...state.objects].filter(o => !o.collected).sort((a, b) => a.y - b.y)

      for (const obj of sortedObjs) {
        if (obj.y < -80 || obj.y > h + 80) continue
        const { screenY, t, unit } = project(obj.y, w, h)
        if (unit < 6) continue
        const ox = laneX(obj.lane, t, w)

        if (obj.type === 'obstacle') {
          drawObstacle(ctx, ox, screenY, unit, state.frameCount, sprites)
        } else if (obj.type === 'obstacle_low') {
          drawObstacleLow(ctx, ox, screenY, unit, state.frameCount, sprites)
        } else if (obj.type === 'obstacle_high') {
          drawObstacleHigh(ctx, ox, screenY, unit, state.frameCount, sprites)
        } else if (obj.type === 'bone') {
          drawBone(ctx, ox, screenY, unit, false, state.frameCount, sprites)
        } else if (obj.type === 'golden_bone') {
          drawBone(ctx, ox, screenY, unit, true, state.frameCount, sprites)
        } else if (obj.type === 'box') {
          drawBox(ctx, ox, screenY, unit, state.frameCount, state.frameCount - (obj.spawnedAt ?? state.frameCount), sprites)
        }
      }

      // ── 강아지 ──
      if (state.isMagnetActive) {
        drawMagnetField(ctx, dogX, dogFeetY - dogW * 0.5, dogW, state.frameCount)
      }

      if (state.speedMultiplier > 1) {
        r.ghostTrails.push({ x: dogX, y: dogFeetY, alpha: 0.5 })
        r.ghostTrails = r.ghostTrails
          .map(tr => ({ ...tr, alpha: tr.alpha - 0.05 }))
          .filter(tr => tr.alpha > 0)
          .slice(-8)
        drawGhostTrail(ctx, r.ghostTrails, dogW)
      } else {
        r.ghostTrails = []
      }

      drawDog(ctx, dogX, dogFeetY, dogW,
        state.frameCount, state.isBigDog, state.hasShield, state.isDrone, state.invincibleTimer,
        state.jumpProgress, state.slideProgress, sprites)

      // ── 추격자 (강아지 뒤 = 화면 아래쪽) ──
      drawChaser(ctx, laneX(dogLaneF, Math.min(1, row.t + 0.12), w), dogFeetY, row.unit, state.chaserDistance, state.frameCount, sprites)

      drawParticles(ctx, r.particles)
      drawTunnelVision(ctx, w, h, state.speedMultiplier)
      drawChaserWarning(ctx, w, h, state.chaserDistance, state.frameCount)

      // 하단 비네트
      const vignette = ctx.createLinearGradient(0, h - 80, 0, h)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.3)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, h - 80, w, 80)

      ctx.restore()

      // ── 점수 텍스트 · 콤보 (흔들림 밖) ──
      drawFloatingTexts(ctx, state.floatingTexts, w, fontScale, yScale)
      drawComboGauge(ctx, w, state.combo, state.comboTimer, GAME.COMBO_DECAY_FRAMES, hudBottom)

      const hud = lastHudRef.current
      const activeCount = state.activeItems.filter(i => i.remaining > 0).length
      if (
        hud.score !== state.score ||
        hud.time !== state.timeRemaining ||
        hud.speed !== state.speedMultiplier ||
        hud.chaser !== state.chaserWarning ||
        hud.itemCount !== activeCount ||
        hud.shield !== state.hasShield
      ) {
        hud.score = state.score
        hud.time = state.timeRemaining
        hud.speed = state.speedMultiplier
        hud.chaser = state.chaserWarning
        hud.itemCount = activeCount
        hud.shield = state.hasShield
        forceUpdate(c => c + 1)
      }
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [canvasSize, openQuiz, triggerItem])

  const state = stateRef.current
  const displayScore = Math.max(0, state.score)
  const activeEffects = state.activeItems.filter(i => i.remaining > 0)
  const activeScreenAttacks = screenAttacks.filter((attack) => attack.expiresAt > Date.now())
  const isScreenFlipped = activeScreenAttacks.some((attack) => attack.type === 'screen_flip')
  const isScreenShrunk = activeScreenAttacks.some((attack) => attack.type === 'screen_shrink')
  const isChoiceQuestion = !!currentQ
    && (!currentQ.type || currentQ.type === 'CHOICE' || currentQ.type === 'OX')
    && currentQ.options.length > 0

  const controlButton = (
    label: string,
    onPress: () => void,
    style: React.CSSProperties,
  ) => (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress() }}
      className="pointer-events-auto w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl text-white font-bold active:scale-90 transition-transform select-none"
      style={{ touchAction: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', ...style }}
      aria-label={label}
    >{label}</button>
  )

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}>
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
            className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-xl px-4 py-2 text-center text-sm font-bold text-white pointer-events-none whitespace-nowrap"
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
        <div className="flex items-center justify-between gap-2 px-3 py-2" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
        }}>
          {/* 점수 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 0 8px rgba(245,158,11,0.5)',
            }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="white">
                <ellipse cx="8" cy="7" rx="3" ry="2" />
                <circle cx="3.5" cy="5.5" r="2" />
                <circle cx="3.5" cy="8.5" r="2" />
                <circle cx="12.5" cy="5.5" r="2" />
                <circle cx="12.5" cy="8.5" r="2" />
              </svg>
            </div>
            <span className="text-xl md:text-2xl font-bold text-white tabular-nums" style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(245,158,11,0.3)',
            }}>
              {displayScore.toLocaleString()}
            </span>
          </div>

          {/* 타이머 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`px-3 py-1 rounded-lg font-bold text-lg md:text-xl tabular-nums ${
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
          <div className="flex items-center gap-1 min-w-[3rem] justify-end">
            {activeEffects.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap" style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(4px)',
              }}>
                <span className="text-base">{ITEM_DEFS[item.type].emoji}</span>
                <span className="text-white font-bold tabular-nums">{Math.ceil(item.remaining / 60)}s</span>
              </div>
            ))}
            {state.hasShield && (
              <div className="rounded-md px-1.5 py-0.5 text-base" style={{
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

        {/* 추격자 경고 */}
        {state.chaserWarning && (
          <div className="flex justify-center mt-1">
            <div className="px-3 py-0.5 rounded-full text-xs font-bold text-white animate-pulse" style={{
              background: 'linear-gradient(90deg, rgba(239,68,68,0.8), rgba(185,28,28,0.8))',
              boxShadow: '0 0 12px rgba(239,68,68,0.4)',
            }}>
              🐱 고양이가 바로 뒤에! 장애물을 피해요
            </div>
          </div>
        )}
      </div>

      {/* ── 아이템 획득 컷인 ── */}
      <AnimatePresence>
        {itemCutIn && (
          <motion.div
            key={`cutin-${itemCutIn}`}
            initial={{ opacity: 0, scale: 0.72, y: 16 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.72, 1.18, 1.06, 0.94], y: [16, 0, 0, -10] }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, times: [0, 0.22, 0.78, 1] }}
            className="absolute inset-0 z-[55] flex items-center justify-center pointer-events-none"
            style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}
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
            key={`roulette-${rouletteRound}`}
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
            className="absolute bottom-0 left-0 right-0 z-40 overflow-y-auto"
            style={{
              maxHeight: '55%',
              background: 'linear-gradient(180deg, rgba(15,15,30,0.95) 0%, rgba(20,10,40,0.98) 100%)',
              backdropFilter: 'blur(16px)',
              borderTop: '3px solid rgba(139,92,246,0.6)',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -8px 32px rgba(139,92,246,0.3)',
            }}
          >
            <div className="p-4 max-w-3xl mx-auto">
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

              {currentQ.image_url && (
                <QuestionImage
                  src={currentQ.image_url}
                  className="mb-3 bg-white/10"
                  maxHeightClass="max-h-28 md:max-h-40"
                />
              )}
              <h3 className="text-lg md:text-xl font-bold text-white mb-3 leading-snug whitespace-pre-wrap">
                {displayBlankText(currentQ.question_text)}
              </h3>

              {isChoiceQuestion ? (
                <div className="grid grid-cols-2 gap-2">
                  {currentQ.options.map((opt, i) => {
                    const colors = OPTION_COLORS[i % OPTION_COLORS.length]
                    return (
                      <motion.button
                        key={i}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAnswer(opt)}
                        className="rounded-xl px-3 py-3 text-left font-semibold text-white transition-all pointer-events-auto break-words"
                        style={{
                          background: `linear-gradient(135deg, ${colors[0]}dd, ${colors[1]}dd)`,
                          border: `2px solid ${colors[0]}66`,
                          boxShadow: `0 4px 12px ${colors[0]}33`,
                        }}
                      >
                        <span className="font-bold mr-2 opacity-70">{getOptionLabel(i)}</span>
                        {opt}
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <form
                  className="flex gap-2 pointer-events-auto"
                  onSubmit={(e) => { e.preventDefault(); if (quizInput.trim()) void handleAnswer(quizInput) }}
                >
                  <input
                    type="text"
                    value={quizInput}
                    onChange={(e) => setQuizInput(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    placeholder={currentQ.type === 'BLANK' ? '빈칸에 들어갈 말' : '답을 입력하세요'}
                    aria-label="정답 입력"
                    className="flex-1 min-w-0 rounded-xl px-4 py-3 text-base text-white outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '2px solid rgba(139,92,246,0.5)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!quizInput.trim()}
                    className="rounded-xl px-5 py-3 font-bold text-white disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                      border: '2px solid rgba(139,92,246,0.6)',
                    }}
                  >
                    제출
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 터치 조작 버튼 ── */}
      {isTouch && !showQuiz && (
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
          <div className="flex justify-between items-end">
            {controlButton('←', () => { stateRef.current = moveLane(stateRef.current, 'left') }, {
              background: 'rgba(255,255,255,0.14)',
              border: '2px solid rgba(255,255,255,0.25)',
            })}
            <div className="flex flex-col gap-2 items-center">
              {controlButton('↑', () => { stateRef.current = jump(stateRef.current) }, {
                background: 'rgba(16,185,129,0.25)',
                border: '2px solid rgba(16,185,129,0.5)',
              })}
              {controlButton('↓', () => { stateRef.current = slide(stateRef.current) }, {
                background: 'rgba(59,130,246,0.25)',
                border: '2px solid rgba(59,130,246,0.5)',
              })}
            </div>
            {controlButton('→', () => { stateRef.current = moveLane(stateRef.current, 'right') }, {
              background: 'rgba(255,255,255,0.14)',
              border: '2px solid rgba(255,255,255,0.25)',
            })}
          </div>
        </div>
      )}
    </div>
  )
}
