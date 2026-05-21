// Cafe 게임 Zustand Store

import { create } from 'zustand'
import {
  CafeGameState,
  getInitialState,
  buyMenu,
  buyUpgrade,
  serveCustomer,
  removeCustomer,
  spawnCustomer,
  restockMenu,
  MENU_ITEMS,
  UPGRADES,
} from '@/lib/game/cafe'
import type { ItemId } from '@/lib/game/cafeItems'

export interface ActiveBuff {
  itemId: ItemId
  expiresAt: number
}

interface CafeStore extends CafeGameState {
  // Actions
  startGame: (duration: number) => void
  tickTimer: () => void
  earnCash: (amount: number) => void
  purchaseMenu: (menuId: string) => void
  purchaseUpgrade: (upgradeId: string) => void
  serveMenu: (customerId: string, menuId: string) => { success: boolean; earned: number }
  addCustomer: () => void
  removeExpiredCustomer: (customerId: string) => void
  resetGame: () => void
  updateCustomers: (currentTime: number) => void
  restockMenu: (menuId: string) => void // 퀴즈 정답 시 메뉴 재고충전
  activeBuffs: ActiveBuff[]
  applyBuff: (itemId: ItemId, duration?: number) => void
  removeBuff: (itemId: ItemId) => void
  goldenSpatulaActive: boolean
  activateGoldenSpatula: () => void
  consumeGoldenSpatula: () => void
  removeHalfCustomers: () => void
  purchaseMenuFree: (menuId: string) => void
}

export const useCafeStore = create<CafeStore>((set, get) => ({
  ...getInitialState(),
  activeBuffs: [],
  goldenSpatulaActive: false,

  startGame: (duration: number) => {
    set({
      ...getInitialState(),
      status: 'playing',
      timeRemaining: duration,
      activeBuffs: [],
      goldenSpatulaActive: false,
    })
  },

  tickTimer: () => {
    const state = get()
    if (state.status !== 'playing') return

    const newTime = state.timeRemaining - 1
    if (newTime <= 0) {
      set({
        ...state,
        status: 'ended',
        timeRemaining: 0,
      })
    } else {
      set({
        ...state,
        timeRemaining: newTime,
      })
    }
  },

  earnCash: (amount: number) => {
    set((state) => ({
      ...state,
      cash: state.cash + amount,
      totalCashEarned: state.totalCashEarned + amount,
    }))
  },

  purchaseMenu: (menuId: string) => {
    set((state) => buyMenu(state, menuId))
  },

  purchaseUpgrade: (upgradeId: string) => {
    set((state) => buyUpgrade(state, upgradeId))
  },

  serveMenu: (customerId: string, menuId: string) => {
    const state = get()
    const result = serveCustomer(state, customerId, menuId)
    if (result.success) {
      set(result.newState)
    }
    return { success: result.success, earned: result.earned }
  },

  addCustomer: () => {
    const state = get()
    if (state.status !== 'playing') return

    const newCustomer = spawnCustomer(state, Date.now())
    if (newCustomer) {
      set({
        ...state,
        customers: [...state.customers, newCustomer],
      })
    }
  },

  restockMenu: (menuId: string) => {
    set((state) => restockMenu(state, menuId))
  },

  removeExpiredCustomer: (customerId: string) => {
    set((state) => removeCustomer(state, customerId))
  },

  resetGame: () => {
    set({
      ...getInitialState(),
      activeBuffs: [],
      goldenSpatulaActive: false,
    })
  },

  updateCustomers: (currentTime: number) => {
    const state = get()
    if (state.status !== 'playing') return
    const hasExpressLane = state.activeBuffs.some(buff => buff.itemId === 'EXPRESS_LANE' && buff.expiresAt > currentTime)

    // 인내심이 다한 손님 제거
    const validCustomers = state.customers.filter((customer) => {
      const elapsed = (currentTime - customer.spawnTime) / 1000
      const patience = hasExpressLane ? customer.patience * 2 : customer.patience
      return elapsed < patience
    })

    if (validCustomers.length !== state.customers.length) {
      set({
        ...state,
        customers: validCustomers,
        activeBuffs: state.activeBuffs.filter(buff => buff.expiresAt > currentTime),
      })
    } else if (state.activeBuffs.some(buff => buff.expiresAt <= currentTime)) {
      set({
        ...state,
        activeBuffs: state.activeBuffs.filter(buff => buff.expiresAt > currentTime),
      })
    }
  },

  applyBuff: (itemId: ItemId, duration = 0) => {
    if (duration <= 0) return

    set((state) => ({
      ...state,
      activeBuffs: [
        ...state.activeBuffs.filter(buff => buff.itemId !== itemId),
        { itemId, expiresAt: Date.now() + duration },
      ],
    }))
  },

  removeBuff: (itemId: ItemId) => {
    set((state) => ({
      ...state,
      activeBuffs: state.activeBuffs.filter(buff => buff.itemId !== itemId),
    }))
  },

  activateGoldenSpatula: () => {
    set((state) => ({ ...state, goldenSpatulaActive: true }))
  },

  consumeGoldenSpatula: () => {
    set((state) => ({ ...state, goldenSpatulaActive: false }))
  },

  removeHalfCustomers: () => {
    set((state) => ({
      ...state,
      customers: state.customers.slice(Math.ceil(state.customers.length / 2)),
    }))
  },

  purchaseMenuFree: (menuId: string) => {
    set((state) => {
      if (state.unlockedMenus.includes(menuId)) return state
      if (!MENU_ITEMS.some(menu => menu.id === menuId)) return state
      return {
        ...state,
        unlockedMenus: [...state.unlockedMenus, menuId],
      }
    })
  },
}))
