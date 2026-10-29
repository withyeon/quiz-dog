import { assignTitles, createBoneRushState, parseBoneRushSave, summarizeBoneRush, toBoneRushSave } from '@/lib/game/boneRush'

type SummaryPlayer = { id: string; is_kicked?: boolean | null; score?: number | null; item_effects?: unknown }

type BoneRushResultSummaryProps = {
  players: SummaryPlayer[]
  playerId: string
}

/**
 * 학생 결과 화면의 "오늘의 쟁탈전 기록" 칸: 내 뼈다귀·상자·고양이 통계와 칭호.
 * 칭호는 lib/game/boneRush.assignTitles 가 모든 참가자에게 하나 이상 준다 — 1등이 아니어도 뭔가 받는다.
 */
export default function BoneRushResultSummary({ players, playerId }: BoneRushResultSummaryProps) {
  const me = players.find((player) => player.id === playerId)
  if (!me) return null
  const save = parseBoneRushSave(me.item_effects) ?? toBoneRushSave(createBoneRushState())
  save.bones = Math.max(save.bones, me.score ?? 0)
  const titles = assignTitles(players).get(playerId) ?? []

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="text-sm font-black text-amber-700">🦴 오늘의 쟁탈전 기록</div>
      <p className="mt-1 text-lg font-bold text-slate-800">
        뼈다귀 {save.bones.toLocaleString()}개를 모았고, 상자를 {save.stats.correct}개 열었어요
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summarizeBoneRush(save).map((item) => (
          <div key={item.label} className="rounded-md bg-white/80 px-3 py-2 text-center">
            <div className="text-xs font-bold text-slate-500">{item.label}</div>
            <div className="text-xl font-black text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
        <span className="rounded-full bg-white px-2.5 py-1">땅에서 주움 {save.stats.collected.toLocaleString()}개</span>
        <span className="rounded-full bg-white px-2.5 py-1">고양이 보냄 {save.stats.catsSent}번</span>
        <span className="rounded-full bg-white px-2.5 py-1">뺏김 {save.stats.stolen.toLocaleString()}개</span>
      </div>

      {titles.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-500">내 칭호</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {titles.map((title) => (
              <div key={title.id} className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-black text-amber-800" title={title.description}>
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
