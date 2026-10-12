/**
 * /dev 봇 친구의 모드별 동작. 봇이 한 문제를 맞히거나 틀렸을 때 자기 행(과 공격 대상 행)을 어떻게 바꾸는지 정한다.
 * (언제·얼마나 맞히는지는 components/dev/DevBotRunner.tsx 와 lib/dev/devBots.ts 의 난이도가 정한다)
 *
 * 원칙
 * - 사람 화면이 실제로 읽는 컬럼만, 사람이 받는 것과 비슷한 크기로 바꾼다. 게임 규칙 함수가 있으면 그대로 쓴다
 *   (골드퀘스트 상자·인형뽑기·마피아 금고·눈싸움 데미지·레이드 데미지).
 * - 숫자는 원자 증분만 쓴다. 사람이 봇을 공격·강탈하면 그 값이 봇 행에 바로 쌓이므로 절대값으로 덮지 않는다.
 * - 사람에게 하는 공격은 사람 화면이 DB 변화만으로 알아채는 모드(골드퀘스트·눈싸움·좀비)에서만 한다.
 *   다른 모드는 사람 자기 점수를 자기 화면이 절대값으로 쓰므로, 봇이 깎아도 곧 덮인다.
 * - 사람이 보낸 브로드캐스트는 이 탭에 돌아오지 않는다(self:false). 그래서 봇은 그런 이벤트에 반응하지 않는다.
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
import { getMachineRank, tryFishing, type Doll } from '@/lib/game/fishing'
import { generateSafeVaults, DIAMOND_CASH_VALUE } from '@/lib/game/mafia'
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
      const event = generateBoxEvent(self.gold ?? 0, ctx.players(), self.id)
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
  cafe: {
    cycleSeconds: 10,
    onAnswer: async (ctx, correct) => {
      if (!correct) return
      ctx.memory.correct = (ctx.memory.correct ?? 0) + 1
      const menuPrices = [1000, 3000, 8000, 15000, 35000, 80000]
      const price = menuPrices[Math.min(menuPrices.length - 1, Math.floor(ctx.memory.correct / 4))]
      await ctx.addDelta({ score: price, cafe_cash: price })
    },
  },

  // 마피아: 순위는 현금 + 다이아×100. 실제 금고 표에서 하나를 연다.
  mafia: {
    cycleSeconds: 10,
    onAnswer: async (ctx, correct) => {
      if (!correct) return
      const vault = pick(generateSafeVaults())
      const multiplier = ctx.memory.multiplier ?? 1
      if (vault.reward === 'cash') {
        const cash = Math.floor(vault.amount * multiplier)
        await ctx.addDelta({ mafia_cash: cash, gold: cash, score: cash })
      } else if (vault.reward === 'diamond') {
        const diamonds = Math.floor(vault.amount * multiplier)
        await ctx.addDelta({ mafia_diamonds: diamonds, score: diamonds * DIAMOND_CASH_VALUE })
      } else if (vault.reward === 'multiplier_1.5' || vault.reward === 'multiplier_2') {
        ctx.memory.multiplier = multiplier * (vault.multiplierType ?? 1)
      }
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
  treat_rush: {
    cycleSeconds: 30,
    onAnswer: async (ctx, correct) => {
      const running = Math.round(secondsSinceLast(ctx) * (2 + Math.random()))
      const earned = running + (correct ? 50 : 0)
      if (earned > 0) await ctx.addDelta({ score: earned })
    },
  },

  // 강아지대소동: 학생 화면엔 다른 학생이 안 보인다(선생님 TV 화면엔 나온다). 정답 +100 + 피하기 보상.
  poop_dodge: {
    cycleSeconds: 17,
    onAnswer: async (ctx, correct) => {
      const earned = correct ? 100 + randInt(50, 200) : randInt(20, 60)
      await ctx.addDelta({ score: earned })
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
