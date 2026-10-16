import { Zap } from 'lucide-react'
import RaidWidget from './RaidWidget'

const SEGMENT_COUNT = 12

// 낮은 칸은 서늘하게, 높은 칸은 뜨겁게
const SEGMENT_ON = [
  'bg-sky-300', 'bg-sky-300', 'bg-cyan-300', 'bg-cyan-300',
  'bg-emerald-300', 'bg-lime-300', 'bg-yellow-300', 'bg-amber-300',
  'bg-amber-400', 'bg-orange-400', 'bg-orange-500', 'bg-rose-500',
]

type FirepowerPanelProps = {
  /** 최근 10초 안의 명중 수 */
  recentHits: number
  activePlayerCount: number
}

function moodLine(ratio: number): string {
  if (ratio < 0.12) return '아직 조용해요'
  if (ratio < 0.4) return '불씨가 붙었어요'
  if (ratio < 0.7) return '화력이 올라와요!'
  return '폭풍 같은 공격!'
}

/**
 * 공격 속도(반 전체 화력) — 최근 10초 동안 몇 번 맞혔는지를 게이지로.
 * 순전히 보는 재미용이다. 누가 몇 번 때렸는지는 없고 반 전체 합만 보인다.
 */
export default function FirepowerPanel({ recentHits, activePlayerCount }: FirepowerPanelProps) {
  // 반 인원 정도의 명중이 10초에 쏟아지면 가득 찬 것으로 본다 (적은 반도 눈에 띄게 최소치를 둔다)
  const max = Math.max(6, activePlayerCount)
  const ratio = Math.min(1, recentHits / max)
  const lit = Math.round(ratio * SEGMENT_COUNT)

  return (
    <RaidWidget
      title="공격 속도"
      icon={Zap}
      aside={<span className="tabular-nums">10초에 {recentHits}번</span>}
    >
      <div className="flex gap-1" role="img" aria-label={`최근 10초 명중 ${recentHits}번`}>
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <span
            key={index}
            className={`h-6 flex-1 rounded-[3px] transition-colors duration-300 ${index < lit ? SEGMENT_ON[index] : 'bg-black/35'}`}
          />
        ))}
      </div>
      <p className="mt-2 flex items-baseline justify-between gap-2 text-sm font-black">
        <span className="text-amber-200">{moodLine(ratio)}</span>
        <span className="text-xs font-bold text-white/45">반 전체 화력</span>
      </p>
    </RaidWidget>
  )
}
