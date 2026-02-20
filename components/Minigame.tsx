'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

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
}

export default function Minigame({ characterImage, onScoreChange }: MinigameProps) {
  const [playerX, setPlayerX] = useState(50) // 플레이어 X 위치 (0-100)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [fallingObjects, setFallingObjects] = useState<FallingObject[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [isMovingLeft, setIsMovingLeft] = useState(false)
  const [isMovingRight, setIsMovingRight] = useState(false)
  const [backgroundStars, setBackgroundStars] = useState<Array<{ left: string; top: string }>>([])

  const objectIdRef = useRef(0)
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const spawnTimerRef = useRef<NodeJS.Timeout>()

  // Initialize background stars only on client-side to prevent hydration mismatch
  useEffect(() => {
    const stars = Array.from({ length: 20 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    }))
    setBackgroundStars(stars)
  }, [])

  // 플레이어 이동
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return
      if (e.key === 'ArrowLeft') setIsMovingLeft(true)
      if (e.key === 'ArrowRight') setIsMovingRight(true)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIsMovingLeft(false)
      if (e.key === 'ArrowRight') setIsMovingRight(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameOver])

  // 플레이어 위치 업데이트
  useEffect(() => {
    if (gameOver) return

    const moveInterval = setInterval(() => {
      setPlayerX(prev => {
        let newX = prev
        if (isMovingLeft) newX = Math.max(10, prev - 3)
        if (isMovingRight) newX = Math.min(90, prev + 3)
        return newX
      })
    }, 16)

    return () => clearInterval(moveInterval)
  }, [isMovingLeft, isMovingRight, gameOver])

  // 장애물/코인 생성
  useEffect(() => {
    if (gameOver) return

    const spawnObject = () => {
      const random = Math.random()
      const type: FallingObject['type'] =
        random < 0.4 ? 'bomb' :
          random < 0.7 ? 'rock' : 'coin'

      const newObject: FallingObject = {
        id: objectIdRef.current++,
        x: Math.random() * 80 + 10, // 10-90 사이
        y: -10,
        type,
        speed: 1.5 + Math.random() * 1 + score * 0.01, // 점수에 따라 속도 증가
      }

      setFallingObjects(prev => [...prev, newObject])
    }

    spawnTimerRef.current = setInterval(spawnObject, 800) // 0.8초마다 생성

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    }
  }, [gameOver, score])

  // 게임 루프
  useEffect(() => {
    if (gameOver) return

    gameLoopRef.current = setInterval(() => {
      setFallingObjects(prev => {
        const updated = prev
          .map(obj => ({ ...obj, y: obj.y + obj.speed }))
          .filter(obj => obj.y < 110) // 화면 밖으로 나간 것 제거

        // 충돌 감지
        updated.forEach(obj => {
          const distX = Math.abs(obj.x - playerX)
          const distY = Math.abs(obj.y - 90) // 플레이어는 y=90에 위치

          if (distX < 8 && distY < 8) {
            if (obj.type === 'coin') {
              // 코인 수집
              setScore(s => {
                const newScore = s + 10
                if (onScoreChange) onScoreChange(newScore)
                return newScore
              })
              obj.y = 200 // 제거 처리
            } else if (obj.type === 'bomb' || obj.type === 'rock') {
              // 장애물 충돌 -> 게임 오버
              setGameOver(true)
              setHighScore(prev => Math.max(prev, score))
            }
          }
        })

        return updated
      })
    }, 16)

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    }
  }, [gameOver, playerX, score, onScoreChange])

  // 게임 재시작
  const handleRestart = () => {
    setGameOver(false)
    setScore(0)
    setPlayerX(50)
    setFallingObjects([])
    setIsMovingLeft(false)
    setIsMovingRight(false)
    if (onScoreChange) onScoreChange(0)
  }

  // 화면 클릭으로 이동
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameOver) {
      handleRestart()
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100

    if (clickX < playerX) {
      setIsMovingLeft(true)
      setTimeout(() => setIsMovingLeft(false), 200)
    } else {
      setIsMovingRight(true)
      setTimeout(() => setIsMovingRight(false), 200)
    }
  }

  return (
    <div
      className="relative w-full h-full bg-gradient-to-b from-indigo-400 via-purple-400 to-pink-300 overflow-hidden rounded-lg cursor-pointer"
      onClick={handleClick}
    >
      {/* 배경 별 */}
      <div className="absolute inset-0">
        {backgroundStars.map((star, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: star.left,
              top: star.top,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: (i % 10) * 0.2,
            }}
          />
        ))}
      </div>

      {/* 떨어지는 오브젝트 */}
      <AnimatePresence>
        {fallingObjects.map(obj => (
          <motion.div
            key={obj.id}
            className="absolute text-4xl"
            style={{
              left: `${obj.x}%`,
              top: `${obj.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: obj.type === 'coin' ? 360 : 0 }}
            exit={{ scale: 0 }}
            transition={{ rotate: { duration: 2, repeat: Infinity, ease: 'linear' } }}
          >
            {obj.type === 'bomb' && '💣'}
            {obj.type === 'rock' && '🪨'}
            {obj.type === 'coin' && '🪙'}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 플레이어 */}
      <motion.div
        className="absolute bottom-[10%]"
        style={{
          left: `${playerX}%`,
          transform: 'translateX(-50%)',
        }}
        animate={{
          scale: gameOver ? [1, 1.2, 0] : 1,
        }}
      >
        <div className="relative w-16 h-16">
          <Image
            src={characterImage}
            alt="Player"
            fill
            className="object-contain drop-shadow-lg"
            sizes="64px"
          />
        </div>
      </motion.div>

      {/* 점수 표시 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center">
        <motion.div
          className="text-5xl font-bold text-white drop-shadow-lg"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.3 }}
          key={score}
        >
          {score}
        </motion.div>
        {highScore > 0 && (
          <div className="text-sm text-white/80 font-semibold mt-1">
            최고: {highScore}
          </div>
        )}
      </div>

      {/* 게임 오버 */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <div className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
              게임 오버!
            </div>
            <div className="text-2xl text-white mb-6">
              점수: {score}
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRestart}
              className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-bold text-xl shadow-lg"
            >
              다시 시작
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 조작 안내 */}
      {!gameOver && score < 50 && (
        <motion.div
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <p className="text-white text-sm font-semibold drop-shadow-lg">
            ← → 키 또는 클릭으로 이동 | 💣🪨 피하기 | 🪙 모으기!
          </p>
        </motion.div>
      )}
    </div>
  )
}
