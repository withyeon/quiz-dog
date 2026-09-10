'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Confetti from 'react-confetti'
import { ArrowRight } from 'lucide-react'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { useAudioContext } from '@/components/AudioProvider'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import {
  buildResultAnalytics,
  type Player,
  type QuestionAnalysis,
  type Room,
} from './resultAnalytics'
import { getScoreDisplay } from '@/lib/game/scoreDisplay'

type TeacherEndSequenceProps = {
  room: Room
  players: Player[]
  questions: AnalyticsQuestion[]
  onRestart?: () => void
  isRestarting?: boolean
  /** 시작 단계 — /dev/result-preview 에서 특정 화면을 바로 열어볼 때만 쓴다 */
  initialStage?: Stage
}

type RankedPlayer = ReturnType<typeof buildResultAnalytics>['players'][number]

type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6

const STAGE_DELAYS: Record<Stage, number> = {
  0: 2400,
  1: 4200,
  2: 4200,
  3: 5200,
  4: 6000,
  5: 0,
  6: 0,
}

const RESULT_ANNOUNCEMENT_TRACK = {
  id: 'result-announcement',
  title: 'Funky Victory Loop',
  src: '/audio/bgm/result-announcement.mp3',
}

/** 등수별 색/아이콘을 한곳에 모아 발표 화면과 시상대가 같은 톤을 쓰게 한다 */
const RANK_THEME = {
  1: {
    label: '1등은...',
    medal: '/trophy.webp',
    cardRing: 'ring-amber-300',
    accent: 'text-amber-300',
    frame: 'from-amber-200 via-yellow-400 to-amber-600',
    podium: 'from-amber-200 via-yellow-400 to-amber-600 text-amber-950',
    chip: 'bg-amber-100 text-amber-900',
    glow: 'result-glow-gold',
    spotlight: 'rgba(251, 191, 36, 0.35)',
  },
  2: {
    label: '2등은...',
    medal: '/silver.webp',
    cardRing: 'ring-slate-300',
    accent: 'text-slate-100',
    frame: 'from-white via-slate-200 to-slate-400',
    podium: 'from-slate-100 via-slate-300 to-slate-500 text-slate-900',
    chip: 'bg-slate-100 text-slate-700',
    glow: 'result-glow-silver',
    spotlight: 'rgba(226, 232, 240, 0.28)',
  },
  3: {
    label: '3등은...',
    medal: '/bronze.webp',
    cardRing: 'ring-orange-300',
    accent: 'text-orange-300',
    frame: 'from-orange-200 via-orange-400 to-orange-700',
    podium: 'from-orange-200 via-orange-400 to-orange-700 text-orange-950',
    chip: 'bg-orange-100 text-orange-900',
    glow: 'result-glow-bronze',
    spotlight: 'rgba(251, 146, 60, 0.3)',
  },
} as const

/** 배경 별은 매 렌더마다 흔들리면 안 되므로 고정 좌표를 쓴다 */
const STARS = [
  { left: '6%', top: '14%', size: 10, delay: '0s' },
  { left: '17%', top: '62%', size: 7, delay: '0.7s' },
  { left: '27%', top: '26%', size: 12, delay: '1.4s' },
  { left: '38%', top: '78%', size: 8, delay: '0.3s' },
  { left: '47%', top: '11%', size: 9, delay: '2.1s' },
  { left: '58%', top: '68%', size: 11, delay: '1.1s' },
  { left: '68%', top: '22%', size: 8, delay: '1.8s' },
  { left: '77%', top: '54%', size: 13, delay: '0.5s' },
  { left: '86%', top: '17%', size: 9, delay: '2.4s' },
  { left: '93%', top: '72%', size: 7, delay: '1.6s' },
]

