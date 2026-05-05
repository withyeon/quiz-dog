'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  tryFishing,
  trySpecialItem,
  checkFrenzyEvent,
  type Doll,
  type FishingState,
  type MachineRank,
  type SpecialItem,
  type SpecialItemType,
  calculateTotalPoints,
  getMachineRank,
} from '@/lib/game/fishing'
import { getPlayerById, updatePlayer } from '@/lib/services/players'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  caught_dolls?: Doll[]
  claw_points?: number
}

interface UseFishingGameParams {
  playerId: string | null
  currentPlayer: Player | null | undefined
  checkAnswer: (answer: string) => Promise<boolean>
  handleWrongAnswer: () => void
  goToNextQuestion: () => void
  getElapsedSeconds: () => number
  playSFX: (sound: any) => void
  setCurrentView: (view: string) => void
}

export function useFishingGame({
  playerId,
  currentPlayer,
  checkAnswer,
  handleWrongAnswer,
  goToNextQuestion,
  getElapsedSeconds,
  playSFX,
  setCurrentView,
}: UseFishingGameParams) {
  const [fishingState, setFishingState] = useState<FishingState>('idle')
  const [caughtItem, setCaughtItem] = useState<Doll | null>(null)
  const [fishingResult, setFishingResult] = useState<{
    success: boolean
    doll: Doll | null
    points: number
    message: string
    willFail: boolean
  } | null>(null)
  const [caughtDolls, setCaughtDolls] = useState<Doll[]>([])
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [isFrenzyEvent, setIsFrenzyEvent] = useState(false)
  const [frenzyTimeLeft, setFrenzyTimeLeft] = useState(0)
  const [savedAnswerTime, setSavedAnswerTime] = useState<number>(30)
  const [isClawReady, setIsClawReady] = useState(false)
  const [activeItems, setActiveItems] = useState<SpecialItemType[]>([])
  const [pendingItem, setPendingItem] = useState<SpecialItem | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)

  const machineRank: MachineRank = getMachineRank(correctAnswers)

  // 저장된 인형 불러오기
  useEffect(() => {
    if (currentPlayer) {
      if ((currentPlayer as Player).caught_dolls) {
        setCaughtDolls((currentPlayer as Player).caught_dolls as Doll[])
      }
      if ((currentPlayer as Player).caught_dolls) {
        setCorrectAnswers(((currentPlayer as Player).caught_dolls as Doll[]).length)
      }
    }
  }, [currentPlayer])

  // 대성공 이벤트 타이머
  useEffect(() => {
    if (isFrenzyEvent && frenzyTimeLeft > 0) {
      const timer = setInterval(() => {
        setFrenzyTimeLeft((prev) => {
          if (prev <= 1) {
            setIsFrenzyEvent(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isFrenzyEvent, frenzyTimeLeft])

  const runFishingSequence = async (
    result: typeof fishingResult,
    newCorrectAnswers: number
  ) => {
    if (!result || !playerId) return

    setTimeout(() => {
      setFishingState('grab')
      setTimeout(() => {
        setFishingState('up')
        setTimeout(() => {
          setFishingState('return')
          setTimeout(() => {
            setFishingState('release')

            if (result.success && result.doll) {
              const doll = result.doll
              const newDolls = [...caughtDolls, doll]
              setCaughtDolls(newDolls)
              const totalPoints = calculateTotalPoints(newDolls)

              ;(async () => {
                try {
                  await updatePlayer(playerId, {
                    caught_dolls: newDolls,
                    claw_points: totalPoints,
                    score: totalPoints,
                  })

                  playSFX('item')
                } catch (error) {
                  console.error('Error updating doll data:', error)
                }
              })()
            }

            setTimeout(() => {
              setFishingState('idle')
              setCaughtItem(null)
            }, 2000)
          }, 2000)
        }, 1500)
      }, 500)
    }, 1500)
  }

  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    if (correct) {
      playSFX('correct')

      const answerTime = getElapsedSeconds()
      setSavedAnswerTime(answerTime)

      let frenzyActive = isFrenzyEvent
      if (!frenzyActive) {
        frenzyActive = checkFrenzyEvent()
        if (frenzyActive) {
          setIsFrenzyEvent(true)
          setFrenzyTimeLeft(10)
          playSFX('item')
        }
      }

      const newCorrectAnswers = correctAnswers + 1
      setCorrectAnswers(newCorrectAnswers)

      const newMachineRank = getMachineRank(newCorrectAnswers)
      const specialItem = trySpecialItem()

      if (specialItem) {
        if (specialItem.type === 'COIN_RAIN') {
          const bonus = specialItem.bonusPoints ?? 150
          try {
            if (playerId) {
              const player = await getPlayerById(playerId)
              await updatePlayer(playerId, { score: (player?.score || 0) + bonus })
            }
          } catch (e) { console.error(e) }
        } else if (specialItem.type === 'EXTRA_PULL') {
          // 한 번 더
        } else {
          setActiveItems(prev => [...prev, specialItem.type])
        }
        setPendingItem(specialItem)
        setShowItemModal(true)
        playSFX('item')
        return true
      }

      const isLuckyBoosted = activeItems.includes('LUCKY_BOOST')
      const result = tryFishing(answerTime, isLuckyBoosted ? Math.min(5, newMachineRank + 2) as MachineRank : newMachineRank, frenzyActive)
      const isDoubled = activeItems.includes('DOUBLE_SCORE')

      if (isDoubled && result.doll) {
        result.doll.score = result.doll.score * 2
        result.points = result.doll.score
        result.message = `${result.doll.name} 획득! 2배! (+${result.doll.score}점)`
        setActiveItems(prev => prev.filter(t => t !== 'DOUBLE_SCORE'))
      }
      if (isLuckyBoosted) setActiveItems(prev => prev.filter(t => t !== 'LUCKY_BOOST'))

      setFishingResult(result)
      setCaughtItem(result.doll)
      setCurrentView('claw')
      setFishingState('down')
      setIsClawReady(false)
      runFishingSequence(result, newCorrectAnswers)
    } else {
      playSFX('incorrect')
      handleWrongAnswer()
    }
    return correct
  }

  const handleStartFishing = () => {
    if (fishingState !== 'idle') return

    playSFX('click')
    setFishingState('idle')
    setIsClawReady(false)
    setFishingResult(null)
    setCaughtItem(null)
    goToNextQuestion()
  }

  const handleItemModalClose = () => {
    setShowItemModal(false)
    const item = pendingItem
    setPendingItem(null)

    if (!item) return

    if (item.type === 'EXTRA_PULL') {
      const isLucky = activeItems.includes('LUCKY_BOOST')
      const result = tryFishing(savedAnswerTime, isLucky ? (Math.min(5, machineRank + 2) as MachineRank) : machineRank, isFrenzyEvent)
      if (isLucky) setActiveItems(prev => prev.filter(t => t !== 'LUCKY_BOOST'))
      setFishingResult(result)
      setCaughtItem(result.doll)
      setCurrentView('claw')
      setFishingState('down')
      setIsClawReady(false)
      runFishingSequence(result, correctAnswers)
    } else {
      goToNextQuestion()
    }
  }

  const handleResultCardClick = () => {
    setFishingResult(null)
    goToNextQuestion()
  }

  return {
    fishingState,
    caughtItem,
    fishingResult,
    caughtDolls,
    correctAnswers,
    isFrenzyEvent,
    frenzyTimeLeft,
    activeItems,
    pendingItem,
    showItemModal,
    machineRank,
    handleAnswerSubmit,
    handleStartFishing,
    handleItemModalClose,
    handleResultCardClick,
  }
}
