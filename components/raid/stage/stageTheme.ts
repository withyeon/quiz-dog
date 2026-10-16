import type { CSSProperties } from 'react'
import { isRaidRole, type RaidRole } from '@/lib/game/raid'

/** 무대의 모든 조각이 같은 기준으로 크기를 고르도록 compact/large 를 한곳에서 정한다 */
export type StageSize = 'compact' | 'large'

/** 역할별 타격 숫자 색 — 전사는 붉은 주황, 마법사는 오로라 보라, 수호자는 하늘색 */
const ROLE_HIT_COLOR: Record<RaidRole, string> = {
  warrior: '#fb7a3c',
  mage: '#c4a8ff',
  guardian: '#5eead4',
}

/** 역할을 모르는 친구 타격(옛 데이터·봇)은 차가운 흰색 */
const NEUTRAL_HIT_COLOR = '#e0f2fe'

export function getRoleHitColor(role: string | null | undefined): string {
  return isRaidRole(role) ? ROLE_HIT_COLOR[role] : NEUTRAL_HIT_COLOR
}

/**
 * 굵은 어두운 외곽선 글씨. 복잡한 픽셀아트 배경 위에서도 숫자가 읽히게 한다.
 * paint-order 를 지원하는 브라우저는 바깥쪽으로만 선이 두꺼워지고,
 * 지원하지 않는 브라우저는 text-shadow 4방향 외곽선이 대신 받쳐 준다.
 */
export function outlinedText(px: number, color = 'rgba(6, 12, 28, 0.96)'): CSSProperties {
  const half = Math.max(1, Math.round(px / 2))
  return {
    WebkitTextStroke: `${px}px ${color}`,
    paintOrder: 'stroke fill',
    textShadow: `${half}px 0 0 ${color}, -${half}px 0 0 ${color}, 0 ${half}px 0 ${color}, 0 -${half}px 0 ${color}, 0 ${half + 1}px 4px rgba(0, 0, 0, 0.55)`,
  }
}

/** 체력 비율별 막대 색 */
export function hpTone(ratio: number): string {
  if (ratio > 0.5) return 'from-emerald-400 to-green-500'
  if (ratio > 0.25) return 'from-amber-300 to-orange-500'
  return 'from-rose-400 to-red-600'
}

/** 칸 수가 많은 반(필요 칸 40명 등)에서도 한 줄에 들어가도록 게이지 칸을 줄이고 비율로 채운다 */
export function toSegments(points: number, required: number, maxSegments: number) {
  const total = Math.max(1, Math.min(required, maxSegments))
  const filled = required <= maxSegments
    ? Math.min(points, total)
    : Math.min(total, Math.max(points > 0 ? 1 : 0, Math.round((points / Math.max(1, required)) * total)))
  return { total, filled }
}
