import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

/**
 * 원자적 골드/점수 변경 어댑터.
 * 절대값 덮어쓰기(Lost Update) 대신 서버측 증분/훔치기/교환으로 처리한다.
 */
export interface GoldQuestMutator {
  /** 한 플레이어의 gold/score를 원자적으로 증분 (음수면 감소, 0 미만 clamp). */
  delta: (playerId: string, deltas: { gold?: number; score?: number }, reason?: string) => Promise<void>
  /** thief가 victim의 gold(및 동일 score)를 amount만큼 원자적으로 강탈 (총량 보존). */
  steal: (victimId: string, thiefId: string, amount: number, reason?: string) => Promise<void>
  /** 두 플레이어의 gold/score를 원자적으로 맞교환. */
  swap: (aId: string, bId: string, reason?: string) => Promise<void>
}

export type BoxEventType = 
  | 'GOLD_STACK'          // 골드 스택 (10, 20, 30, 40, 50, 100)
  | 'JESTER'              // 골드 2배
  | 'UNICORN'             // 골드 3배
  | 'SLIME_MONSTER'       // 골드 25% 손실
  | 'DRAGON'              // 골드 50% 손실
  | 'KING'                // 골드 교환 (Swap)
  | 'ELF'                 // 10% 훔치기
  | 'WIZARD'              // 25% 훔치기
  | 'FAIRY'               // 아무 일도 없음

export interface BoxEvent {
  type: BoxEventType
  value?: number // Gold 양
  targetPlayerId?: string // Swap/Steal 대상 플레이어 ID
  message: string
  itemName: string // 아이템 이름
  icon: string // 이모지 아이콘
  image?: string // 결과 화면에 표시할 개별 이미지
}

/** 한 문제를 맞힐 때마다 고르는 상자 개수 (ChestView · 튜토리얼 공용) */
export const CHEST_COUNT = 3

/** 이만큼 연속으로 맞히면 방어권을 하나 받는다 */
export const SHIELD_STREAK = 4

/** 광대·유니콘이 골드를 몇 배로 만드는지 */
export const GOLD_MULTIPLIER = { JESTER: 2, UNICORN: 3 } as const

/** 함정이 깎아가는 골드 비율 */
export const GOLD_LOSS_RATE = { SLIME_MONSTER: 0.25, DRAGON: 0.5 } as const

/** 엘프·마법사가 상대에게서 빼앗는 골드 비율 */
export const GOLD_STEAL_RATE = { ELF: 0.1, WIZARD: 0.25 } as const

/** 비율을 화면에 쓰는 퍼센트 숫자로 (0.25 → 25) */
export function toPercent(rate: number): number {
  return Math.round(rate * 100)
}

/** 골드 상자 목록 — 누적 확률 · 골드 · 아이템 이름 · 이미지 */
const GOLD_STACKS = [
  { chance: 0.05, value: 10, itemName: '동전 주머니', found: '낡은 동전 주머니를 발견했다!', image: '/gold-quest/coin-pouch.webp' },
  { chance: 0.175, value: 20, itemName: '골드 주머니', found: '무거운 골드 주머니를 발견했다!', image: '/gold-quest/money-bag.webp' },
  { chance: 0.35, value: 30, itemName: '나무 상자', found: '수상한 나무 상자를 발견했다!', image: '/gold-quest/wooden-crate.webp' },
  { chance: 0.5, value: 40, itemName: '반짝이는 주머니', found: '반짝이는 주머니를 발견했다!', image: '/gold-quest/gold-pile.webp' },
  { chance: 0.635, value: 50, itemName: '보물 상자', found: '무거운 보물 상자를 발견했다!', image: '/gold-quest/treasure-chest.webp' },
  { chance: 0.71, value: 100, itemName: '황금 왕관', found: '전설의 황금 왕관을 발견했다!', image: '/gold-quest/golden-crown.webp' },
] as const

type GoldStack = (typeof GOLD_STACKS)[number]

/** 상자 하나에서 받을 수 있는 가장 큰 골드 */
export const MAX_GOLD_STACK = Math.max(...GOLD_STACKS.map((stack) => stack.value))

/** 이름으로 골드 상자를 찾는다 (교환·훔치기가 불가능할 때 대신 주는 보상용) */
function goldStackNamed(itemName: GoldStack['itemName']): BoxEvent {
  const stack = GOLD_STACKS.find((candidate) => candidate.itemName === itemName)!
  return {
    type: 'GOLD_STACK',
    value: stack.value,
    message: `${stack.found} +${stack.value} 골드`,
    itemName: stack.itemName,
    icon: '💰',
    image: stack.image,
  }
}

/** public/gold-quest 이미지 파일명 (이벤트 타입별) */
export const BOX_EVENT_IMAGE: Record<BoxEventType, string> = {
  GOLD_STACK: '/gold-quest/gold-stack.webp',
  JESTER: '/gold-quest/jester.webp',
  UNICORN: '/gold-quest/unicorn.webp',
  SLIME_MONSTER: '/gold-quest/slime.webp',
  DRAGON: '/gold-quest/dragon.webp',
  KING: '/gold-quest/king.webp',
  ELF: '/gold-quest/elf.webp',
  WIZARD: '/gold-quest/wizard.webp',
  FAIRY: '/gold-quest/fairy.webp',
}

/**
 * Blooket Gold Quest 스타일 상자 이벤트 생성
 * @param currentGold 현재 플레이어의 Gold
 * @param players 전체 플레이어 목록
 * @param currentPlayerId 현재 플레이어 ID
 * @param isMannerMode 매너 모드 (Swap/Steal 금지) 여부
 * @returns BoxEvent
 */
