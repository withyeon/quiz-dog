import type { RaidTitle } from '@/lib/game/raid'
import { RAID_TITLE_VISUAL } from './titleStyle'

type RaidTitleBadgeProps = {
  title: RaidTitle
  className?: string
}

/** 밝은 카드 위에 올리는 칭호 배지 */
export default function RaidTitleBadge({ title, className = '' }: RaidTitleBadgeProps) {
  const { Icon, light } = RAID_TITLE_VISUAL[title.id]
  return (
    <span
      title={title.description}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${light} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {title.name}
    </span>
  )
}
