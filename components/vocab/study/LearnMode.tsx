'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { RotateCcw } from 'lucide-react'
import { VOCAB_ART } from '@/lib/vocab/art'
import StudyQuestion from '@/components/vocab/study/StudyQuestion'
import {
  advanceLearn,
  answerLearnCard,
  answerOf,
  buildChoices,
  countLevels,
  isLearnRoundDone,
  learnQuestionKind,
  levelOf,
  promptOf,
  startLearnRound,
  type LearnLevel,
  type LearnOptions,
  type LearnState,
  type StudyCard,
} from '@/lib/vocab/study'

const LEVEL_STYLE: Record<LearnLevel, { label: string; bar: string; chip: string }> = {
  0: { label: '처음 보는 카드', bar: 'bg-slate-300', chip: 'bg-slate-100 text-slate-600' },
  1: { label: '익히는 중', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700' },
  2: { label: '다 외움', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
}

export function LearnProgress({ counts, total }: { counts: Record<LearnLevel, number>; total: number }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200">
        {([2, 1] as const).map((level) => (
          <div key={level} className={`h-full transition-all duration-500 ${LEVEL_STYLE[level].bar}`} style={{ width: `${(counts[level] / Math.max(1, total)) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
        {([0, 1, 2] as const).map((level) => (
          <span key={level} className={`rounded-full px-2.5 py-1 ${LEVEL_STYLE[level].chip}`}>
            {LEVEL_STYLE[level].label} {counts[level]}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * 익히기. 7장씩 묶어서, 처음엔 객관식 → 맞히면 같은 카드를 직접 쓰기 → 쓰기까지 맞히면 "다 외움".
 * 틀린 카드는 다음 묶음에 다시 나온다. 단계(levels)는 기기에 남아 다음에 이어서 한다.
 */
export default function LearnMode({
  cards,
  levels,
  onLevelsChange,
  options,
}: {
  cards: StudyCard[]
  levels: Record<string, LearnLevel>
  onLevelsChange: (levels: Record<string, LearnLevel>) => void
  options: LearnOptions
}) {
  const [state, setState] = useState<LearnState>(() => ({ levels, round: null }))
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])

  // 처음 들어오거나 묶음이 없으면 새 묶음을 시작한다
  useEffect(() => {
    setState((prev) => (prev.round ? prev : startLearnRound(prev, cards, options)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    onLevelsChange(state.levels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.levels])

  const counts = countLevels(state, cards)
  const round = state.round
  const roundDone = isLearnRoundDone(state)
  const currentId = round && !roundDone ? round.cardIds[round.cursor] : null
  const current = currentId ? byId.get(currentId) : undefined
  const kind = current ? learnQuestionKind(levelOf(state, current.id), options) : 'choice'
  const answerLabel = options.answerWith === 'term' ? '용어' : '뜻'

  const choices = useMemo(
    () => (current && kind === 'choice' ? buildChoices(current, cards, options.answerWith) : []),
    // 같은 카드라도 묶음 안 순서가 바뀌면 보기를 새로 섞는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, kind, round?.number, round?.cursor, options.answerWith],
  )

  const handleResult = (correct: boolean) => {
    if (!current) return
    setState((prev) => advanceLearn(answerLearnCard(prev, current.id, correct, options)))
  }

  const restart = () => {
    // 별표만 보는 중이면 그 카드들만 처음으로 돌린다
    const kept = { ...state.levels }
    for (const card of cards) delete kept[card.id]
    setState(startLearnRound({ levels: kept, round: null }, cards, options))
  }

  if (counts[2] === cards.length) {
    return (
      <div className="space-y-5">
        <LearnProgress counts={counts} total={cards.length} />
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <Image src={VOCAB_ART.trophy} alt="" width={112} height={112} unoptimized className="mx-auto h-28 w-28 object-contain" />
          <h3 className="mt-3 text-2xl font-black text-slate-900">{cards.length}장을 모두 외웠어요!</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">시험 보기로 확인해 보거나, 처음부터 다시 익혀 보세요.</p>
          <button
            type="button"
            onClick={restart}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            처음부터 다시 익히기
          </button>
        </div>
      </div>
    )
  }

  if (round && roundDone) {
    const results = round.cardIds.map((id) => ({ card: byId.get(id), correct: round.results[id] }))
    const correctCount = results.filter((item) => item.correct).length
    return (
      <div className="space-y-5">
        <LearnProgress counts={counts} total={cards.length} />
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h3 className="text-xl font-black text-slate-900">{round.number}번째 묶음 끝! {round.cardIds.length}장 중 {correctCount}장 맞혔어요</h3>
          <ul className="mt-4 divide-y divide-slate-100">
            {results.map(({ card, correct }) => card && (
              <li key={card.id} className="flex items-start gap-3 py-2.5">
                <Image src={correct ? VOCAB_ART.correct : VOCAB_ART.wrong} alt={correct ? '맞힘' : '틀림'} width={22} height={22} unoptimized className="mt-0.5 h-[22px] w-[22px] shrink-0 object-contain" />
                <span className="min-w-0 flex-1 break-words font-bold text-slate-900">{card.term}</span>
                <span className="min-w-0 flex-1 break-words text-slate-600">{card.definition}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${LEVEL_STYLE[levelOf(state, card.id)].chip}`}>
                  {LEVEL_STYLE[levelOf(state, card.id)].label}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            autoFocus
            onClick={() => setState((prev) => startLearnRound(prev, cards, options))}
            className="mt-5 h-12 w-full rounded-xl bg-sky-500 text-base font-black text-white transition hover:bg-sky-600"
          >
            다음 묶음
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <LearnProgress counts={counts} total={cards.length} />
      {current && (
        <StudyQuestion
          key={`${round?.number}-${round?.cursor}-${current.id}`}
          prompt={promptOf(current, options.answerWith)}
          answer={answerOf(current, options.answerWith)}
          kind={kind}
          choices={choices}
          answerLabel={answerLabel}
          onResult={handleResult}
        />
      )}
      {round && (
        <p className="text-center text-xs font-bold text-slate-400">
          이번 묶음 {Math.min(round.cursor + 1, round.cardIds.length)} / {round.cardIds.length}
        </p>
      )}
    </div>
  )
}