export function generateBoxEvent(
  currentGold: number,
  players: Player[],
  currentPlayerId: string,
  isMannerMode: boolean = false
): BoxEvent {
  const random = Math.random()
  const otherPlayers = players.filter((p) => p.id !== currentPlayerId)
  const otherPlayersWithGold = otherPlayers.filter((p) => (p.gold ?? 0) > 0)
  const canSteal = !isMannerMode && otherPlayersWithGold.length > 0
  const canSwap = !isMannerMode && otherPlayers.length > 0

  for (const stack of GOLD_STACKS) {
    if (random < stack.chance) return goldStackNamed(stack.itemName)
  }

  if (random < 0.80) {
    const bonus = Math.max(currentGold * (GOLD_MULTIPLIER.JESTER - 1), 50)
    return { type: 'JESTER', value: bonus, message: `속임수에 걸려들지 않고 이득을 봤다. +${bonus} 골드`, itemName: '광대', icon: '🃏' }
  }

  if (random < 0.84) {
    const bonus = Math.max(currentGold * (GOLD_MULTIPLIER.UNICORN - 1), 100)
    return { type: 'UNICORN', value: bonus, message: `유니콘을 만나 행운을 얻었다. +${bonus} 골드`, itemName: '유니콘', icon: '🦄' }
  }

  if (random < 0.87) {
    if (currentGold <= 0) return { type: 'FAIRY', message: '슬라임 함정을 밟았지만 잃을 골드가 없었다.', itemName: '빈 함정', icon: '✨' }
    const lossAmount = Math.floor(currentGold * GOLD_LOSS_RATE.SLIME_MONSTER)
    return { type: 'SLIME_MONSTER', value: lossAmount, message: `슬라임 함정에 빠졌다. -${lossAmount} 골드`, itemName: '슬라임 함정', icon: '👾' }
  }

  if (random < 0.88) {
    if (currentGold <= 0) return { type: 'FAIRY', message: '드래곤이 나타났지만 잃을 골드가 없었다.', itemName: '빈 함정', icon: '✨' }
    const lossAmount = Math.floor(currentGold * GOLD_LOSS_RATE.DRAGON)
    return { type: 'DRAGON', value: lossAmount, message: `드래곤에게 습격당했다. -${lossAmount} 골드`, itemName: '드래곤', icon: '🐉' }
  }

  if (random < 0.90) {
    if (canSwap) return { type: 'KING', message: '왕이 명령했다. 골드를 교환할 상대를 선택하라.', itemName: '왕의 명령서', icon: '👑' }
    return goldStackNamed('보물 상자')
  }

  if (random < 0.94) {
    if (canSteal) return { type: 'ELF', message: `엘프의 편지를 얻었다. 골드 ${toPercent(GOLD_STEAL_RATE.ELF)}%를 빼앗을 상대를 선택하라.`, itemName: '엘프의 밀서', icon: '🧝' }
    return goldStackNamed('나무 상자')
  }

  if (random < 0.98) {
    if (canSteal) return { type: 'WIZARD', message: `마법사의 계약서를 얻었다. 골드 ${toPercent(GOLD_STEAL_RATE.WIZARD)}%를 빼앗을 상대를 선택하라.`, itemName: '마법사의 계약서', icon: '🧙' }
    return goldStackNamed('반짝이는 주머니')
  }

  return { type: 'FAIRY', message: '요정이 스쳐 지나갔다. 아무 일도 일어나지 않았다.', itemName: '요정', icon: '✨' }
}


/**
 * BoxEvent를 적용하여 플레이어 점수 업데이트.
 * 모든 변경은 서버측 원자 연산(mutator)으로 처리해 동시 상자 개봉/강탈 시
 * Lost Update(골드 증발·복제)를 방지한다.
 */
export async function applyBoxEvent(
  event: BoxEvent,
  currentPlayerId: string,
  currentPlayer: Player,
  targetPlayer: Player | null,
  mutator: GoldQuestMutator,
): Promise<void> {
  switch (event.type) {
    case 'GOLD_STACK':
    case 'JESTER':
    case 'UNICORN':
      // 골드 추가 (스택/광대 2배/유니콘 3배 — value로 결정됨)
      if (event.value !== undefined) {
        await mutator.delta(currentPlayerId, { gold: event.value, score: event.value }, 'gold_quest_gain')
      }
      break

    case 'SLIME_MONSTER':
    case 'DRAGON':
      // 골드 손실 (슬라임 25%/드래곤 50% — value로 결정됨). 서버에서 0 미만 clamp.
      if (event.value !== undefined) {
        await mutator.delta(currentPlayerId, { gold: -event.value, score: -event.value }, 'gold_quest_loss')
      }
      break

    case 'KING':
      // 왕: 골드/점수 원자적 교환 (Swap)
      if (event.targetPlayerId && targetPlayer) {
        await mutator.swap(currentPlayerId, event.targetPlayerId, 'gold_quest_swap')
      }
      break

    case 'ELF':
    case 'WIZARD':
      // 엘프/마법사: 골드 훔치기 (비율은 event.value로 결정). 서버가 피해자 실제 보유량까지만 이동.
      if (event.targetPlayerId && targetPlayer && event.value !== undefined) {
        await mutator.steal(event.targetPlayerId, currentPlayerId, event.value, 'gold_quest_steal')
      }
      break

    case 'FAIRY':
      // 요정: 아무것도 하지 않음
      break
  }
}
