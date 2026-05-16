// 좀비를 피해라! Zustand Store

import { create } from 'zustand'
import {
  ZombiePlayer,
  ZombieGameLog,
  ZombieActionType,
  createInitialPlayers,
  assignRoles,
  zombieAttack,
  humanHeal,
  humanShield,
  scanPlayer,
  applyCorrectBonus,
  applyWrongPenalty,
  aiDecideAction,
  aiWillAnswerCorrectly,
  checkWinCondition,
  tickStatusEffects,
  generateRandomEvent,
  formatTime,
  GAME_CONSTANTS,
} from '@/lib/game/zombie'

export type ZombieGameStatus = 'lobby' | 'role_reveal' | 'playing' | 'ended'
export type ZombieViewState = 
  | 'quiz' 
  | 'actionSelect' 
  | 'targetSelect' 
  | 'scanResult' 
  | 'attackResult' 
  | 'wrong' 
  | 'event' 
  | 'result'

interface ZombieGameState {
  status: ZombieGameStatus
  timeRemaining: number
  roundNumber: number
  players: ZombiePlayer[]
  gameLog: ZombieGameLog[]
  winner: 'human' | 'zombie' | null
  winReason: string
  
  // 스캔 관련
  scanCooldown: number
  lastScanResult: { playerId: string; isZombie: boolean } | null
  
  // 공격 결과
  lastAttackResult: { 
    targetId: string; 
    damage: number; 
    infected: boolean; 
    log: string 
  } | null
  
  // 랜덤 이벤트
  currentEvent: { type: string; description: string } | null
  
  // 플레이어 수 설정
  playerCount: number
  
  actions: {
    setPlayerCount: (count: number) => void
    startGame: (duration?: number) => void
    tickTimer: () => void
    
    // 플레이어 정답/오답 처리
    onCorrectAnswer: () => void
    onWrongAnswer: () => void
    
    // 액션 수행
    performAction: (action: ZombieActionType, targetId?: string) => void
    
    // AI 라운드 처리
    processAiRound: () => void
    
    // 이벤트 관련
    clearEvent: () => void
    clearScanResult: () => void
    clearAttackResult: () => void
    
    // 리셋
    resetGame: () => void
  }
}

function addLog(
  logs: ZombieGameLog[],
  message: string,
  type: ZombieGameLog['type'] = 'info',
): ZombieGameLog[] {
  return [
    ...logs,
    {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      type,
      timestamp: Date.now(),
    },
  ]
}

const initialState = {
  status: 'lobby' as ZombieGameStatus,
  timeRemaining: GAME_CONSTANTS.GAME_DURATION,
  roundNumber: 0,
  players: [] as ZombiePlayer[],
  gameLog: [] as ZombieGameLog[],
  winner: null as 'human' | 'zombie' | null,
  winReason: '',
  scanCooldown: 0,
  lastScanResult: null as { playerId: string; isZombie: boolean } | null,
  lastAttackResult: null as { targetId: string; damage: number; infected: boolean; log: string } | null,
  currentEvent: null as { type: string; description: string } | null,
  playerCount: 10,
}

