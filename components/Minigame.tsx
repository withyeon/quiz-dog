'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MinigameProps {
  characterImage: string
  onScoreChange?: (score: number) => void
}

interface FallingObject {
  id: number
  x: number
  y: number
  type: 'bomb' | 'coin' | 'rock'
  speed: number
  removed: boolean
}

const OBJ_SIZE = 40
const PLAYER_W = 64
const PLAYER_H = 64
const PLAYER_Y_FRAC = 0.88

export default function Minigame({ characterImage, onScoreChange }: MinigameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const playerXRef = useRef(0.5)
  const playerVelRef = useRef(0)
  const keysRef = useRef({ left: false, right: false })
  const objectsRef = useRef<FallingObject[]>([])
  const scoreRef = useRef(0)
  const gameOverRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const spawnTimerRef = useRef(0)
  const nextIdRef = useRef(0)

  const playerImgRef = useRef<HTMLImageElement | null>(null)
  const bombImgRef = useRef<HTMLImageElement | null>(null)
  const rockImgRef = useRef<HTMLImageElement | null>(null)
  const boneImgRef = useRef<HTMLImageElement | null>(null)
  const bgImgRef = useRef<HTMLImageElement | null>(null)

  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    const load = (src: string, ref: React.MutableRefObject<HTMLImageElement | null>) => {
      const img = new window.Image()
      img.src = src
      img.onload = () => { ref.current = img }
    }
    load(characterImage, playerImgRef)
    load('/mini-game/bomb.svg', bombImgRef)
    load('/mini-game/rock.svg', rockImgRef)
    load('/mini-game/bone.svg', boneImgRef)
    load('/background/mini-game.png', bgImgRef)
  }, [characterImage])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keysRef.current.left = true
      if (e.key === 'ArrowRight') keysRef.current.right = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keysRef.current.left = false
      if (e.key === 'ArrowRight') keysRef.current.right = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const startLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    gameOverRef.current = false
    scoreRef.current = 0
    playerXRef.current = 0.5
    playerVelRef.current = 0
    objectsRef.current = []
    spawnTimerRef.current = 0
    nextIdRef.current = 0
    lastTimeRef.current = null

    const loop = (now: number) => {
      if (gameOverRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 500
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      if (lastTimeRef.current === null) lastTimeRef.current = now
      const delta = Math.min(50, now - lastTimeRef.current)
      lastTimeRef.current = now

      // 플레이어 이동
      const friction = Math.pow(0.85, delta / 16.67)
      if (keysRef.current.left) playerVelRef.current -= 0.000007 * delta
      if (keysRef.current.right) playerVelRef.current += 0.000007 * delta
      playerVelRef.current *= friction
      playerVelRef.current = Math.max(-0.003, Math.min(0.003, playerVelRef.current))
      playerXRef.current += playerVelRef.current * delta
      playerXRef.current = Math.max(0.08, Math.min(0.92, playerXRef.current))

      // 오브젝트 스폰
      spawnTimerRef.current += delta
      const spawnInterval = Math.max(400, 800 - scoreRef.current * 0.5)
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current = 0
        const r = Math.random()
        const type: 'bomb' | 'coin' | 'rock' = r < 0.4 ? 'bomb' : r < 0.7 ? 'rock' : 'coin'
        objectsRef.current.push({
          id: nextIdRef.current++,
          x: (Math.random() * 0.8 + 0.1) * w,
          y: -OBJ_SIZE,
          type,
          speed: (1.5 + Math.random() + scoreRef.current * 0.01) * 0.12,
          removed: false,
        })
      }

      // 오브젝트 업데이트 + 충돌
      const playerPx = playerXRef.current * w
      const playerPy = h * PLAYER_Y_FRAC
      let hitGame = false

      for (const obj of objectsRef.current) {
        if (obj.removed) continue
        obj.y += obj.speed * delta
        const dx = Math.abs(obj.x - playerPx)
        const dy = Math.abs(obj.y - playerPy)
        if (dx < (OBJ_SIZE + PLAYER_W) * 0.35 && dy < (OBJ_SIZE + PLAYER_H) * 0.35) {
          obj.removed = true
          if (obj.type === 'coin') {
            scoreRef.current += 10
            setScore(scoreRef.current)
          } else {
            hitGame = true
          }
        }
      }

      if (hitGame) {
        gameOverRef.current = true
        setHighScore(prev => Math.max(prev, scoreRef.current))
        setGameOver(true)
        return
      }

      objectsRef.current = objectsRef.current.filter(o => !o.removed && o.y < h + OBJ_SIZE)

      // 배경 렌더링
      if (bgImgRef.current) {
        const img = bgImgRef.current
        const ir = img.width / img.height
        const cr = w / h
        let sw: number, sh: number, sx: number, sy: number
        if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0 }
        else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2 }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
      } else {
        ctx.fillStyle = '#7dd3fc'
        ctx.fillRect(0, 0, w, h)
      }

      // 오브젝트 렌더링
      for (const obj of objectsRef.current) {
        if (obj.removed) continue
        const img = obj.type === 'bomb' ? bombImgRef.current
          : obj.type === 'rock' ? rockImgRef.current
          : boneImgRef.current
        if (img) {
          ctx.drawImage(img, obj.x - OBJ_SIZE / 2, obj.y - OBJ_SIZE / 2, OBJ_SIZE, OBJ_SIZE)
        } else {
          ctx.fillStyle = obj.type === 'coin' ? '#fbbf24' : '#ef4444'
          ctx.beginPath()
          ctx.arc(obj.x, obj.y, OBJ_SIZE / 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 플레이어 렌더링
      if (playerImgRef.current) {
        ctx.drawImage(playerImgRef.current, playerPx - PLAYER_W / 2, playerPy - PLAYER_H / 2, PLAYER_W, PLAYER_H)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    startLoop()
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [startLoop])

  useEffect(() => {
    onScoreChange?.(score)
  }, [score, onScoreChange])

  const handleRestart = useCallback(() => {
    setGameOver(false)
    setScore(0)
    startLoop()
  }, [startLoop])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameOver) { handleRestart(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / rect.width
    playerVelRef.current += clickX < playerXRef.current ? -0.002 : 0.002
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameOver) return
    const rect = e.currentTarget.getBoundingClientRect()
    playerXRef.current = Math.max(0.08, Math.min(0.92, (e.touches[0].clientX - rect.left) / rect.width))
    playerVelRef.current = 0
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-lg cursor-pointer touch-none"
      onClick={handleClick}
      onTouchMove={handleTouchMove}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-5xl font-bold text-white drop-shadow-lg">{score}</div>
        {highScore > 0 && (
          <div className="text-sm text-white/80 font-semibold mt-1">최고: {highScore}</div>
        )}
      </div>

      {!gameOver && score < 50 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <p className="text-white text-sm font-semibold drop-shadow-lg animate-pulse">
            ← → 키 또는 클릭으로 이동 | 폭탄·운석 피하기 | 뼈다귀 모으기!
          </p>
        </div>
      )}

      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <div className="text-6xl font-bold text-white mb-4 drop-shadow-lg">게임 오버!</div>
            <div className="text-2xl text-white mb-6">점수: {score}</div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); handleRestart() }}
              className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-bold text-xl shadow-lg"
            >
              다시 시작
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
