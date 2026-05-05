// Mafia Heist: Deceptive Dinos 스타일 게임 Zustand Store

import { create } from 'zustand'
import {
  Player,
  SafeVault,
  GameLog,
  createInitialPlayers,
  generateSafeVaults,
  openSafeVault,
  applyCheat,
  detectCheating,
  attemptInvestigate,
  calculateLaunderedCash,
  generateCheatHint,
  aiAutoEarn,
  aiAttemptCheat,
  calculateTotalMultiplier,
} from '@/lib/game/mafia'

interface MafiaGameState {
  status: 'lobby' | 'playing' | 'ended'
  timeRemaining: number
  players: Player[]
  currentVaults: SafeVault[] | null // 현재 3개 금고
  gameLog: GameLog[]
  pendingAction: 'excavate' | 'investigate' | null // 정답 후 대기 중인 액션
  showVaultSelection: boolean // 금고 선택 화면 표시 여부
  showInvestigation: boolean // 조사 화면 표시 여부
  cheatVaultContents: SafeVault[] | null // Cheat으로 본 금고 내용
  investigatingPlayer: string | null // 조사 중인 플레이어 ID
  investigationResult: 'CHEATER' | 'CLEAR' | null // 조사 결과
  selectedVaultResult: { vault: SafeVault; log: string } | null // 선택한 금고의 결과
  actions: {
    startGame: (duration: number) => void
    tickTimer: () => void
    setPendingAction: (action: 'excavate' | 'investigate' | null) => void
    generateNewVaults: () => void
    selectVault: (vaultId: string) => void
    useCheatButton: () => void
    startInvestigation: (targetId: string) => void
    completeInvestigation: () => void
    aiAction: () => void
    resetGame: () => void
  }
}

const initialState = {
  status: 'lobby' as const,
  timeRemaining: 420,
  players: createInitialPlayers(),
  currentVaults: null,
  gameLog: [] as GameLog[],
  pendingAction: null,
  showVaultSelection: false,
  showInvestigation: false,
  cheatVaultContents: null,
  investigatingPlayer: null,
  investigationResult: null,
  selectedVaultResult: null,
}

