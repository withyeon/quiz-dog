'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  generateSchoolRacingItem,
  calculateMoveDistance,
  applySchoolItemEffect,
  type SchoolRacingItem,
  type SchoolRacingItemType,
  type SchoolItemEffect,
  TRACK_LENGTH,
} from '@/lib/game/schoolRacing'
import type { Database } from '@/types/database.types'
import type { SFXType } from '@/hooks/useAudio'

type Player = Database['public']['Tables']['players']['Row'] & {
  position?: number
}

interface UseRacingGameParams {
  playerId: string | null
  roomCode: string | null
  currentPlayer: Player | null | undefined
  players: Player[]
  room: any
  currentView: string
  consecutiveCorrect: number
  checkAnswer: (answer: string) => Promise<boolean>
  handleWrongAnswer: () => void
  goToNextQuestion: () => void
  getElapsedSeconds: () => number
  playSFX: (sound: SFXType) => void
  setCurrentView: (view: string) => void
}

export function useRacingGame({
  playerId,
  roomCode,
  currentPlayer,
  players,
  room,
  currentView,
  consecutiveCorrect,
  checkAnswer,
  handleWrongAnswer,
  goToNextQuestion,
  getElapsedSeconds,
  playSFX,
  setCurrentView,
}: UseRacingGameParams) {
  const [answerTime, setAnswerTime] = useState(0)
  const [acquiredItem, setAcquiredItem] = useState<SchoolRacingItem | null>(null)
  const [activeItems, setActiveItems] = useState<SchoolRacingItem[]>([])
  const [activeEffect, setActiveEffect] = useState<{ type: SchoolRacingItemType; fromPlayer?: string } | null>(null)
  const [isStunned, setIsStunned] = useState(false)
  const [isBlinded, setIsBlinded] = useState(false)
  const [isMinified, setIsMinified] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)
  const [hasShield, setHasShield] = useState(false)
  const [spicyPepperCount, setSpicyPepperCount] = useState(0)
  const [previousRank, setPreviousRank] = useState<number>(0)
  const [rankChange, setRankChange] = useState<{ type: 'up' | 'down' | null; value: number }>({ type: null, value: 0 })
  const [speedBoostActive, setSpeedBoostActive] = useState(false)
  const [showRankChange, setShowRankChange] = useState(false)
  const [showReversal, setShowReversal] = useState(false)
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0)

  // 순위 계산
  const sortedPlayers = [...players].sort((a, b) => (b.position || 0) - (a.position || 0))
  const currentRank = sortedPlayers.findIndex(p => p.id === playerId) + 1

  // 순위 변동 감지
  useEffect(() => {
    if (previousRank > 0 && currentRank > 0 && previousRank !== currentRank) {
      const change = previousRank - currentRank
      if (change > 0) {
        setRankChange({ type: 'up', value: change })
        setShowRankChange(true)
        setShowReversal(true)
        playSFX('correct')
      } else if (change < 0) {
        setRankChange({ type: 'down', value: Math.abs(change) })
        setShowRankChange(true)
        setTimeout(() => {
          setShowRankChange(false)
        }, 2000)
      }
    }
    setPreviousRank(currentRank)
  }, [currentRank, previousRank, playSFX])

  // 정답 제출
  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    const timeElapsed = getElapsedSeconds()
    setAnswerTime(timeElapsed)

    if (correct) {
      playSFX('correct')

      let baseDistance = calculateMoveDistance(timeElapsed, 30, consecutiveCorrect + 1)

      // 매운 고추 효과
      const spicyPepperActive = activeItems.find(item => item.type === 'SPICY_PEPPER')
      if (spicyPepperActive && spicyPepperCount > 0) {
        baseDistance *= 2
        const newCount = spicyPepperCount - 1
        setSpicyPepperCount(newCount)
        if (newCount === 0) {
          setActiveItems(prev => prev.filter(i => i.type !== 'SPICY_PEPPER'))
        }
      }

      const newPosition = (currentPlayer?.position || 0) + baseDistance
      const newScore = (currentPlayer?.score || 0) + baseDistance

      try {
        await (supabase
          .from('players') as any)
          .update({
            position: newPosition,
            score: newScore,
          })
          .eq('id', playerId)

        const newCorrectCount = correctAnswersCount + 1
        setCorrectAnswersCount(newCorrectCount)

        if (newCorrectCount % 4 === 0) {
          playSFX('item')
          const item1 = generateSchoolRacingItem()
          setAcquiredItem(item1)
          setCurrentView('item')
        } else {
          setTimeout(goToNextQuestion, 1000)
        }
      } catch (error) {
        console.error('Error updating position:', error)
      }
    } else {
      playSFX('incorrect')
      handleWrongAnswer()
    }
    return correct
  }

  // 아이템 사용
  const handleUseItem = async (item: SchoolRacingItem) => {
    if (!currentPlayer || !roomCode) return

    playSFX('click')

    // 방패로 해로운 파워업 차단
    if (hasShield && (item.type === 'WHOOSH' || item.type === 'ROCKET_ATTACK' ||
      item.type === 'BUSY_BEES' || item.type === 'FREEZE' || item.type === 'MINIFY' ||
      item.type === 'BLOOK_FIESTA')) {
      setHasShield(false)
      setActiveEffect({ type: 'MIGHTY_SHIELD', fromPlayer: currentPlayer?.nickname || '' })
      setTimeout(() => setActiveEffect(null), 2000)
      setAcquiredItem(null)
      goToNextQuestion()
      return
    }

    const effect = applySchoolItemEffect(
      item,
      playerId!,
      players.map(p => ({ id: p.id, position: p.position || 0 })),
      currentPlayer.position || 0
    )

    if ((effect.type === 'ENERGY_BOOST' || effect.type === 'SODA_BLAST') && effect.value !== undefined) {
      try {
        await ((supabase
          .from('players') as any)
          .update({
            position: Math.min(TRACK_LENGTH, (currentPlayer.position || 0) + effect.value),
            score: (currentPlayer.score || 0) + effect.value
          })
          .eq('id', playerId))
        setSpeedBoostActive(true)
        setTimeout(() => setSpeedBoostActive(false), 2000)
      } catch (error) {
        console.error('Error using item:', error)
      }
    } else if (effect.type === 'SPICY_PEPPER' && effect.duration) {
      setSpicyPepperCount(effect.duration)
      setActiveItems(prev => [...prev, item])
    } else if (effect.type === 'MIGHTY_SHIELD') {
      setHasShield(true)
      setActiveItems(prev => [...prev, item])
    } else if ((effect.type === 'WHOOSH' || effect.type === 'ROCKET_ATTACK' || effect.type === 'BUSY_BEES')
      && effect.targetPlayerId && effect.value !== undefined) {
      try {
        const targetPlayer = players.find(p => p.id === effect.targetPlayerId)
        if (targetPlayer) {
          await ((supabase
            .from('players') as any)
            .update({
              position: Math.max(0, (targetPlayer.position || 0) + effect.value),
            })
            .eq('id', effect.targetPlayerId))
          if (effect.targetPlayerId === playerId) {
            setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
            setTimeout(() => setActiveEffect(null), 2000)
          }
        }
      } catch (error) {
        console.error('Error applying push effect:', error)
      }
    } else if (effect.type === 'FREEZE' && effect.targetPlayerId && effect.duration) {
      if (effect.targetPlayerId === playerId) {
        setIsFrozen(true)
        setTimeout(() => setIsFrozen(false), effect.duration * 1000)
      }
      setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
      setTimeout(() => setActiveEffect(null), effect.duration * 1000)
    } else if (effect.type === 'MINIFY' && effect.affectsAll) {
      setIsMinified(true)
      setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
      setTimeout(() => {
        setIsMinified(false)
        setActiveEffect(null)
      }, (effect.duration || 5) * 1000)
    } else if (effect.type === 'BLOOK_FIESTA' && effect.affectsAll) {
      setIsBlinded(true)
      setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
      setTimeout(() => {
        setIsBlinded(false)
        setActiveEffect(null)
      }, (effect.duration || 5) * 1000)
    }

    setAcquiredItem(null)
    goToNextQuestion()
  }

  // 아이템 건너뛰기
  const handleSkipItem = useCallback(() => {
    setAcquiredItem(null)
    goToNextQuestion()
  }, [goToNextQuestion])

  // 아이템 화면 자동 다음 문제 (5초)
  useEffect(() => {
    if (currentView === 'item' && acquiredItem) {
      const timer = setTimeout(() => {
        handleSkipItem()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [currentView, acquiredItem, handleSkipItem])

  // 게임 종료 체크
  useEffect(() => {
    if (!room || room.status === 'finished') return

    const sortedPlayers = [...players].sort((a, b) => (b.position || 0) - (a.position || 0))
    const topPlayer = sortedPlayers[0]

    if (topPlayer && (topPlayer.position || 0) >= TRACK_LENGTH) {
      ;(async () => {
        try {
          await ((supabase
            .from('rooms') as any)
            .update({ status: 'finished' })
            .eq('room_code', roomCode) as any)
        } catch (error) {
          console.error('Error finishing game:', error)
        }
      })()
    }
  }, [players, room, roomCode])

  // 게임 종료 감지
  useEffect(() => {
    if (room && room.status === 'finished' && currentView !== 'result') {
      setCurrentView('result')
    }
  }, [room, currentView])

  return {
    answerTime,
    acquiredItem,
    activeItems,
    activeEffect,
    isStunned,
    isBlinded,
    isMinified,
    isFrozen,
    hasShield,
    spicyPepperCount,
    rankChange,
    speedBoostActive,
    showRankChange,
    showReversal,
    correctAnswersCount,
    sortedPlayers,
    currentRank,
    handleAnswerSubmit,
    handleUseItem,
    handleSkipItem,
  }
}
