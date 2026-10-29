import { Gamepad2, GraduationCap, Users } from 'lucide-react'
import { getGameModeGuide } from '@/lib/game/modeGuide'
import type { GameModeId } from '@/lib/game/modes'

const CONTROL_TONE: Record<string, { bg: string; color: string }> = {
  쉬움: { bg: '#DCFCE7', color: '#166534' },
  보통: { bg: '#FEF3C7', color: '#92400E' },
  어려움: { bg: '#FEE2E2', color: '#991B1B' },
}

/** 게임 카드 아래 한 줄 — 추천 학년 · 조작 난도 · 개인전/협동전 */
export default function GameGuideChips({ modeId, size = 'md' }: { modeId: GameModeId; size?: 'sm' | 'md' }) {
  const guide = getGameModeGuide(modeId)
  const control = CONTROL_TONE[guide.control] ?? CONTROL_TONE['보통']
  const chip = size === 'sm'
    ? 'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold'
    : 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold sm:text-xs'
  const icon = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'

  return (
    <div className="flex flex-wrap gap-1">
      <span className={chip} style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>
        <GraduationCap className={icon} />
        {guide.grades}
      </span>
      <span className={chip} style={{ backgroundColor: control.bg, color: control.color }}>
        <Gamepad2 className={icon} />
        조작 {guide.control}
      </span>
      <span className={chip} style={{ backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
        <Users className={icon} />
        {guide.play}
      </span>
    </div>
  )
}
