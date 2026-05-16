'use client'

import { useEffect, useRef, useState } from 'react'

type FallingObject = {
  id: number
  x: number
  y: number
  size: number
  speed: number
  hit: boolean
}

export type DodgeResult = {
  hits: number
  blockedByUmbrella: number
  reward: number
}

type DodgeMiniGameProps = {
  durationSeconds: number
  baseReward: number
  questionIndex: number
  umbrella?: boolean
  cleaner?: boolean
  multiplier?: number
  invincible?: boolean
  poopBombed?: boolean
  paused?: boolean
  onComplete: (result: DodgeResult) => void
}

const PLAYER_SIZE = 52
const OBJECT_SIZE = 34

function rectsOverlap(a: DOMRectLike, b: DOMRectLike) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

type DOMRectLike = {
  x: number
  y: number
  width: number
  height: number
}

export default function DodgeMiniGame({
  durationSeconds,
  baseReward,
  questionIndex,
  umbrella = false,
  cleaner = false,
  multiplier = 1,
  invincible = false,
  poopBombed = false,
  paused = false,
  onComplete,
}: DodgeMiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const objectsRef = useRef<FallingObject[]>([])
  const playerXRef = useRef(0.5)
  const keysRef = useRef({ left: false, right: false })
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const spawnElapsedRef = useRef(0)
  const nextIdRef = useRef(1)
  const hitsRef = useRef(0)
  const umbrellaUsedRef = useRef(false)
  const completedRef = useRef(false)
  const cleanerUsedRef = useRef(false)
  const pausedRef = useRef(paused)
  const touchActiveRef = useRef(false)

  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const [hits, setHits] = useState(0)
  const [showBombWarning, setShowBombWarning] = useState(poopBombed)
  const [blocked, setBlocked] = useState(0)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!poopBombed) return
    const timer = window.setTimeout(() => setShowBombWarning(false), 1000)
    return () => window.clearTimeout(timer)
  }, [poopBombed])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        keysRef.current.left = true
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        keysRef.current.right = true
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        keysRef.current.left = false
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        keysRef.current.right = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const handleTouchStart = () => {
      touchActiveRef.current = true
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchActiveRef.current) return
      const rect = wrap.getBoundingClientRect()
      const x = event.touches[0].clientX - rect.left
      playerXRef.current = Math.max(0.08, Math.min(0.92, x / Math.max(1, rect.width)))
    }

    const handleTouchEnd = () => {
      touchActiveRef.current = false
    }

    wrap.addEventListener('touchstart', handleTouchStart, { passive: true })
    wrap.addEventListener('touchmove', handleTouchMove, { passive: true })
    wrap.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      wrap.removeEventListener('touchstart', handleTouchStart)
      wrap.removeEventListener('touchmove', handleTouchMove)
      wrap.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(320, rect.width) * ratio
      canvas.height = Math.max(420, rect.height) * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const complete = () => {
      if (completedRef.current) return
      completedRef.current = true
      const rawReward = baseReward * multiplier - hitsRef.current * 10
      onComplete({
        hits: hitsRef.current,
        blockedByUmbrella: umbrellaUsedRef.current ? 1 : 0,
        reward: Math.max(0, Math.round(rawReward)),
      })
    }

    const loop = (now: number) => {
      if (completedRef.current) return
      const width = canvas.clientWidth || 360
      const height = canvas.clientHeight || 560

      if (lastTimeRef.current === null) lastTimeRef.current = now
      const rawDelta = Math.min(48, now - lastTimeRef.current)
      lastTimeRef.current = now

      const delta = pausedRef.current ? 0 : rawDelta
      elapsedRef.current += delta
      spawnElapsedRef.current += delta

      if (!pausedRef.current) {
        const moveStep = delta * 0.0018
        if (keysRef.current.left) playerXRef.current -= moveStep
        if (keysRef.current.right) playerXRef.current += moveStep
        playerXRef.current = Math.max(0.08, Math.min(0.92, playerXRef.current))

        const difficulty = 1 + questionIndex * 0.15
        const baseInterval = poopBombed ? 430 : 860
        const spawnInterval = baseInterval / difficulty
        const fallSpeed = (poopBombed ? 0.25 : 0.19) * difficulty * (poopBombed ? 1.3 : 1)

        if (spawnElapsedRef.current >= spawnInterval) {
          spawnElapsedRef.current = 0
          objectsRef.current.push({
            id: nextIdRef.current,
            x: Math.random() * (width - OBJECT_SIZE) + OBJECT_SIZE / 2,
            y: -OBJECT_SIZE,
            size: OBJECT_SIZE,
            speed: fallSpeed + Math.random() * 0.08,
            hit: false,
          })
          nextIdRef.current += 1
        }

        if (cleaner && !cleanerUsedRef.current && elapsedRef.current >= 2000) {
          cleanerUsedRef.current = true
          objectsRef.current = []
        }

        const playerRect = {
          x: playerXRef.current * width - PLAYER_SIZE / 2,
          y: height - PLAYER_SIZE - 32,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
        }

        objectsRef.current = objectsRef.current
          .map((object) => ({ ...object, y: object.y + object.speed * delta }))
          .filter((object) => object.y < height + OBJECT_SIZE)

        for (const object of objectsRef.current) {
          if (object.hit || invincible) continue
          const objectRect = {
            x: object.x - object.size / 2,
            y: object.y - object.size / 2,
            width: object.size,
            height: object.size,
          }
          if (!rectsOverlap(playerRect, objectRect)) continue

          object.hit = true
          if (umbrella && !umbrellaUsedRef.current) {
            umbrellaUsedRef.current = true
            setBlocked(1)
            continue
          }
          hitsRef.current += 1
          setHits(hitsRef.current)
        }
      }

      const remaining = Math.max(0, durationSeconds - elapsedRef.current / 1000)
      setTimeLeft(Math.ceil(remaining * 10) / 10)

      ctx.clearRect(0, 0, width, height)
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#BAE6FD')
      sky.addColorStop(1, '#DCFCE7')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = '#BBF7D0'
      ctx.fillRect(0, height - 56, width, 56)

      ctx.font = '34px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const object of objectsRef.current) {
        if (object.hit) continue
        ctx.fillText('💩', object.x, object.y)
      }

      ctx.font = invincible ? '54px sans-serif' : '50px sans-serif'
      ctx.fillText(invincible ? '👑🐕' : '🐕', playerXRef.current * width, height - PLAYER_SIZE / 2 - 28)

      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.58)'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = '700 30px sans-serif'
        ctx.fillText('잠깐 멈춤', width / 2, height / 2)
      }

      if (remaining <= 0) {
        complete()
        return
      }

      rafRef.current = window.requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    rafRef.current = window.requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [baseReward, cleaner, durationSeconds, invincible, multiplier, onComplete, poopBombed, questionIndex, umbrella])

  const moveButton = (direction: 'left' | 'right') => {
    playerXRef.current += direction === 'left' ? -0.12 : 0.12
    playerXRef.current = Math.max(0.08, Math.min(0.92, playerXRef.current))
  }

  return (
    <div className="relative h-[min(72vh,620px)] min-h-[420px] w-full overflow-hidden rounded-[28px] border-4 border-slate-900 bg-sky-100 shadow-[6px_6px_0_#0f172a]">
      <div ref={wrapRef} className="h-full w-full touch-none">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div className="absolute left-4 top-4 flex gap-2">
        <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-2 font-black text-slate-900 shadow-[2px_2px_0_#0f172a]">
          {timeLeft.toFixed(1)}초
        </div>
        <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-2 font-black text-rose-600 shadow-[2px_2px_0_#0f172a]">
          맞음 {hits}
        </div>
        {blocked > 0 && (
          <div className="rounded-2xl border-2 border-slate-900 bg-cyan-100 px-4 py-2 font-black text-cyan-800 shadow-[2px_2px_0_#0f172a]">
            우산 방어!
          </div>
        )}
      </div>

      {showBombWarning && (
        <div className="absolute inset-x-4 top-20 rounded-3xl border-4 border-red-900 bg-red-100 px-5 py-4 text-center text-2xl font-black text-red-700 shadow-[4px_4px_0_#7f1d1d]">
          💣 똥폭탄 공격받음!
        </div>
      )}

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => moveButton('left')}
          className="rounded-3xl border-4 border-slate-900 bg-white py-4 text-4xl font-black shadow-[4px_4px_0_#0f172a]"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => moveButton('right')}
          className="rounded-3xl border-4 border-slate-900 bg-white py-4 text-4xl font-black shadow-[4px_4px_0_#0f172a]"
        >
          →
        </button>
      </div>
    </div>
  )
}
