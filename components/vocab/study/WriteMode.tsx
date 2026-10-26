'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { RotateCcw } from 'lucide-react'
import StudyQuestion from '@/components/vocab/study/StudyQuestion'
import { shuffle } from '@/lib/vocab/cards'
import { answerOf, promptOf, type AnswerSide, type StudyCard } from '@/lib/vocab/study'
import { VOCAB_ART } from '@/lib/vocab/art'

type WriteSession = {
  round: number
  queue: string[]
  cursor: number
  /** 이번 바퀴에서 틀린 카드 */
  missed: string[]
  /** 첫 바퀴에서 한 번에 맞힌 카드 수 */
  firstTryCorrect: number
}

function newSession(cards: StudyCard[], shuffled: boolean): WriteSession {
  const ids = cards.map((card) => card.id)
  return { round: 1, queue: shuffled ? shuffle(ids) : ids, cursor: 0, missed: [], firstTryCorrect: 0 }
}

/**
 * 쓰기. 모든 카드를 직접 써서 답하고, 틀린 카드만 모아 다음 바퀴를 돈다. 다 맞히면 끝.
 */
export default function WriteMode({
  cards,
  answerWith,
  shuffled,
}: {
  cards: StudyCard[]
  answerWith: AnswerSide
  shuffled: boolean
}) {
  const [session, setSession] = useState(() => newSession(cards, shuffled))
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const answerLabel = answerWith === 'term' ? '용어' : '뜻'

  const roundDone = session.cursor >= session.queue.length
  const current = roundDone ? undefined : byId.get(session.queue[session.cursor])

  const handleResult = (correct: boolean) => {
    if (!current) return
    setSession((prev) => ({
      ...prev,
      cursor: prev.cursor + 1,
      missed: correct ? prev.missed : [...prev.missed, current.id],
      firstTryCorrect: prev.firstTryCorrect + (correct && prev.round === 1 ? 1 : 0),
    }))
  }

  if (roundDone) {
    const finished = session.missed.length === 0
    const correctThisRound = session.queue.length - session.missed.length
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <Image src={finished ? VOCAB_ART.clap : VOCAB_ART.write} alt="" width={112} height={112} unoptimized className="mx-auto h-28 w-28 object-contain" />
        <h3 className="mt-3 text-2xl font-black text-slate-900">
          {finished ? '모든 카드를 써서 맞혔어요!' : `${session.round}바퀴 끝 · ${session.queue.length}장 중 ${correctThisRound}장 맞힘`}
        </h3>
        {finished ? (
          <p className="mt-2 text-sm font-medium text-slate-500">
            처음 한 번에 맞힌 카드 {session.firstTryCorrect} / {cards.length}장 ({Math.round((session.firstTryCorrect / cards.length) * 100)}%)
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-slate-500">틀린 {session.missed.length}장만 다시 써 봐요.</p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {!finished && (
            <button
              type="button"
              autoFocus
              onClick={() => setSession((prev) => ({
                ...prev,
                round: prev.round + 1,
                queue: shuffled ? shuffle(prev.missed) : prev.missed,
                cursor: 0,
                missed: [],
              }))}
              className="h-12 rounded-xl bg-sky-500 px-6 text-base font-black text-white transition hover:bg-sky-600"
            >
              틀린 {session.missed.length}장 다시 쓰기
            </button>
          )}
          <button
            type="button"
            onClick={() => setSession(newSession(cards, shuffled))}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            처음부터
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm font-bold text-slate-500">
        <span>{session.round}바퀴째</span>
        <span>{session.cursor + 1} / {session.queue.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${(session.cursor / session.queue.length) * 100}%` }} />
      </div>
      {current && (
        <StudyQuestion
          key={`${session.round}-${session.cursor}-${current.id}`}
          prompt={promptOf(current, answerWith)}
          answer={answerOf(current, answerWith)}
          kind="written"
          answerLabel={answerLabel}
          onResult={handleResult}
        />
      )}
    </div>
  )
}
