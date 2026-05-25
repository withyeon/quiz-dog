import type { Database } from '@/types/database.types'
import { updatePlayer } from '@/lib/services/players'

type Player = Database['public']['Tables']['players']['Row']
type PlayerPatch = Partial<Player> & Record<string, unknown>
type PlayerPatchUpdater = (playerId: string, patch: PlayerPatch) => Promise<void>

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

  if (random < 0.05) return { type: 'GOLD_STACK', value: 10, message: '낡은 동전 주머니를 발견했다! +10 골드', itemName: '동전 주머니', icon: '💰', image: '/gold-quest/coin-pouch.svg' }
  if (random < 0.175) return { type: 'GOLD_STACK', value: 20, message: '무거운 골드 주머니를 발견했다! +20 골드', itemName: '골드 주머니', icon: '💰', image: '/gold-quest/money-bag.svg' }
  if (random < 0.35) return { type: 'GOLD_STACK', value: 30, message: '수상한 나무 상자를 발견했다! +30 골드', itemName: '나무 상자', icon: '💰', image: '/gold-quest/wooden-crate.svg' }
  if (random < 0.50) return { type: 'GOLD_STACK', value: 40, message: '반짝이는 주머니를 발견했다! +40 골드', itemName: '반짝이는 주머니', icon: '💰', image: '/gold-quest/gold-pile.svg' }
  if (random < 0.635) return { type: 'GOLD_STACK', value: 50, message: '무거운 보물 상자를 발견했다! +50 골드', itemName: '보물 상자', icon: '💰', image: '/gold-quest/treasure-chest.svg' }
  if (random < 0.71) return { type: 'GOLD_STACK', value: 100, message: '전설의 황금 왕관을 발견했다! +100 골드', itemName: '황금 왕관', icon: '💰', image: '/gold-quest/golden-crown.svg' }

  if (random < 0.80) {
    const bonus = Math.max(currentGold, 50)
    return { type: 'JESTER', value: bonus, message: `속임수에 걸려들지 않고 이득을 봤다. +${bonus} 골드`, itemName: '광대', icon: '🃏' }
  }

  if (random < 0.84) {
    const bonus = Math.max(currentGold * 2, 100)
    return { type: 'UNICORN', value: bonus, message: `유니콘을 만나 행운을 얻었다. +${bonus} 골드`, itemName: '유니콘', icon: '🦄' }
  }

  if (random < 0.87) {
    if (currentGold <= 0) return { type: 'FAIRY', message: '슬라임 함정을 밟았지만 잃을 골드가 없었다.', itemName: '빈 함정', icon: '✨' }
    const lossAmount = Math.floor(currentGold * 0.25)
    return { type: 'SLIME_MONSTER', value: lossAmount, message: `슬라임 함정에 빠졌다. -${lossAmount} 골드`, itemName: '슬라임 함정', icon: '👾' }
  }

  if (random < 0.88) {
    if (currentGold <= 0) return { type: 'FAIRY', message: '드래곤이 나타났지만 잃을 골드가 없었다.', itemName: '빈 함정', icon: '✨' }
    const lossAmount = Math.floor(currentGold * 0.5)
    return { type: 'DRAGON', value: lossAmount, message: `드래곤에게 습격당했다. -${lossAmount} 골드`, itemName: '드래곤', icon: '🐉' }
  }

  if (random < 0.90) {
    if (canSwap) return { type: 'KING', message: '왕이 명령했다. 골드를 교환할 상대를 선택하라.', itemName: '왕의 명령서', icon: '👑' }
    return { type: 'GOLD_STACK', value: 50, message: '무거운 보물 상자를 발견했다. +50 골드', itemName: '보물 상자', icon: '💰', image: '/gold-quest/treasure-chest.svg' }
  }

  if (random < 0.94) {
    if (canSteal) return { type: 'ELF', message: '엘프의 편지를 얻었다. 골드 10%를 빼앗을 상대를 선택하라.', itemName: '엘프의 밀서', icon: '🧝' }
    return { type: 'GOLD_STACK', value: 30, message: '수상한 나무 상자를 발견했다. +30 골드', itemName: '나무 상자', icon: '💰', image: '/gold-quest/wooden-crate.svg' }
  }

  if (random < 0.98) {
    if (canSteal) return { type: 'WIZARD', message: '마법사의 계약서를 얻었다. 골드 25%를 빼앗을 상대를 선택하라.', itemName: '마법사의 계약서', icon: '🧙' }
    return { type: 'GOLD_STACK', value: 40, message: '반짝이는 골드 주머니를 발견했다. +40 골드', itemName: '금화 더미', icon: '💰', image: '/gold-quest/gold-pile.svg' }
  }

  return { type: 'FAIRY', message: '요정이 스쳐 지나갔다. 아무 일도 일어나지 않았다.', itemName: '요정', icon: '✨' }
}


/**
 * BoxEvent를 적용하여 플레이어 점수 업데이트
 */
export async function applyBoxEvent(
  event: BoxEvent,
  currentPlayerId: string,
  currentPlayer: Player,
  targetPlayer: Player | null,
  updatePlayerPatch: PlayerPatchUpdater = updatePlayer,
): Promise<void> {
  switch (event.type) {
    case 'GOLD_STACK':
    case 'JESTER':
    case 'UNICORN':
      // 골드 추가 (스택/광대 2배/유니콘 3배 — value로 결정됨)
      if (event.value !== undefined) {
        await updatePlayerPatch(currentPlayerId, {
          gold: currentPlayer.gold + event.value,
          score: currentPlayer.score + event.value,
        })
      }
      break

    case 'SLIME_MONSTER':
    case 'DRAGON':
      // 골드 손실 (슬라임 25%/드래곤 50% — value로 결정됨)
      if (event.value !== undefined) {
        await updatePlayerPatch(currentPlayerId, {
          gold: Math.max(currentPlayer.gold - event.value, 0),
          score: Math.max(currentPlayer.score - event.value, 0),
        })
      }
      break

    case 'KING':
      // 왕: 골드 교환 (Swap)
      if (event.targetPlayerId && targetPlayer) {
        // 두 플레이어의 점수와 Gold 교환
        const tempScore = currentPlayer.score
        const tempGold = currentPlayer.gold

        await Promise.all([
          updatePlayerPatch(currentPlayerId, {
            score: targetPlayer.score,
            gold: targetPlayer.gold,
          }),
          updatePlayerPatch(event.targetPlayerId, {
            score: tempScore,
            gold: tempGold,
          }),
        ])
      }
      break

    case 'ELF':
    case 'WIZARD':
      // 엘프/마법사: 골드 훔치기 (비율은 event.value로 결정)
      if (event.targetPlayerId && targetPlayer && event.value !== undefined) {
        const stealAmount = Math.min(event.value, targetPlayer.gold)

        await Promise.all([
          updatePlayerPatch(currentPlayerId, {
            gold: currentPlayer.gold + stealAmount,
            score: currentPlayer.score + stealAmount,
          }),
          updatePlayerPatch(event.targetPlayerId, {
            gold: Math.max(targetPlayer.gold - stealAmount, 0),
            score: Math.max(targetPlayer.score - stealAmount, 0),
          }),
        ])
      }
      break

    case 'FAIRY':
      // 요정: 아무것도 하지 않음
      break
  }
}
