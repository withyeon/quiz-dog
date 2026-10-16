import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type RaidWidgetTone = 'neutral' | 'danger' | 'ice' | 'gold'

const TONE: Record<RaidWidgetTone, { frame: string; title: string }> = {
  neutral: {
    frame: 'border-white/10 from-slate-800/80 to-slate-900/90',
    title: 'text-sky-200',
  },
  danger: {
    frame: 'border-rose-400/70 from-rose-950/85 to-slate-900/95 shadow-[0_0_28px_rgba(244,63,94,0.35)]',
    title: 'text-rose-200',
  },
  ice: {
    frame: 'border-cyan-300/60 from-cyan-950/70 to-slate-900/95 shadow-[0_0_22px_rgba(34,211,238,0.25)]',
    title: 'text-cyan-200',
  },
  gold: {
    frame: 'border-amber-300/70 from-amber-900/55 to-slate-900/95 shadow-[0_0_26px_rgba(251,191,36,0.35)]',
    title: 'text-amber-200',
  },
}

type RaidWidgetProps = {
  title: string
  icon: LucideIcon
  tone?: RaidWidgetTone
  /** 제목줄 오른쪽 (작은 숫자·상태) */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** 선생님 화면 옆 패널의 공통 틀. 상태에 따라 테두리 색과 빛이 바뀐다 */
export default function RaidWidget({ title, icon: Icon, tone = 'neutral', aside, className = '', children }: RaidWidgetProps) {
  const style = TONE[tone]
  return (
    <div className={`rounded-xl border-2 bg-gradient-to-b p-3.5 transition-colors duration-300 2xl:p-4 ${style.frame} ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-sm font-black ${style.title}`}>
          <Icon className="h-4 w-4" />
          {title}
        </div>
        {aside && <div className="text-sm font-black text-white/80">{aside}</div>}
      </div>
      {children}
    </div>
  )
}
