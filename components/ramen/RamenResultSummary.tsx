import { assignTitles, parseStats, summarizeStats } from '@/lib/game/ramen'

type SummaryPlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown }

type RamenResultSummaryProps = {
  players: SummaryPlayer[]
  playerId: string
}

/**
 * 학생 결과 화면의 "오늘의 라면가게" 칸: 내 장사 통계와 칭호.
 * 칭호는 lib/game/ramen.assignTitles 가 모든 참가자에게 하나 이상 준다 — 1등이 아니어도 뭔가 받는다.
 */
export default function RamenResultSummary({ players, playerId }: RamenResultSummaryProps) {
  const me = players.find((player) => player.id === playerId)
  if (!me) return null
  const stats = parseStats(me.item_effects)
  const titles = assignTitles(players).get(playerId) ?? []

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-violet-700">🍜 오늘의 라면가게</div>
          <p className="mt-1 text-lg font-bold text-slate-800">
            손님 {stats.customers}명에게 라면 {stats.served}그릇을 팔았어요
            {stats.perfect > 0 && ` · 1,000원 라면 ${stats.perfect}개`}
          </p>
        </div>
        <div className="text-5xl" aria-hidden>🍜</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summarizeStats(stats).map((item) => (
          <div key={item.label} className="rounded-md bg-white/80 px-3 py-2 text-center">
            <div className="text-xs font-bold text-slate-500">{item.label}</div>
            <div className="text-xl font-black text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      {titles.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-500">내 칭호</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {titles.map((title) => (
              <div key={title.id} className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-sm font-black text-violet-800" title={title.description}>
                {title.emoji} {title.label}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500 break-keep">{titles.map((title) => title.description).join(' · ')}</p>
        </div>
      )}
    </section>
  )
}
