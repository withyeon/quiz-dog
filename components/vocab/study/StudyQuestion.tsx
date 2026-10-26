'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Volume2, X } from 'lucide-react'
import { canSpeak, speak } from '@/lib/vocab/speech'
import { isVocabAnswerCorrect } from '@/lib/vocab/study'
import { VOCAB_ART } from '@/lib/vocab/art'

export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  const [available, setAvailable] = useState(false)
  useEffect(() => { setAvailable(canSpeak()) }, [])
  if (!available) return null
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); speak(text) }}
      aria-label="소리 내어 읽기"
      title="소리 내어 읽기"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-sky-600 ${className}`}
    >
      <Volume2 className="h-5 w-5" />
    </button>
  )
}

/** 입력칸·버튼에 포커스가 있을 때는 화면 단축키를 쓰지 않는다 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable
}

const AUTO_NEXT_MS = 900

/**
 * 문제 하나 (익히기·쓰기 공용). 맞히면 잠깐 초록색으로 보여 주고 저절로 넘어가고,
 * 틀리면 정답을 보여 준 채 "계속하기"를 기다린다. 쓰기에서 억울하게 틀렸으면 "내 답도 맞아요"로 바로잡는다.
 * 문제가 바뀔 때는 부모가 key 를 바꿔 새로 그린다.
 */
export default function StudyQuestion({
  prompt,
  answer,
  kind,
  choices = [],
  answerLabel,
  onResult,
}: {
  prompt: string
  answer: string
  kind: 'choice' | 'written'
  choices?: string[]
  /** "뜻" 또는 "용어" — 무엇을 답하는지 */
  answerLabel: string
  onResult: (correct: boolean) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const doneRef = useRef(false)

  const finish = (correct: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    onResult(correct)
  }

  const submitChoice = (choice: string) => {
    if (result !== null) return
    setPicked(choice)
    setResult(choice === answer)
  }

  const submitWritten = (text: string) => {
    if (result !== null) return
    setTyped(text)
    setResult(isVocabAnswerCorrect(text, answer))
  }

  // 맞히면 저절로 다음 문제
  useEffect(() => {
    if (result !== true) return
    const timer = window.setTimeout(() => finish(true), AUTO_NEXT_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  useEffect(() => {
    if (result === false) continueRef.current?.focus()
    else if (result === null && kind === 'written') inputRef.current?.focus()
  }, [result, kind])

  // 객관식은 숫자 1~4 로 고른다
  useEffect(() => {
    if (kind !== 'choice' || result !== null) return
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const index = Number(event.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < choices.length) submitChoice(choices[index])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, result, choices])

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-black text-slate-400">{kind === 'choice' ? `알맞은 ${answerLabel} 고르기` : `${answerLabel} 쓰기`}</span>
        <SpeakButton text={prompt} className="-mr-2 -mt-2" />
      </div>
      <p className="mt-2 min-h-[4rem] whitespace-pre-wrap break-words text-2xl font-black leading-snug text-slate-900 sm:text-3xl">{prompt}</p>

      {kind === 'choice' ? (
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {choices.map((choice, index) => {
            const isAnswer = choice === answer
            const isPicked = choice === picked
            let tone = 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50'
            if (result !== null && isAnswer) tone = 'border-emerald-400 bg-emerald-50'
            else if (result === false && isPicked) tone = 'border-rose-400 bg-rose-50'
            else if (result !== null) tone = 'border-slate-200 bg-white opacity-60'
            return (
              <button
                key={`${choice}-${index}`}
                type="button"
                onClick={() => submitChoice(choice)}
                disabled={result !== null}
                className={`flex min-h-[3.5rem] items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base font-bold text-slate-800 transition ${tone}`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">{index + 1}</span>
                <span className="min-w-0 flex-1 break-words">{choice}</span>
                {result !== null && isAnswer && <Check className="h-5 w-5 shrink-0 text-emerald-600" />}
                {result === false && isPicked && <X className="h-5 w-5 shrink-0 text-rose-500" />}
              </button>
            )
          })}
        </div>
      ) : (
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (typed.trim()) submitWritten(typed)
          }}
        >
          <input
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            readOnly={result !== null}
            placeholder={`${answerLabel}${answerLabel === '용어' ? '를' : '을'} 적어 보세요`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`h-14 w-full rounded-2xl border-2 px-4 text-lg font-bold text-slate-900 outline-none transition focus:ring-4 ${
              result === true
                ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-100'
                : result === false
                  ? 'border-rose-300 bg-rose-50 focus:ring-rose-100'
                  : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-sky-100'
            }`}
            aria-label={`${answerLabel} 입력`}
          />
          {result === null && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => submitWritten('')} className="h-11 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                모르겠어요
              </button>
              <button
                type="submit"
                disabled={!typed.trim()}
                className="h-11 rounded-xl bg-sky-500 px-6 text-base font-black text-white transition hover:bg-sky-600 disabled:opacity-40"
              >
                답하기
              </button>
            </div>
          )}
        </form>
      )}

      {result === true && (
        <p className="mt-5 flex items-center gap-2 text-base font-black text-emerald-600">
          <Image src={VOCAB_ART.correct} alt="" width={28} height={28} unoptimized className="h-7 w-7 object-contain" /> 맞았어요!
        </p>
      )}

      {result === false && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          {kind === 'written' && (
            <p className="text-sm font-bold text-slate-500">
              내 답 · <span className="text-rose-600">{typed.trim() || '(모르겠어요)'}</span>
            </p>
          )}
          <p className="mt-1 text-base font-black text-slate-900">
            정답 · <span className="text-emerald-700">{answer}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {kind === 'written' && typed.trim() && (
              <button type="button" onClick={() => finish(true)} className="h-11 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-white hover:text-slate-800">
                내 답도 맞아요
              </button>
            )}
            <button
              ref={continueRef}
              type="button"
              onClick={() => finish(false)}
              className="h-11 rounded-xl bg-slate-900 px-6 text-base font-black text-white transition hover:bg-slate-700"
            >
              계속하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
