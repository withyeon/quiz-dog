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

  if (random < 0.05) return { type: 'GOLD_STACK', value: 10, message: '낡은 금화 자루 발견. +10 골드', itemName: '금화 자루', icon: '💰' }
  if (random < 0.175) return { type: 'GOLD_STACK', value: 20, message: '작은 보물 더미 발견. +20 골드', itemName: '작은 보물 더미', icon: '💰' }
  if (random < 0.35) return { type: 'GOLD_STACK', value: 30, message: '숨겨진 보급 상자 발견. +30 골드', itemName: '보급 상자', icon: '💰' }
  if (random < 0.50) return { type: 'GOLD_STACK', value: 40, message: '빛나는 금화 더미 발견. +40 골드', itemName: '금화 더미', icon: '💰' }
  if (random < 0.635) return { type: 'GOLD_STACK', value: 50, message: '묵직한 보물 상자 발견. +50 골드', itemName: '보물 상자', icon: '💰' }
  if (random < 0.71) return { type: 'GOLD_STACK', value: 100, message: '전설의 왕관 보물 발견. +100 골드', itemName: '왕관 보물', icon: '💰' }

  if (random < 0.80) {
    const bonus = Math.max(currentGold, 50)
    return { type: 'JESTER', value: bonus, message: `광대의 거래 성공. +${bonus} 골드`, itemName: '광대', icon: '🃏' }
  }

  if (random < 0.84) {
    const bonus = Math.max(currentGold * 2, 100)
    return { type: 'UNICORN', value: bonus, message: `유니콘의 항로 발견. +${bonus} 골드`, itemName: '유니콘', icon: '🦄' }
  }

  if (random < 0.87) {
    if (currentGold <= 0) return { type: 'FAIRY', message: '빈 함정을 발견했지만 잃을 골드는 없었다.', itemName: '빈 함정', icon: '✨' }
    const lossAmount = Math.floor(currentGold * 0.25)
    return { type: 'SLIME_MONSTER', value: lossAmount, message: `슬라임 함정 발동. ${lossAmount} 골드를 잃었다.`, itemName: '슬라임 함정', icon: '👾' }
  }

  if (random < 0.88) {
    if (currentGold <= 0) return { type: 'FAIRY', message: '용의 그림자를 피했다. 잃을 골드는 없었다.', itemName: '빈 함정', icon: '✨' }
    const lossAmount = Math.floor(currentGold * 0.5)
    return { type: 'DRAGON', value: lossAmount, message: `드래곤 급습. ${lossAmount} 골드를 잃었다.`, itemName: '드래곤', icon: '🐉' }
  }

  if (random < 0.90) {
    if (canSwap) return { type: 'KING', message: '왕의 명령서 획득. 교환할 상대를 선택하라.', itemName: '왕의 명령서', icon: '👑' }
    return { type: 'GOLD_STACK', value: 50, message: '묵직한 보물 상자 발견. +50 골드', itemName: '보물 상자', icon: '💰' }
  }

  if (random < 0.94) {
    if (canSteal) return { type: 'ELF', message: '엘프의 밀서 획득. 골드 10%를 가져올 상대를 선택하라.', itemName: '엘프의 밀서', icon: '🧝' }
    return { type: 'GOLD_STACK', value: 30, message: '숨겨진 보급 상자 발견. +30 골드', itemName: '보급 상자', icon: '💰' }
  }

  if (random < 0.98) {
    if (canSteal) return { type: 'WIZARD', message: '마법사의 계약서 획득. 골드 25%를 가져올 상대를 선택하라.', itemName: '마법사의 계약서', icon: '🧙' }
    return { type: 'GOLD_STACK', value: 40, message: '빛나는 금화 더미 발견. +40 골드', itemName: '금화 더미', icon: '💰' }
  }

  return { type: 'FAIRY', message: '요정의 바람이 지나갔다. 이번 항로는 조용하다.', itemName: '요정', icon: '✨' }
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
