'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowLeftRight, ClipboardPaste, Globe, Loader2, Lock, Play, Plus, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import AudienceFields from '@/components/teacher/create/AudienceFields'
import VocabPasteImport from '@/components/vocab/VocabPasteImport'
import VocabAiImport from '@/components/vocab/VocabAiImport'
import VocabStudyLinkModal from '@/components/vocab/VocabStudyLinkModal'
import { toast } from '@/components/ui/Toaster'
import { confirmAsync } from '@/components/ui/ConfirmDialog'
import { formatServiceError } from '@/lib/services/errors'
import { createVocabSet, updateVocabSet } from '@/lib/services/vocabSets'
import { remapSubjectToLevel, schoolLevelFromGrade } from '@/lib/constants/subjects'
import { isBlankCard, MIN_VOCAB_CARDS, validateVocabCards, type VocabCard } from '@/lib/vocab/cards'

/** aiFilled: 종이에 뜻이 없어 AI가 써 넣은 뜻 — 선생님이 뜻을 고치기 전까지 표시한다 */
type EditorCard = VocabCard & { uid: string; aiFilled?: boolean }

let uidSeed = 0
const nextUid = () => `card-${Date.now()}-${uidSeed++}`
const withUid = (card: VocabCard & { aiFilled?: boolean }): EditorCard => ({ ...card, uid: nextUid() })
const blankCard = (): EditorCard => withUid({ term: '', definition: '' })

export type VocabEditorInitial = {
  setId?: string
  title: string
  subject: string
  grade: string
  isPublic: boolean
  cards: VocabCard[]
}