export const useMafiaStore = create<MafiaGameState>((set, get) => ({
  ...initialState,

  actions: {
    startGame: (duration: number) => {
      set({
        ...initialState,
        status: 'playing',
        timeRemaining: duration,
        players: createInitialPlayers(),
        currentVaults: null,
        gameLog: [
          {
            id: 'start',
            message: '게임이 시작되었습니다. 정답을 맞추고 금고를 열거나 다른 플레이어를 조사하세요!',
            type: 'info',
            timestamp: Date.now(),
          },
        ],
      })
    },

    tickTimer: () => {
      const state = get()
      if (state.status !== 'playing') return

      const currentTime = Date.now()
      let newPlayers = [...state.players]
      let newLogs: GameLog[] = []

      // 치팅 감지 및 종료 체크
      state.players.forEach((player) => {
        if (player.isCheating) {
          const result = detectCheating(player, currentTime)
          if (result.log) {
            newPlayers = newPlayers.map((p) =>
              p.id === player.id ? result.newPlayer : p
            )
            newLogs.push({
              id: `cheat-${Date.now()}-${Math.random()}`,
              message: result.log,
              type: result.caught ? 'danger' : 'warning',
              timestamp: Date.now(),
            })
          } else if (player.cheatEndTime && currentTime >= player.cheatEndTime) {
            // 치팅 시간 종료
            newPlayers = newPlayers.map((p) =>
              p.id === player.id
                ? {
                    ...p,
                    isCheating: false,
                    cheatEndTime: undefined,
                  }
                : p
            )
          }
        }
      })

      const newTime = state.timeRemaining - 1
      if (newTime <= 0) {
        // 게임 종료 - 최종 순위 계산
        const sortedPlayers = [...newPlayers].sort(
          (a, b) => calculateLaunderedCash(b) - calculateLaunderedCash(a)
        )

        const winner = sortedPlayers[0]
        const finalLog: GameLog = {
          id: 'end',
          message: `게임 종료! 승자: ${winner.name} ($${calculateLaunderedCash(winner).toLocaleString()})`,
          type: 'success',
          timestamp: Date.now(),
        }

        set({
          ...state,
          status: 'ended',
          timeRemaining: 0,
          players: newPlayers,
          gameLog: [...state.gameLog, ...newLogs, finalLog],
        })
      } else {
        set({
          ...state,
          timeRemaining: newTime,
          players: newPlayers,
          gameLog: newLogs.length > 0 ? [...state.gameLog, ...newLogs] : state.gameLog,
        })
      }
    },

    setPendingAction: (action: 'excavate' | 'investigate' | null) => {
      const state = get()
      if (action === 'excavate') {
        // 금고 열기 선택 - 새로운 금고 생성
        const vaults = generateSafeVaults()
        set({
          ...state,
          pendingAction: action,
          showVaultSelection: true,
          showInvestigation: false,
          currentVaults: vaults,
          cheatVaultContents: null,
        })
      } else if (action === 'investigate') {
        // 조사 선택
        set({
          ...state,
          pendingAction: action,
          showVaultSelection: false,
          showInvestigation: true,
        })
      } else {
        set({
          ...state,
          pendingAction: null,
          showVaultSelection: false,
          showInvestigation: false,
          currentVaults: null,
          cheatVaultContents: null,
          investigatingPlayer: null,
          investigationResult: null,
          selectedVaultResult: null,
        })
      }
    },

    generateNewVaults: () => {
      const vaults = generateSafeVaults()
      set({
        ...get(),
        currentVaults: vaults,
        cheatVaultContents: null,
      })
    },

    selectVault: (vaultId: string) => {
      const state = get()
      if (state.status !== 'playing' || !state.currentVaults) return

      const player = state.players.find((p) => !p.isAi)
      if (!player) return

      const vault = state.currentVaults.find((v) => v.id === vaultId)
      if (!vault) return

      const result = openSafeVault(vault, player)

      set({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? result.newPlayer : p)),
        gameLog: [
          ...state.gameLog,
          {
            id: `log-${Date.now()}`,
            message: result.log,
            type: vault.reward === 'empty' ? 'info' : 'success',
            timestamp: Date.now(),
          },
        ],
        showVaultSelection: false,
        pendingAction: null,
        selectedVaultResult: { vault, log: result.log },
        currentVaults: null, // 결과 화면으로 넘어가면 금고 선택 화면은 닫음
        cheatVaultContents: null,
      })
    },

    useCheatButton: () => {
      const state = get()
      if (state.status !== 'playing' || !state.currentVaults) return

      const player = state.players.find((p) => !p.isAi)
      if (!player) return

      const result = applyCheat(state.currentVaults, player, Date.now())

      set({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? result.newPlayer : p)),
        cheatVaultContents: result.vaultContents,
        gameLog: [
          ...state.gameLog,
          {
            id: `cheat-${Date.now()}`,
            message: result.log,
            type: 'warning',
            timestamp: Date.now(),
          },
        ],
      })
    },

    startInvestigation: (targetId: string) => {
      const state = get()
      if (state.status !== 'playing') return

      const player = state.players.find((p) => !p.isAi)
      const target = state.players.find((p) => p.id === targetId)
      if (!player || !target || target.isAi === false) return

      set({
        ...state,
        investigatingPlayer: targetId,
        investigationResult: null,
      })

      // 3초 후 조사 완료
      setTimeout(() => {
        const currentState = get()
        const currentPlayer = currentState.players.find((p) => !p.isAi)
        const currentTarget = currentState.players.find((p) => p.id === targetId)
        if (!currentPlayer || !currentTarget) return

        const result = attemptInvestigate(currentPlayer, currentTarget, Date.now())

        set({
          ...currentState,
          players: currentState.players.map((p) => {
            if (p.id === currentPlayer.id) return result.newInvestigator
            if (p.id === currentTarget.id) return result.newTarget
            return p
          }),
          investigationResult: result.result,
          gameLog: [
            ...currentState.gameLog,
            {
              id: `investigate-${Date.now()}`,
              message: result.log,
              type: result.success ? 'success' : 'info',
              timestamp: Date.now(),
            },
          ],
        })
      }, 3000)
    },

    completeInvestigation: () => {
      const state = get()
      set({
        ...state,
        showInvestigation: false,
        pendingAction: null,
        investigatingPlayer: null,
        investigationResult: null,
      })
    },

    aiAction: () => {
      const state = get()
      if (state.status !== 'playing') return

      const currentTime = Date.now()
      let newPlayers = [...state.players]
      let newLogs: GameLog[] = []

      // AI 자동 행동
      state.players.forEach((aiPlayer) => {
        if (!aiPlayer.isAi || aiPlayer.status !== 'active') return

        // 치팅 종료 체크
        if (aiPlayer.isCheating && aiPlayer.cheatEndTime && currentTime >= aiPlayer.cheatEndTime) {
          newPlayers = newPlayers.map((p) =>
            p.id === aiPlayer.id
              ? {
                  ...p,
                  isCheating: false,
                  cheatEndTime: undefined,
                }
              : p
          )
          return
        }

        // 이미 치팅 중이면 스킵
        if (aiPlayer.isCheating) return

        // 랜덤 행동 결정 (20% 확률로 치팅 시도, 80% 확률로 자금 획득)
        const action = Math.random()

        if (action < 0.2) {
          // 치팅 시도 (새로운 금고 생성)
          const vaults = generateSafeVaults()
          const result = aiAttemptCheat(aiPlayer, vaults, currentTime)
          if (result.vaultContents) {
            newPlayers = newPlayers.map((p) =>
              p.id === aiPlayer.id ? result.newPlayer : p
            )
            if (result.log) {
              newLogs.push({
                id: `ai-cheat-${Date.now()}-${Math.random()}`,
                message: result.log,
                type: 'warning',
                timestamp: Date.now(),
              })
            }
          }
        } else {
          // 자금 획득
          const result = aiAutoEarn(aiPlayer)
          newPlayers = newPlayers.map((p) =>
            p.id === aiPlayer.id ? result.newPlayer : p
          )
          newLogs.push({
            id: `ai-${Date.now()}-${Math.random()}`,
            message: result.log,
            type: 'info',
            timestamp: Date.now(),
          })
        }
      })

      set({
        ...state,
        players: newPlayers,
        gameLog: [...state.gameLog, ...newLogs],
      })
    },

    resetGame: () => {
      set(initialState)
    },
  },
}))
