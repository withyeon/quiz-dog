'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  Crosshair,
  Flame,
  RadioTower,
  Snowflake,
  Thermometer,
  Trophy,
  Users,
} from 'lucide-react'
import QuizView from '@/components/QuizView'
import BattleArena from '@/components/BattleArena'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import { CLASS_BADGES, getReloadDelay, HudTile } from '@/components/battle/BattleHud'
import { useGameBase } from '@/hooks/useGameBase'
import {
  calculateDamage,
  isCriticalHit,
  generateAttack,
  applyDamage,
  applyHeal,
  applyHeater,
  checkWinner,
  isGameOver,
  generateItem,
  calculateZoneDamage,
  getComboDamageMultiplier,
  type AttackResult,
  type PlayerClass,
  type SnowballItem,
  PLAYER_CLASSES,
} from '@/lib/game/battleRoyale'
import ClassSelector from '@/components/ClassSelector'
import SnowEffect from '@/components/SnowEffect'
import HitOverlay from '@/components/HitOverlay'
import BlizzardOverlay from '@/components/BlizzardOverlay'
import ScreenShake from '@/components/ScreenShake'
import type { Database } from '@/types/database.types'
import { updatePlayer } from '@/lib/services/players'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'

type Player = Database['public']['Tables']['players']['Row'] & {
  health?: number
  player_class?: PlayerClass
}

type BattleView = 'lobby' | 'classSelect' | 'countdown' | 'quiz' | 'attack' | 'wrong' | 'result'

type IncomingAttack = {
  attackerNickname: string
  damage: number
  isCritical: boolean
}

