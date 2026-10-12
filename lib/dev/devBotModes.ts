/**
 * /dev 봇 친구의 모드별 동작. 봇이 한 문제를 맞히거나 틀렸을 때 자기 행(과 공격 대상 행)을 어떻게 바꾸는지 정한다.
 * (언제·얼마나 맞히는지는 components/dev/DevBotRunner.tsx 와 lib/dev/devBots.ts 의 난이도가 정한다)
 *
 * 원칙
 * - 사람 화면이 실제로 읽는 컬럼만, 사람이 받는 것과 비슷한 크기로 바꾼다. 게임 규칙 함수가 있으면 그대로 쓴다
 *   (골드퀘스트 상자·인형뽑기·마피아 금고·눈싸움 데미지·레이드 데미지).
 * - 숫자는 원자 증분만 쓴다. 사람이 봇을 공격·강탈하면 그 값이 봇 행에 바로 쌓이므로 절대값으로 덮지 않는다.
 * - 공격·방해는 사람이 쓰는 것과 같은 길로 한다.
 *   · DB 로 끝나는 것(골드퀘스트 강탈·교환, 눈싸움, 좀비, 마피아 조사 환수, 간식런 점수 뺏기, 똥폭탄·점수 도둑)은 그대로 쓴다.
 *   · 피해자 화면이 스스로 효과를 거는 것(카페 방해 아이템, 화면 뒤집기·축소, 간식런 점수 뺏기의 화면 쪽)은
 *     사람이 보내는 것과 같은 이벤트를 이 탭에 흘린다.
 *   · 피해자가 봇이면 화면이 없으니 실행기가 그 이벤트를 봇의 onEvent 로 넘기고, 봇이 효과를 수입·돈에 반영한다
 *     (사람이 봇에게 쓴 것도 같다. 사람이 보낸 이벤트는 보내는 순간 엿본다 — lib/realtime/roomChannel.ts).
 * - 시작 전 퀴즈를 마친 플레이어만 노린다(isTargetable). 공격 확률은 게임 규칙 그대로이고,
 *   /dev 의 "공격 자주"를 켜면(ctx.aggressive) 훨씬 자주 쓴다.
 */

import { DEV_BOT_DIFFICULTIES, type DevBot } from '@/lib/dev/devBots'
import type { DeltaColumn, PlayerDeltas, PlayerMaxes } from '@/lib/services/playerMutations'
import type { RoomEventType } from '@/lib/realtime/roomChannel'
import type { Database } from '@/types/database.types'
import { GOLD_STEAL_RATE, generateBoxEvent } from '@/lib/game/goldQuest'
import {
  PLAYER_CLASSES,
  calculateDamage,
  canAttackTarget,
  getDamageReduction,
  isCriticalHit,
  type PlayerClass,
} from '@/lib/game/battleRoyale'
import { getMachineRank, trySpecialItem, tryFishing, type Doll } from '@/lib/game/fishing'
import {
  DIAMOND_CASH_VALUE,
  applyCheat,
  attemptInvestigate,
  generateSafeVaults,
  openSafeVault,
  type MultiplierType,
  type Player as MafiaPlayer,
  type SafeVault,
} from '@/lib/game/mafia'
import { RARE_ITEM_STREAK, TAX_IMMUNITY_SECONDS, TAX_RATE, getRandomItemChoices } from '@/lib/game/cafeItems'
import { MENU_ITEMS } from '@/lib/game/cafe'
import { rollBoxItem } from '@/lib/game/간식런'
import {
  CARD_DEFS,
  POOP_BOMB_SCORE,
  SCORE_THIEF_AMOUNT,
  createPoopBombAttack,
  drawCardChoices,
  parsePendingAttacks,
} from '@/lib/game/강아지대소동'
import { sortPlayersByScore } from '@/lib/utils/playerSorting'
import { GAME_CONSTANTS, ZOMBIE_ACTION_LIMITS, getZombieMeta } from '@/lib/game/zombie'
import { zombieApplyAction, zombieAttack } from '@/lib/services/playerMutations'
import {
  RAID_ROLE_ORDER,
  computeHitDamage,
  computeRaidState,
  getRaidFrenzyState,
  getRaidRole,
  parseRaidSettings,
} from '@/lib/game/raid'

type PlayerRow = Database['public']['Tables']['players']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']

