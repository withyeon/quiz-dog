'use client'

import { useEffect, useRef, useState } from 'react'
import { useGameBase } from '@/hooks/useGameBase'
import { getReloadDelay } from '@/components/battle/BattleHud'
import {
  calculateDamage,
  isCriticalHit,
  generateAttack,
  getDamageReduction,
  HEATER_HEAL_AMOUNT,
  checkWinner,
  checkWinningTeam,
  isGameOver,
  generateItem,
  calculateZoneDamage,
  getComboDamageMultiplier,
  assignTeams,
  canAttackTarget,
  canPlayTeamMode,
  checkRevival,
  PLAYER_CLASSES,
  type AttackResult,
  type PlayerClass,
  type SnowballItem,
  type Team,
} from '@/lib/game/battleRoyale'
import type { Database } from '@/types/database.types'
import { updatePlayer } from '@/lib/services/players'
import { emitRoomRuntimeEvent, subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'

/** 눈싸움에서 쓰는 플레이어 행. 체력·장비·팀·부활 연속 정답 수가 붙는다. */
export type BattlePlayer = Database['public']['Tables']['players']['Row'] & {
  health?: number
  player_class?: PlayerClass
  team?: Team | null
  revival_streak?: number
}

export type IncomingAttack = {
  attackerNickname: string
  damage: number
  isCritical: boolean
}

/**
 * 눈싸움 대작전의 게임 로직 훅.
 *
 * 방·플레이어·퀴즈 흐름은 useGameBase 가 맡고, 이 훅은 그 위에 눈싸움 고유의 상태를 얹는다:
 * 장비 선택, 눈뭉치 장전·조준·발사, 아이템, 팀 배정(호스트)과 도중 입장 합류, 폭설 주의보,
 * 탈락·부활, 종료 판정. 페이지는 여기서 돌려주는 값을 화면에 그리기만 한다.
 */
export function useSnowBattleGame() {
  const base = useGameBase({ expectedGameMode: 'battle_royale' })
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    players,
    room,
    currentPlayer,
    isPreStartQuizComplete,
    playSFX,
    checkAnswer,
    handleWrongAnswer,
    handleCountdownComplete,
    goToNextQuestion,
    isRoomHost,
    questionStartTime,
    consecutiveCorrect,
    sendRoomEvent,
    commitPlayerDelta,
  } = base

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
  const [showTeamReveal, setShowTeamReveal] = useState(false)
  const [teamRevealComplete, setTeamRevealComplete] = useState(() => {
    if (typeof window === 'undefined') return false
    const code = new URLSearchParams(window.location.search).get('room')
    if (!code) return false
    return sessionStorage.getItem(`battle_team_revealed_${code}`) === '1'
  })
  const currentPlayerClass = (currentPlayer as BattlePlayer | null)?.player_class ?? null
  const currentPlayerTeam = (currentPlayer as BattlePlayer | null)?.team ?? null
  const hasFinishedGameRef = useRef(false)
  const hasAssignedTeamsRef = useRef(false)
  const lastAttackTargetRef = useRef<string | null>(null)
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const incomingAttackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blizzardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousHealthRef = useRef<number | null>(null)
  // 폭설 주의보 타이머가 참조하는 값들. deps에 넣으면 플레이어 상태가 바뀔 때마다
  // (12인 교실 기준 5분에 900회) 10초 interval이 파괴·재생성되어 영영 발동하지 않는다.
  const playersRef = useRef(players)
  playersRef.current = players
  const zoneLevelRef = useRef(1)
  const battleStartTime = gameStartTime

  useEffect(() => {
    return () => {
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      if (incomingAttackTimerRef.current) clearTimeout(incomingAttackTimerRef.current)
      if (blizzardTimerRef.current) clearTimeout(blizzardTimerRef.current)
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
      if (event.type === 'battle:blizzard') {
        const payload = event.payload as { targetId?: string } | undefined
        if (!payload || payload.targetId !== playerId) return
        if (blizzardTimerRef.current) clearTimeout(blizzardTimerRef.current)
        setIsBlizzardActive(true)
        blizzardTimerRef.current = setTimeout(() => setIsBlizzardActive(false), 5000)
        return
      }

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

      // 전장에서 눈뭉치가 날아오는 시간(약 0.5초)만큼 기다렸다가 맞는다
      incomingAttackTimerRef.current = setTimeout(() => {
        setIncomingAttack({
          attackerNickname: payload.attackerNickname || '상대',
          damage: payload.damage ?? 0,
          isCritical: Boolean(payload.isCritical),
        })
        setShowSnowEffect(true)
        incomingAttackTimerRef.current = setTimeout(() => {
          setIncomingAttack(null)
          setShowSnowEffect(false)
        }, 1300)
      }, 520)
    })
  }, [playerId])

  // 호스트가 게임 시작 시 팀 배정 (한 번만)
  useEffect(() => {
    if (room?.status !== 'playing' || !isPreStartQuizComplete) return
    if (!isRoomHost) return
    if (hasAssignedTeamsRef.current) return
    if (players.length === 0) return

    // 이미 팀이 배정되어 있으면 스킵 (재접속/새로고침 케이스)
    const anyTeamAssigned = players.some((p) => (p as BattlePlayer).team)
    if (anyTeamAssigned) {
      hasAssignedTeamsRef.current = true
      return
    }

    if (!canPlayTeamMode(players.length)) {
      // 인원 부족 시 개인전 폴백 — 팀 미지정 그대로 진행
      hasAssignedTeamsRef.current = true
      return
    }

    hasAssignedTeamsRef.current = true
    const assignments = assignTeams(players, {
      accuracyOf: (player) => {
        const history = (player as BattlePlayer).answer_history
        if (!Array.isArray(history) || history.length === 0) return null
        const correct = history.filter(
          (rec: unknown) =>
            typeof rec === 'object' && rec !== null && (rec as { isCorrect?: boolean }).isCorrect,
        ).length
        return correct / history.length
      },
    })

    Promise.all(
      Array.from(assignments.entries()).map(([playerId, team]) =>
        updatePlayer(playerId, { team, revival_streak: 0 }),
      ),
    ).catch((error) => {
      // 재시도하지 않는다. players가 바뀔 때마다 이 effect가 다시 도는데
      // (팀 컬럼 누락 같은) 영구적인 실패면 실패한 update를 게임 내내 쏟아붓게 된다.
      // 팀 없이 개인전으로 그대로 진행한다.
      console.error('팀 배정 실패 — 개인전으로 진행합니다:', error)
    })
  }, [isPreStartQuizComplete, isRoomHost, players, room?.status])

  // 게임 도중 들어온 학생은 시작 때의 팀 배정을 놓친다. 팀전이 이미 진행 중이면
  // 생존자가 적은 팀(같으면 인원이 적은 팀)에 스스로 합류한다.
  // 팀이 없는 채로 두면 canAttackTarget 이 양쪽 모두를 공격 가능하게 봐서 팀전이 깨진다.
  const lateTeamRequestedRef = useRef(false)
  useEffect(() => {
    if (room?.status !== 'playing' || !playerId || !currentPlayer) return
    if (currentPlayerTeam || lateTeamRequestedRef.current) return
    const teamed = players.filter((p) => (p as BattlePlayer).team && !p.is_kicked)
    if (teamed.length === 0) return // 개인전이거나 호스트가 아직 배정 중

    const count = (team: Team, aliveOnly: boolean) => teamed.filter((p) =>
      (p as BattlePlayer).team === team && (!aliveOnly || (p.health ?? 100) > 0)
    ).length
    const pick = (): Team => {
      const redAlive = count('red', true)
      const blueAlive = count('blue', true)
      if (redAlive !== blueAlive) return redAlive < blueAlive ? 'red' : 'blue'
      const redAll = count('red', false)
      const blueAll = count('blue', false)
      if (redAll !== blueAll) return redAll < blueAll ? 'red' : 'blue'
      return Math.random() < 0.5 ? 'red' : 'blue'
    }

    lateTeamRequestedRef.current = true
    updatePlayer(playerId, { team: pick(), revival_streak: 0 }).catch((error) => {
      lateTeamRequestedRef.current = false
      console.error('도중 입장 팀 배정 실패:', error)
    })
  }, [currentPlayer, currentPlayerTeam, playerId, players, room?.status])

  // 팀 배정이 완료되면 reveal 표시 (모든 플레이어가 보게 됨)
  useEffect(() => {
    if (room?.status !== 'playing') return
    if (teamRevealComplete) return
    if (players.length === 0) return

    const hasTeams = players.some((p) => (p as BattlePlayer).team)
    if (!hasTeams) return

    // 내 팀만 정해졌으면 보여준다. 예전에는 전원이 배정되기를 기다렸는데,
    // 게임 도중 들어온 학생은 팀이 없으므로 그 방에서는 아무도 팀 화면을 보지 못했다.
    if (!currentPlayerTeam) return

    setShowTeamReveal(true)
  }, [currentPlayerTeam, players, room?.status, teamRevealComplete])

  // 장비 선택 단계는 렌더에서 처리한다: 훅이 카운트다운을 켜면(showCountdown) 장비를 고를 때까지
  // 카운트다운 대신 ClassSelector를 보여주고, 고른 뒤 카운트다운 → 시작 전 퀴즈로 이어진다.
  // (예전에는 currentView === 'countdown'을 기다렸는데 훅이 그 값을 쓰지 않아 장비 선택 화면이 한 번도 뜨지 않았다.)

  useEffect(() => {
    if (room?.status !== 'playing') {
      hasFinishedGameRef.current = false
    }
  }, [room?.status])

  // 자기장(폭설 주의보) 시스템
  useEffect(() => {
    if (room?.status !== 'playing' || !battleStartTime || !isPreStartQuizComplete) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - battleStartTime
      const newZoneLevel = Math.floor(elapsed / 120000) + 1 // 2분마다 레벨 증가
      zoneLevelRef.current = newZoneLevel
      setZoneLevel(newZoneLevel)
    }, 1000)

    return () => clearInterval(interval)
  }, [battleStartTime, isPreStartQuizComplete, room?.status])

  // 자기장(폭설 주의보) 데미지 적용 — 10초마다.
  // players/zoneLevel 은 ref로 읽는다. deps에 넣으면 interval이 계속 리셋되어 발동하지 않는다.
  useEffect(() => {
    if (room?.status !== 'playing' || !battleStartTime || !isPreStartQuizComplete) return
    if (!isRoomHost) return

    const interval = setInterval(() => {
      const level = zoneLevelRef.current
      if (level <= 1) return

      const zoneDamage = calculateZoneDamage(Date.now() - battleStartTime, level)
      const alive = playersRef.current.filter((player) => (player.health ?? 100) > 0)
      if (alive.length === 0) return

      Promise.all(
        alive.map((player) =>
          commitPlayerDelta(player.id, { health: -zoneDamage }, { reason: 'battle_zone' }),
        ),
      ).catch((error) => {
        console.error('Error applying zone damage:', error)
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [battleStartTime, commitPlayerDelta, isPreStartQuizComplete, isRoomHost, room?.status])

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

  // 게임 종료 확인 (팀전 우선)
  // 직업을 고른 학생만 판정 대상. 도중 입장자는 체력이 null이라 생존자로 잡혀
  // 상대팀이 전멸해도 승패가 갈리지 않는다.
  useEffect(() => {
    const combatants = (players as BattlePlayer[]).filter((p) => p.player_class)
    // 팀 배정은 학생마다 따로 저장되어 실시간으로 한 명씩 도착한다. 첫 한 명만 팀이 붙은 순간
    // "상대팀 생존자 0"으로 읽혀 시작하자마자 결과 화면이 뜨던 레이스 — 전원 배정 전엔 판정하지 않는다.
    const teamedCount = combatants.filter((p) => p.team === 'red' || p.team === 'blue').length
    const teamAssignmentInProgress = teamedCount > 0 && teamedCount < combatants.length
    if (combatants.length >= 2 && room?.status === 'playing' && isPreStartQuizComplete && !teamAssignmentInProgress) {
      const winningTeam = checkWinningTeam(combatants)
      const winner = checkWinner(combatants)
      if (winningTeam || winner || isGameOver(combatants)) {
        // 학생은 자기 화면만 로컬 종료한다. 방의 finished 기록은 교사 대시보드(유일한 권위자)가
        // 담당한다(시간 종료 또는 교사의 수동 종료). 학생은 세션 제어 권한이 없다.
        setCurrentView('result')
        playSFX('item')
      }
    }
  }, [isPreStartQuizComplete, players, room?.status, playSFX, setCurrentView])

  const handleBattleCountdownComplete = () => {
    setGameStartTime(Date.now())
    handleCountdownComplete()
  }

  const handleTeamRevealComplete = () => {
    setTeamRevealComplete(true)
    setShowTeamReveal(false)
    if (typeof window !== 'undefined' && roomCode) {
      sessionStorage.setItem(`battle_team_revealed_${roomCode}`, '1')
    }
  }

  // 정답 후 다음 문제로 (클릭 시 즉시 이동)
  const goToNextQuiz = () => {
    if (nextQuestionTimerRef.current) {
      clearTimeout(nextQuestionTimerRef.current)
      nextQuestionTimerRef.current = null
    }
    setAttackResult(null)
    goToNextQuestion()
  }

  const handleTargetLock = (targetId: string) => {
    if (hasSnowball || isReloading) return
    const target = players.find((p) => p.id === targetId) as BattlePlayer | undefined
    if (!target || !currentPlayer) return
    if (!canAttackTarget(currentPlayer as BattlePlayer, target)) return
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

      // 탈락자 부활 처리 — 3연속 정답으로 50% 체력 복귀
      const me = currentPlayer as BattlePlayer | null
      const myHealth = me?.health ?? 100
      if (myHealth <= 0) {
        const nextRevivalStreak = (me?.revival_streak ?? 0) + 1
        const revivedHealth = checkRevival(nextRevivalStreak, selectedClass || undefined)
        try {
          if (revivedHealth !== null) {
            await updatePlayer(playerId, { health: revivedHealth, revival_streak: 0 })
            setIsEliminated(false)
            playSFX('item')
          } else {
            await updatePlayer(playerId, { revival_streak: nextRevivalStreak })
          }
        } catch (error) {
          console.error('Error processing revival:', error)
        }
        // 탈락 중에는 공격하지 않음. 다음 문제로 이동.
        nextQuestionTimerRef.current = setTimeout(goToNextQuiz, 900)
        return correct
      }

      // 핫초코 직업: 체온 회복 — 원자적 증분(최대 체력 상한 적용)
      if (selectedClass === 'hot_choco') {
        const classInfo = PLAYER_CLASSES[selectedClass]
        const healAmount = classInfo.healAmount ?? 0
        try {
          await commitPlayerDelta(playerId, { health: healAmount }, {
            reason: 'battle_heal',
            maxes: { health: classInfo.maxHealth },
          })
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
      // 탈락자가 오답이면 부활 streak 리셋
      const me = currentPlayer as BattlePlayer | null
      if (me && (me.health ?? 100) <= 0 && (me.revival_streak ?? 0) > 0) {
        try {
          await updatePlayer(playerId, { revival_streak: 0 })
        } catch (error) {
          console.error('Error resetting revival streak:', error)
        }
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
    // 이미 탈락했으면 못 던진다. 나를 쓰러뜨린 공격이 아직 realtime으로 도착하지 않은
    // 짧은 순간(실측 ~190ms)에 답을 제출하면 탈락자가 한 발 더 던질 수 있었다.
    if ((currentPlayer.health ?? 100) <= 0) return

    // 같은 팀 공격 차단
    const targetPlayerCheck = players.find((p) => p.id === targetId) as BattlePlayer | undefined
    if (!targetPlayerCheck) return
    if (!canAttackTarget(currentPlayer as BattlePlayer, targetPlayerCheck)) return

    lastAttackTargetRef.current = targetId

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

    // 타겟 플레이어 체력 감소 — 원자적 증분으로 동시 공격이 누적되게 한다.
    const targetPlayer = players.find(p => p.id === targetId) as BattlePlayer | undefined
    if (targetPlayer) {
      const reduction = getDamageReduction(damage, targetPlayer.player_class as PlayerClass | undefined)

      try {
        await commitPlayerDelta(targetId, { health: -reduction }, { reason: 'battle_attack' })
        const attackPayload = {
          attackerId: playerId,
          attackerNickname: currentPlayer.nickname,
          targetId,
          damage,
          isCritical,
          itemType: attack.itemType ?? null,
        }
        await sendRoomEvent('battle:attacked', attackPayload)
        // 브로드캐스트는 self: false라 내 화면에는 안 돌아온다. 전장이 내 눈뭉치도
        // 날리도록 같은 이벤트를 로컬로 흘려 준다.
        emitRoomRuntimeEvent({
          type: 'battle:attacked',
          roomCode: roomCode ?? '',
          clientId: 'local',
          playerId,
          sentAt: new Date().toISOString(),
          seq: 0,
          payload: attackPayload,
        })

        // 화면은 그대로 두고(퀴즈 옆 전장에서 눈뭉치가 날아간다) 짧게 흔들기만 한다
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 350)

        // 왕눈덩이 아이템 사용
        if (hasGiantBall) {
          setCurrentItem(null)
        }

        // 다음 문제까지의 간격을 직업 장전 속도에 맞춘다. 예전에는 전 직업 2000ms 고정이라,
        // 타겟을 미리 찍는 순간 attackSpeed(스노우 런처의 유일한 장점)가 통째로 사라졌다.
        // 타이머는 nextQuestionTimerRef에 둔다 — 정답 배너를 눌러 먼저 넘어가면 이 타이머가
        // 한 번 더 넘겨 문제를 건너뛰었다.
        if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
        nextQuestionTimerRef.current = setTimeout(() => {
          nextQuestionTimerRef.current = null
          setAttackResult(null)
          goToNextQuestion()
        }, getReloadDelay(selectedClass) + 700)
      } catch (error) {
        console.error('Error updating health:', error)
      }
    }
  }

  // 아이템 사용 (눈보라·휴대 난로만 수동 사용. 왕눈덩이는 다음 공격에 자동 적용)
  const handleUseItem = async () => {
    if (!currentItem || !playerId) return
    if (currentItem.type === 'giant_ball') return // 자동 적용 아이템 — 칩 클릭으로 폐기되지 않도록

    if (currentItem.type === 'blizzard') {
      // 상대팀에서 가장 잘 버티고 있는 생존자의 화면을 가린다.
      // (눈싸움은 score를 쓰지 않아 전원 0이었고, 팀·탈락 여부도 안 걸러서
      //  같은 팀이나 이미 탈락한 학생에게 날아가곤 했다.)
      const topPlayer = players
        .filter((p) => canAttackTarget(currentPlayer as BattlePlayer, p as BattlePlayer))
        .sort((a, b) => (b.health ?? 0) - (a.health ?? 0))[0]

      if (topPlayer) {
        await sendRoomEvent('battle:blizzard', { targetId: topPlayer.id })
        playSFX('item')
      }
    } else if (currentItem.type === 'heater') {
      // 체온 회복 — 원자적 증분(+30, 최대 체력 상한)
      if (currentPlayer) {
        const maxHealth = selectedClass
          ? PLAYER_CLASSES[selectedClass].maxHealth
          : 100
        await commitPlayerDelta(playerId, { health: HEATER_HEAL_AMOUNT }, {
          reason: 'battle_heater',
          maxes: { health: maxHealth },
        })
        playSFX('item')
      }
    }

    setCurrentItem(null)
  }

  return {
    ...base,
    isPaused: room?.status === 'paused',
    // 눈싸움 상태
    attackResult,
    selectedClass,
    hasSnowball,
    currentItem,
    isShaking,
    showSnowEffect,
    isBlizzardActive,
    isReloading,
    zoneLevel,
    lockedTarget,
    incomingAttack,
    isEliminated,
    showEliminationEffect,
    showTeamReveal,
    teamRevealComplete,
    currentPlayerTeam,
    // 눈싸움 동작
    handleClassSelect,
    handleBattleCountdownComplete,
    handleTeamRevealComplete,
    goToNextQuiz,
    handleTargetLock,
    handleAnswerSubmit,
    handlePlayerAttack,
    handleUseItem,
  }
}
