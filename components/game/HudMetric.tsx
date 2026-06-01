import type { LucideIcon } from 'lucide-react'

type HudMetricProps = {
  icon: LucideIcon
  label: string
  value: string | number
  detail?: string
  tone: string
}

export default function HudMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: HudMetricProps) {
  return (
    <div className="min-w-0 rounded-lg border border-white/70 bg-white/72 px-2.5 py-1.5 shadow-sm backdrop-blur sm:min-w-[108px] sm:px-3 sm:py-2">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.08em] text-slate-500 sm:mb-1 sm:text-[11px]">
        <Icon className={`h-3 w-3 shrink-0 ${tone} sm:h-3.5 sm:w-3.5`} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-lg font-black leading-none text-slate-950 tabular-nums sm:text-xl">{value}</div>
      {detail && <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500 sm:mt-1 sm:text-[11px]">{detail}</div>}
    </div>
  )
}
