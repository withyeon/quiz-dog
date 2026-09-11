import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'

type ScorePlayer = {
  score?: number | null
  gold?: number | null
  health?: number | null
  factory_money?: number | null
  claw_points?: number | null
}

export type ScoreDisplay = {
  value: number
  label: string
  text: string
  icon?: string
  tone: 'default' | 'gold' | 'money' | 'health' | 'height'
}

function toFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString()
}

export function getPrimaryScoreValue(player: ScorePlayer, gameMode: string | null | undefined): number {
  const mode = getGameModeConfig(gameMode).id

  if (mode === 'gold_quest') return toFiniteNumber(player.gold ?? player.score)
  if (mode === 'battle_royale') return toFiniteNumber(player.health ?? player.score)
  if (mode === 'factory') return toFiniteNumber(player.factory_money ?? player.score)
  if (mode === 'cafe') return toFiniteNumber(player.score)
  if (mode === 'fishing') return toFiniteNumber(player.claw_points ?? player.score)
  return toFiniteNumber(player.score)
}

export function getScoreDisplay(player: ScorePlayer, gameMode: string | null | undefined): ScoreDisplay {
  const mode = getGameModeConfig(gameMode).id
  const value = getPrimaryScoreValue(player, mode)

  if (mode === 'gold_quest') {
    return {
      value,
      label: '골드',
      text: `${formatNumber(value)} 골드`,
      icon: '/gold-quest/gold-stack.webp',
      tone: 'gold',
    }
  }

  if (mode === 'factory' || mode === 'cafe') {
    return {
      value,
      label: '원',
      text: `${formatNumber(value)}원`,
      tone: 'money',
    }
  }

  if (mode === 'battle_royale') {
    return {
      value,
      label: 'HP',
      text: `${formatNumber(value)} HP`,
      tone: 'health',
    }
  }

  if (mode === 'dontlookdown') {
    return {
      value,
      label: 'm',
      text: `${formatNumber(value)}m`,
      tone: 'height',
    }
  }

  // 공부 모드 점수는 첫 바퀴에서 맞힌 문제 수다 (재도전하면 최고 시도).
  if (mode === 'study') {
    return {
      value,
      label: '개 정답',
      text: `${formatNumber(value)}개 정답`,
      tone: 'default',
    }
  }

  // 좀비 모드 점수는 생존 여부가 먼저인 티어 점수다 (인간 200+체력 / 좀비 10×감염수).
  // 그냥 '점'이라고 하면 인간과 좀비가 같은 척도로 보이므로 이름을 붙여준다.
  if (mode === 'zombie') {
    return {
      value,
      label: '생존 점수',
      text: `${formatNumber(value)}점`,
      tone: 'default',
    }
  }

  return {
    value,
    label: '점',
    text: `${formatNumber(value)}점`,
    tone: 'default',
  }
}

export function getScoreDisplayLabel(gameMode: string | null | undefined): string {
  const mode = getGameModeConfig(gameMode).id
  if (mode === 'gold_quest') return '골드'
  if (mode === 'factory' || mode === 'cafe') return '수익'
  if (mode === 'battle_royale') return '체력'
  if (mode === 'dontlookdown') return '높이'
  if (mode === 'zombie') return '생존 점수'
  if (mode === 'study') return '정답 수'
  return '점수'
}

export function getScoreSortMode(gameMode: string | null | undefined): GameModeId {
  return getGameModeConfig(gameMode).id
}
