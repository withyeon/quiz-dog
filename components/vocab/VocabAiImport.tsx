'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, FileText, Loader2, RotateCcw, ScanText, Sparkles, Upload, X } from 'lucide-react'
import { getTeacherAccessToken } from '@/lib/services/questionImages'
import { downscaleImage } from '@/lib/utils/downscaleImage'
import type { VocabAiCard, VocabAiMode } from '@/lib/ai/vocabGenerator'

const MAX_FILES = 5
// Vercel 함수는 요청 본문 4.5MB 가 한계라 조금 여유를 둔다
const MAX_BODY_BYTES = 4.2 * 1024 * 1024
const COUNT_OPTIONS = [10, 15, 20, 30]

const MODES: { id: VocabAiMode; label: string; icon: typeof ScanText; hint: string }[] = [
  { id: 'scan', label: '사진·PDF 옮기기', icon: ScanText, hint: '단어장·단어 목록·학습지를 찍어 올리면 종이에 적힌 그대로 카드로 옮겨요.' },
  { id: 'extract', label: '글에서 단어 뽑기', icon: Sparkles, hint: '교과서 지문이나 영어 본문을 넣으면 꼭 알아야 할 낱말을 골라 뜻과 함께 만들어요.' },
]

const ACCEPT: Record<VocabAiMode, string> = {
  scan: 'image/*,.heic,.heif,application/pdf,.pdf',
  extract: 'image/*,.heic,.heif,application/pdf,.pdf,.docx,.hwp,.hwpx,.pptx,.ppt,.txt',
}

