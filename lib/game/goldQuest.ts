import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

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
}

/** public/gold-quest 이미지 파일명 (이벤트 타입별) */
export const BOX_EVENT_IMAGE: Record<BoxEventType, string> = {
  GOLD_STACK: '/gold-quest/gold-stack.svg',
  JESTER: '/gold-quest/jester.svg',
  UNICORN: '/gold-quest/unicorn.svg',
  SLIME_MONSTER: '/gold-quest/slime.svg',
  DRAGON: '/gold-quest/dragon.svg',
  KING: '/gold-quest/king.svg',
  ELF: '/gold-quest/elf.svg',
  WIZARD: '/gold-quest/wizard.svg',
  FAIRY: '/gold-quest/fairy.svg',
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

  if (random < 0.05) return { type: 'GOLD_STACK', value: 10, message: '골드 스택 발견! +10 골드', itemName: '골드 스택', icon: '💰' }
  if (random < 0.175) return { type: 'GOLD_STACK', value: 20, message: '골드 스택 발견! +20 골드', itemName: '골드 스택', icon: '💰' }
  if (random < 0.35) return { type: 'GOLD_STACK', value: 30, message: '골드 스택 발견! +30 골드', itemName: '골드 스택', icon: '💰' }
  if (random < 0.50) return { type: 'GOLD_STACK', value: 40, message: '골드 스택 발견! +40 골드', itemName: '골드 스택', icon: '💰' }
  if (random < 0.635) return { type: 'GOLD_STACK', value: 50, message: '골드 스택 발견! +50 골드', itemName: '골드 스택', icon: '💰' }
  if (random < 0.71) return { type: 'GOLD_STACK', value: 100, message: '골드 스택 발견! +100 골드', itemName: '골드 스택', icon: '💰' }

  if (random < 0.80) {
    const bonus = Math.max(currentGold, 50)
    return { type: 'JESTER', value: bonus, message: `광대가 나타났다! 골드가 2배가 되었다! 🃏`, itemName: '광대', icon: '🃏' }
  }

  if (random < 0.84) {
    const bonus = Math.max(currentGold * 2, 100)
    return { type: 'UNICORN', value: bonus, message: `유니콘이 나타났다! 골드가 3배가 되었다! 🦄`, itemName: '유니콘', icon: '🦄' }
  }

  if (random < 0.87) {
    const lossAmount = Math.floor(currentGold * 0.25)
    return { type: 'SLIME_MONSTER', value: lossAmount, message: `슬라임 몬스터가 나타났다! 골드의 25%를 잃었다! 😱`, itemName: '슬라임 몬스터', icon: '👾' }
  }

  if (random < 0.88) {
    const lossAmount = Math.floor(currentGold * 0.5)
    return { type: 'DRAGON', value: lossAmount, message: `드래곤이 나타났다! 골드의 50%를 잃었다! 🐉`, itemName: '드래곤', icon: '🐉' }
  }

  if (random < 0.90) {
    if (canSwap) return { type: 'KING', message: `왕이 나타났다! 다른 플레이어와 골드를 교환할 수 있다! 👑`, itemName: '왕', icon: '👑' }
    return { type: 'GOLD_STACK', value: 50, message: '골드 스택 발견! +50 골드', itemName: '골드 스택', icon: '💰' }
  }

  if (random < 0.94) {
    if (canSteal) return { type: 'ELF', message: `엘프가 나타났다! 다른 플레이어의 골드 10%를 훔칠 수 있다! 🧝`, itemName: '엘프', icon: '🧝' }
    return { type: 'GOLD_STACK', value: 30, message: '골드 스택 발견! +30 골드', itemName: '골드 스택', icon: '💰' }
  }

  if (random < 0.98) {
    if (canSteal) return { type: 'WIZARD', message: `마법사가 나타났다! 다른 플레이어의 골드 25%를 훔칠 수 있다! 🧙`, itemName: '마법사', icon: '🧙' }
    return { type: 'GOLD_STACK', value: 40, message: '골드 스택 발견! +40 골드', itemName: '골드 스택', icon: '💰' }
  }

  return { type: 'FAIRY', message: `요정이 나타났지만 아무 일도 일어나지 않았다... ✨`, itemName: '요정', icon: '✨' }
}


/**
 * BoxEvent를 적용하여 플레이어 점수 업데이트
 */
export async function applyBoxEvent(
  event: BoxEvent,
  currentPlayerId: string,
  currentPlayer: Player,
  targetPlayer: Player | null,
  supabaseClient: any
): Promise<void> {
  switch (event.type) {
    case 'GOLD_STACK':
    case 'JESTER':
    case 'UNICORN':
      // 골드 추가 (스택/광대 2배/유니콘 3배 — value로 결정됨)
      if (event.value !== undefined) {
        await supabaseClient
          .from('players')
          .update({
            gold: currentPlayer.gold + event.value,
            score: currentPlayer.score + event.value,
          })
          .eq('id', currentPlayerId)
      }
      break

    case 'SLIME_MONSTER':
    case 'DRAGON':
      // 골드 손실 (슬라임 25%/드래곤 50% — value로 결정됨)
      if (event.value !== undefined) {
        await supabaseClient
          .from('players')
          .update({
            gold: Math.max(currentPlayer.gold - event.value, 0),
            score: Math.max(currentPlayer.score - event.value, 0),
          })
          .eq('id', currentPlayerId)
      }
      break

    case 'KING':
      // 왕: 골드 교환 (Swap)
      if (event.targetPlayerId && targetPlayer) {
        // 두 플레이어의 점수와 Gold 교환
        const tempScore = currentPlayer.score
        const tempGold = currentPlayer.gold

        // 현재 플레이어 업데이트
        await supabaseClient
          .from('players')
          .update({
            score: targetPlayer.score,
            gold: targetPlayer.gold,
          })
          .eq('id', currentPlayerId)

        // 대상 플레이어 업데이트
        await supabaseClient
          .from('players')
          .update({
            score: tempScore,
            gold: tempGold,
          })
          .eq('id', event.targetPlayerId)
      }
      break

    case 'ELF':
    case 'WIZARD':
      // 엘프/마법사: 골드 훔치기 (비율은 event.value로 결정)
      if (event.targetPlayerId && targetPlayer && event.value !== undefined) {
        const stealAmount = Math.min(event.value, targetPlayer.gold)
        
        // 현재 플레이어에게 골드 추가
        await supabaseClient
          .from('players')
          .update({
            gold: currentPlayer.gold + stealAmount,
            score: currentPlayer.score + stealAmount,
          })
          .eq('id', currentPlayerId)

        // 대상 플레이어에서 골드 차감
        await supabaseClient
          .from('players')
          .update({
            gold: Math.max(targetPlayer.gold - stealAmount, 0),
            score: Math.max(targetPlayer.score - stealAmount, 0),
          })
          .eq('id', event.targetPlayerId)
      }
      break

    case 'FAIRY':
      // 요정: 아무것도 하지 않음
      break
  }
}