export type DevBotContext = {
  bot: DevBot
  roomCode: string
  /** 이번 판 봇들의 player id. 피해자가 봇이면 화면 효과 대신 점수 손해로 바꿀 때 쓴다 */
  botIds: ReadonlySet<string>
  /** /dev "공격 자주". 켜면 방해·공격 아이템을 훨씬 자주 쓴다 */
  aggressive: boolean
  /** 봇마다 따로 쓰는 메모(연속 정답, 누적 정답 등) */
  memory: Record<string, number>
  room: () => RoomRow | null
  /** 봇 자기 행(실행기가 들고 있는 최신 값) */
  self: () => PlayerRow | null
  /** 같은 방의 모든 플레이어(봇 자신 포함) */
  players: () => PlayerRow[]
  /** 자기 행 숫자 컬럼 원자 증분 + 화면에 바로 알림 */
  addDelta: (deltas: PlayerDeltas, maxes?: PlayerMaxes) => Promise<PlayerRow>
  /** 다른 플레이어 행 숫자 컬럼 원자 증분(공격) + 화면에 바로 알림 */
  addDeltaTo: (playerId: string, deltas: PlayerDeltas, maxes?: PlayerMaxes) => Promise<PlayerRow>
  steal: (victimId: string, amount: number, columns: DeltaColumn[]) => Promise<void>
  swap: (otherId: string, columns: DeltaColumn[]) => Promise<void>
  /** 숫자가 아닌 컬럼 덮어쓰기 + 화면에 바로 알림 (봇 자기 행만) */
  setFields: (patch: Record<string, unknown>) => Promise<void>
  /** 다른 플레이어 행의 숫자가 아닌 컬럼 덮어쓰기(마피아 수상함 해제·똥폭탄 쌓기) + 화면에 바로 알림 */
  patchPlayer: (playerId: string, patch: Record<string, unknown>, reason?: string) => Promise<void>
  /** DB 최신 행 한 줄(마피아 조사처럼 상대의 지금 값으로 판정해야 할 때) */
  fetchPlayer: (playerId: string) => Promise<PlayerRow | null>
  /** RPC 가 돌려준 권위 있는 행들을 화면에 알림 */
  publishRows: (rows: PlayerRow[], columns: Array<keyof PlayerRow>) => void
  /** 이 탭의 게임 화면에 봇이 보낸 것처럼 이벤트를 흘린다(사람 화면 연출용) */
  emit: (type: RoomEventType, payload: Record<string, unknown>) => void
}

