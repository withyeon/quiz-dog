'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Confetti from 'react-confetti'
import { ArrowRight, Medal, PartyPopper, Trophy } from 'lucide-react'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import {
  buildResultAnalytics,
  type Player,
  type QuestionAnalysis,
  type Room,
} from './resultAnalytics'

type TeacherEndSequenceProps = {
  room: Room
  players: Player[]
  questions: AnalyticsQuestion[]
}

type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6

const STAGE_DELAYS: Record<Stage, number> = {
  0: 2400,
  1: 4200,
  2: 4200,
  3: 5200,
  4: 4200,
  5: 0,
  6: 0,
}

export default function TeacherEndSequence({
  room,
  players,
  questions,
}: TeacherEndSequenceProps) {
  const analytics = useMemo(
    () => buildResultAnalytics(players, questions, room),
    [players, questions, room],
  )
  const [stage, setStage] = useState<Stage>(0)
  const [reviewIndex, setReviewIndex] = useState(0)
  const topThree = analytics.players.slice(0, 3)
  const reviewQuestions = analytics.hardestQuestions.slice(0, 3)

  useEffect(() => {
    const delay = STAGE_DELAYS[stage]
    if (!delay) return

    const timer = window.setTimeout(() => {
      setStage((current) => Math.min(6, current + 1) as Stage)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [stage])

  const nextReview = () => {
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex((value) => value + 1)
      return
    }
    setStage(6)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#102a43] text-white">
      {(stage === 0 || stage === 3 || stage === 4 || stage === 6) && (
        <Confetti recycle={stage !== 6} numberOfPieces={stage === 6 ? 120 : 260} />
      )}

      {stage === 0 && (
        <section className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-white text-7xl shadow-2xl">
            🐶
          </div>
          <h1 className="text-[clamp(72px,10vw,150px)] font-black leading-none tracking-normal">게임 종료!</h1>
          <p className="mt-8 text-[clamp(28px,4vw,56px)] font-black text-sky-100">잠시 후 Top 3를 공개합니다</p>
        </section>
      )}

      {(stage === 1 || stage === 2 || stage === 3) && (
        <RevealStage stage={stage} player={topThree[3 - stage]} />
      )}

      {stage === 4 && (
        <section className="flex min-h-screen flex-col justify-center p-10">
          <h1 className="mb-10 text-center text-[clamp(48px,7vw,96px)] font-black tracking-normal">오늘의 Top 3</h1>
          <div className="mx-auto grid w-full max-w-6xl grid-cols-3 items-end gap-5">
            <PodiumSpot rank={2} player={topThree[1]} height="h-72" tone="silver" />
            <PodiumSpot rank={1} player={topThree[0]} height="h-96" tone="gold" />
            <PodiumSpot rank={3} player={topThree[2]} height="h-60" tone="bronze" />
          </div>
        </section>
      )}

      {stage === 5 && (
        <ReviewQuestionStage
          question={reviewQuestions[reviewIndex]}
          index={reviewIndex}
          total={reviewQuestions.length}
          onNext={nextReview}
        />
      )}

      {stage === 6 && (
        <section className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-white text-8xl shadow-2xl">
            🐕
          </div>
          <h1 className="text-[clamp(64px,9vw,132px)] font-black leading-none tracking-normal">수고했어요!</h1>
          <p className="mt-8 max-w-3xl text-[clamp(24px,3vw,44px)] font-black text-sky-100">
            오늘의 어려운 문제를 확인했어요. 이제 다음 활동으로 이어갈 수 있습니다.
          </p>
          <div className="fixed bottom-8 right-8 flex gap-3">
            <Link
              href="/teacher/dashboard"
              className="rounded-lg bg-white px-8 py-5 text-2xl font-black text-slate-900 shadow-xl hover:bg-slate-100"
            >
              다음 게임
            </Link>
            <Link
              href={`/teacher/game/${room.room_code}/report`}
              className="rounded-lg bg-emerald-400 px-8 py-5 text-2xl font-black text-emerald-950 shadow-xl hover:bg-emerald-300"
            >
              수업 종료
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}

function RevealStage({
  stage,
  player,
}: {
  stage: 1 | 2 | 3
  player: ReturnType<typeof buildResultAnalytics>['players'][number] | undefined
}) {
  const rank = 4 - stage
  const label = rank === 1 ? '1등은...' : rank === 2 ? '2등은...' : '3등은...'
  const color = rank === 1 ? 'text-amber-300' : rank === 2 ? 'text-slate-200' : 'text-orange-300'
  const Icon = rank === 1 ? Trophy : rank === 2 ? Medal : PartyPopper

  return (
    <section className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className={`mb-8 flex items-center gap-6 text-[clamp(48px,7vw,96px)] font-black ${color}`}>
        <Icon className="h-20 w-20" />
        {label}
      </div>
      <div className="animate-[pulse_1.2s_ease-in-out_infinite] rounded-3xl border-8 border-white/20 bg-white p-10 text-slate-950 shadow-2xl">
        <div className="text-[clamp(52px,8vw,110px)] font-black tracking-normal">
          {player?.avatar || '🐶'} {player?.nickname || '참가자'}
        </div>
        <div className={`mt-6 text-[clamp(44px,6vw,84px)] font-black ${rank === 1 ? 'text-amber-500' : 'text-slate-700'}`}>
          {player?.score.toLocaleString() ?? 0}점
        </div>
      </div>
    </section>
  )
}

function PodiumSpot({
  rank,
  player,
  height,
  tone,
}: {
  rank: 1 | 2 | 3
  player: ReturnType<typeof buildResultAnalytics>['players'][number] | undefined
  height: string
  tone: 'gold' | 'silver' | 'bronze'
}) {
  const toneClass = {
    gold: 'from-amber-300 to-yellow-500 text-amber-950',
    silver: 'from-slate-200 to-slate-400 text-slate-950',
    bronze: 'from-orange-300 to-orange-600 text-orange-950',
  }[tone]

  return (
    <div className="flex flex-col items-center">
      <div className="mb-5 rounded-full bg-white px-8 py-5 text-center text-slate-950 shadow-xl">
        <div className="text-[clamp(34px,4vw,58px)] font-black tracking-normal">{player?.avatar || '🐶'} {player?.nickname || '-'}</div>
        <div className="mt-2 text-[clamp(24px,3vw,42px)] font-black text-slate-600">{player?.score.toLocaleString() ?? 0}점</div>
      </div>
      <div className={`${height} flex w-full items-center justify-center rounded-t-3xl bg-gradient-to-b ${toneClass} text-[clamp(72px,8vw,128px)] font-black shadow-2xl`}>
        {rank}
      </div>
    </div>
  )
}

function ReviewQuestionStage({
  question,
  index,
  total,
  onNext,
}: {
  question: QuestionAnalysis | undefined
  index: number
  total: number
  onNext: () => void
}) {
  if (!question) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <h1 className="text-[clamp(56px,8vw,120px)] font-black tracking-normal">복습할 문항이 없습니다</h1>
        <button onClick={onNext} className="mt-10 rounded-lg bg-white px-8 py-5 text-3xl font-black text-slate-900">
          마무리로
        </button>
      </section>
    )
  }

  return (
    <section className="flex min-h-screen flex-col p-10">
      <div className="mb-8 text-[clamp(32px,4vw,56px)] font-black text-sky-100">
        가장 많이 틀린 문제 #{index + 1}
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-3xl bg-white p-10 text-slate-950 shadow-2xl">
        <h1 className="text-[clamp(44px,5vw,76px)] font-black leading-tight tracking-normal">
          Q{question.index + 1}. {question.text}
        </h1>
        {question.options.length > 0 && (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {question.options.map((option, optionIndex) => (
              <div
                key={`${option}-${optionIndex}`}
                className={`rounded-2xl border-4 p-6 text-[clamp(28px,3vw,44px)] font-black ${
                  option === question.answer || String(optionIndex + 1) === question.answer
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                {optionIndex + 1}. {option}
              </div>
            ))}
          </div>
        )}
        <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl bg-emerald-100 px-8 py-5 text-[clamp(28px,3vw,46px)] font-black text-emerald-950">
            정답: {question.answer}
          </div>
          <div className="rounded-2xl bg-orange-100 px-8 py-5 text-[clamp(28px,3vw,46px)] font-black text-orange-950">
            정답률 {question.accuracy}%만 맞췄어요
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <button
          onClick={onNext}
          className="flex items-center gap-3 rounded-lg bg-white px-8 py-5 text-3xl font-black text-slate-950 shadow-xl hover:bg-slate-100"
        >
          {index + 1 >= total ? '마무리' : '다음'}
          <ArrowRight className="h-8 w-8" />
        </button>
      </div>
    </section>
  )
}
