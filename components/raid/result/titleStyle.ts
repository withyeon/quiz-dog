import { Heart, Medal, Sword, Target, Zap, type LucideIcon } from 'lucide-react'
import type { RaidTitleId } from '@/lib/game/raid'

type TitleVisual = {
  Icon: LucideIcon
  /** 밝은 카드(학생 결과) 위의 배지 */
  light: string
  /** 어두운 무대(선생님 의식 화면) 위의 글자색 */
  dark: string
}

export const RAID_TITLE_VISUAL: Record<RaidTitleId, TitleVisual> = {
  top_damage: { Icon: Sword, light: 'border-amber-300 bg-amber-100 text-amber-900', dark: 'text-amber-200' },
  top_hits: { Icon: Target, light: 'border-rose-300 bg-rose-100 text-rose-800', dark: 'text-rose-200' },
  top_hunter: { Icon: Zap, light: 'border-violet-300 bg-violet-100 text-violet-800', dark: 'text-violet-200' },
  role: { Icon: Medal, light: 'border-sky-300 bg-sky-100 text-sky-800', dark: 'text-sky-200' },
  together: { Icon: Heart, light: 'border-emerald-300 bg-emerald-100 text-emerald-800', dark: 'text-emerald-200' },
}

/** 특별 칭호(공동 1등 포함). 의식 화면에서 먼저 보여 주고 금빛으로 강조한다 */
export function isSpecialTitle(id: RaidTitleId): boolean {
  return id === 'top_damage' || id === 'top_hits' || id === 'top_hunter'
}

/** 특별 칭호 순서: 최강의 일격 → 명중왕 → 필살기 저지왕. 나머지는 맨 뒤 */
export function titleRank(id: RaidTitleId): number {
  switch (id) {
    case 'top_damage': return 0
    case 'top_hits': return 1
    case 'top_hunter': return 2
    default: return 3
  }
}
