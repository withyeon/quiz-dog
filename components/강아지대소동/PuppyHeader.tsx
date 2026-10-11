'use client'

import PomeMascot from '@/components/PomeMascot'
import QuizSetName from '@/components/game/QuizSetName'

type Props = {
  questionSetTitle: string | null | undefined
  nickname: string
  score: number
  /** 남은 시간. null 이면 아직 시작 전, 0 이하면 보너스 단계 */
  remainingSeconds: number | null
  combo: number
}

/** 상단 카드: 게임 이름·문제집, 내 이름과 점수, 남은 시간과 콤보. */
export default function PuppyHeader({ questionSetTitle, nickname, score, remainingSeconds, combo }: Props) {
  const progressLabel = remainingSeconds == null
    ? '시간 대기'
    : remainingSeconds <= 0
      ? '보너스'
      : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`

  return (
    <header className="rounded-[28px] border-4 border-slate-900 bg-white p-3 shadow-[5px_5px_0_#0f172a] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs font-black text-sky-700 sm:text-sm">강아지 대소동</div>
            <QuizSetName title={questionSetTitle} />
          </div>
          <div className="flex items-center gap-2 text-xl font-black sm:text-2xl">
            <PomeMascot className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="truncate">{nickname}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-black text-slate-500 sm:text-sm">내 점수</div>
          <div className="text-2xl font-black text-amber-600 sm:text-3xl">{score.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs font-black sm:mt-3 sm:text-sm">
        <div className="rounded-2xl bg-sky-100 px-3 py-1.5 sm:py-2">문제 {progressLabel}</div>
        <div className="rounded-2xl bg-rose-100 px-3 py-1.5 sm:py-2">{combo}콤보</div>
      </div>
    </header>
  )
}