/** 글이 길어지면 칸이 따라 늘어나는 입력칸 (한 줄 입력처럼 Enter 로 줄을 바꾸지 않는다) */
function GrowingField({
  value,
  onChange,
  placeholder,
  label,
  invalid,
  onKeyDown,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  invalid: boolean
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef?: (element: HTMLTextAreaElement | null) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  return (
    <label className="block">
      <textarea
        ref={(element) => { ref.current = element; inputRef?.(element) }}
        value={value}
        rows={1}
        onChange={(event) => onChange(event.target.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`block w-full resize-none overflow-hidden border-0 border-b-2 bg-transparent px-0.5 py-1.5 text-base font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-sky-500 ${
          invalid ? 'border-amber-400' : 'border-slate-200'
        }`}
      />
      <span className="mt-1 block text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</span>
    </label>
  )
}

/**
 * 단어장 만들기·고치기. 용어와 뜻을 줄줄이 적고, 저장하면 카드마다 다른 카드의 뜻을 오답 보기로 붙인
 * 객관식 문제가 된다(lib/vocab/cards.ts) — 그래서 학생 공부 화면뿐 아니라 모든 게임에 그대로 쓸 수 있다.
 */
export default function VocabEditor({ initial }: { initial: VocabEditorInitial }) {
  const router = useRouter()
  const isEdit = Boolean(initial.setId)
  const [title, setTitle] = useState(initial.title)
  const [subject, setSubject] = useState(initial.subject)
  const [grade, setGrade] = useState(initial.grade)
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [cards, setCards] = useState<EditorCard[]>(() => {
    const loaded = initial.cards.map(withUid)
    // 새 단어장은 빈 카드 몇 장으로 시작해 바로 적을 수 있게 한다
    while (loaded.length < MIN_VOCAB_CARDS + 1) loaded.push(blankCard())
    return loaded
  })
  const originalIds = useRef(initial.cards.map((card) => card.id).filter((id): id is string => Boolean(id)))
  const [pasteOpen, setPasteOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [triedSave, setTriedSave] = useState(false)
  const [saved, setSaved] = useState<{ setId: string; count: number } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const fieldRefs = useRef(new Map<string, HTMLTextAreaElement>())
  const focusNext = useRef<string | null>(null)

  const handleGradeChange = (nextGrade: string) => {
    setGrade(nextGrade)
    setSubject((current) => remapSubjectToLevel(current, schoolLevelFromGrade(nextGrade)))
  }

  const validation = useMemo(() => validateVocabCards(cards), [cards])
  const filledCount = cards.filter((card) => !isBlankCard(card)).length

  // 저장하지 않고 나가려 할 때 붙잡는다
  useEffect(() => {
    if (!dirty || saved) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, saved])

  useEffect(() => {
    if (!focusNext.current) return
    fieldRefs.current.get(focusNext.current)?.focus()
    focusNext.current = null
  })

  const touch = () => setDirty(true)

  const updateCard = (uid: string, patch: Partial<VocabCard>) => {
    touch()
    setCards((current) => current.map((card) => (
      card.uid === uid ? { ...card, ...patch, ...('definition' in patch ? { aiFilled: false } : {}) } : card
    )))
  }

  const addCard = (afterUid?: string) => {
    touch()
    const card = blankCard()
    focusNext.current = `${card.uid}:term`
    setCards((current) => {
      if (!afterUid) return [...current, card]
      const index = current.findIndex((item) => item.uid === afterUid)
      return [...current.slice(0, index + 1), card, ...current.slice(index + 1)]
    })
  }

  const removeCard = (uid: string) => {
    touch()
    setCards((current) => (current.length <= 1 ? [blankCard()] : current.filter((card) => card.uid !== uid)))
  }

  const swapSides = () => {
    touch()
    setCards((current) => current.map((card) => ({ ...card, term: card.definition, definition: card.term })))
    toast.success('용어와 뜻을 서로 바꿨어요.')
  }

  const importCards = (imported: Array<VocabCard & { aiFilled?: boolean }>) => {
    touch()
    setCards((current) => {
      const kept = current.filter((card) => !isBlankCard(card))
      return [...kept, ...imported.map(withUid)]
    })
    setPasteOpen(false)
    setAiOpen(false)
    toast.success(`카드 ${imported.length}장을 넣었어요.`)
  }

  /** 마지막 카드의 뜻 칸에서 Tab 을 누르면 새 카드를 만든다 */
  const handleDefinitionKey = (event: React.KeyboardEvent<HTMLTextAreaElement>, uid: string, index: number) => {
    if (event.key === 'Tab' && !event.shiftKey && index === cards.length - 1) {
      event.preventDefault()
      addCard()
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (index === cards.length - 1) addCard()
      else fieldRefs.current.get(`${cards[index + 1].uid}:term`)?.focus()
    }
    void uid
  }

  const handleTermKey = (event: React.KeyboardEvent<HTMLTextAreaElement>, uid: string) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      fieldRefs.current.get(`${uid}:definition`)?.focus()
    }
  }

  const save = async () => {
    setTriedSave(true)
    const metadata = { title, subject, grade }
    const payloadCards = cards.filter((card) => !isBlankCard(card)).map(({ id, term, definition }) => ({ id, term, definition }))
    setSaving(true)
    try {
      if (isEdit && initial.setId) {
        await updateVocabSet({ setId: initial.setId, metadata, cards: payloadCards, originalIds: originalIds.current })
        toast.success('단어장을 저장했어요.')
        setDirty(false)
        router.push('/teacher')
        return
      }
      const setId = await createVocabSet({ metadata, cards: payloadCards, isPublic })
      setDirty(false)
      setSaved({ setId, count: payloadCards.length })
      window.scrollTo({ top: 0 })
    } catch (error) {
      toast.error(formatServiceError(error))
    } finally {
      setSaving(false)
    }
  }

  const leave = async () => {
    if (dirty) {
      const ok = await confirmAsync({
        title: '저장하지 않고 나갈까요?',
        message: '적은 카드가 사라져요.',
        confirmLabel: '나가기',
        destructive: true,
      })
      if (!ok) return
    }
    router.push('/teacher')
  }

  if (saved) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-b from-sky-50 to-white px-6 pb-6 pt-8 text-center">
            <Image src="/assets/icons/mascot-pome-clap-320.webp" alt="" width={128} height={128} unoptimized className="mx-auto h-32 w-32 object-contain" priority />
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">단어장을 저장했어요</h1>
            <p className="mt-3 text-lg font-black text-slate-800">{title.trim()}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">카드 {saved.count}장</span>
              {grade && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{grade}</span>}
              {subject && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{subject}</span>}
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${isPublic ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {isPublic ? '자료실 공개' : '나만 보기'}
              </span>
            </div>
          </div>
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-base font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
            >
              <Smartphone className="h-5 w-5" />
              학생 공부 링크
            </button>
            <Link
              href={`/teacher/play?set=${encodeURIComponent(saved.setId)}`}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-base font-black text-slate-800 transition hover:bg-slate-50"
            >
              <Play className="h-5 w-5 fill-current" />
              게임으로 시작
            </Link>
            <Link
              href={`/teacher/vocab/${encodeURIComponent(saved.setId)}/edit`}
              className="flex h-12 items-center justify-center rounded-xl text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              더 고치기
            </Link>
            <Link href="/teacher" className="flex h-12 items-center justify-center rounded-xl text-sm font-bold text-slate-600 transition hover:bg-slate-50">
              내 문제집으로
            </Link>
          </div>
        </div>
        {linkOpen && <VocabStudyLinkModal setId={saved.setId} title={title.trim()} onClose={() => setLinkOpen(false)} />}
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl pb-28 text-black">
      <button type="button" onClick={leave} className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        내 문제집
      </button>
      <h1 className="text-3xl font-black tracking-tight text-slate-900">{isEdit ? '단어장 고치기' : '단어장 만들기'}</h1>
      <p className="mt-2 break-keep text-sm font-medium leading-6 text-slate-500">
        용어와 뜻을 적으면 학생은 카드 뒤집기 · 익히기 · 쓰기 · 시험 보기로 혼자 공부하고, 같은 단어장으로 모든 게임도 할 수 있어요.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="vocab-title" className="mb-1.5 block text-sm font-bold text-slate-700">단어장 이름</label>
        <input
          id="vocab-title"
          value={title}
          onChange={(event) => { touch(); setTitle(event.target.value) }}
          placeholder="예: 중1 영어 3단원 단어"
          className={`h-12 w-full rounded-xl border bg-white px-4 text-base font-bold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${
            triedSave && !title.trim() ? 'border-amber-400' : 'border-slate-200'
          }`}
        />
        <div className="mt-4">
          <AudienceFields grade={grade} onGradeChange={(value) => { touch(); handleGradeChange(value) }} subject={subject} onSubjectChange={(value) => { touch(); setSubject(value) }} compact />
        </div>
        {!isEdit && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-4 w-4 accent-sky-500" />
            자료실에 공개해서 다른 선생님도 쓰게 하기
          </label>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-slate-900">
          카드 <span className="text-sky-600">{filledCount}</span>장
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-sm font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
          >
            <Sparkles className="h-4 w-4" />
            AI로 가져오기
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            <ClipboardPaste className="h-4 w-4" />
            한꺼번에 붙여 넣기
          </button>
          <button
            type="button"
            onClick={swapSides}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeftRight className="h-4 w-4" />
            용어 ↔ 뜻 바꾸기
          </button>
        </div>
      </div>

      <ol className="mt-3 space-y-3">
        {cards.map((card, index) => {
          const error = validation.cardErrors[index]
          const showError = Boolean(error) && (triedSave || (card.term.trim() !== '' && card.definition.trim() !== ''))
          return (
            <li key={card.uid} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <span className="text-sm font-black text-slate-400">{index + 1}</span>
                <div className="flex items-center gap-1">
                  {showError
                    ? <span className="mr-1 text-xs font-bold text-amber-600">{error}</span>
                    : card.aiFilled && <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-600">AI가 쓴 뜻 · 확인해 주세요</span>}
                  <button
                    type="button"
                    onClick={() => addCard(card.uid)}
                    title="아래에 카드 끼워 넣기"
                    aria-label={`${index + 1}번 카드 아래에 카드 끼워 넣기`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCard(card.uid)}
                    title="카드 지우기"
                    aria-label={`${index + 1}번 카드 지우기`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-4 px-4 pb-4 pt-3 sm:grid-cols-2 sm:gap-6">
                <GrowingField
                  value={card.term}
                  onChange={(value) => updateCard(card.uid, { term: value })}
                  placeholder="용어 (예: apple)"
                  label="용어"
                  invalid={triedSave && Boolean(error) && !card.term.trim()}
                  onKeyDown={(event) => handleTermKey(event, card.uid)}
                  inputRef={(element) => { if (element) fieldRefs.current.set(`${card.uid}:term`, element); else fieldRefs.current.delete(`${card.uid}:term`) }}
                />
                <GrowingField
                  value={card.definition}
                  onChange={(value) => updateCard(card.uid, { definition: value })}
                  placeholder="뜻 (예: 사과)"
                  label="뜻"
                  invalid={triedSave && Boolean(error) && !card.definition.trim()}
                  onKeyDown={(event) => handleDefinitionKey(event, card.uid, index)}
                  inputRef={(element) => { if (element) fieldRefs.current.set(`${card.uid}:definition`, element); else fieldRefs.current.delete(`${card.uid}:definition`) }}
                />
              </div>
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        onClick={() => addCard()}
        className="mt-3 flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-base font-black text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
      >
        <Plus className="h-5 w-5" />
        카드 추가
      </button>
      <p className="mt-2 text-center text-xs font-medium text-slate-400">뜻 칸에서 Enter 를 누르면 다음 카드로, 마지막 카드면 새 카드가 생겨요.</p>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/[0.95] px-4 py-3 lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <p className="min-w-0 break-keep text-sm font-semibold text-slate-500">
            {triedSave && validation.errors.length > 0
              ? <span className="text-amber-600">{validation.errors[0]}</span>
              : `카드 ${filledCount}장 · ${MIN_VOCAB_CARDS}장 이상이면 저장할 수 있어요`}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-6 text-base font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? '저장하기' : '만들기'}
          </button>
        </div>
      </div>

      {pasteOpen && <VocabPasteImport onImport={importCards} onClose={() => setPasteOpen(false)} />}
      {aiOpen && (
        <VocabAiImport
          grade={grade}
          subject={subject}
          existingTerms={cards.map((card) => card.term)}
          onImport={importCards}
          onClose={() => setAiOpen(false)}
        />
      )}
    </main>
  )
}
