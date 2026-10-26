'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, Shuffle, Star, type LucideIcon } from 'lucide-react'
import FlashcardsMode from '@/components/vocab/study/FlashcardsMode'
import LearnMode from '@/components/vocab/study/LearnMode'
import WriteMode from '@/components/vocab/study/WriteMode'
import TestMode from '@/components/vocab/study/TestMode'
import { SpeakButton } from '@/components/vocab/study/StudyQuestion'
import { DEFAULT_VOCAB_PROGRESS, loadVocabProgress, saveVocabProgress, type VocabProgress } from '@/lib/vocab/progress'
import type { AnswerSide, LearnLevel, StudyCard } from '@/lib/vocab/study'
import { MIN_VOCAB_CARDS } from '@/lib/vocab/cards'
import { VOCAB_ART } from '@/lib/vocab/art'

type StudyMode = 'flashcards' | 'learn' | 'write' | 'test'

const MODES: { id: StudyMode; label: string; caption: string; art: string; tone: string }[] = [
  { id: 'flashcards', label: '카드 뒤집기', caption: '보고 떠올리기', art: VOCAB_ART.flashcards, tone: 'bg-sky-100' },
  { id: 'learn', label: '익히기', caption: '고르고 쓰며 외우기', art: VOCAB_ART.learn, tone: 'bg-emerald-100' },
  { id: 'write', label: '쓰기', caption: '직접 써서 답하기', art: VOCAB_ART.write, tone: 'bg-amber-100' },
  { id: 'test', label: '시험 보기', caption: '한 번에 채점', art: VOCAB_ART.test, tone: 'bg-rose-100' },
]

