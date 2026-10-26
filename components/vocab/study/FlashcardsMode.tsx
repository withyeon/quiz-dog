'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Star, Undo2, X } from 'lucide-react'
import { shuffle } from '@/lib/vocab/cards'
import type { StudyCard } from '@/lib/vocab/study'
import { isTypingTarget, SpeakButton } from '@/components/vocab/study/StudyQuestion'
import { VOCAB_ART } from '@/lib/vocab/art'

type Mark = 'known' | 'learning'

/**
 * 카드 뒤집기. 앞면을 보고 떠올린 뒤 뒤집어 확인하고, "알아요 / 아직이에요"로 나눈다.
 * 한 바퀴가 끝나면 아직인 카드만 다시 돌 수 있다. 키보드: 스페이스 뒤집기, → 알아요, ← 아직이에요.
 * 폰에서는 카드를 오른쪽·왼쪽으로 밀어도 된다.
 */
export default function FlashcardsMode({
  cards,
  front,
  shuffled,
  stars,
  onToggleStar,
  onMark,
  active,
}: {
  cards: StudyCard[]
  front: 'term' | 'definition'
  shuffled: boolean
  stars: Set<string>
  onToggleStar: (cardId: string) => void
  /** 기기에 "알아요" 기록을 남긴다 */
  onMark: (cardId: string, known: boolean) => void
  /** 이 화면이 보일 때만 키보드를 듣는다 */
  active: boolean
}) {
  const [deckIds, setDeckIds] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [history, setHistory] = useState<string[]>([])
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  const cardIdsKey = cards.map((card) => card.id).join('|')
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])

  const startDeck = (ids: string[]) => {
    setDeckIds(shuffled ? shuffle(ids) : ids)
    setIndex(0)
    setFlipped(false)
    setMarks({})
    setHistory([])
  }

  // 카드 목록(별표만 보기 등)이나 섞기가 바뀌면 처음부터
  useEffect(() => {
    startDeck(cards.map((card) => card.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIdsKey, shuffled])

  const current = deckIds[index] ? byId.get(deckIds[index]) : undefined
  const done = deckIds.length > 0 && index >= deckIds.length
  const knownCount = Object.values(marks).filter((mark) => mark === 'known').length
  const learningIds = deckIds.filter((id) => marks[id] === 'learning')

  const mark = (value: Mark) => {
    if (!current || slide) return
    setSlide(value === 'known' ? 'right' : 'left')
    onMark(current.id, value === 'known')
    window.setTimeout(() => {
      setMarks((prev) => ({ ...prev, [current.id]: value }))
      setHistory((prev) => [...prev, current.id])
      setIndex((prev) => prev + 1)
      setFlipped(false)
      setSlide(null)
    }, 180)
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((prev) => prev.slice(0, -1))
    setMarks((prev) => {
      const next = { ...prev }
      delete next[last]
      return next
    })
    setIndex((prev) => Math.max(0, prev - 1))
    setFlipped(false)
  }

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key === ' ' || event.key === 'Enter') {
        // 버튼에 포커스가 있으면 그 버튼이 눌리므로 화면 단축키는 건너뛴다
        if ((event.target as HTMLElement)?.tagName === 'BUTTON') return
        event.preventDefault()
        setFlipped((prev) => !prev)
      } else if (event.key === 'ArrowRight') {
        mark('known')
      } else if (event.key === 'ArrowLeft') {
        mark('learning')
      } else if (event.key === 'Backspace' || (event.key === 'z' && (event.metaKey || event.ctrlKey))) {
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (cards.length === 0) return null

  if (done) {
    const allKnown = learningIds.length === 0
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <Image src={allKnown ? VOCAB_ART.clap : VOCAB_ART.keepGoing} alt="" width={112} height={112} unoptimized className="mx-auto h-28 w-28 object-contain" />
        <h3 className="mt-3 text-2xl font-black text-slate-900">{allKnown ? '모든 카드를 알고 있어요!' : '한 바퀴 다 돌았어요'}</h3>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-3xl font-black text-emerald-600">{knownCount}</p>
            <p className="text-sm font-bold text-emerald-700">알아요</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-3xl font-black text-amber-600">{learningIds.length}</p>
            <p className="text-sm font-bold text-amber-700">아직이에요</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {!allKnown && (
            <button
              type="button"
              onClick={() => startDeck(learningIds)}
              className="h-12 rounded-xl bg-sky-500 px-6 text-base font-black text-white transition hover:bg-sky-600"
            >
              아직인 카드 {learningIds.length}장 다시
            </button>
          )}
          <button
            type="button"
            onClick={() => startDeck(cards.map((card) => card.id))}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            처음부터
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null
  const frontText = front === 'term' ? current.term : current.definition
  const backText = front === 'term' ? current.definition : current.term
  const starred = stars.has(current.id)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm font-bold">
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">아직 {learningIds.length}</span>
        <span className="text-slate-500">{index + 1} / {deckIds.length}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">알아요 {knownCount}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${(index / deckIds.length) * 100}%` }} />
      </div>

      <div className="mt-4 [perspective:1600px]">
        <div
          role="button"
          tabIndex={0}
          aria-label={flipped ? `뒷면: ${backText}. 눌러서 앞면 보기` : `앞면: ${frontText}. 눌러서 뒤집기`}
          onClick={() => {
            if (swiped.current) { swiped.current = false; return }
            setFlipped((prev) => !prev)
          }}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setFlipped((prev) => !prev) }
          }}
          onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY } }}
          onPointerUp={(event) => {
            const start = pointerStart.current
            pointerStart.current = null
            if (!start) return
            const dx = event.clientX - start.x
            const dy = event.clientY - start.y
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              swiped.current = true
              mark(dx > 0 ? 'known' : 'learning')
            }
          }}
          className="relative h-[clamp(260px,46vh,420px)] w-full cursor-pointer select-none outline-none transition-[transform,opacity] duration-200 [transform-style:preserve-3d] focus-visible:ring-4 focus-visible:ring-sky-200 rounded-3xl"
          style={{
            transform: `${slide === 'right' ? 'translateX(40px) rotate(4deg)' : slide === 'left' ? 'translateX(-40px) rotate(-4deg)' : ''} rotateY(${flipped ? 180 : 0}deg)`,
            opacity: slide ? 0 : 1,
            transitionDuration: slide ? '180ms' : '450ms',
            touchAction: 'pan-y',
          }}
        >
          {[{ text: frontText, back: false }, { text: backText, back: true }].map((face) => (
            <div
              key={face.back ? 'back' : 'front'}
              className={`absolute inset-0 flex flex-col rounded-3xl border-2 p-5 shadow-sm [backface-visibility:hidden] sm:p-8 ${
                face.back ? 'border-sky-200 bg-sky-50 [transform:rotateY(180deg)]' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400">
                  {(face.back ? front !== 'term' : front === 'term') ? '용어' : '뜻'}
                </span>
                <div className="flex items-center">
                  <SpeakButton text={face.text} />
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onToggleStar(current.id) }}
                    aria-label={starred ? '별표 빼기' : '별표 하기'}
                    aria-pressed={starred}
                    className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-amber-400"
                  >
                    <Star className={`h-5 w-5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
                <p
                  className={`whitespace-pre-wrap break-words text-center font-black leading-snug text-slate-900 ${
                    face.text.length > 80 ? 'text-xl sm:text-2xl' : face.text.length > 24 ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'
                  }`}
                >
                  {face.text}
                </p>
              </div>
              {!face.back && <p className="text-center text-xs font-bold text-slate-400">눌러서 뒤집기</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => mark('learning')}
          className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 bg-white text-base font-black text-amber-700 transition hover:bg-amber-50 sm:max-w-[220px]"
        >
          <X className="h-5 w-5" />
          아직이에요
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          aria-label="되돌리기"
          title="되돌리기"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => mark('known')}
          className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-white text-base font-black text-emerald-700 transition hover:bg-emerald-50 sm:max-w-[220px]"
        >
          <Check className="h-5 w-5" />
          알아요
        </button>
      </div>
      <p className="mt-3 hidden items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 sm:flex">
        스페이스 뒤집기 · <ArrowLeft className="h-3 w-3" /> 아직이에요 · <ArrowRight className="h-3 w-3" /> 알아요
      </p>
    </div>
  )
}