export type DevBotModeStrategy = {
  /** 사람이 이 모드에서 문제 하나(퀴즈 + 미니게임)를 도는 데 걸리는 대략의 시간(초). 난이도 속도를 곱해 쓴다 */
  cycleSeconds: number
  /** 시작할 때 봇마다 한 번(직업·역할처럼 사람이 게임 화면에서 고르는 값) */
  onStart?: (ctx: DevBotContext) => Promise<void>
  onAnswer: (ctx: DevBotContext, correct: boolean, answerTimeMs: number) => Promise<void>
  /** 이 봇을 겨냥한 이벤트(사람·다른 봇이 쓴 방해 아이템 등). 사람 화면이 스스로 거는 효과를 봇은 여기서 받는다 */
  onEvent?: (ctx: DevBotContext, type: RoomEventType, payload: Record<string, unknown>) => Promise<void>
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

/**
 * 시작 전 퀴즈 문제 수. 진짜 학생은 다 같이 이만큼 풀고 나서 게임을 시작하므로 그동안은 서로 공격하지 않는다.
 * 봇도 처음 이만큼은 보상·공격 없이 답만 한다(DevBotRunner). 그리고 이만큼 푼 플레이어만 공격 대상으로 삼는다.
 * 이걸 안 하면 사람이 직업을 고르고 시작 전 퀴즈를 푸는 동안 봇 눈뭉치에 맞아, 해 보기도 전에 눈사람이 된다.
 * (사람의 answer_history 는 useGameBase 가 5초 안에 DB 에 쓴다)
 */
export const DEV_BOT_WARMUP_ANSWERS = 3

function isTargetable(player: PlayerRow): boolean {
  if (player.is_kicked) return false
  return Array.isArray(player.answer_history) && player.answer_history.length >= DEV_BOT_WARMUP_ANSWERS
}

/** 공격 대상 고르기. 사람만 노리면 사람이 늘 먼저 쓰러지므로 고르게 뽑는다. */
function pickTarget(candidates: PlayerRow[]): PlayerRow | null {
  const targetable = candidates.filter(isTargetable)
  return targetable.length > 0 ? pick(targetable) : null
}

/** 사람 플레이어 중 공격받을 준비(시작 전 퀴즈 끝)가 된 사람이 있는지. 모두에게 가는 화면 공격을 언제 보낼지 정한다 */
function hasReadyHuman(ctx: DevBotContext): boolean {
  return ctx.players().some((p) => !ctx.botIds.has(p.id) && isTargetable(p))
}

/** 화면 뒤집기·축소처럼 "나 빼고 모두"에게 가는 화면 공격. 사람 화면이 받아서 스스로 건다 */
function emitScreenAttack(ctx: DevBotContext, mode: 'fishing' | 'treat_rush', effect: 'screen_flip' | 'screen_shrink') {
  const self = ctx.self()
  if (!self || !hasReadyHuman(ctx)) return
  const durationMs = 7000
  ctx.emit('game:effect', {
    mode,
    effect,
    ...(mode === 'treat_rush' ? { item: effect } : {}),
    sourcePlayerId: self.id,
    sourceName: self.nickname,
    durationMs,
    expiresAt: Date.now() + durationMs,
  })
}

// ── 마피아: 화면(MafiaView)과 같은 방식으로 행 ↔ 게임 규칙 객체를 오간다 ──
function toMafiaPlayer(row: PlayerRow): MafiaPlayer {
  const item = row.active_item as { mafia?: Record<string, unknown> } | Record<string, unknown> | null
  const raw = (item && typeof item === 'object' && 'mafia' in item && item.mafia && typeof item.mafia === 'object'
    ? item.mafia
    : item ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    name: row.nickname,
    isAi: false,
    cash: row.mafia_cash ?? row.score ?? 0,
    diamonds: row.mafia_diamonds ?? 0,
    status: 'active',
    isCheating: raw.isCheating === true,
    cheatPendingVault: raw.cheatPendingVault === true,
    multipliers: Array.isArray(raw.multipliers)
      ? raw.multipliers.filter((m): m is MultiplierType => m === 1.5 || m === 2)
      : [],
  }
}

function mafiaFlagPatch(player: MafiaPlayer): Record<string, unknown> {
  return {
    active_item: {
      mafia: {
        isCheating: player.isCheating,
        cheatPendingVault: player.cheatPendingVault ?? false,
        multipliers: player.multipliers,
      },
    },
  }
}

// ── 카페: 봇이 연 메뉴(정답 4개마다 하나씩)와 판매가 ──
const CAFE_MENU_PRICES = [1000, 3000, 8000, 15000, 35000, 80000]

/** 봇 카페 정보(active_item). 사람 화면의 카피캣(1등 메뉴 가져오기)과 세금 면제 표시가 읽는다(CafePlayerMeta) */
async function publishCafeMeta(ctx: DevBotContext, level: number): Promise<void> {
  const unlockedMenus = MENU_ITEMS.slice(0, level + 1).map((menu) => menu.id)
  await ctx.setFields({ active_item: { unlockedMenus, taxFreeUntil: ctx.memory.taxFreeUntil ?? 0 } })
}

/** 몰래본 금고 중 가장 좋은 것(배수는 대략 150달러어치로 친다) */
function bestVault(vaults: SafeVault[]): SafeVault {
  const value = (v: SafeVault) => v.reward === 'cash'
    ? v.amount
    : v.reward === 'diamond' ? v.amount * DIAMOND_CASH_VALUE
      : v.reward === 'empty' ? 0 : 150
  return [...vaults].sort((a, b) => value(b) - value(a))[0]
}

/** 마지막 행동 뒤 흐른 초. 시간에 따라 저절로 쌓이는 점수(편의점 매출·타워 처치·간식런 달리기)에 쓴다 */
function secondsSinceLast(ctx: DevBotContext): number {
  const now = Date.now()
  const last = ctx.memory.lastAt ?? now
  ctx.memory.lastAt = now
  return Math.min(60, Math.max(0, (now - last) / 1000))
}

const STRATEGIES: Record<string, DevBotModeStrategy> = {
  // 골드퀘스트: 순위는 gold. 실제 상자 규칙으로 뽑고, 엘프·마법사·왕이 나오면 정말 훔치거나 바꾼다.
  gold_quest: {
    cycleSeconds: 14,
    onAnswer: async (ctx, correct) => {
      if (!correct) return
      const self = ctx.self()
      if (!self) return
      // 공격 자주: 상자 3개를 열어 보고 강탈·교환이 있으면 그걸 고른다(규칙 그대로면 정답의 약 10%만 공격)
      const draws = Array.from({ length: ctx.aggressive ? 3 : 1 }, () => generateBoxEvent(self.gold ?? 0, ctx.players(), self.id))
      const event = draws.find((e) => e.type === 'ELF' || e.type === 'WIZARD' || e.type === 'KING') ?? draws[0]
      // 방어권(has_umbrella)이 있는 사람은 건드리지 않는다. 봇은 사람 화면의 방어권 응답을 들을 수 없어서다.
      const exposed = ctx.players().filter((p) => p.id !== self.id && !p.has_umbrella)
      switch (event.type) {
        case 'GOLD_STACK':
        case 'JESTER':
        case 'UNICORN':
          await ctx.addDelta({ gold: event.value ?? 0, score: event.value ?? 0 })
          return
        case 'SLIME_MONSTER':
        case 'DRAGON':
          await ctx.addDelta({ gold: -(event.value ?? 0), score: -(event.value ?? 0) })
          return
        case 'ELF':
        case 'WIZARD': {
          const target = pickTarget(exposed.filter((p) => (p.gold ?? 0) > 0))
          if (!target) return
          const amount = Math.floor((target.gold ?? 0) * GOLD_STEAL_RATE[event.type])
          if (amount <= 0) return
          await ctx.steal(target.id, amount, ['gold', 'score'])
          ctx.emit('gold_quest:attack_notice', {
            attackerPlayerId: self.id,
            targetPlayerId: target.id,
            message: `${self.nickname}님이 ${event.itemName}로 내 골드 ${amount}을 가져갔어요.`,
          })
          return
        }
        case 'KING': {
          // 사람처럼 나보다 골드가 많은 상대와만 바꾼다
          const richer = exposed.filter((p) => (p.gold ?? 0) > (self.gold ?? 0))
          const target = pickTarget(richer)
          if (!target) return
          await ctx.swap(target.id, ['gold', 'score'])
          ctx.emit('gold_quest:attack_notice', {
            attackerPlayerId: self.id,
            targetPlayerId: target.id,
            message: `${self.nickname}님이 왕의 명령서로 나와 골드를 교환했어요.`,
          })
          return
        }
        default:
          return
      }
    },
  },

  // 눈싸움: 직업이 있어야 승패 판정에 들어간다. 정답이면 실제 데미지 식으로 눈뭉치를 던진다.
  battle_royale: {
    cycleSeconds: 7,
    onStart: async (ctx) => {
      const playerClass = pick(Object.keys(PLAYER_CLASSES) as PlayerClass[])
      await ctx.setFields({ player_class: playerClass, health: PLAYER_CLASSES[playerClass].maxHealth })
    },
    onAnswer: async (ctx, correct, answerTimeMs) => {
      const self = ctx.self()
      if (!correct || !self || (self.health ?? 0) <= 0) return
      const playerClass = (self.player_class as PlayerClass | null) ?? undefined
      const classInfo = playerClass ? PLAYER_CLASSES[playerClass] : null
      if (classInfo?.healAmount) {
        await ctx.addDelta({ health: classInfo.healAmount }, { health: classInfo.maxHealth })
      }
      const targets = ctx.players().filter((p) => !p.is_kicked && canAttackTarget(self, p))
      const target = pickTarget(targets)
      if (!target) return
      const startedAt = ctx.room()?.started_at
      const gameTime = startedAt ? Date.now() - new Date(startedAt).getTime() : 0
      const isCritical = isCriticalHit()
      const damage = calculateDamage(true, answerTimeMs, isCritical, playerClass, gameTime)
      const reduction = getDamageReduction(damage, (target.player_class as PlayerClass | null) ?? undefined)
      await ctx.addDeltaTo(target.id, { health: -reduction })
      // 전장에 눈뭉치가 날아가고, 사람이 맞았으면 맞은 연출이 뜬다
      ctx.emit('battle:attacked', {
        attackerId: self.id,
        attackerNickname: self.nickname,
        targetId: target.id,
        damage,
        isCritical,
        itemType: null,
      })
    },
  },

  // 인형뽑기: 순위는 claw_points. 실제 뽑기 확률(정답 5개마다 집게 등급 상승)로 인형을 뽑는다.
  fishing: {
    cycleSeconds: 12,
    onAnswer: async (ctx, correct, answerTimeMs) => {
      if (!correct) return
      ctx.memory.correct = (ctx.memory.correct ?? 0) + 1
      // 정답 때 특별 아이템(1/7)이 나오고, 그중 화면 뒤집기·축소는 나 빼고 모두에게 간다
      const special = trySpecialItem()
      const attack = special?.type === 'SCREEN_FLIP' || special?.type === 'SCREEN_SHRINK'
        ? special.type
        : ctx.aggressive && Math.random() < 0.35 ? pick(['SCREEN_FLIP', 'SCREEN_SHRINK'] as const) : null
      if (attack) emitScreenAttack(ctx, 'fishing', attack === 'SCREEN_FLIP' ? 'screen_flip' : 'screen_shrink')
      const aim = DEV_BOT_DIFFICULTIES[ctx.bot.difficulty].accuracy * 0.85
      const result = tryFishing(answerTimeMs / 1000, getMachineRank(ctx.memory.correct), false, aim)
      if (!result.success || !result.doll) return
      const doll: Doll = result.doll
      const dolls = Array.isArray(ctx.self()?.caught_dolls) ? (ctx.self()!.caught_dolls as unknown as Doll[]) : []
      await ctx.setFields({ caught_dolls: [...dolls, doll] })
      await ctx.addDelta({ claw_points: doll.score, score: doll.score })
    },
  },

  // 전설의 편의점: 게임 중엔 다른 학생이 안 보이고 결과에만 나온다. 정답 보너스 + 늘어나는 매출, 오답은 8% 손해.
  factory: {
    cycleSeconds: 6,
    onAnswer: async (ctx, correct) => {
      const income = (ctx.memory.incomePerSecond ?? 0) * secondsSinceLast(ctx)
      let delta = income
      if (correct) {
        ctx.memory.correct = (ctx.memory.correct ?? 0) + 1
        delta += randInt(500, 1200)
        // 정답 3개마다 상품이 하나 늘어 초당 매출이 오른다
        if (ctx.memory.correct % 3 === 0) ctx.memory.incomePerSecond = (ctx.memory.incomePerSecond ?? 0) + randInt(50, 250)
      } else {
        const money = ctx.self()?.convenience_money ?? 0
        delta -= Math.min(2000, Math.max(100, Math.floor(money * 0.08)))
      }
      const amount = Math.round(delta)
      if (amount !== 0) await ctx.addDelta({ factory_money: amount, convenience_money: amount, score: amount })
    },
  },

  // 카페: 정답마다 손님 한 명. 메뉴가 점점 비싸진다(정답 4개마다 다음 메뉴). 점수 = 지금 가진 돈.
  // 정답마다 사람처럼 아이템 3개 중 하나를 고르고, 방해 아이템(세금·악성 리뷰·가격 폭락·바퀴벌레)이 있으면 절반쯤 쓴다.
  // 봇이 방해 아이템을 맞으면(onEvent) 손님·가격이 줄어든 만큼 수입이 줄고, 세금은 가진 돈의 25%가 사라진다.
  cafe: {
    cycleSeconds: 10,
    onAnswer: async (ctx, correct) => {
      if (!correct) {
        ctx.memory.streak = 0
        return
      }
      ctx.memory.correct = (ctx.memory.correct ?? 0) + 1
      ctx.memory.streak = (ctx.memory.streak ?? 0) + 1
      const level = Math.min(CAFE_MENU_PRICES.length - 1, Math.floor(ctx.memory.correct / 4))
      const now = Date.now()
      // 악성 리뷰: 손님이 안 와서 못 판다 / 가격 폭락·바퀴벌레: 절반만 번다
      const factor = now < (ctx.memory.closedUntil ?? 0)
        ? 0
        : now < Math.max(ctx.memory.priceCrashUntil ?? 0, ctx.memory.roachUntil ?? 0) ? 0.5 : 1
      const price = Math.round(CAFE_MENU_PRICES[level] * factor)
      if (price > 0) await ctx.addDelta({ score: price, cafe_cash: price })
      // 연 메뉴가 늘면 카페 정보(active_item)를 다시 올린다. 사람의 카피캣·세금 면제 표시가 이걸 읽는다.
      if (level !== ctx.memory.publishedLevel) {
        ctx.memory.publishedLevel = level
        await publishCafeMeta(ctx, level)
      }

      // 연속 정답 3개부터 희귀 아이템(세금·바퀴벌레)이 섞인다. 공격 자주면 처음부터 섞고 방해 아이템을 거의 늘 고른다.
      const choices = getRandomItemChoices(ctx.aggressive ? RARE_ITEM_STREAK : ctx.memory.streak)
      const debuffs = choices.filter((item) => item.type === 'debuff')
      if (debuffs.length === 0 || Math.random() > (ctx.aggressive ? 0.95 : 0.5)) return
      const self = ctx.self()
      const target = self ? pickTarget(ctx.players().filter((p) => p.id !== self.id)) : null
      if (!self || !target) return
      const item = pick(debuffs)
      // 사람이 보내는 것과 같은 이벤트. 사람 카페면 사람 화면이, 봇 카페면 그 봇의 onEvent 가 효과를 건다.
      ctx.emit('cafe:item_attack', {
        attackerId: self.id,
        attackerNickname: self.nickname,
        targetId: target.id,
        itemId: item.id,
        duration: item.duration,
      })
    },
    onEvent: async (ctx, type, payload) => {
      if (type !== 'cafe:item_attack') return
      const now = Date.now()
      const duration = Number(payload.duration) || 0
      switch (payload.itemId) {
        case 'BAD_REVIEW':
          ctx.memory.closedUntil = now + (duration || 15000)
          return
        case 'PRICE_CRASH':
          ctx.memory.priceCrashUntil = now + (duration || 20000)
          return
        case 'ROACH_ALERT':
          // 손님 절반이 떠나고 재고 절반이 버려진다 → 한동안 절반만 판다
          ctx.memory.roachUntil = now + 10000
          return
        case 'TAX': {
          // 사람 카페와 같은 규칙: 가진 돈의 25%가 사라지고, 30초 동안은 세금이 안 걷힌다
          if (now < (ctx.memory.taxFreeUntil ?? 0)) return
          const cash = ctx.self()?.cafe_cash ?? ctx.self()?.score ?? 0
          const paid = Math.floor(cash * TAX_RATE)
          ctx.memory.taxFreeUntil = now + TAX_IMMUNITY_SECONDS * 1000
          if (paid > 0) await ctx.addDelta({ score: -paid, cafe_cash: -paid })
          await publishCafeMeta(ctx, ctx.memory.publishedLevel ?? 0)
          return
        }
        default:
          return
      }
    },
  },

  // 마피아: 순위는 현금 + 다이아×100. 정답이면 사람처럼 '친구 조사' 또는 '금고 열기'를 한다.
  // - 금고 열기는 가끔 몰래보기로 가장 좋은 금고를 고른다. 그러면 다음 행동까지 수상함이 남아 사람이 조사로 잡을 수 있다.
  // - 친구 조사는 누가 몰래봤는지 모르니 아무나 고른다. 몰래본 사람을 잡으면 자금 30%를 환수하고 상대에게 발각 알림이 뜬다.
  mafia: {
    cycleSeconds: 10,
    onAnswer: async (ctx, correct) => {
      if (!correct) return
      const selfRow = ctx.self()
      if (!selfRow) return
      const me = toMafiaPlayer(selfRow)

      const target = Math.random() < (ctx.aggressive ? 0.45 : 0.25)
        ? pickTarget(ctx.players().filter((p) => p.id !== me.id))
        : null
      if (target) {
        // 상대 잔액·수상함은 DB 최신값으로 판정한다(사람 화면과 같다)
        const fresh = toMafiaPlayer((await ctx.fetchPlayer(target.id)) ?? target)
        const result = attemptInvestigate(me, fresh, Date.now())
        // 조사는 '다음 행동'이라 내 수상함은 풀린다
        await ctx.setFields(mafiaFlagPatch({ ...result.newInvestigator, isCheating: false, cheatPendingVault: false }))
        if (!result.success) return
        ctx.emit('game:effect', {
          kind: 'mafia:caught',
          targetPlayerId: target.id,
          investigatorName: me.name,
          recovered: result.recovered ?? 0,
        })
        await ctx.patchPlayer(target.id, mafiaFlagPatch(result.newTarget), 'mafia_target_caught')
        const recovered = result.recovered ?? 0
        if (recovered > 0) {
          const convert = result.diamondsConverted ?? 0
          if (convert > 0) {
            await ctx.addDeltaTo(target.id, {
              mafia_diamonds: -convert,
              mafia_cash: convert * DIAMOND_CASH_VALUE,
              gold: convert * DIAMOND_CASH_VALUE,
            })
          }
          await ctx.steal(target.id, recovered, ['mafia_cash', 'score', 'gold'])
        }
        ctx.emit('game:effect', { kind: 'mafia:log', message: result.log, logType: 'danger' })
        return
      }

      const vaults = generateSafeVaults()
      const peek = Math.random() < (ctx.aggressive ? 0.5 : 0.3)
      const actor = peek ? applyCheat(vaults, me, Date.now()).newPlayer : me
      const vault = peek ? bestVault(vaults) : pick(vaults)
      const opened = openSafeVault(vault, actor)
      const next = opened.newPlayer
      // 몰래본 그 라운드에 연 금고는 수상함을 유지하고, 지난 라운드 수상함은 이번 행동으로 풀린다(MafiaView 와 같다)
      if (next.cheatPendingVault) next.cheatPendingVault = false
      else if (next.isCheating) next.isCheating = false
      const cash = next.cash - me.cash
      const diamonds = next.diamonds - me.diamonds
      const deltas: PlayerDeltas = {}
      if (cash !== 0) {
        deltas.mafia_cash = cash
        deltas.gold = cash
      }
      if (diamonds !== 0) deltas.mafia_diamonds = diamonds
      if (cash + diamonds * DIAMOND_CASH_VALUE !== 0) deltas.score = cash + diamonds * DIAMOND_CASH_VALUE
      if (Object.keys(deltas).length > 0) await ctx.addDelta(deltas)
      await ctx.setFields(mafiaFlagPatch(next))
      ctx.emit('game:effect', { kind: 'mafia:log', message: opened.log, logType: vault.reward === 'empty' ? 'info' : 'success' })
    },
  },

  // 떨어지지마: 높이 = score(미터, 정상 520), 에너지 = gold. 높이는 내려가지 않는다.
  dontlookdown: {
    cycleSeconds: 8,
    onAnswer: async (ctx, correct) => {
      if (correct) await ctx.addDelta({ score: randInt(8, 20), gold: randInt(40, 120) }, { score: 520 })
      else await ctx.addDelta({ gold: -180 })
    },
  },

  // 타워: 게임 중엔 다른 학생이 안 보이고 결과에만 나온다. 점수 = 번 골드 합(퀴즈 60~120 + 처치 수입).
  tower: {
    cycleSeconds: 10,
    onAnswer: async (ctx, correct) => {
      const kills = Math.round(secondsSinceLast(ctx) * randInt(5, 15))
      const earned = kills + (correct ? randInt(60, 120) : 0)
      if (earned > 0) await ctx.addDelta({ score: earned, gold: earned })
    },
  },

  // 좀비: 역할·체력·감염은 서버 RPC 로만 바꾼다(사람 화면과 같은 경로). 역할은 startRoom 이 배정한다.
  zombie: {
    cycleSeconds: 9,
    onAnswer: async (ctx, correct) => {
      const self = ctx.self()
      const meta = self ? getZombieMeta(self) : null
      if (!self || !meta) return
      const columns: Array<keyof PlayerRow> = ['health', 'attack_power', 'score', 'active_item']
      const row = await zombieApplyAction(self.id, correct ? 'correct' : 'wrong', { ...ZOMBIE_ACTION_LIMITS })
      if (row) ctx.publishRows([row], columns)
      if (!correct) return

      if (meta.role === 'human') {
        const action = Math.random() < 0.5 ? 'heal' : 'shield'
        const healed = await zombieApplyAction(self.id, action, { ...ZOMBIE_ACTION_LIMITS })
        if (healed) ctx.publishRows([healed], columns)
        return
      }
      const humans = ctx.players().filter((p) => !p.is_kicked && getZombieMeta(p)?.role === 'human')
      const target = pickTarget(humans)
      if (!target) return
      const attacker = row ?? self
      const result = await zombieAttack(
        self.id,
        target.id,
        attacker.attack_power ?? GAME_CONSTANTS.ZOMBIE_BASE_ATTACK,
        GAME_CONSTANTS.INFECTION_THRESHOLD,
        GAME_CONSTANTS.ZOMBIE_BASE_ATTACK,
      )
      ctx.publishRows(result.players, columns)
    },
  },

  // 간식런: 게임 중엔 다른 학생이 안 보인다. 달리기 점수(초당 2~3) + 30초마다 퀴즈 정답 +50.
  // 달리며 줍는 상자(퀴즈 한 번 사이 1~2개)에서 점수 뺏기(10%)·화면 뒤집기·축소(8%)가 나오면 쓴다.
  treat_rush: {
    cycleSeconds: 30,
    onAnswer: async (ctx, correct) => {
      const running = Math.round(secondsSinceLast(ctx) * (2 + Math.random()))
      const earned = running + (correct ? 50 : 0)
      if (earned > 0) await ctx.addDelta({ score: earned })

      const self = ctx.self()
      if (!self) return
      const boxes = ctx.aggressive ? 3 : randInt(1, 2)
      for (let i = 0; i < boxes; i += 1) {
        const rolled = rollBoxItem()
        const item = ctx.aggressive && rolled !== 'score_steal' && rolled !== 'screen_flip' && rolled !== 'screen_shrink' && Math.random() < 0.4
          ? pick(['score_steal', 'screen_flip', 'screen_shrink'] as const)
          : rolled
        if (item === 'screen_flip' || item === 'screen_shrink') {
          emitScreenAttack(ctx, 'treat_rush', item)
        } else if (item === 'score_steal') {
          const target = pickTarget(ctx.players().filter((p) => p.id !== self.id && p.is_online !== false && (p.score ?? 0) > 0))
          if (!target) continue
          const amount = Math.max(10, Math.min(120, Math.ceil((target.score ?? 0) * 0.2)))
          await ctx.steal(target.id, amount, ['score'])
          // 사람 화면은 자기 점수를 로컬에서 들고 있다가 덮어쓰므로, 같은 이벤트로 화면 점수도 깎게 한다
          ctx.emit('game:effect', {
            mode: 'treat_rush',
            effect: 'score_steal',
            item,
            sourcePlayerId: self.id,
            sourceName: self.nickname,
            targetPlayerId: target.id,
            amount,
          })
        }
      }
    },
  },

  // 강아지대소동: 학생 화면엔 다른 학생이 안 보인다(선생님 TV 화면엔 나온다). 정답 +100 + 피하기 보상.
  // 정답 뒤 카드 3장 중 공격 카드(똥폭탄 → 1등에게, 점수 도둑 → 아무에게 50점)가 있으면 절반쯤 쓴다.
  poop_dodge: {
    cycleSeconds: 17,
    onAnswer: async (ctx, correct) => {
      const self = ctx.self()
      if (!self) return
      let earned = correct ? 100 + randInt(50, 200) : randInt(20, 60)

      // 받은 똥폭탄은 다음 피하기에서 맞는다. 봇은 피하기 화면이 없으니 한 개에 20점 손해로 친다.
      const bombs = parsePendingAttacks(self.pending_attacks)
      if (bombs.length > 0) {
        await ctx.setFields({ pending_attacks: [] })
        earned -= 20 * bombs.length
      }

      if (correct) {
        const attackCards = drawCardChoices().filter((card) => card.id === 'poop_bomb' || card.id === 'score_thief')
        const useAttack = attackCards.length > 0 ? Math.random() < (ctx.aggressive ? 0.95 : 0.5) : ctx.aggressive && Math.random() < 0.5
        const card = useAttack ? (attackCards.length > 0 ? pick(attackCards) : pick([CARD_DEFS.poop_bomb, CARD_DEFS.score_thief])) : null
        const others = ctx.players().filter((p) => p.id !== self.id)
        if (card?.id === 'poop_bomb') {
          // 게임 규칙: 똥폭탄은 1등에게 간다
          const top = sortPlayersByScore(others.filter(isTargetable))[0]
          if (top) {
            const fresh = (await ctx.fetchPlayer(top.id)) ?? top
            await ctx.patchPlayer(top.id, {
              pending_attacks: [...parsePendingAttacks(fresh.pending_attacks), createPoopBombAttack(self.nickname)],
            }, 'poop_dodge_poop_bomb')
            earned += POOP_BOMB_SCORE
          }
        } else if (card?.id === 'score_thief') {
          const target = pickTarget(others)
          if (target) {
            await ctx.addDeltaTo(target.id, { score: -SCORE_THIEF_AMOUNT })
            earned += SCORE_THIEF_AMOUNT
          }
        }
      }

      if (earned !== 0) await ctx.addDelta({ score: earned })
    },
  },

  // 펭귄 레이드: 보스 체력은 전원의 score 합에서 깎인다. 방패가 올라오면 절반이 기여해야 깨지므로 봇도 기여한다.
  raid: {
    cycleSeconds: 6,
    onStart: async (ctx) => {
      await ctx.setFields({ player_class: pick(RAID_ROLE_ORDER) })
    },
    onAnswer: async (ctx, correct) => {
      if (!correct) {
        ctx.memory.streak = 0
        return
      }
      const self = ctx.self()
      if (!self) return
      ctx.memory.streak = (ctx.memory.streak ?? 0) + 1
      const room = ctx.room()
      const hit = computeHitDamage({
        role: getRaidRole(self),
        streak: ctx.memory.streak,
        frenzyActive: getRaidFrenzyState(room?.started_at).active,
      })
      const deltas: PlayerDeltas = { score: hit.damage, gold: 1 }
      const boss = computeRaidState(ctx.players(), parseRaidSettings(room?.settings)).current
      const myDefense = Math.max(0, self.defense ?? 0)
      if (boss && boss.shield.active && !boss.shield.broken && myDefense < boss.def.index + 1) {
        deltas.defense = boss.def.index + 1 - myDefense
      }
      await ctx.addDelta(deltas)
    },
  },

  // 공부 모드: 점수 = 맞힌 개수. 게임 중엔 다른 학생이 안 보이고 결과·리포트에만 나온다.
  study: {
    cycleSeconds: 8,
    onAnswer: async (ctx, correct) => {
      if (correct) await ctx.addDelta({ score: 1 })
    },
  },
}

const DEFAULT_STRATEGY: DevBotModeStrategy = {
  cycleSeconds: 10,
  onAnswer: async (ctx, correct) => {
    if (correct) await ctx.addDelta({ score: 100 })
  },
}

export function getDevBotModeStrategy(mode: string | null | undefined): DevBotModeStrategy {
  return (mode && STRATEGIES[mode]) || DEFAULT_STRATEGY
}
