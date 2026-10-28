import { PASSIVE_IDS, SKILLS, WEAPON_IDS, assignTitles, createSurvivorState, parseSurvivorSave, summarizeSurvivor, toSurvivorSave } from '@/lib/game/survivor'
import SkillIcon from '@/components/survivor/SkillIcon'

type SummaryPlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown }

type SurvivorResultSummaryProps = {
  players: SummaryPlayer[]
  playerId: string
}

/**
 * 학생 결과 화면의 "오늘의 생존 기록" 칸: 내 전투 통계·모은 스킬·칭호.
 * 칭호는 lib/game/survivor.assignTitles 가 모든 참가자에게 하나 이상 준다 — 1등이 아니어도 뭔가 받는다.
 */
export default function SurvivorResultSummary({ players, playerId }: SurvivorResultSummaryProps) {
  const me = players.find((player) => player.id === playerId)
  if (!me) return null
  const save = parseSurvivorSave(me.item_effects) ?? toSurvivorSave(createSurvivorState())
  const titles = assignTitles(players).get(playerId) ?? []
  const skills = [...WEAPON_IDS, ...PASSIVE_IDS].filter((id) => (save.skills[id] ?? 0) > 0)

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="text-sm font-black text-amber-700">🐶 오늘의 생존 기록</div>
      <p className="mt-1 text-lg font-bold text-slate-800">
        몬스터를 {save.stats.kills.toLocaleString()}마리 물리치고 Lv.{save.level}까지 자랐어요
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summarizeSurvivor(save).map((item) => (
          <div key={item.label} className="rounded-md bg-white/80 px-3 py-2 text-center">
            <div className="text-xs font-bold text-slate-500">{item.label}</div>
            <div className="text-xl font-black text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      {skills.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-black text-slate-500">모은 스킬</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {skills.map((id) => (
              <div key={id} className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-white py-1 pl-1 pr-3 text-sm font-black text-slate-800">
                <SkillIcon id={id} className="h-6 w-6" />
                {SKILLS[id].label} <span className="text-amber-600">Lv.{save.skills[id]}</span>
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
