import { Snowflake } from 'lucide-react'
import type { RaidState } from '@/lib/game/raid'
import { BossPip } from '@/components/raid/result/BossPips'
import RaidWidget from './RaidWidget'

type LegionPanelProps = {
  raidState: RaidState
}

/** 펭귄 군단 진행 — 쓰러뜨린 펭귄은 흑백 + 체크, 싸우는 펭귄은 체력 막대, 아직 안 만난 펭귄은 실루엣 */
export default function LegionPanel({ raidState }: LegionPanelProps) {
  const currentIndex = raidState.current?.def.index ?? null
  return (
    <RaidWidget
      title="펭귄 군단"
      icon={Snowflake}
      aside={<span className="tabular-nums">{raidState.defeatedCount} / {raidState.roster.length}</span>}
    >
      <div className="flex items-end justify-around gap-2">
        {raidState.bosses.map((boss) => {
          const isCurrent = boss.def.index === currentIndex
          return (
            <div key={boss.def.index} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <BossPip boss={boss} width={raidState.bosses.length > 4 ? 44 : 54} current={isCurrent} showName />
              {/* 체력 막대 자리는 항상 잡아 두어 펭귄이 바뀌어도 높이가 흔들리지 않는다 */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                {isCurrent && (
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 transition-[width] duration-500"
                    style={{ width: `${Math.max(2, boss.hpRatio * 100)}%` }}
                  />
                )}
                {boss.defeated && <div className="h-full w-full rounded-full bg-emerald-400/60" />}
              </div>
            </div>
          )
        })}
      </div>
    </RaidWidget>
  )
}
