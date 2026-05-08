'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  calculateTotalPoints,
  checkFrenzyEvent,
  getAimGrade,
  getAimSpeed,
  getComboState,
  getMachineRank,
  tryFishing,
  trySpecialItem,
  type ComboState,
  type Doll,
  type FishingResult,
  type FishingState,
  type MachineRank,
  type SpecialItem,
  type SpecialItemType,
} from '@/lib/game/fishing'
import { updatePlayer } from '@/lib/services/players'
import type { SFXType } from '@/hooks/useAudio'
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
  playSFX: (sound: SFXType) => void
  setCurrentView: (view: string) => void
}

type PendingPull = {
  answerTime: number
  machineRank: MachineRank
  frenzyActive: boolean
}

const AIM_MIN = 8
const AIM_MAX = 92
const TARGET_MIN = 20
const TARGET_MAX = 80

function createTargetPosition() {
  return Math.round(TARGET_MIN + Math.random() * (TARGET_MAX - TARGET_MIN))
}

function calculateAimAccuracy(aimPosition: number, targetPosition: number) {
  const distance = Math.abs(aimPosition - targetPosition)
  return Math.max(0, Math.min(1, 1 - distance / 36))
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
  const [fishingResult, setFishingResult] = useState<FishingResult | null>(null)
  const [caughtDolls, setCaughtDolls] = useState<Doll[]>([])
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0)
  const [isFrenzyEvent, setIsFrenzyEvent] = useState(false)
  const [frenzyTimeLeft, setFrenzyTimeLeft] = useState(0)
  const [savedAnswerTime, setSavedAnswerTime] = useState<number>(30)
  const [activeItems, setActiveItems] = useState<SpecialItemType[]>([])
  const [pendingItem, setPendingItem] = useState<SpecialItem | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [pendingPull, setPendingPull] = useState<PendingPull | null>(null)
  const [aimPosition, setAimPosition] = useState(50)
  const [targetPosition, setTargetPosition] = useState(50)
  const [lastAccuracy, setLastAccuracy] = useState(0)
  const [comboState, setComboState] = useState<ComboState>({ count: 0, multiplier: 1.0, label: '' })

  const caughtDollsRef = useRef<Doll[]>([])
  const aimDirectionRef = useRef(1)
  const aimPositionRef = useRef(50)
  const sequenceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const fishingStateRef = useRef<FishingState>('idle')
  const pendingPullRef = useRef<PendingPull | null>(null)
  const activeItemsRef = useRef<SpecialItemType[]>([])
  const consecutiveCorrectRef = useRef(0)

  const machineRank: MachineRank = getMachineRank(correctAnswers)

  // refs를 최신 상태로 유지
  useEffect(() => { fishingStateRef.current = fishingState }, [fishingState])
  useEffect(() => { pendingPullRef.current = pendingPull }, [pendingPull])
  useEffect(() => { caughtDollsRef.current = caughtDolls }, [caughtDolls])
  useEffect(() => { activeItemsRef.current = activeItems }, [activeItems])
  useEffect(() => { consecutiveCorrectRef.current = consecutiveCorrect }, [consecutiveCorrect])

  // 저장된 데이터 복원
  useEffect(() => {
    if (!currentPlayer) return
    const savedDolls = Array.isArray(currentPlayer.caught_dolls)
      ? (currentPlayer.caught_dolls as Doll[])
      : []
    setCaughtDolls(savedDolls)
    setCorrectAnswers(savedDolls.length)
  }, [currentPlayer])

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      sequenceTimersRef.current.forEach(clearTimeout)
    }
  }, [])

  // 조준 오실레이션 — 기계 랭크에 따라 속도 변화
  useEffect(() => {
    if (fishingState !== 'aim') return

    const speed = getAimSpeed(machineRank)
    const timer = window.setInterval(() => {
      setAimPosition((prev) => {
        let next = prev + speed * aimDirectionRef.current
        if (next >= AIM_MAX) { aimDirectionRef.current = -1; next = AIM_MAX }
        if (next <= AIM_MIN) { aimDirectionRef.current = 1; next = AIM_MIN }
        aimPositionRef.current = next
        return next
      })
    }, 24)

    return () => window.clearInterval(timer)
  }, [fishingState, machineRank])

  // 프렌지 타이머
  useEffect(() => {
    if (!isFrenzyEvent || frenzyTimeLeft <= 0) return
    const timer = window.setInterval(() => {
      setFrenzyTimeLeft((prev) => {
        if (prev <= 1) { setIsFrenzyEvent(false); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isFrenzyEvent, frenzyTimeLeft])

  const queueTimer = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay)
    sequenceTimersRef.current.push(timer)
    return timer
  }, [])

  const persistCaughtDoll = useCallback(async (doll: Doll) => {
    if (!playerId) return
    const newDolls = [...caughtDollsRef.current, doll]
    caughtDollsRef.current = newDolls
    setCaughtDolls(newDolls)
    const totalPoints = calculateTotalPoints(newDolls)
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
  }, [playerId, playSFX])

  const runFishingSequence = useCallback((result: FishingResult) => {
    queueTimer(() => {
      setFishingState('grab')
      queueTimer(() => {
        setFishingState('up')
        queueTimer(() => {
          setFishingState('return')
          queueTimer(() => {
            setFishingState('release')
            if (result.success && result.doll) {
              void persistCaughtDoll(result.doll)
            }
          }, 950)
        }, 950)
      }, 650)
    }, 450)
  }, [persistCaughtDoll, queueTimer])

  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)

    if (!correct) {
      playSFX('incorrect')
      handleWrongAnswer()
      setConsecutiveCorrect(0)
      setComboState(getComboState(0))
      return false
    }

    playSFX('correct')

    const answerTime = getElapsedSeconds()
    setSavedAnswerTime(answerTime)

    // 콤보 업데이트
    const newConsecutive = consecutiveCorrect + 1
    setConsecutiveCorrect(newConsecutive)
    setComboState(getComboState(newConsecutive))

    // 프렌지 이벤트
    let frenzyActive = isFrenzyEvent
    if (!frenzyActive) {
      frenzyActive = checkFrenzyEvent()
      if (frenzyActive) {
        setIsFrenzyEvent(true)
        setFrenzyTimeLeft(12)
        playSFX('item')
      }
    }

    const newCorrectAnswers = correctAnswers + 1
    setCorrectAnswers(newCorrectAnswers)

    const nextMachineRank = getMachineRank(newCorrectAnswers)
    setPendingPull({ answerTime, machineRank: nextMachineRank, frenzyActive })

    // 특별 아이템 확인
    const specialItem = trySpecialItem()
    if (specialItem) {
      setActiveItems((prev) => [...prev, specialItem.type])
      setPendingItem(specialItem)
      setShowItemModal(true)
      playSFX('item')
    }

    return true
  }

  const handleOpenClaw = useCallback(() => {
    if (!pendingPullRef.current || fishingStateRef.current !== 'idle') return

    setFishingResult(null)
    setCaughtItem(null)
    setLastAccuracy(0)
    setTargetPosition(createTargetPosition())
    setAimPosition(50)
    aimDirectionRef.current = Math.random() > 0.5 ? 1 : -1
    setFishingState('aim')
    setCurrentView('claw')
    playSFX('click')
  }, [playSFX, setCurrentView])

  const handleDropClaw = useCallback(() => {
    if (!pendingPullRef.current || fishingStateRef.current !== 'aim') return

    const currentAim = aimPositionRef.current
    const currentActiveItems = activeItemsRef.current
    const currentConsecutive = consecutiveCorrectRef.current

    let accuracy = calculateAimAccuracy(currentAim, targetPosition)
    let resultMachineRank = pendingPullRef.current.machineRank
    let bonusPoints = 0
    const consumedItems = new Set<SpecialItemType>()

    if (currentActiveItems.includes('SHIELD')) {
      accuracy = Math.max(accuracy, 0.56)
      consumedItems.add('SHIELD')
    }
    if (currentActiveItems.includes('LUCKY_BOOST')) {
      resultMachineRank = Math.min(5, resultMachineRank + 2) as MachineRank
      consumedItems.add('LUCKY_BOOST')
    }
    if (currentActiveItems.includes('COIN_RAIN')) {
      bonusPoints += 150
      consumedItems.add('COIN_RAIN')
    }
    if (currentActiveItems.includes('EXTRA_PULL')) {
      bonusPoints += 120
      accuracy = Math.max(accuracy, 0.68)
      consumedItems.add('EXTRA_PULL')
    }

    const comboMultiplier = getComboState(currentConsecutive).multiplier
    let result = tryFishing(
      pendingPullRef.current.answerTime,
      resultMachineRank,
      pendingPullRef.current.frenzyActive,
      accuracy,
      bonusPoints,
      comboMultiplier,
    )

    if (currentActiveItems.includes('DOUBLE_SCORE') && result.doll) {
      const doubledDoll = { ...result.doll, score: result.doll.score * 2 }
      result = {
        ...result,
        doll: doubledDoll,
        points: doubledDoll.score,
        message: `${doubledDoll.name} 획득! 2배 보너스 (+${doubledDoll.score}점)`,
      }
      consumedItems.add('DOUBLE_SCORE')
    }

    setActiveItems((prev) => prev.filter((type) => !consumedItems.has(type)))
    setPendingPull(null)
    setLastAccuracy(accuracy)
    setFishingResult(result)
    setCaughtItem(result.doll)
    setFishingState('down')
    playSFX(getAimGrade(accuracy) === 'perfect' ? 'correct' : 'click')
    runFishingSequence(result)
  }, [playSFX, runFishingSequence, targetPosition])

  const handleStartFishing = useCallback(() => {
    if (fishingStateRef.current === 'aim') {
      handleDropClaw()
      return
    }
    handleOpenClaw()
  }, [handleDropClaw, handleOpenClaw])

  // 스페이스바 & 엔터 키 지원
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
      e.preventDefault()

      const state = fishingStateRef.current
      if (state === 'aim') {
        handleDropClaw()
      } else if (state === 'idle' && pendingPullRef.current) {
        handleOpenClaw()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDropClaw, handleOpenClaw])

  const handleItemModalClose = () => {
    setShowItemModal(false)
    setPendingItem(null)
  }

  const handleResultCardClick = () => {
    setFishingResult(null)
    setCaughtItem(null)
    setFishingState('idle')
    goToNextQuestion()
  }

  return {
    fishingState,
    caughtItem,
    fishingResult,
    caughtDolls,
    correctAnswers,
    consecutiveCorrect,
    comboState,
    isFrenzyEvent,
    frenzyTimeLeft,
    activeItems,
    pendingItem,
    showItemModal,
    machineRank,
    pendingPull,
    aimPosition,
    targetPosition,
    lastAccuracy,
    savedAnswerTime,
    handleAnswerSubmit,
    handleOpenClaw,
    handleDropClaw,
    handleStartFishing,
    handleItemModalClose,
    handleResultCardClick,
  }
}
