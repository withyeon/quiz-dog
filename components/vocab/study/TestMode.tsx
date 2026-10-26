'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { confirmAsync } from '@/components/ui/ConfirmDialog'
import { SpeakButton } from '@/components/vocab/study/StudyQuestion'
import { scoreArt, VOCAB_ART } from '@/lib/vocab/art'
import {
  buildTest,
  gradeTestAnswer,
  TEST_KIND_LABEL,
  type AnswerSide,
  type StudyCard,
  type TestQuestion,
  type TestQuestionKind,
} from '@/lib/vocab/study'

const ALL_KINDS: TestQuestionKind[] = ['truefalse', 'choice', 'written']
const DEFAULT_COUNT = 20

/**
 * 시험 보기. 문항 수와 문제 유형을 고르면 시험지 한 장을 만들고, 다 풀고 나서 한 번에 채점한다.
 * 채점 뒤에는 문제마다 맞고 틀림과 정답을 보여 주고, 틀린 카드로만 다시 시험을 볼 수 있다.
 */
export default function TestMode({ cards, answerWith }: { cards: StudyCard[]; answerWith: AnswerSide }) {
  const [count, setCount] = useState(Math.min(DEFAULT_COUNT, cards.length))
  const [kinds, setKinds] = useState<TestQuestionKind[]>(ALL_KINDS)
  const [questions, setQuestions] = useState<TestQuestion[] | null>(null)
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [graded, setGraded] = useState(false)

  const answerLabel = answerWith === 'term' ? '용어' : '뜻'

  const start = (pool: StudyCard[], size: number) => {
    setQuestions(buildTest(pool, { count: size, kinds, answerWith }))
    setResponses({})
    setGraded(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const respond = (index: number, value: string) => {
    if (graded) return
    setResponses((prev) => ({ ...prev, [index]: value }))
  }

  const submit = async () => {
    if (!questions) return
    const unanswered = questions.filter((_, index) => !responses[index]?.trim()).length
    if (unanswered > 0) {
      const ok = await confirmAsync({
        title: `${unanswered}문제를 안 풀었어요`,
        message: '안 푼 문제는 틀린 것으로 채점해요. 그래도 낼까요?',
        confirmLabel: '채점하기',
      })
      if (!ok) return
    }
    setGraded(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!questions) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h3 className="text-xl font-black text-slate-900">시험지 만들기</h3>
        <p className="mt-1 text-sm font-medium text-slate-500">다 풀고 나서 한 번에 채점해요.</p>

        <label className="mt-6 block">
          <span className="flex items-center justify-between text-sm font-bold text-slate-700">
            문항 수 <span className="text-lg font-black text-sky-600">{count}</span>
          </span>
          <input
            type="range"
            min={1}
            max={cards.length}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <span className="flex justify-between text-xs font-semibold text-slate-400"><span>1</span><span>{cards.length}</span></span>
        </label>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold text-slate-700">문제 유형</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_KINDS.map((kind) => {
              const checked = kinds.includes(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => setKinds((prev) => (checked ? prev.filter((item) => item !== kind) : [...prev, kind]))}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-xl border-2 px-4 text-sm font-bold transition ${
                    checked ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {checked && <Check className="h-4 w-4" />}
                  {TEST_KIND_LABEL[kind]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <button
          type="button"
          disabled={kinds.length === 0}
          onClick={() => start(cards, count)}
          className="mt-8 h-12 w-full rounded-xl bg-sky-500 text-base font-black text-white transition hover:bg-sky-600 disabled:opacity-40"
        >
          시험 시작
        </button>
        {kinds.length === 0 && <p className="mt-2 text-center text-xs font-bold text-amber-600">문제 유형을 하나 이상 골라 주세요.</p>}
      </div>
    )
  }

  const results = questions.map((question, index) => gradeTestAnswer(question, responses[index]))
  const correctCount = results.filter(Boolean).length
  const percent = Math.round((correctCount / Math.max(1, questions.length)) * 100)
  const missedCards = Array.from(new Set(questions.filter((_, index) => !results[index]).map((question) => question.cardId)))
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is StudyCard => Boolean(card))
  const answeredCount = questions.filter((_, index) => responses[index]?.trim()).length

  let lastKind: TestQuestionKind | null = null

  return (
    <div className="space-y-4">
      {graded && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <Image src={scoreArt(percent)} alt="" width={104} height={104} unoptimized className="mx-auto h-[104px] w-[104px] object-contain" />
          <p className="mt-2 text-sm font-bold text-slate-500">내 점수</p>
          <p className={`mt-1 text-6xl font-black ${percent >= 80 ? 'text-emerald-500' : percent >= 50 ? 'text-sky-500' : 'text-amber-500'}`}>{percent}<span className="text-3xl">점</span></p>
          <p className="mt-2 text-base font-bold text-slate-700">{questions.length}문제 중 {correctCount}문제 맞혔어요</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            {missedCards.length > 0 && (
              <button
                type="button"
                onClick={() => start(missedCards, missedCards.length)}
                className="h-12 rounded-xl bg-sky-500 px-6 text-base font-black text-white transition hover:bg-sky-600"
              >
                틀린 카드 {missedCards.length}장으로 다시 시험
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuestions(null)}
              className="h-12 rounded-xl border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:bg-slate-50"
            >
              새 시험지 만들기
            </button>
          </div>
        </div>
      )}

      <ol className="space-y-4">
        {questions.map((question, index) => {
          const response = responses[index]
          const correct = results[index]
          const header = question.kind !== lastKind ? TEST_KIND_LABEL[question.kind] : null
          lastKind = question.kind
          return (
            <li key={`${question.cardId}-${index}`}>
              {header && <h4 className="mb-2 mt-6 text-sm font-black text-slate-500 first:mt-0">{header}</h4>}
              <div className={`rounded-3xl border-2 bg-white p-5 shadow-sm sm:p-6 ${graded ? (correct ? 'border-emerald-200' : 'border-rose-200') : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-black text-slate-400">{index + 1} / {questions.length}</span>
                  <div className="flex items-center gap-1">
                    {graded && (correct
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-1 pl-1.5 pr-2.5 text-xs font-black text-emerald-700"><Image src={VOCAB_ART.correct} alt="" width={16} height={16} unoptimized className="h-4 w-4 object-contain" />맞음</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-1 pl-1.5 pr-2.5 text-xs font-black text-rose-600"><Image src={VOCAB_ART.wrong} alt="" width={16} height={16} unoptimized className="h-4 w-4 object-contain" />틀림</span>)}
                    <SpeakButton text={question.prompt} />
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-xl font-black leading-snug text-slate-900">{question.prompt}</p>

                {question.kind === 'truefalse' && (
                  <>
                    <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-lg font-bold text-slate-700">
                      <span className="mr-2 text-xs font-black text-slate-400">{answerLabel}</span>
                      {question.shown}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[{ value: 'true', label: '맞아요' }, { value: 'false', label: '아니에요' }].map((option) => {
                        const picked = response === option.value
                        const isRight = (option.value === 'true') === question.isTrue
                        let tone = picked ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        if (graded && isRight) tone = 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        else if (graded && picked) tone = 'border-rose-300 bg-rose-50 text-rose-700'
                        return (
                          <button key={option.value} type="button" disabled={graded} onClick={() => respond(index, option.value)} className={`h-12 rounded-2xl border-2 text-base font-black transition ${tone}`}>
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                {question.kind === 'choice' && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {question.choices.map((choice, choiceIndex) => {
                      const picked = response === choice
                      const isRight = choice === question.answer
                      let tone = picked ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      if (graded && isRight) tone = 'border-emerald-400 bg-emerald-50'
                      else if (graded && picked) tone = 'border-rose-300 bg-rose-50'
                      else if (graded) tone = 'border-slate-200 bg-white opacity-60'
                      return (
                        <button
                          key={`${choice}-${choiceIndex}`}
                          type="button"
                          disabled={graded}
                          onClick={() => respond(index, choice)}
                          className={`min-h-[3rem] break-words rounded-2xl border-2 px-4 py-2.5 text-left text-base font-bold text-slate-800 transition ${tone}`}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                )}

                {question.kind === 'written' && (
                  <input
                    value={response ?? ''}
                    onChange={(event) => respond(index, event.target.value)}
                    readOnly={graded}
                    placeholder={`${answerLabel}${answerLabel === '용어' ? '를' : '을'} 적어 보세요`}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={`mt-4 h-12 w-full rounded-2xl border-2 px-4 text-base font-bold text-slate-900 outline-none transition focus:ring-4 ${
                      graded
                        ? correct ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
                        : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
                    }`}
                    aria-label={`${index + 1}번 답`}
                  />
                )}

                {graded && !correct && (
                  <p className="mt-3 text-sm font-bold text-slate-600">
                    {question.kind === 'truefalse'
                      ? <>정답 · <span className="text-emerald-700">{question.isTrue ? '맞아요' : `아니에요 (${answerLabel}: ${question.answer})`}</span></>
                      : <>정답 · <span className="text-emerald-700">{question.answer}</span></>}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {!graded && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/[0.96] p-3 shadow-lg">
          <span className="pl-2 text-sm font-bold text-slate-500">{answeredCount} / {questions.length} 풀었어요</span>
          <button type="button" onClick={submit} className="h-12 rounded-xl bg-sky-500 px-6 text-base font-black text-white transition hover:bg-sky-600">
            채점하기
          </button>
        </div>
      )}
    </div>
  )
}
