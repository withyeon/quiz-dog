import { Check } from 'lucide-react'
import type { RaidBossState } from '@/lib/game/raid'
import { RAID_SPRITE_SRC } from '@/components/raid/raidAssets'

type BossPipProps = {
  boss: RaidBossState
  /** 스프라이트 가로(px). 세로는 4:5 */
  width: number
  /** 지금 싸우는 펭귄인지 (빛으로 강조) */
  current?: boolean
  showName?: boolean
}

/**
 * 펭귄 한 마리 표시. 쓰러뜨린 펭귄은 쓰러진 그림 + 체크, 아직 안 만난 펭귄은 어두운 실루엣.
 */
export function BossPip({ boss, width, current = false, showName = false }: BossPipProps) {
  const height = Math.round(width * 1.25)
  const sprites = RAID_SPRITE_SRC[boss.def.sprite]
  const tone = boss.defeated
    ? 'opacity-70 grayscale'
    : current
      ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]'
      : 'brightness-[0.4] grayscale'
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className="relative" style={{ width, height }}>
        <img
          src={boss.defeated ? sprites.down : sprites.idle}
          alt={boss.defeated ? `${boss.def.name} 쓰러짐` : boss.def.name}
          width={width}
          height={height}
          draggable={false}
          className={`select-none ${tone}`}
          style={{ width, height }}
        />
        {boss.defeated && (
          <span className="absolute -bottom-0.5 -right-1 flex h-[40%] w-[40%] min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 ring-2 ring-slate-900/70">
            <Check className="h-[70%] w-[70%]" strokeWidth={4} />
          </span>
        )}
      </div>
      {showName && (
        <span className={`break-keep text-center text-xs font-black leading-tight ${boss.defeated ? 'text-emerald-200' : current ? 'text-amber-200' : 'text-white/45'}`}>
          {boss.def.name.replace('펭귄 ', '')}
        </span>
      )}
    </div>
  )
}

type BossPipsProps = {
  bosses: RaidBossState[]
  width?: number
  currentIndex?: number | null
  showNames?: boolean
  className?: string
}

/** 펭귄 군단을 한 줄로. 처치 현황을 그림으로 보여 준다 */
export default function BossPips({ bosses, width = 24, currentIndex = null, showNames = false, className = '' }: BossPipsProps) {
  return (
    <div className={`flex items-end justify-center gap-2 ${className}`}>
      {bosses.map((boss) => (
        <BossPip key={boss.def.index} boss={boss} width={width} current={boss.def.index === currentIndex} showName={showNames} />
      ))}
    </div>
  )
}
