'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, Heart, Info, Loader2, Pencil, Play } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { GAME_MODES, isHiddenGameMode, type GameModeId } from '@/lib/game/modes'
import { getOptionLabel } from '@/lib/quiz/optionLabels'
import { isQuizAnswerMatch, splitAcceptableAnswers } from '@/lib/quiz/answerMatching'
import { displayBlankText } from '@/lib/quiz/blankText'
import type { SharedQuestionSet } from '@/lib/services/sharing'

const DEFAULT_MODE: GameModeId = 'gold_quest'

function optionsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((option): option is string => typeof option === 'string')
}

export default function SharedSetView({ set }: { set: SharedQuestionSet }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [gameMode, setGameMode] = useState<GameModeId>(DEFAULT_MODE)
  const [pending, setPending] = useState<'play' | 'import' | null>(null)

  const modes = useMemo(() => GAME_MODES.filter((mode) => !isHiddenGameMode(mode.id)), [])
  const selected = modes.find((mode) => mode.id === gameMode) ?? modes[0]

  const summary = [set.grade, set.subject, `${set.questionCount}문항`]
    .filter(Boolean)
    .join(' · ')

  /** 로그인 상태면 바로 목적지로, 아니면 로그인 후 그 목적지로 돌아오게 한다. */
  const go = (destination: string, kind: 'play' | 'import') => {
    setPending(kind)
    if (user) {
      router.push(destination)
      return
    }
    router.push(`/login?redirect=${encodeURIComponent(destination)}`)
  }

  const startLesson = () =>
    go(`/teacher/play?set=${encodeURIComponent(set.id)}&gameMode=${gameMode}`, 'play')

  const importToLibrary = () =>
    go(`/teacher/import?from=${encodeURIComponent(set.id)}`, 'import')

  return (
    <div className="min-h-dvh bg-sky-50/60">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-32 sm:px-6">
        {/* ── 문제집 헤더 ── */}
        <section className="rounded-3xl border-2 border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold text-sky-600">공유받은 문제집</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            {set.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-slate-500">
            <span>{summary}</span>
            {set.ownerName && <span>원작 · {set.ownerName} 선생님</span>}
            {set.likeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-500">
                <Heart className="h-4 w-4 fill-current" />
                {set.likeCount}
              </span>
            )}
          </div>

          {set.forkedFromName && (
            <p className="mt-2 text-sm font-medium text-slate-400">
              {set.forkedFromName} 선생님의 문제집에서 가져와 만들었어요
            </p>
          )}

          {set.description && (
            <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-600">
              {set.description}
            </p>
          )}

          {set.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {set.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── 게임 모드 고르기 ── */}
        <section className="mt-6 rounded-3xl border-2 border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-slate-900">게임 모드 고르기</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            같은 문제로 {modes.length}가지 게임 중에 골라 수업할 수 있어요.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {modes.map((mode) => {
              const active = mode.id === gameMode
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setGameMode(mode.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-colors ${
                    active
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-200 bg-white hover:border-sky-200'
                  }`}
                >
                  {mode.image ? (
                    <Image
                      src={mode.image}
                      alt=""
                      width={120}
                      height={120}
                      className="h-16 w-16 object-contain"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center text-4xl">
                      {mode.emoji}
                    </span>
                  )}
                  <span className="text-sm font-bold text-slate-800">{mode.shortLabel}</span>
                </button>
              )
            })}
          </div>

          {selected && (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              <span className="font-bold text-slate-800">{selected.label}</span> · {selected.description}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={startLesson}
              disabled={pending !== null || authLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black text-white shadow-sm transition-colors hover:bg-sky-600 disabled:opacity-60"
            >
              {pending === 'play'
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Play className="h-5 w-5 fill-current" />}
              이 문제로 수업하기
            </button>
            <button
              type="button"
              onClick={importToLibrary}
              disabled={pending !== null || authLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-lg font-black text-slate-700 transition-colors hover:border-sky-300 disabled:opacity-60"
            >
              {pending === 'import'
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Pencil className="h-5 w-5" />}
              내 문제집으로 가져오기
            </button>
          </div>

          {!user && !authLoading && (
            <p className="mt-3 text-center text-sm font-medium text-slate-500">
              선생님 로그인이 필요해요. 학생은 로그인하지 않습니다.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              이 주소는 <b>선생님용</b>이에요. 아이들에게는 게임을 시작하면 나오는{' '}
              <b>6자리 입장 코드</b>를 알려주세요.
            </span>
          </p>
        </section>

        {/* ── 문제 미리보기 ── */}
        <section className="mt-6 rounded-3xl border-2 border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-slate-900">
            문제 미리보기 <span className="text-slate-400">({set.questionCount})</span>
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            정답은 <span className="font-bold text-emerald-700">초록색</span>으로 표시했어요.
            수업 전에 내용을 확인해 보세요.
          </p>

          <ol className="mt-5 space-y-4">
            {set.questions.map((question, index) => {
              const options = optionsOf(question.options)
              // 정답은 그대로 보여준다. 받는 선생님이 내용을 검토하고 쓸지 판단해야 하고,
              // 어차피 문제 자체가 공개돼 있어 정답만 가려도 얻는 게 크지 않다.
              const acceptable = splitAcceptableAnswers(question.answer)
              // 보기 중에 정답과 일치하는 게 하나도 없으면(주관식·빈칸) 따로 적어 준다.
              const hasCorrectOption = options.some((option) => isQuizAnswerMatch(option, question.answer))

              return (
                <li
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  {question.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={question.image_url}
                      alt=""
                      className="mb-2 max-h-32 w-auto rounded-lg border border-slate-200 object-contain"
                    />
                  )}
                  <p className="font-bold leading-relaxed text-slate-900">
                    <span className="mr-2 text-sky-600">{index + 1}.</span>
                    {/* 빈칸 문제의 {{blank}} 표식이 그대로 보이지 않도록 게임 화면과 같게 바꾼다 */}
                    {displayBlankText(question.question_text)}
                  </p>

                  {options.length > 0 && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {options.map((option, optionIndex) => {
                        const correct = isQuizAnswerMatch(option, question.answer)
                        return (
                          <li
                            key={`${question.id}-${optionIndex}`}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                              correct
                                ? 'bg-emerald-50 font-bold text-emerald-800 ring-1 ring-emerald-200'
                                : 'bg-white text-slate-700'
                            }`}
                          >
                            <span className={`font-bold ${correct ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {getOptionLabel(optionIndex)}
                            </span>
                            <span className="flex-1">{option}</span>
                            {correct && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {!hasCorrectOption && acceptable.length > 0 && (
                    <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      정답 · {acceptable.join(', ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  )
}