export type VocabStudySet = {
  id: string
  title: string
  subject: string | null
  grade: string | null
  ownerName: string | null
  cards: StudyCard[]
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <div className="flex rounded-xl bg-slate-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${value === option.value ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleChip({ active, onClick, icon: Icon, children, disabled }: { active: boolean; onClick: () => void; icon?: LucideIcon; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition disabled:opacity-40 ${
        active ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'
      }`}
    >
      {Icon && <Icon className={`h-3.5 w-3.5 ${active && Icon === Star ? 'fill-current' : ''}`} />}
      {children}
    </button>
  )
}

/**
 * 학생이 단어장 하나로 혼자 공부하는 화면 (app/cards/[code]). 로그인 없이 쓰고, 기록은 기기에 남긴다.
 */
export default function VocabStudyApp({ set }: { set: VocabStudySet }) {
  const [mode, setMode] = useState<StudyMode>('flashcards')
  const [progress, setProgress] = useState<VocabProgress>(DEFAULT_VOCAB_PROGRESS)
  const [ready, setReady] = useState(false)
  const [useChoice, setUseChoice] = useState(true)
  const [useWritten, setUseWritten] = useState(true)

  useEffect(() => {
    setProgress(loadVocabProgress(set.id))
    setReady(true)
  }, [set.id])

  useEffect(() => {
    if (ready) saveVocabProgress(set.id, progress)
  }, [ready, set.id, progress])

  const stars = useMemo(() => new Set(progress.stars), [progress.stars])
  const known = useMemo(() => new Set(progress.known), [progress.known])
  const starredCards = set.cards.filter((card) => stars.has(card.id))
  // 별표만 보기인데 별표가 너무 적으면(객관식 보기를 못 만듦) 전체로 공부한다
  const starredOnly = progress.prefs.starredOnly && starredCards.length > 0
  const studyCards = starredOnly ? starredCards : set.cards
  const tooFewForChoices = studyCards.length < MIN_VOCAB_CARDS
  const cardsKey = studyCards.map((card) => card.id).join('|')
  const { answerWith, front, shuffle } = progress.prefs

  const setPrefs = (patch: Partial<VocabProgress['prefs']>) =>
    setProgress((prev) => ({ ...prev, prefs: { ...prev.prefs, ...patch } }))

  const toggleStar = (cardId: string) =>
    setProgress((prev) => ({
      ...prev,
      stars: prev.stars.includes(cardId) ? prev.stars.filter((id) => id !== cardId) : [...prev.stars, cardId],
    }))

  const markKnown = (cardId: string, isKnown: boolean) =>
    setProgress((prev) => ({
      ...prev,
      known: isKnown ? Array.from(new Set([...prev.known, cardId])) : prev.known.filter((id) => id !== cardId),
    }))

  const setLevels = (levels: Record<string, LearnLevel>) => setProgress((prev) => ({ ...prev, learn: levels }))

  const meta = [`카드 ${set.cards.length}장`, set.grade, set.subject, set.ownerName ? `${set.ownerName} 선생님` : null]
    .filter(Boolean)
    .join(' · ')

  const answerSegment = (
    <Segmented<AnswerSide>
      label="답할 것"
      value={answerWith}
      onChange={(value) => setPrefs({ answerWith: value })}
      options={[{ value: 'definition', label: '뜻' }, { value: 'term', label: '용어' }]}
    />
  )

  return (
    <div className="min-h-dvh bg-sky-50/60 pb-16">
      <header className="border-b border-sky-100 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center" aria-label="퀴즈독 홈">
            <Image src="/header-logo.webp" alt="퀴즈독" width={150} height={50} className="h-10 w-auto" priority />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 py-1 pl-1.5 pr-3 text-xs font-black text-sky-700">
            <Image src={VOCAB_ART.set} alt="" width={20} height={20} unoptimized className="h-5 w-5 object-contain" />
            단어장
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">
        <h1 className="break-words text-2xl font-black leading-tight text-slate-900 sm:text-3xl">{set.title}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">{meta}</p>

        <nav aria-label="공부 방법" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map((item) => {
            const active = mode === item.id
            const disabled = item.id !== 'flashcards' && tooFewForChoices && item.id !== 'write'
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => setMode(item.id)}
                className={`flex items-center gap-2.5 rounded-2xl border-2 p-3 text-left transition disabled:opacity-40 ${
                  active ? 'border-sky-400 bg-white shadow-sm' : 'border-transparent bg-white/70 hover:border-sky-200 hover:bg-white'
                }`}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.tone}`}>
                  <Image src={item.art} alt="" width={34} height={34} unoptimized className="h-[34px] w-[34px] object-contain" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${active ? 'text-sky-800' : 'text-slate-800'}`}>{item.label}</span>
                  <span className="block truncate text-[11px] font-semibold text-slate-400">{item.caption}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {mode === 'flashcards' ? (
            <Segmented<'term' | 'definition'>
              label="앞면"
              value={front}
              onChange={(value) => setPrefs({ front: value })}
              options={[{ value: 'term', label: '용어' }, { value: 'definition', label: '뜻' }]}
            />
          ) : answerSegment}
          <div className="flex flex-wrap gap-1.5">
            {mode !== 'test' && (
              <ToggleChip active={shuffle} onClick={() => setPrefs({ shuffle: !shuffle })} icon={Shuffle}>섞기</ToggleChip>
            )}
            <ToggleChip
              active={starredOnly}
              disabled={starredCards.length === 0}
              onClick={() => setPrefs({ starredOnly: !progress.prefs.starredOnly })}
              icon={Star}
            >
              별표만 {starredCards.length > 0 ? starredCards.length : ''}
            </ToggleChip>
            {mode === 'learn' && (
              <>
                <ToggleChip active={useChoice} onClick={() => (useChoice && !useWritten ? undefined : setUseChoice(!useChoice))}>객관식</ToggleChip>
                <ToggleChip active={useWritten} onClick={() => (useWritten && !useChoice ? undefined : setUseWritten(!useWritten))}>쓰기</ToggleChip>
              </>
            )}
          </div>
        </div>

        {starredOnly && tooFewForChoices && mode !== 'flashcards' && mode !== 'write' && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
            별표 카드가 {MIN_VOCAB_CARDS}장보다 적으면 객관식 보기를 만들 수 없어요. 별표를 더 하거나 전체로 공부해 주세요.
          </p>
        )}

        <section className="mt-5">
          {!ready ? (
            <div className="h-[420px] animate-pulse rounded-3xl bg-white" />
          ) : mode === 'flashcards' ? (
            <FlashcardsMode
              cards={studyCards}
              front={front}
              shuffled={shuffle}
              stars={stars}
              onToggleStar={toggleStar}
              onMark={markKnown}
              active
            />
          ) : mode === 'learn' && !tooFewForChoices ? (
            <LearnMode
              key={`${cardsKey}-${answerWith}-${useChoice}-${useWritten}-${shuffle}`}
              cards={studyCards}
              levels={progress.learn}
              onLevelsChange={setLevels}
              options={{ answerWith, useChoice, useWritten, shuffle }}
            />
          ) : mode === 'write' ? (
            <WriteMode key={`${cardsKey}-${answerWith}-${shuffle}`} cards={studyCards} answerWith={answerWith} shuffled={shuffle} />
          ) : mode === 'test' && !tooFewForChoices ? (
            <TestMode key={`${cardsKey}-${answerWith}`} cards={studyCards} answerWith={answerWith} />
          ) : null}
        </section>

        {mode === 'flashcards' && (
          <section className="mt-10">
            <h2 className="text-lg font-black text-slate-900">
              이 단어장의 카드 <span className="text-slate-400">({set.cards.length})</span>
            </h2>
            <ul className="mt-3 space-y-2">
              {set.cards.map((card) => {
                const starred = stars.has(card.id)
                return (
                  <li key={card.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                      <p className="break-words font-black text-slate-900">{card.term}</p>
                      <p className="break-words text-slate-600">{card.definition}</p>
                    </div>
                    <div className="-my-1 flex shrink-0 items-center">
                      {known.has(card.id) && <Check className="mr-1 h-4 w-4 text-emerald-500" aria-label="알아요로 표시한 카드" />}
                      <SpeakButton text={card.term} />
                      <button
                        type="button"
                        onClick={() => toggleStar(card.id)}
                        aria-label={starred ? `${card.term} 별표 빼기` : `${card.term} 별표 하기`}
                        aria-pressed={starred}
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-amber-400"
                      >
                        <Star className={`h-5 w-5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <p className="mt-10 text-center text-xs font-medium text-slate-400">
          공부 기록과 별표는 이 기기에만 저장돼요.
        </p>
      </main>
    </div>
  )
}
