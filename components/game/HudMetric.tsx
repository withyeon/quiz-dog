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
    <div className="min-w-[108px] rounded-lg border border-white/70 bg-white/72 px-3 py-2 shadow-sm backdrop-blur">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className="text-xl font-black leading-none text-slate-950 tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</div>}
    </div>
  )
}