type Usage = { plan: 'free' | 'pro'; used: number; limit: number | null }

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`
}

/**
 * 단어장 AI 가져오기. 사진·PDF 의 단어 목록을 그대로 옮기거나(scan), 지문에서 낱말을 뽑는다(extract).
 * 결과는 붙여 넣기 창처럼 미리 보고 고른 카드만 편집기에 넣는다 — 저장 전 편집기에서 다시 고칠 수 있다.
 */
export default function VocabAiImport({
  grade,
  subject,
  existingTerms,
  onImport,
  onClose,
}: {
  grade: string
  subject: string
  /** 편집기에 이미 있는 용어 — 같은 단어는 처음부터 빼 둔다 */
  existingTerms: string[]
  onImport: (cards: VocabAiCard[]) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<VocabAiMode>('scan')
  const [filesByMode, setFilesByMode] = useState<Record<VocabAiMode, File[]>>({ scan: [], extract: [] })
  const [text, setText] = useState('')
  const [count, setCount] = useState(15)
  const [fillMissing, setFillMissing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; quota?: boolean } | null>(null)
  const [result, setResult] = useState<VocabAiCard[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [usage, setUsage] = useState<Usage | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const files = filesByMode[mode]
  const existing = useMemo(() => new Set(existingTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)), [existingTerms])
  const isExisting = (card: VocabAiCard) => existing.has(card.term.trim().toLowerCase())
  const outOfQuota = usage !== null && usage.limit !== null && usage.used >= usage.limit

  const refreshUsage = async () => {
    try {
      const token = await getTeacherAccessToken()
      if (!token) return
      const res = await fetch('/api/teacher/ai-usage', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.used === 'number') setUsage({ plan: data.plan === 'pro' ? 'pro' : 'free', used: data.used, limit: typeof data.limit === 'number' ? data.limit : null })
    } catch {
      // 사용량은 안내용이라 못 읽어도 그대로 둔다(서버가 한도를 본다)
    }
  }

  useEffect(() => { void refreshUsage() }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, loading])

  useEffect(() => () => abortRef.current?.abort(), [])

  // 사진 미리 보기 주소 (지우거나 닫으면 풀어 준다)
  const previews = useMemo(() => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)), [files])
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews])

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return
    setError(null)
    const incoming = Array.from(list)
    const room = MAX_FILES - files.length
    if (room <= 0) {
      setError({ message: `파일은 ${MAX_FILES}개까지 올릴 수 있어요.` })
      return
    }
    if (incoming.length > room) setError({ message: `파일은 ${MAX_FILES}개까지라 앞의 ${room}개만 넣었어요.` })
    const shrunk = await Promise.all(incoming.slice(0, room).map((file) => downscaleImage(file)))
    setFilesByMode((current) => ({ ...current, [mode]: [...current[mode], ...shrunk] }))
  }

  const removeFile = (index: number) => {
    setFilesByMode((current) => ({ ...current, [mode]: current[mode].filter((_, i) => i !== index) }))
  }

  const canRun = !loading && !outOfQuota && (mode === 'scan' ? files.length > 0 : files.length > 0 || text.trim().length > 0)

  const run = async () => {
    if (!canRun) return
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0) + new Blob([text]).size
    if (totalBytes > MAX_BODY_BYTES) {
      setError({ message: `파일이 너무 커요(${formatSize(totalBytes)}). 합쳐서 4MB 이하로 올려 주세요. PDF는 필요한 쪽만 저장해 올리면 돼요.` })
      return
    }
    setError(null)
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const formData = new FormData()
      formData.append('mode', mode)
      files.forEach((file) => formData.append('files', file))
      if (grade) formData.append('grade', grade)
      if (subject) formData.append('subject', subject)
      if (mode === 'scan') formData.append('fillMissing', fillMissing ? '1' : '0')
      else {
        formData.append('count', String(count))
        if (text.trim()) formData.append('text', text.trim())
      }
      const token = await getTeacherAccessToken()
      const response = await fetch('/api/generate-vocab', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      void refreshUsage()
      if (!response.ok) {
        setError({
          message: data.error || (response.status === 413 ? '파일이 너무 커요. 4MB 이하로 올려 주세요.' : '카드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'),
          quota: response.status === 402,
        })
        return
      }
      const cards: VocabAiCard[] = Array.isArray(data.cards) ? data.cards : []
      setResult(cards)
      setSelected(new Set(cards.flatMap((card, index) => (existing.has(card.term.trim().toLowerCase()) ? [] : [index]))))
    } catch (caught) {
      if ((caught as Error)?.name === 'AbortError') return
      setError({ message: '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  // 지문 사진을 옮기기로 올려 빈손이면, 같은 파일을 들고 뽑기로 넘어간다
  const switchToExtract = () => {
    setFilesByMode((current) => ({ scan: [], extract: current.extract.length > 0 ? current.extract : current.scan }))
    setMode('extract')
    setResult(null)
  }

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const filledCount = result?.filter((card) => card.aiFilled).length ?? 0
  const emptyCount = result?.filter((card) => !card.definition).length ?? 0
  const duplicateCount = result?.filter(isExisting).length ?? 0
  const usageNote = usage
    ? usage.limit === null ? `이번 달 AI 만들기 ${usage.used}회 · 무제한` : `이번 달 AI 만들기 ${usage.used}/${usage.limit}회`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => { if (!loading) onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI로 단어 가져오기"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-lg font-black text-slate-900">
              <Sparkles className="h-5 w-5 text-sky-500" />
              AI로 단어 가져오기
            </h2>
            {usageNote && <p className="text-xs font-bold text-slate-400">{usageNote}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result === null ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
              {MODES.map((item) => {
                const Icon = item.icon
                const active = mode === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={loading}
                    onClick={() => { setMode(item.id); setError(null) }}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-black transition ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 break-keep text-sm font-medium text-slate-500">{MODES.find((item) => item.id === mode)?.hint}</p>

            {mode === 'extract' && (
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={loading}
                placeholder={'단어를 뽑을 글을 붙여 넣어 주세요.\n예) 영어 교과서 본문, 사회·과학 교과서 한 단원'}
                className="mt-4 min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                aria-label="단어를 뽑을 글"
              />
            )}

            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files) }}
              className={`mt-4 rounded-2xl border-2 border-dashed p-4 transition ${dragging ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'}`}
            >
              {files.length > 0 && (
                <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="relative flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                      {previews[index] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[index]!} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-slate-400"><FileText className="h-5 w-5" /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-700">{file.name}</span>
                        <span className="block text-[11px] font-medium text-slate-400">{formatSize(file.size)}</span>
                      </span>
                      <button type="button" onClick={() => removeFile(index)} disabled={loading} aria-label={`${file.name} 빼기`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={loading || files.length >= MAX_FILES}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {mode === 'scan' ? '사진·PDF 고르기' : '파일 고르기'}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInput.current?.click()}
                  disabled={loading || files.length >= MAX_FILES}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50 sm:hidden"
                >
                  <Camera className="h-4 w-4" />
                  사진 찍기
                </button>
                <p className="w-full break-keep text-xs font-medium text-slate-400">
                  {mode === 'scan'
                    ? <><span className="hidden sm:inline">여기에 끌어다 놓아도 돼요 · </span>사진 여러 장({MAX_FILES}장까지)은 순서대로 이어서 옮겨요</>
                    : '사진·PDF·한글·워드·PPT 파일도 돼요 · 글과 파일을 함께 넣어도 돼요'}
                </p>
              </div>
              <input ref={fileInput} type="file" multiple accept={ACCEPT[mode]} className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = '' }} />
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = '' }} />
            </div>

            {mode === 'scan' ? (
              <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={fillMissing} onChange={(event) => setFillMissing(event.target.checked)} disabled={loading} className="mt-0.5 h-4 w-4 accent-sky-500" />
                <span className="break-keep">
                  종이에 뜻이 없는 단어는 AI가 뜻 채우기
                  <span className="block text-xs font-medium text-slate-400">단어만 적힌 목록에 좋아요. AI가 쓴 뜻은 표시해 둘게요.</span>
                </span>
              </label>
            ) : (
              <fieldset className="mt-4">
                <legend className="mb-1.5 text-xs font-black text-slate-500">몇 개 뽑을까요?</legend>
                <div className="flex flex-wrap gap-1.5">
                  {COUNT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCount(option)}
                      disabled={loading}
                      aria-pressed={count === option}
                      className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${count === option ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {option}개
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {(grade || subject) && (
              <p className="mt-3 text-xs font-medium text-slate-400">
                {[grade, subject].filter(Boolean).join(' · ')} 눈높이에 맞춰 뜻을 써요
              </p>
            )}

            {error && (
              <p className="mt-4 break-keep rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-700">
                {error.message}
                {error.quota && usage?.plan !== 'pro' && (
                  <> <Link href="/pricing" className="text-sky-700 underline underline-offset-2">요금제 보기</Link></>
                )}
              </p>
            )}
            {outOfQuota && !error && (
              <p className="mt-4 break-keep rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-700">
                이번 달 AI 만들기 횟수를 다 썼어요. <Link href="/pricing" className="text-sky-700 underline underline-offset-2">Pro는 무제한</Link>
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-5">
            {result.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-base font-black text-slate-800">{mode === 'scan' ? '단어 목록을 찾지 못했어요' : '뽑을 낱말을 찾지 못했어요'}</p>
                <p className="mt-2 break-keep text-sm font-medium text-slate-500">
                  {mode === 'scan'
                    ? '글자가 잘 보이게 다시 찍거나, 이야기·설명 글이라면 "글에서 단어 뽑기"로 해 보세요.'
                    : '글을 조금 더 넣어 다시 해 보세요.'}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">찾은 카드가 없으면 AI 사용 횟수는 줄지 않아요.</p>
                {mode === 'scan' && (
                  <button type="button" onClick={switchToExtract} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-50 px-4 text-sm font-black text-sky-700 hover:bg-sky-100">
                    <Sparkles className="h-4 w-4" />
                    같은 파일로 단어 뽑기
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-700">
                    카드 {result.length}장을 찾았어요
                    {filledCount > 0 && <span className="ml-1.5 text-xs font-bold text-amber-600">AI가 뜻을 쓴 카드 {filledCount}장은 확인해 주세요</span>}
                    {emptyCount > 0 && <span className="ml-1.5 text-xs font-bold text-amber-600">뜻이 빈 카드 {emptyCount}장</span>}
                    {duplicateCount > 0 && <span className="ml-1.5 text-xs font-bold text-slate-400">이미 있는 단어 {duplicateCount}장은 빼 뒀어요</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelected(selected.size === result.length ? new Set() : new Set(result.map((_, index) => index)))}
                    className="text-xs font-bold text-sky-700 hover:underline"
                  >
                    {selected.size === result.length ? '모두 빼기' : '모두 고르기'}
                  </button>
                </div>
                <ol className="min-h-[160px] flex-1 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {result.map((card, index) => (
                    <li key={index}>
                      <label className={`grid cursor-pointer grid-cols-[1.25rem_1.75rem_1fr] items-start gap-2 px-3 py-2 text-sm sm:grid-cols-[1.25rem_1.75rem_1fr_1fr] ${selected.has(index) ? '' : 'opacity-40'}`}>
                        <input type="checkbox" checked={selected.has(index)} onChange={() => toggle(index)} className="mt-0.5 h-4 w-4 accent-sky-500" />
                        <span className="font-bold text-slate-400">{index + 1}</span>
                        <span className="break-words font-bold text-slate-900">
                          {card.term}
                          {isExisting(card) && <span className="ml-1.5 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-500">이미 있음</span>}
                        </span>
                        <span className={`col-start-3 break-words sm:col-start-auto ${card.definition ? 'text-slate-600' : 'text-amber-500'}`}>
                          {card.definition || '(뜻 없음)'}
                          {card.aiFilled && <span className="ml-1.5 whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-600">AI가 쓴 뜻</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          {loading ? (
            <>
              <p className="mr-auto flex min-w-0 items-center gap-2 break-keep text-sm font-bold text-slate-500">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-500" />
                {mode === 'scan' ? '종이 속 단어를 옮기고 있어요 · 10~30초' : '낱말을 고르고 있어요 · 10~20초'}
              </p>
              <button type="button" onClick={cancel} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                그만두기
              </button>
            </>
          ) : result === null ? (
            <>
              <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                취소
              </button>
              <button
                type="button"
                onClick={run}
                disabled={!canRun}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {mode === 'scan' ? '카드로 옮기기' : `단어 ${count}개 뽑기`}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setResult(null)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <RotateCcw className="h-4 w-4" />
                다시 하기
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => onImport(result.filter((_, index) => selected.has(index)))}
                className="h-11 rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600 disabled:opacity-50"
              >
                카드 {selected.size}장 넣기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
