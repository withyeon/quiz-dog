'use client'

import { useEffect, useRef, useState } from 'react'

type FallingObject = {
  id: number
  x: number
  y: number
  size: number
  speed: number
  vx: number
  rotation: number
  spin: number
  wobble: number
  variant: 'normal' | 'fast' | 'heavy'
  hit: boolean
}

type SplatParticle = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  maxLife: number
  color: string
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
const MASCOT_SRC = '/mascot_pome.png'

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
  const particlesRef = useRef<SplatParticle[]>([])
  const mascotImageRef = useRef<HTMLImageElement | null>(null)
  const playerXRef = useRef(0.5)
  const playerVelocityRef = useRef(0)
  const keysRef = useRef({ left: false, right: false })
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const spawnElapsedRef = useRef(0)
  const nextIdRef = useRef(1)
  const hitsRef = useRef(0)
  const streakRef = useRef(0)
  const umbrellaUsedRef = useRef(false)
  const completedRef = useRef(false)
  const cleanerUsedRef = useRef(false)
  const pausedRef = useRef(paused)
  const touchActiveRef = useRef(false)
  const shakeRef = useRef(0)
  const nearMissRef = useRef(0)

  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const [hits, setHits] = useState(0)
  const [showBombWarning, setShowBombWarning] = useState(poopBombed)
  const [blocked, setBlocked] = useState(0)
  const [nearMisses, setNearMisses] = useState(0)

  useEffect(() => {
    const image = new Image()
    image.src = MASCOT_SRC
    image.onload = () => {
      mascotImageRef.current = image
    }
  }, [])

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
        const acceleration = delta * 0.0000062
        const friction = Math.pow(0.86, delta / 16.67)
        if (keysRef.current.left) playerVelocityRef.current -= acceleration
        if (keysRef.current.right) playerVelocityRef.current += acceleration
        playerVelocityRef.current *= friction
        playerVelocityRef.current = Math.max(-0.0024, Math.min(0.0024, playerVelocityRef.current))
        playerXRef.current += playerVelocityRef.current * delta
        playerXRef.current = Math.max(0.08, Math.min(0.92, playerXRef.current))
        if (playerXRef.current <= 0.08 || playerXRef.current >= 0.92) {
          playerVelocityRef.current *= -0.25
        }

        const difficulty = 1 + questionIndex * 0.15
        const baseInterval = poopBombed ? 360 : 760
        const spawnInterval = baseInterval / difficulty
        const fallSpeed = (poopBombed ? 0.28 : 0.2) * difficulty * (poopBombed ? 1.35 : 1)

        if (spawnElapsedRef.current >= spawnInterval) {
          spawnElapsedRef.current = 0
          const variantRoll = Math.random()
          const variant = variantRoll > 0.88 ? 'heavy' : variantRoll > 0.68 ? 'fast' : 'normal'
          const size = variant === 'heavy' ? OBJECT_SIZE + 14 : variant === 'fast' ? OBJECT_SIZE - 4 : OBJECT_SIZE
          objectsRef.current.push({
            id: nextIdRef.current,
            x: Math.random() * (width - size) + size / 2,
            y: -size,
            size,
            speed: fallSpeed + Math.random() * (variant === 'fast' ? 0.18 : 0.1),
            vx: (Math.random() - 0.5) * (variant === 'heavy' ? 0.03 : 0.07),
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.012,
            wobble: Math.random() * Math.PI * 2,
            variant,
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
          .map((object) => ({
            ...object,
            x: Math.max(object.size / 2, Math.min(width - object.size / 2, object.x + object.vx * delta + Math.sin(object.wobble + elapsedRef.current * 0.006) * 0.12)),
            y: object.y + object.speed * delta,
            rotation: object.rotation + object.spin * delta,
          }))
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
          shakeRef.current = 260
          spawnSplat(object.x, object.y, object.variant === 'heavy' ? 18 : 12)
          if (umbrella && !umbrellaUsedRef.current) {
            umbrellaUsedRef.current = true
            setBlocked(1)
            continue
          }
          hitsRef.current += 1
          streakRef.current = 0
          setHits(hitsRef.current)
        }

        for (const object of objectsRef.current) {
          if (object.hit) continue
          const playerCenterX = playerXRef.current * width
          const playerTop = height - PLAYER_SIZE - 32
          const passedPlayer = object.y > playerTop + PLAYER_SIZE * 0.3 && object.y < playerTop + PLAYER_SIZE * 0.3 + object.speed * delta + 4
          const closeX = Math.abs(object.x - playerCenterX) < PLAYER_SIZE * 0.95
          if (passedPlayer && closeX) {
            nearMissRef.current += 1
            streakRef.current += 1
            setNearMisses(nearMissRef.current)
            spawnSplat(object.x, height - 58, 6, ['#fbbf24', '#fde68a', '#f59e0b'])
          }
        }

        particlesRef.current = particlesRef.current
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.vx * delta,
            y: particle.y + particle.vy * delta,
            vy: particle.vy + 0.0011 * delta,
            life: particle.life - delta,
          }))
          .filter((particle) => particle.life > 0)

        shakeRef.current = Math.max(0, shakeRef.current - delta)
      }

      const remaining = Math.max(0, durationSeconds - elapsedRef.current / 1000)
      setTimeLeft(Math.ceil(remaining * 10) / 10)

      ctx.clearRect(0, 0, width, height)
      ctx.save()
      if (shakeRef.current > 0) {
        const intensity = shakeRef.current / 260
        ctx.translate((Math.random() - 0.5) * 12 * intensity, (Math.random() - 0.5) * 8 * intensity)
      }
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#7dd3fc')
      sky.addColorStop(0.58, '#dbeafe')
      sky.addColorStop(1, '#bbf7d0')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      drawCloud(ctx, width * 0.18, 74, 1)
      drawCloud(ctx, width * 0.78, 112, 0.75)
      drawSpeedLines(ctx, width, height, Math.min(1, elapsedRef.current / 2000))

      ctx.fillStyle = '#BBF7D0'
      ctx.fillRect(0, height - 56, width, 56)
      ctx.fillStyle = '#86efac'
      for (let x = 0; x < width; x += 18) {
        ctx.fillRect(x, height - 58, 8, 5)
      }

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const object of objectsRef.current) {
        if (object.hit) continue
        const dangerY = height - 58
        const distanceToGround = dangerY - object.y
        if (distanceToGround < 180 && distanceToGround > 0) {
          const alpha = Math.max(0.08, 1 - distanceToGround / 180)
          ctx.fillStyle = `rgba(127, 29, 29, ${0.12 + alpha * 0.18})`
          ctx.beginPath()
          ctx.ellipse(object.x, height - 48, object.size * 0.55, object.size * 0.16, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        drawPoop(ctx, object)
      }

      for (const particle of particlesRef.current) {
        const alpha = Math.max(0, particle.life / particle.maxLife)
        ctx.globalAlpha = alpha
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * (0.4 + alpha * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      drawPlayer(ctx, mascotImageRef.current, playerXRef.current * width, height - PLAYER_SIZE / 2 - 28, invincible, playerVelocityRef.current)

      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.58)'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = '700 30px sans-serif'
        ctx.fillText('잠깐 멈춤', width / 2, height / 2)
      }
      ctx.restore()

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
    playerVelocityRef.current += direction === 'left' ? -0.0015 : 0.0015
    playerVelocityRef.current = Math.max(-0.0026, Math.min(0.0026, playerVelocityRef.current))
  }

  const spawnSplat = (
    x: number,
    y: number,
    count: number,
    colors = ['#7c2d12', '#92400e', '#451a03', '#f97316'],
  ) => {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.06 + Math.random() * 0.18
      particlesRef.current.push({
        id: nextIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.06,
        size: 3 + Math.random() * 5,
        life: 360 + Math.random() * 260,
        maxLife: 620,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
  }

  return (
    <div className="relative h-[min(72vh,620px)] min-h-[420px] w-full overflow-hidden rounded-[28px] border-4 border-slate-900 bg-sky-100 shadow-[6px_6px_0_#0f172a]">
      <div ref={wrapRef} className="h-full w-full touch-none">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-2 sm:left-4 sm:right-auto sm:top-4">
        <div className="rounded-2xl border-2 border-slate-900 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-[2px_2px_0_#0f172a] sm:px-4 sm:text-base">
          {timeLeft.toFixed(1)}초
        </div>
        <div className="rounded-2xl border-2 border-slate-900 bg-white px-3 py-2 text-sm font-black text-rose-600 shadow-[2px_2px_0_#0f172a] sm:px-4 sm:text-base">
          맞음 {hits}
        </div>
        {blocked > 0 && (
          <div className="rounded-2xl border-2 border-slate-900 bg-cyan-100 px-3 py-2 text-sm font-black text-cyan-800 shadow-[2px_2px_0_#0f172a] sm:px-4 sm:text-base">
            우산 방어!
          </div>
        )}
        {nearMisses > 0 && (
          <div className="rounded-2xl border-2 border-slate-900 bg-amber-100 px-3 py-2 text-sm font-black text-amber-800 shadow-[2px_2px_0_#0f172a] sm:px-4 sm:text-base">
            아슬아슬 {nearMisses}
          </div>
        )}
      </div>

      {showBombWarning && (
        <div className="absolute inset-x-4 top-20 rounded-3xl border-4 border-red-900 bg-red-100 px-5 py-4 text-center text-2xl font-black text-red-700 shadow-[4px_4px_0_#7f1d1d]">
          💣 똥폭탄 공격받음! 떨어지는 속도가 빨라져요
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

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save()
  ctx.globalAlpha = 0.72
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, 28 * scale, 0, Math.PI * 2)
  ctx.arc(x + 26 * scale, y - 8 * scale, 34 * scale, 0, Math.PI * 2)
  ctx.arc(x + 58 * scale, y, 26 * scale, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = 0.08 * alpha
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3
  for (let index = 0; index < 10; index += 1) {
    const x = (index / 10) * width + 20
    ctx.beginPath()
    ctx.moveTo(x, height * 0.2)
    ctx.lineTo(x - 36, height * 0.68)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPoop(ctx: CanvasRenderingContext2D, object: FallingObject) {
  ctx.save()
  ctx.translate(object.x, object.y)
  ctx.rotate(object.rotation)
  const scale = object.size / OBJECT_SIZE
  ctx.shadowColor = 'rgba(69, 26, 3, 0.28)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  ctx.font = `${object.variant === 'heavy' ? 42 * scale : 34 * scale}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(object.variant === 'fast' ? '💨' : '💩', 0, object.variant === 'fast' ? -2 : 0)
  if (object.variant === 'fast') {
    ctx.font = `${26 * scale}px sans-serif`
    ctx.fillText('💩', 9 * scale, 5 * scale)
  }
  ctx.restore()
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  invincible: boolean,
  velocity: number,
) {
  ctx.save()
  const lean = Math.max(-0.22, Math.min(0.22, velocity * 90))
  ctx.translate(x, y)
  ctx.rotate(lean)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)'
  ctx.beginPath()
  ctx.ellipse(0, 34, 34, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  if (invincible) {
    ctx.fillStyle = '#fbbf24'
    ctx.font = '32px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('👑', 0, -44)
  }
  if (image) {
    ctx.drawImage(image, -36, -42, 72, 74)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
