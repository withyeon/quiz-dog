import { assignQuizpangTitles, parseQuizpangSave, summarizeQuizpang, ITEM_INFO, type ItemId } from '@/lib/game/quizpang'
import ItemIcon from '@/components/quizpang/ItemIcon'

type SummaryPlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown; score?: number | null }

type QuizpangResultSummaryProps = {
  players: SummaryPlayer[]
  playerId: string
}

/**
 * 학생 결과 화면의 "오늘의 팡팡 기록" 칸: 터뜨린 강아지·최고 콤보·한 방 점수·맞힌 문제, 남은 아이템, 칭호.
 * 칭호는 lib/game/quizpang.assignQuizpangTitles 가 모든 참가자에게 하나 이상 준다 — 1등이 아니어도 뭔가 받는다.
 */
export default function QuizpangResultSummary({ players, playerId }: QuizpangResultSummaryProps) {
  const me = players.find((player) => player.id === playerId)
  if (!me) return null
  const save = parseQuizpangSave(me.item_effects)
  if (!save) return null
  const titles = assignQuizpangTitles(players).get(playerId) ?? []
  const leftover = save.inventory as ItemId[]

  return (
    <section className="rounded-lg border border-pink-200 bg-pink-50 p-5 shadow-sm">
      <div className="text-sm font-black text-pink-700">🐶 오늘의 팡팡 기록</div>
      <p className="mt-1 text-lg font-bold text-slate-800 break-keep">
        강아지를 {save.stats.cleared.toLocaleString()}마리 터뜨리고 {save.stats.maxChain > 1 ? `최고 ${save.stats.maxChain}콤보를 만들었어요` : '차근차근 맞췄어요'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summarizeQuizpang(save).map((item) => (
          <div key={item.label} className="rounded-md bg-white/80 px-3 py-2 text-center">
            <div className="text-xs font-bold text-slate-500">{item.label}</div>
            <div className="text-xl font-black text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      {leftover.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-500">안 쓰고 남긴 아이템</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {leftover.map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-center gap-1.5 rounded-full border border-pink-200 bg-white py-1 pl-1 pr-3 text-sm font-black text-slate-800">
                <ItemIcon id={item} className="h-6 w-6 text-base" />
                {ITEM_INFO[item].label}
              </div>
            ))}
          </div>
        </div>
      )}

      {titles.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-500">내 칭호</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {titles.map((title) => (
              <div key={title.id} className="rounded-full border border-pink-300 bg-white px-3 py-1.5 text-sm font-black text-pink-800" title={title.description}>
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