export default function TeacherEndSequence({
  room,
  players,
  questions,
  onRestart,
  isRestarting = false,
  initialStage = 0,
}: TeacherEndSequenceProps) {
  const analytics = useMemo(
    () => buildResultAnalytics(players, questions, room),
    [players, questions, room],
  )
  const [stage, setStage] = useState<Stage>(initialStage)
  const [reviewIndex, setReviewIndex] = useState(0)
  const { playBGM, stopBGM } = useAudioContext()
  const topThree = useMemo(() => analytics.players.slice(0, 3), [analytics])
  const reviewQuestions = useMemo(() => analytics.hardestQuestions.slice(0, 3), [analytics])

  useEffect(() => {
    // 참가자가 3명이 안 되면 빈 등수는 건너뛴다 (빈 카드가 뜨지 않게)
    const revealStages: Record<number, number> = { 1: 2, 2: 1, 3: 0 }
    const emptyReveal = stage in revealStages && !topThree[revealStages[stage]]
    const delay = emptyReveal ? 0 : STAGE_DELAYS[stage]
    if (!emptyReveal && !delay) return

    const timer = window.setTimeout(() => {
      setStage((current) => {
        const nextStage = Math.min(6, current + 1) as Stage
        if (nextStage >= 5) stopBGM()
        return nextStage
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [stage, stopBGM, topThree])

  useEffect(() => {
    if (stage <= 4) {
      playBGM('result', RESULT_ANNOUNCEMENT_TRACK)
      return
    }

    stopBGM()
  }, [playBGM, stage, stopBGM])

  useEffect(() => {
    return () => stopBGM()
  }, [stopBGM])

  const nextReview = () => {
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex((value) => value + 1)
      return
    }
    stopBGM()
    setStage(6)
  }

  const revealRank = stage >= 1 && stage <= 3 ? ((4 - stage) as 1 | 2 | 3) : null

  return (
    <main className="result-stage relative min-h-dvh overflow-hidden font-bitbit text-white">
      <StageBackdrop spotlight={revealRank ? RANK_THEME[revealRank].spotlight : undefined} />

      {(stage === 0 || stage === 3 || stage === 4 || stage === 6) && (
        <Confetti recycle={stage !== 6} numberOfPieces={stage === 6 ? 120 : 260} />
      )}

      <div className="relative z-10">
        {stage === 0 && (
          <section className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
            <div className="result-bob relative mb-10">
              <span className="absolute -inset-6 rounded-full bg-sky-300/25 blur-2xl" />
              <span className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white text-7xl shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-8 ring-white/25">
                🐶
              </span>
            </div>
            <h1 className="result-gold-text result-pop text-[clamp(72px,10vw,150px)] font-black leading-none tracking-normal">
              게임 종료!
            </h1>
            <p className="result-fade-up mt-8 text-[clamp(28px,4vw,56px)] font-black text-sky-100 [animation-delay:0.35s]">
              잠시 후 Top 3를 공개합니다
            </p>
            <div className="mt-10 flex items-center gap-4">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="result-dot h-4 w-4 rounded-full bg-sky-200"
                  style={{ animationDelay: `${index * 0.18}s` }}
                />
              ))}
            </div>
          </section>
        )}

        {revealRank && (
          <RevealStage
            key={revealRank}
            rank={revealRank}
            player={topThree[revealRank - 1]}
            gameMode={room.game_mode}
          />
        )}

        {stage === 4 && (
          <section className="flex min-h-dvh flex-col justify-center p-6 sm:p-10">
            <h1 className="result-drop-in mb-3 text-center text-[clamp(48px,7vw,96px)] font-black tracking-normal">
              오늘의 <span className="result-gold-text">Top 3</span>
            </h1>
            <p className="result-fade-up mb-8 text-center text-[clamp(18px,2.2vw,32px)] font-black text-sky-200/90 [animation-delay:0.3s]">
              참가자 {analytics.players.length}명 중 · 모두 정말 잘했어요! 👏
            </p>

            <div className="relative mx-auto w-full max-w-6xl">
              {/* 1등 자리로 내려오는 조명 */}
              <div
                className="result-beam pointer-events-none absolute -top-16 left-1/2 h-[85%] w-[52%] max-w-lg -translate-x-1/2"
                aria-hidden
              />

              <div className="relative flex items-end justify-center gap-2 sm:gap-5">
                {topThree[1] && (
                  <PodiumSpot rank={2} player={topThree[1]} gameMode={room.game_mode} height="h-40 sm:h-56 lg:h-64" delay="0.15s" />
                )}
                {topThree[0] && (
                  <PodiumSpot rank={1} player={topThree[0]} gameMode={room.game_mode} height="h-56 sm:h-80 lg:h-[22rem]" delay="0.45s" />
                )}
                {topThree[2] && (
                  <PodiumSpot rank={3} player={topThree[2]} gameMode={room.game_mode} height="h-32 sm:h-44 lg:h-52" delay="0s" />
                )}
              </div>

              {/* 무대 바닥과 바닥에 비치는 반사 */}
              <div className="result-floor h-4 w-full rounded-b-2xl ring-1 ring-white/25" />
              <div className="result-reflection h-20 w-full rounded-t-3xl bg-gradient-to-b from-white/30 to-transparent" aria-hidden />
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
          <section className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
            <Image
              src="/quizdog-logo.webp"
              alt="퀴즈독"
              width={400}
              height={125}
              className="mb-8 w-full max-w-md"
              priority
            />
            <div className="fixed bottom-8 right-8 flex gap-3">
              <button
                type="button"
                onClick={onRestart}
                disabled={!onRestart || isRestarting}
                className="rounded-lg bg-white px-8 py-5 text-2xl font-black text-slate-900 shadow-xl transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRestarting ? '다시 시작 중...' : '다시 시작하기'}
              </button>
              <Link
                href={`/teacher/game/${room.room_code}/report`}
                className="rounded-lg bg-emerald-400 px-8 py-5 text-2xl font-black text-emerald-950 shadow-xl hover:bg-emerald-300"
              >
                수업 종료
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

/** 모든 단계가 공유하는 무대 배경 (조명·빛줄기·반짝임) */
function StageBackdrop({ spotlight }: { spotlight?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="result-rays absolute left-1/2 top-1/2 h-[220vmax] w-[220vmax] -translate-x-1/2 -translate-y-1/2 opacity-40" />
      <div className="result-spotlight absolute left-1/2 top-0 h-[95vh] w-[110vw] -translate-x-1/2" />
      {spotlight && (
        <div
          className="absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-700"
          style={{ background: `radial-gradient(closest-side, ${spotlight}, transparent 70%)` }}
        />
      )}
      <div className="result-aurora absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-sky-400/25 blur-[110px]" />
      <div className="result-aurora absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-indigo-400/25 blur-[120px] [animation-delay:2.5s]" />
      {STARS.map((star) => (
        <span
          key={`${star.left}-${star.top}`}
          className="result-twinkle absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  )
}

function RevealStage({
  rank,
  player,
  gameMode,
}: {
  rank: 1 | 2 | 3
  player: RankedPlayer | undefined
  gameMode?: string | null
}) {
  const theme = RANK_THEME[rank]
  const scoreDisplay = getScoreDisplay({ score: player?.score ?? 0 }, gameMode)

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center p-6 text-center sm:p-8">
      <div
        className={`result-drop-in mb-8 flex items-center gap-5 text-[clamp(44px,6.5vw,92px)] font-black ${theme.accent}`}
      >
        <Image
          src={theme.medal}
          alt=""
          width={80}
          height={80}
          className="result-bob h-16 w-16 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)] sm:h-20 sm:w-20"
        />
        {theme.label}
      </div>

      <div className={`result-pop relative w-full max-w-3xl rounded-[44px] bg-gradient-to-b p-[10px] ${theme.frame} ${theme.glow}`}>
        {rank === 1 && (
          <span className="result-bob absolute -top-14 left-1/2 -translate-x-1/2 text-6xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] sm:text-7xl">
            👑
          </span>
        )}

        <div className="relative overflow-hidden rounded-[36px] bg-white px-8 py-10 text-slate-950 sm:px-12">
          {/* 큼직한 등수 숫자를 카드 뒤에 옅게 깔아 화면을 채운다 */}
          <span className="pointer-events-none absolute -right-4 -top-10 select-none text-[clamp(150px,22vw,260px)] font-black leading-none text-slate-900/5">
            {rank}
          </span>

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <div className="relative">
              <PlayerAvatarDisplay
                avatar={player?.avatar}
                nickname={player?.nickname}
                fallback="🐶"
                className={`relative h-28 w-28 overflow-hidden rounded-3xl bg-white text-6xl shadow-lg ring-4 sm:h-32 sm:w-32 ${theme.cardRing}`}
                sizes="128px"
              />
              <span className={`absolute -bottom-3 -right-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b text-2xl font-black shadow-lg ${theme.podium}`}>
                {rank}
              </span>
            </div>
            <span className="text-[clamp(44px,7vw,96px)] font-black leading-tight tracking-normal">
              {player?.nickname || '참가자'}
            </span>
          </div>

          <div className="relative mt-8 flex justify-center">
            <div className={`flex items-center gap-3 rounded-full px-8 py-4 text-[clamp(34px,5vw,64px)] font-black ${theme.chip}`}>
              {scoreDisplay.icon && (
                <Image src={scoreDisplay.icon} alt="" width={48} height={48} className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
              )}
              {scoreDisplay.text}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PodiumSpot({
  rank,
  player,
  gameMode,
  height,
  delay,
}: {
  rank: 1 | 2 | 3
  player: RankedPlayer | undefined
  gameMode?: string | null
  height: string
  delay: string
}) {
  const theme = RANK_THEME[rank]
  const scoreDisplay = getScoreDisplay({ score: player?.score ?? 0 }, gameMode)
  const isWinner = rank === 1

  return (
    <div className="flex w-full max-w-xs min-w-0 flex-col items-center">
      {isWinner && (
        <div className="result-bob mb-1 text-4xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] sm:text-6xl">👑</div>
      )}

      {/* 선수 카드 — 시상대 위에 올라선 것처럼 살짝 겹쳐 둔다 */}
      <div
        className="result-fade-up relative z-10 -mb-5 w-full px-1"
        style={{ animationDelay: `calc(${delay} + 0.35s)` }}
      >
        <div
          className={`rounded-3xl bg-white px-2 pb-6 pt-4 text-center text-slate-950 shadow-[0_16px_40px_rgba(0,0,0,0.4)] ring-2 sm:px-4 ${theme.cardRing}`}
        >
          <PlayerAvatarDisplay
            avatar={player?.avatar}
            nickname={player?.nickname}
            fallback="🐶"
            className={`relative mx-auto h-12 w-12 overflow-hidden rounded-2xl bg-white text-3xl ring-4 sm:h-16 sm:w-16 sm:text-4xl ${theme.cardRing}`}
            sizes="64px"
          />
          <span className="mt-2 block max-w-full truncate text-[clamp(18px,3vw,44px)] font-black leading-tight">
            {player?.nickname || '-'}
          </span>
          <span
            className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[clamp(14px,2.2vw,30px)] font-black sm:px-4 sm:py-1.5 ${theme.chip}`}
          >
            {scoreDisplay.icon && (
              <Image src={scoreDisplay.icon} alt="" width={28} height={28} className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6" />
            )}
            <span className="truncate">{scoreDisplay.text}</span>
          </span>
        </div>
      </div>

      {/* 시상대 블록 */}
      <div
        className={`result-rise result-shine relative ${height} flex w-full flex-col items-center justify-end gap-1 overflow-hidden rounded-t-2xl bg-gradient-to-b pb-4 pt-8 ${theme.podium} shadow-[0_-6px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/40`}
        style={{ animationDelay: delay }}
      >
        {/* 윗면 — 두께가 있는 단상처럼 보이게 하는 밝은 띠 */}
        <span className="absolute inset-x-0 top-0 h-2.5 bg-white/45" aria-hidden />
        <span className="absolute inset-x-0 top-2.5 h-px bg-black/10" aria-hidden />

        <Image
          src={theme.medal}
          alt=""
          width={64}
          height={64}
          className="h-8 w-8 object-contain drop-shadow sm:h-12 sm:w-12"
        />
        <span className="result-engraved text-[clamp(40px,6vw,96px)] font-black leading-none">
          {rank}
        </span>
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
      <section className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
        <h1 className="text-[clamp(56px,8vw,120px)] font-black tracking-normal">복습할 문항이 없습니다</h1>
        <button onClick={onNext} className="mt-10 rounded-lg bg-white px-8 py-5 text-3xl font-black text-slate-900">
          마무리로
        </button>
      </section>
    )
  }

  return (
    <section className="flex min-h-dvh flex-col p-10">
      <div className="mb-8 text-[clamp(32px,4vw,56px)] font-black text-sky-100">
        가장 많이 틀린 문제 {index + 1}
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-3xl bg-white p-10 text-slate-950 shadow-2xl">
        <h1 className="text-[clamp(44px,5vw,76px)] font-black leading-tight tracking-normal">
          질문 {question.index + 1}. {question.text}
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