export const useZombieStore = create<ZombieGameState>((set, get) => ({
  ...initialState,

  actions: {
    setPlayerCount: (count: number) => {
      set({ playerCount: Math.max(GAME_CONSTANTS.MIN_PLAYERS, Math.min(GAME_CONSTANTS.MAX_PLAYERS, count)) })
    },

    startGame: (duration = GAME_CONSTANTS.GAME_DURATION) => {
      const state = get()
      const basePlayers = createInitialPlayers(state.playerCount)
      const playersWithRoles = assignRoles(basePlayers)
      
      const myPlayer = playersWithRoles.find(p => !p.isAi)
      const roleEmoji = myPlayer?.role === 'zombie' ? '🧟' : '🧑'
      const roleText = myPlayer?.role === 'zombie' ? '좀비' : '인간'

      set({
        ...initialState,
        status: 'role_reveal',
        timeRemaining: duration,
        players: playersWithRoles,
        playerCount: state.playerCount,
        gameLog: addLog([], `게임 시작! 당신은 ${roleEmoji} ${roleText}입니다!`, 'info'),
      })

      // 3초 후 자동으로 게임 시작
      setTimeout(() => {
        const currentState = get()
        if (currentState.status === 'role_reveal') {
          set({ status: 'playing' })
        }
      }, 3000)
    },

    tickTimer: () => {
      const state = get()
      if (state.status !== 'playing') return

      const newTime = state.timeRemaining - 1

      // 승리 조건 체크
      const winCheck = checkWinCondition(state.players, newTime)
      if (winCheck.gameOver) {
        set({
          status: 'ended',
          timeRemaining: Math.max(0, newTime),
          winner: winCheck.winner,
          winReason: winCheck.reason,
          gameLog: addLog(state.gameLog, winCheck.reason, winCheck.winner === 'human' ? 'success' : 'danger'),
        })
        return
      }

      // 스캔 쿨다운 감소 (매 ROUND_DURATION 초마다)
      let newScanCooldown = state.scanCooldown
      if (newTime % GAME_CONSTANTS.ROUND_DURATION === 0 && newScanCooldown > 0) {
        newScanCooldown--
      }

      set({
        timeRemaining: newTime,
        scanCooldown: newScanCooldown,
      })
    },

    onCorrectAnswer: () => {
      const state = get()
      if (state.status !== 'playing') return

      const myPlayer = state.players.find(p => !p.isAi)
      if (!myPlayer) return

      const { newPlayer, bonusLog } = applyCorrectBonus(myPlayer)
      let newLogs = state.gameLog

      if (bonusLog) {
        newLogs = addLog(newLogs, bonusLog, 'success')
      }

      set({
        players: state.players.map(p => p.id === myPlayer.id ? newPlayer : p),
        gameLog: newLogs,
        roundNumber: state.roundNumber + 1,
      })
    },

    onWrongAnswer: () => {
      const state = get()
      if (state.status !== 'playing') return

      const myPlayer = state.players.find(p => !p.isAi)
      if (!myPlayer) return

      const { newPlayer, log } = applyWrongPenalty(myPlayer)
      let newPlayers = state.players.map(p => p.id === myPlayer.id ? newPlayer : p)
      let newLogs = addLog(state.gameLog, log, 'warning')

      // 체력 0이면 감염
      if (newPlayer.health <= 0 && newPlayer.role === 'human') {
        const infectedPlayer: ZombiePlayer = {
          ...newPlayer,
          role: 'zombie',
          health: 999,
          attackPower: GAME_CONSTANTS.ZOMBIE_BASE_ATTACK,
          shield: 0,
        }
        newPlayers = newPlayers.map(p => p.id === myPlayer.id ? infectedPlayer : p)
        newLogs = addLog(newLogs, `🧟 ${myPlayer.name}이(가) 좀비가 되었습니다!`, 'infection')
      }

      // 승리 조건 체크
      const winCheck = checkWinCondition(newPlayers, state.timeRemaining)
      if (winCheck.gameOver) {
        set({
          status: 'ended',
          players: newPlayers,
          winner: winCheck.winner,
          winReason: winCheck.reason,
          gameLog: addLog(newLogs, winCheck.reason, winCheck.winner === 'human' ? 'success' : 'danger'),
          roundNumber: state.roundNumber + 1,
        })
        return
      }

      set({
        players: newPlayers,
        gameLog: newLogs,
        roundNumber: state.roundNumber + 1,
      })
    },

    performAction: (action: ZombieActionType, targetId?: string) => {
      const state = get()
      if (state.status !== 'playing') return

      const myPlayer = state.players.find(p => !p.isAi)
      if (!myPlayer) return

      let newPlayers = [...state.players]
      let newLogs = state.gameLog

      switch (action) {
        case 'attack': {
          if (!targetId) return
          const target = newPlayers.find(p => p.id === targetId)
          if (!target) return

          const result = zombieAttack(myPlayer, target)
          newPlayers = newPlayers.map(p => {
            if (p.id === myPlayer.id) return result.newZombie
            if (p.id === targetId) return result.newTarget
            return p
          })
          newLogs = addLog(newLogs, result.log, result.infected ? 'infection' : 'danger')
          
          set({
            players: newPlayers,
            gameLog: newLogs,
            lastAttackResult: {
              targetId,
              damage: myPlayer.attackPower,
              infected: result.infected,
              log: result.log,
            },
          })

          // 승리 조건 체크
          const winCheck = checkWinCondition(newPlayers, state.timeRemaining)
          if (winCheck.gameOver) {
            set({
              status: 'ended',
              winner: winCheck.winner,
              winReason: winCheck.reason,
              gameLog: addLog(newLogs, winCheck.reason, winCheck.winner === 'human' ? 'success' : 'danger'),
            })
          }
          return
        }
        case 'heal': {
          const result = humanHeal(myPlayer)
          newPlayers = newPlayers.map(p => p.id === myPlayer.id ? result.newPlayer : p)
          newLogs = addLog(newLogs, result.log, 'success')
          break
        }
        case 'shield': {
          const result = humanShield(myPlayer)
          newPlayers = newPlayers.map(p => p.id === myPlayer.id ? result.newPlayer : p)
          newLogs = addLog(newLogs, result.log, 'success')
          break
        }
        case 'scan': {
          if (!targetId) return
          if (state.scanCooldown > 0) {
            newLogs = addLog(newLogs, `스캔 쿨다운 중입니다! (${state.scanCooldown}라운드 후 사용 가능)`, 'warning')
            set({ gameLog: newLogs })
            return
          }
          const target = newPlayers.find(p => p.id === targetId)
          if (!target) return

          const result = scanPlayer(myPlayer, target)
          newLogs = addLog(newLogs, result.log, result.isZombie ? 'danger' : 'info')
          
          set({
            gameLog: newLogs,
            scanCooldown: GAME_CONSTANTS.SCAN_COOLDOWN_ROUNDS,
            lastScanResult: { playerId: targetId, isZombie: result.isZombie },
          })
          return
        }
        default:
          return
      }

      set({
        players: newPlayers,
        gameLog: newLogs,
      })
    },

    processAiRound: () => {
      const state = get()
      if (state.status !== 'playing') return

      let newPlayers = [...state.players]
      let newLogs = state.gameLog

      // 각 AI 처리
      newPlayers.forEach((aiPlayer, index) => {
        if (!aiPlayer.isAi || aiPlayer.isEliminated) return

        // AI 정답 확인
        const isCorrect = aiWillAnswerCorrectly(aiPlayer)

        if (isCorrect) {
          // 정답 보너스 적용
          const bonusResult = applyCorrectBonus(aiPlayer)
          const updatedAi = bonusResult.newPlayer
          
          if (bonusResult.bonusLog) {
            newLogs = addLog(newLogs, bonusResult.bonusLog, 'info')
          }

          // AI 행동 결정
          const decision = aiDecideAction(updatedAi, newPlayers)

          switch (decision.action) {
            case 'attack': {
              if (decision.targetId) {
                const target = newPlayers.find(p => p.id === decision.targetId)
                if (target && target.role === 'human' && !target.isEliminated) {
                  const result = zombieAttack(updatedAi, target)
                  newPlayers = newPlayers.map(p => {
                    if (p.id === aiPlayer.id) return result.newZombie
                    if (p.id === decision.targetId) return result.newTarget
                    return p
                  })
                  // 좀비 공격 로그는 인간 플레이어 입장에서 보이되 공격자를 숨김
                  if (result.infected) {
                    newLogs = addLog(newLogs, `🧟 ${target.name}이(가) 감염되었습니다!`, 'infection')
                  }
                  return // 이미 newPlayers에 반영됨
                }
              }
              break
            }
            case 'heal': {
              const result = humanHeal(updatedAi)
              newPlayers = newPlayers.map(p => p.id === aiPlayer.id ? result.newPlayer : p)
              break
            }
            case 'shield': {
              const result = humanShield(updatedAi)
              newPlayers = newPlayers.map(p => p.id === aiPlayer.id ? result.newPlayer : p)
              break
            }
            case 'scan': {
              // AI 스캔은 로그에 표시하지 않음
              newPlayers = newPlayers.map(p => p.id === aiPlayer.id ? updatedAi : p)
              break
            }
          }

          // 행동 후 updatedAi가 반영 안 된 경우 반영
          if (!['attack'].includes(decision.action)) {
            // 이미 위에서 처리됨
          } else {
            newPlayers = newPlayers.map(p => p.id === aiPlayer.id ? updatedAi : p)
          }
        } else {
          // 오답 처리
          const result = applyWrongPenalty(aiPlayer)
          let updatedAi = result.newPlayer

          // 체력 0이면 감염
          if (updatedAi.health <= 0 && updatedAi.role === 'human') {
            updatedAi = {
              ...updatedAi,
              role: 'zombie',
              health: 999,
              attackPower: GAME_CONSTANTS.ZOMBIE_BASE_ATTACK,
              shield: 0,
            }
            newLogs = addLog(newLogs, `🧟 ${aiPlayer.name}이(가) 좀비가 되었습니다!`, 'infection')
          }

          newPlayers = newPlayers.map(p => p.id === aiPlayer.id ? updatedAi : p)
        }
      })

      // 랜덤 이벤트 체크
      const event = generateRandomEvent(state.roundNumber)
      if (event.type !== 'none') {
        newPlayers = event.effect(newPlayers)
        newLogs = addLog(newLogs, event.description, 'warning')
        set({
          players: newPlayers,
          gameLog: newLogs,
          currentEvent: { type: event.type, description: event.description },
        })
      } else {
        set({
          players: newPlayers,
          gameLog: newLogs,
        })
      }

      // 승리 조건 체크
      const winCheck = checkWinCondition(newPlayers, state.timeRemaining)
      if (winCheck.gameOver) {
        set({
          status: 'ended',
          players: newPlayers,
          winner: winCheck.winner,
          winReason: winCheck.reason,
          gameLog: addLog(newLogs, winCheck.reason, winCheck.winner === 'human' ? 'success' : 'danger'),
        })
      }
    },

    clearEvent: () => set({ currentEvent: null }),
    clearScanResult: () => set({ lastScanResult: null }),
    clearAttackResult: () => set({ lastAttackResult: null }),

    resetGame: () => {
      set(initialState)
    },
  },
}))