export default function BattlePage() {
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    showCountdown,
    setShowCountdown,
    players,
    room,
    roomLoading,
    playersLoading,
    currentPlayer,
    currentQuestion,
    playSFX,
    checkAnswer,
    handleWrongAnswer,
    handleCountdownComplete,
    goToNextQuestion,
    isRoomHost,
    finishGame,
    questionStartTime,
    consecutiveCorrect,
    sendRoomEvent,
  } = useGameBase({ expectedGameMode: 'battle_royale' })

  const [attackResult, setAttackResult] = useState<AttackResult | null>(null)
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null)
  const [hasSnowball, setHasSnowball] = useState(false) // 눈뭉치 장전 여부
  const [currentItem, setCurrentItem] = useState<SnowballItem | null>(null)
  const [isShaking, setIsShaking] = useState(false)
  const [showSnowEffect, setShowSnowEffect] = useState(false)
  const [isBlizzardActive, setIsBlizzardActive] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [gameStartTime, setGameStartTime] = useState<number>(0)
  const [zoneLevel, setZoneLevel] = useState(1)
  const [lockedTarget, setLockedTarget] = useState<string | null>(null)
  const [incomingAttack, setIncomingAttack] = useState<IncomingAttack | null>(null)
  const [isEliminated, setIsEliminated] = useState(false)
  const [showEliminationEffect, setShowEliminationEffect] = useState(false)
  const currentPlayerClass = (currentPlayer as Player | null)?.player_class ?? null
  const hasFinishedGameRef = useRef(false)
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const incomingAttackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousHealthRef = useRef<number | null>(null)
  const battleStartTime = room?.started_at
    ? new Date(room.started_at).getTime()
    : gameStartTime

  useEffect(() => {
    return () => {
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      if (incomingAttackTimerRef.current) clearTimeout(incomingAttackTimerRef.current)
    }
  }, [])

  // 직업 선택 저장
  const handleClassSelect = async (playerClass: PlayerClass) => {
    if (!playerId) return

    setSelectedClass(playerClass)

    try {
      const classInfo = PLAYER_CLASSES[playerClass]
      // 직업별 초기 체력 설정
      await updatePlayer(playerId, {
        player_class: playerClass,
        health: classInfo.maxHealth,
      })
    } catch (error) {
      console.error('Error updating class:', error)
    }
  }

  // 저장된 직업 불러오기
  useEffect(() => {
    if (currentPlayerClass) {
      setSelectedClass(currentPlayerClass as PlayerClass)
    }
  }, [currentPlayerClass])

  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (event.type !== 'battle:attacked') return

      const payload = event.payload as {
        attackerNickname?: string
        targetId?: string
        damage?: number
        isCritical?: boolean
      } | undefined

      if (!payload || payload.targetId !== playerId) return

      if (incomingAttackTimerRef.current) {
        clearTimeout(incomingAttackTimerRef.current)
      }

      setIncomingAttack({
        attackerNickname: payload.attackerNickname || '상대',
        damage: payload.damage ?? 0,
        isCritical: Boolean(payload.isCritical),
      })
      setShowSnowEffect(true)
      incomingAttackTimerRef.current = setTimeout(() => {
        setIncomingAttack(null)
        setShowSnowEffect(false)
      }, 2000)
    })
  }, [playerId])

  // 배틀로얄 전용: 게임 시작 시 직업 선택 단계 추가
  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'countdown' && !selectedClass) {
      setCurrentView('classSelect')
      setShowCountdown(false)
    }
  }, [room?.status, currentView, selectedClass, setCurrentView, setShowCountdown])

  // 직업 선택 후 다시 카운트다운으로
  useEffect(() => {
    if (currentView === 'classSelect' && selectedClass) {
      setShowCountdown(true)
      setGameStartTime(Date.now())
      setCurrentView('countdown')
    }
  }, [currentView, selectedClass, setShowCountdown, setCurrentView])

  useEffect(() => {
    if (room?.status !== 'playing') {
      hasFinishedGameRef.current = false
    }
  }, [room?.status])

  // 자기장(폭설 주의보) 시스템
  useEffect(() => {
    if (room?.status !== 'playing' || !battleStartTime) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - battleStartTime
      const newZoneLevel = Math.floor(elapsed / 120000) + 1 // 2분마다 레벨 증가
      setZoneLevel(newZoneLevel)
    }, 1000)

    return () => clearInterval(interval)
  }, [battleStartTime, room?.status])

  // 자기장 데미지 적용
  useEffect(() => {
    if (room?.status !== 'playing' || !battleStartTime || zoneLevel <= 1) return
    if (!isRoomHost) return

    const interval = setInterval(() => {
      // 자기장 데미지 (10초마다)
      const zoneDamage = calculateZoneDamage(Date.now() - battleStartTime, zoneLevel)

      Promise.all(
        players
          .filter((player) => (player.health || 100) > 0)
          .map(async (player) => {
            const newHealth = Math.max(0, (player.health || 100) - zoneDamage)
            await updatePlayer(player.id, { health: newHealth })
          }),
      ).catch((error) => {
        console.error('Error applying zone damage:', error)
      })
    }, 10000) // 10초마다

    return () => clearInterval(interval)
  }, [battleStartTime, isRoomHost, players, room?.status, zoneLevel])

  // 탈락 감지 (체온이 0이 되면 눈사람으로)
  useEffect(() => {
    if (!currentPlayer || currentView === 'result') return

    const currentHealth = currentPlayer.health ?? 100
    const previousHealth = previousHealthRef.current
    previousHealthRef.current = currentHealth

    if (currentHealth <= 0 && previousHealth === null) {
      setIsEliminated(true)
      return
    }

    if (currentHealth <= 0 && previousHealth !== null && previousHealth > 0) {
      playSFX('incorrect')
      setShowEliminationEffect(true)
      setShowSnowEffect(true)
      setTimeout(() => {
        setIsEliminated(true)
        setShowEliminationEffect(false)
      }, 500)
      setTimeout(() => setShowSnowEffect(false), 3000)
    }
  }, [currentPlayer, currentView, playSFX])

  // 게임 종료 확인
  useEffect(() => {
    if (players.length > 0 && room?.status === 'playing') {
      const winner = checkWinner(players as Player[])
      if (winner || isGameOver(players as Player[])) {
        setCurrentView('result')
        playSFX('item')
        if (isRoomHost && !hasFinishedGameRef.current) {
          hasFinishedGameRef.current = true
          void finishGame()
        }
      }
    }
  }, [finishGame, isRoomHost, players, room?.status, playSFX, setCurrentView])

  // 정답 후 다음 문제로 (클릭 시 즉시 이동)
  const goToNextQuiz = () => {
    if (nextQuestionTimerRef.current) {
      clearTimeout(nextQuestionTimerRef.current)
      nextQuestionTimerRef.current = null
    }
    goToNextQuestion()
  }

  const handleTargetLock = (targetId: string) => {
    if (hasSnowball || isReloading) return
    setLockedTarget(targetId)
    playSFX('click')
  }

  // 답안 제출
  const handleAnswerSubmit = async (answer: string) => {
    if (!playerId) return false

    const correct = await checkAnswer(answer)

    if (correct) {
      playSFX('correct')
      const nextComboCount = consecutiveCorrect + 1
      const comboMultiplier = getComboDamageMultiplier(nextComboCount)

      // 핫초코 직업: 체온 회복
      if (selectedClass === 'hot_choco') {
        const maxHealth = PLAYER_CLASSES[selectedClass].maxHealth
        const newHealth = applyHeal(currentPlayer?.health || 100, selectedClass)
        try {
          await updatePlayer(playerId, { health: Math.min(newHealth, maxHealth) })
        } catch (error) {
          console.error('Error healing:', error)
        }
      }

      // 타겟을 먼저 찍었다면 정답 즉시 발사
      if (lockedTarget) {
        const targetId = lockedTarget
        setLockedTarget(null)
        await handlePlayerAttack(targetId, {
          comboMultiplier,
          requireSnowball: false,
        })
        return correct
      }

      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current)
      }

      const reloadDelay = getReloadDelay(selectedClass)
      setIsReloading(true)
      reloadTimerRef.current = setTimeout(() => {
        setHasSnowball(true)
        setIsReloading(false)
        reloadTimerRef.current = null
      }, reloadDelay)

      // 랜덤 아이템 획득 (20% 확률)
      if (Math.random() < 0.2) {
        const item = generateItem()
        setCurrentItem(item)
        playSFX('item')
      }

      nextQuestionTimerRef.current = setTimeout(goToNextQuiz, reloadDelay + 900)
    } else {
      playSFX('incorrect')
      setHasSnowball(false)
      setIsReloading(false)
      setLockedTarget(null)
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current)
        reloadTimerRef.current = null
      }
      handleWrongAnswer()
    }
    return correct
  }

  // 플레이어 공격 처리
  const handlePlayerAttack = async (
    targetId: string,
    options: { comboMultiplier?: number; requireSnowball?: boolean } = {},
  ) => {
    const { comboMultiplier = getComboDamageMultiplier(consecutiveCorrect), requireSnowball = true } = options
    if (!currentPlayer || !playerId) return
    if (requireSnowball && !hasSnowball) return

    playSFX('click')
    setHasSnowball(false)
    setIsReloading(false)
    setLockedTarget(null)
    if (nextQuestionTimerRef.current) {
      clearTimeout(nextQuestionTimerRef.current)
      nextQuestionTimerRef.current = null
    }

    const time = Date.now() - questionStartTime.current
    const isCritical = isCriticalHit()
    const gameTime = battleStartTime ? Date.now() - battleStartTime : 0
    const hasGiantBall = currentItem?.type === 'giant_ball'

    // 데미지 계산
    const damage = Math.floor(
      calculateDamage(
        true,
        time,
        isCritical,
        selectedClass || undefined,
        gameTime,
        hasGiantBall || false
      ) * comboMultiplier
    )

    // 공격 결과 생성
    const attack = generateAttack(playerId, targetId, damage, isCritical)
    if (hasGiantBall) {
      attack.itemType = 'giant_ball'
    }
    setAttackResult(attack)

    // 타겟 플레이어 체력 감소
    const targetPlayer = players.find(p => p.id === targetId) as Player | undefined
    if (targetPlayer) {
      const currentHealth = targetPlayer.health || 100
      const newHealth = applyDamage(currentHealth, damage, targetPlayer.player_class)

      try {
        await updatePlayer(targetId, { health: newHealth })
        await sendRoomEvent('battle:attacked', {
          attackerId: playerId,
          attackerNickname: currentPlayer.nickname,
          targetId,
          damage,
          isCritical,
          itemType: attack.itemType ?? null,
        })

        // 공격 화면 표시 및 이펙트
        setIsShaking(true)
        setShowSnowEffect(true)
        setCurrentView('attack')

        setTimeout(() => {
          setIsShaking(false)
          setShowSnowEffect(false)
        }, 500)

        // 왕눈덩이 아이템 사용
        if (hasGiantBall) {
          setCurrentItem(null)
        }

        setTimeout(() => {
          setAttackResult(null)
          goToNextQuestion()
        }, 2000)
      } catch (error) {
        console.error('Error updating health:', error)
      }
    }
  }

  // 아이템 사용
  const handleUseItem = async () => {
    if (!currentItem || !playerId) return

    if (currentItem.type === 'blizzard') {
      // 1등 플레이어에게 눈보라 적용
      const topPlayer = players
        .filter(p => p.id !== playerId && (p.health || 100) > 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0))[0]

      if (topPlayer) {
        setIsBlizzardActive(true)
        setTimeout(() => setIsBlizzardActive(false), 5000)
      }
    } else if (currentItem.type === 'heater') {
      // 체온 회복
      if (currentPlayer) {
        const maxHealth = selectedClass
          ? PLAYER_CLASSES[selectedClass].maxHealth
          : 100
        const newHealth = applyHeater(currentPlayer.health ?? 100, maxHealth)

        await updatePlayer(playerId, { health: newHealth })
      }
    }

    setCurrentItem(null)
  }

  if (!roomCode || !playerId) {
    return (
      <main className="battle-shell flex min-h-screen items-center justify-center p-4">
        <div className="battle-frost-panel max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <p className="font-bold text-slate-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </main>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <main className="battle-shell flex min-h-screen items-center justify-center p-4">
        <div className="battle-frost-panel px-6 py-5 text-xl font-black text-slate-800">
          로딩 중...
        </div>
      </main>
    )
  }

  // 현재 플레이어가 1등인지 확인 (눈보라 효과용)
  const isTopPlayer = players
    .filter(p => (p.health || 100) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.id === playerId
  const currentHealth = Math.round(currentPlayer?.health ?? 100)
  const aliveCount = players.filter((player) => (player.health ?? 100) > 0).length
  const currentRank = players.filter((player) => (player.health ?? 100) > currentHealth).length + 1
  const selectedClassInfo = selectedClass ? PLAYER_CLASSES[selectedClass] : null
  const SelectedClassIcon = selectedClass ? CLASS_BADGES[selectedClass].Icon : Snowflake
  const selectedClassTone = selectedClass ? CLASS_BADGES[selectedClass].tone : 'text-slate-600 bg-slate-50 border-slate-200'
  const healthTone = currentHealth <= 30 ? 'danger' : currentHealth <= 65 ? 'warm' : 'good'
  const comboMultiplier = getComboDamageMultiplier(consecutiveCorrect)

  return (
    <main
      className="battle-shell relative min-h-screen overflow-x-hidden font-bitbit"
    >
      <SnowEffect
        isActive={showSnowEffect}
        intensity={showEliminationEffect || isEliminated ? 'blizzard' : 'normal'}
        duration={showEliminationEffect || isEliminated ? 3000 : 2000}
      />
      <HitOverlay attack={incomingAttack} />
      {isBlizzardActive && isTopPlayer && <BlizzardOverlay isActive={true} />}

      <ScreenShake intensity={15} duration={500} isShaking={isShaking}>
        <div className="relative z-10 px-3 py-4 sm:px-5 sm:py-6">
          <div className="mx-auto mb-4 max-w-7xl">
            <header className="battle-frost-panel overflow-hidden p-4 sm:p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-slate-950 text-cyan-100 shadow-lg">
                    <Snowflake className="h-7 w-7" strokeWidth={2.4} />
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="battle-chip inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black text-slate-600">
                        <RadioTower className="h-3.5 w-3.5 text-teal-600" />
                        ROOM {roomCode}
                      </span>
                      <span className="battle-chip px-3 py-1 text-xs font-black text-slate-600">
                        LIVE BATTLE
                      </span>
                    </div>
                    <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                      눈싸움 대작전
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      퀴즈로 장전하고, 체온이 남은 플레이어가 끝까지 버팁니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">
                  <HudTile
                    icon={<Thermometer className="h-3.5 w-3.5" />}
                    label="체온"
                    value={`${currentHealth}°`}
                    detail={selectedClassInfo ? `최대 ${selectedClassInfo.maxHealth}°` : '기본 장비'}
                    tone={healthTone}
                  />
                  <HudTile
                    icon={<Trophy className="h-3.5 w-3.5" />}
                    label="순위"
                    value={`#${currentRank}`}
                    detail={`${players.length}명 중`}
                    tone="warm"
                  />
                  <HudTile
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="생존"
                    value={`${aliveCount}/${players.length}`}
                    detail="아레나"
                  />
                  <HudTile
                    icon={<SelectedClassIcon className="h-3.5 w-3.5" />}
                    label="장비"
                    value={selectedClassInfo ? selectedClassInfo.name : '미선택'}
                    detail={selectedClassInfo ? `${selectedClassInfo.attackSpeed}x 장전` : '대기 중'}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {selectedClassInfo && (
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-black ${selectedClassTone}`}>
                    <SelectedClassIcon className="h-4 w-4" />
                    {selectedClassInfo.name}
                  </div>
                )}

                {isReloading && !hasSnowball && (
                  <div className="battle-chip battle-pulse inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-slate-700">
                    <Snowflake className="h-4 w-4 text-cyan-600" />
                    눈뭉치 장전 중
                  </div>
                )}

                {hasSnowball && (
                  <motion.div
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                    className="battle-status-ready inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white"
                  >
                    <Crosshair className="h-4 w-4" />
                    눈뭉치 준비 완료
                  </motion.div>
                )}

                {currentItem && (
                  <motion.button
                    type="button"
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-800 shadow-sm"
                    onClick={handleUseItem}
                  >
                    <span>{currentItem.icon}</span>
                    {currentItem.name}
                  </motion.button>
                )}

                {zoneLevel > 1 && (
                  <div className="battle-status-warn inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white">
                    <AlertTriangle className="h-4 w-4" />
                    폭설 주의보 Lv.{zoneLevel}
                  </div>
                )}

                {consecutiveCorrect >= 2 && (
                  <motion.div
                    key={consecutiveCorrect}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 font-black text-white shadow-lg shadow-orange-300/30"
                  >
                    🔥 {consecutiveCorrect}연속! 데미지 {Math.round(comboMultiplier * 100)}%
                  </motion.div>
                )}
              </div>
            </header>
          </div>

          <div className="mx-auto max-w-7xl">
            {showCountdown && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="pointer-events-none absolute inset-x-0 top-[18vh] text-center text-white"
                >
                  <div className="mb-4 text-8xl">❄️</div>
                  <h1 className="mb-2 text-5xl font-black">눈싸움 대작전</h1>
                  <p className="text-xl font-bold text-cyan-200">타겟을 조준하고 퀴즈로 눈뭉치를 날려라!</p>
                </motion.div>
                <Countdown onComplete={handleCountdownComplete} />
              </div>
            )}

            {currentView === 'lobby' && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="battle-frost-panel grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.85fr_1.15fr]"
              >
                <div className="flex flex-col justify-center">
                  <div className="battle-chip mb-4 inline-flex w-fit items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600">
                    <BadgeCheck className="h-3.5 w-3.5 text-teal-600" />
                    READY ROOM
                  </div>
                  <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">
                    경기장 준비 중
                  </h2>
                  <p className="mt-3 max-w-md text-base font-semibold leading-relaxed text-slate-500">
                    선생님이 게임을 시작하면 장비 선택 후 바로 아레나에 입장합니다.
                  </p>
                </div>
                <BattleArena
                  players={players as Player[]}
                  currentPlayerId={playerId}
                  canAttack={false}
                />
              </motion.section>
            )}

            {currentView === 'classSelect' && (
              <ClassSelector
                onSelect={handleClassSelect}
                selectedClass={selectedClass || undefined}
              />
            )}

            <AnimatePresence>
              {isEliminated && currentView !== 'result' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-slate-950/90 p-5 backdrop-blur-md"
                >
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="mb-6 text-9xl"
                  >
                    ⛄
                  </motion.div>
                  <h2 className="mb-3 text-center text-5xl font-black text-white">눈사람이 되었습니다</h2>
                  <p className="mb-8 text-center text-xl font-bold text-cyan-200">체온이 0°까지 떨어졌습니다</p>

                  <div className="w-full max-w-4xl">
                    <p className="mb-4 text-center font-bold text-slate-400">남은 생존자 현황</p>
                    <BattleArena
                      players={players as Player[]}
                      currentPlayerId={playerId}
                      canAttack={false}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {currentView === 'quiz' && !showCountdown && currentPlayer && (currentPlayer.health || 100) > 0 && (
              <div className="space-y-4">
                {lockedTarget ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="battle-status-ready flex items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-center text-base font-black text-white"
                  >
                    <Crosshair className="h-5 w-5" />
                    조준 완료! 퀴즈를 맞히면 즉시 발사됩니다
                  </motion.div>
                ) : hasSnowball ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="battle-status-ready flex items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-center text-base font-black text-white"
                  >
                    <Crosshair className="h-5 w-5" />
                    눈뭉치 준비 완료. 바로 공격할 타깃을 선택하세요
                  </motion.div>
                ) : isReloading ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="battle-frost-panel flex items-center justify-center gap-2 px-4 py-3 text-center text-base font-black text-slate-700"
                  >
                    <Snowflake className="h-5 w-5 text-cyan-600" />
                    눈뭉치 장전 중
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="battle-frost-panel flex items-center justify-center gap-2 px-4 py-3 text-center text-base font-black text-slate-700"
                  >
                    <Crosshair className="h-5 w-5 text-rose-500" />
                    먼저 타깃을 조준한 뒤 퀴즈를 풀어보세요
                  </motion.div>
                )}

                <BattleArena
                  players={players as Player[]}
                  currentPlayerId={playerId}
                  attackResult={attackResult}
                  lockedTarget={lockedTarget}
                  onTargetSelect={hasSnowball ? handlePlayerAttack : handleTargetLock}
                  canAttack={(hasSnowball || (!isReloading && !hasSnowball))}
                />

                {currentQuestion ? (
                  <QuizView
                    question={currentQuestion}
                    onAnswer={handleAnswerSubmit}
                    onCorrectClick={goToNextQuiz}
                    timeLimit={30}
                    variant="battle"
                    className="battle-frost-panel mx-auto max-w-3xl p-5 sm:p-7"
                  />
                ) : (
                  <div className="battle-frost-panel p-8 text-center">
                    <p className="font-bold text-slate-700">문제를 불러오는 중...</p>
                  </div>
                )}
              </div>
            )}

            {currentView === 'attack' && attackResult && (
              <motion.section
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="battle-ink-panel mx-auto max-w-3xl p-8 text-center text-white"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.5 }}
                  className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[8px] bg-white text-slate-950"
                >
                  {attackResult.isCritical ? (
                    <Flame className="h-9 w-9 text-orange-500" />
                  ) : (
                    <Snowflake className="h-9 w-9 text-cyan-600" />
                  )}
                </motion.div>
                <h2 className="text-4xl font-black">
                  {attackResult.isCritical ? '크리티컬 히트' : '눈뭉치 명중'}
                </h2>
                <p className="mt-3 text-2xl font-black text-cyan-100">
                  {attackResult.damage}° 감소
                </p>
                {attackResult.itemType === 'giant_ball' && (
                  <p className="mt-3 text-base font-black text-amber-200">
                    왕눈덩이 보너스 적용
                  </p>
                )}
                <p className="mt-5 text-sm font-semibold text-cyan-100/70">
                  다음 문제로 이동합니다...
                </p>
              </motion.section>
            )}

            {currentView === 'wrong' && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="battle-frost-panel mx-auto max-w-2xl p-8 text-center"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-950">틀렸습니다</h2>
                <p className="mt-2 font-semibold text-slate-500">눈뭉치가 녹아버렸습니다.</p>
              </motion.section>
            )}

            {currentView === 'result' && (
              <GameResult
                players={players}
                currentPlayerId={playerId}
                gameMode="battle_royale"
              />
            )}
          </div>
        </div>
      </ScreenShake>
    </main>
  )
}
