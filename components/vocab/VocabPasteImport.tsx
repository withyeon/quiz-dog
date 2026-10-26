'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  detectPasteFormat,
  parseVocabText,
  type PasteFormat,
  type RowSeparator,
  type TermSeparator,
  type VocabCard,
} from '@/lib/vocab/cards'

const TERM_OPTIONS: { id: TermSeparator; label: string }[] = [
  { id: 'tab', label: '탭' },
  { id: 'comma', label: '쉼표 ,' },
  { id: 'dash', label: '빼기 -' },
  { id: 'colon', label: '쌍점 :' },
  { id: 'custom', label: '직접' },
]

const ROW_OPTIONS: { id: RowSeparator; label: string }[] = [
  { id: 'newline', label: '줄바꿈' },
  { id: 'semicolon', label: '세미콜론 ;' },
  { id: 'custom', label: '직접' },
]

const PLACEHOLDER = `apple\t사과
banana\t바나나
cherry\t체리

엑셀·다른 단어장에서 복사해 붙여 넣거나
apple - 사과 처럼 한 줄에 하나씩 적어도 돼요.`

/**
 * 한꺼번에 붙여 넣기. 엑셀 두 칸을 복사하거나 다른 단어장 서비스에서 "내보내기"한 글(탭 + 줄바꿈)을
 * 그대로 넣으면 된다. 구분자는 처음 붙여 넣을 때 짐작하고, 선생님이 바꿀 수 있다.
 */
export default function VocabPasteImport({
  onImport,
  onClose,
}: {
  onImport: (cards: VocabCard[]) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [format, setFormat] = useState<PasteFormat>({ term: 'tab', row: 'newline' })
  const [touchedFormat, setTouchedFormat] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleText = (value: string) => {
    setText(value)
    // 선생님이 구분자를 직접 고르기 전까지는 붙여 넣은 글을 보고 계속 짐작한다
    if (!touchedFormat && value.trim()) setFormat(detectPasteFormat(value))
  }

  const updateFormat = (patch: Partial<PasteFormat>) => {
    setTouchedFormat(true)
    setFormat((current) => ({ ...current, ...patch }))
  }

  const cards = useMemo(() => parseVocabText(text, format), [text, format])
  const incomplete = cards.filter((card) => !card.term || !card.definition).length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="한꺼번에 붙여 넣기"
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">한꺼번에 붙여 넣기</h2>
            <p className="text-sm font-medium text-slate-500">한 줄에 카드 하나, 용어와 뜻 사이에 구분자를 넣어 주세요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div className="flex min-h-0 flex-col">
            <textarea
              value={text}
              onChange={(event) => handleText(event.target.value)}
              placeholder={PLACEHOLDER}
              autoFocus
              className="min-h-[220px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              aria-label="붙여 넣을 글"
            />
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-xs font-black text-slate-500">용어와 뜻 사이</legend>
              <div className="flex flex-wrap gap-1.5">
                {TERM_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateFormat({ term: option.id })}
                    aria-pressed={format.term === option.id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${format.term === option.id ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {option.label}
                  </button>
                ))}
                {format.term === 'custom' && (
                  <input
                    value={format.customTerm ?? ''}
                    onChange={(event) => updateFormat({ customTerm: event.target.value })}
                    placeholder="예: ="
                    aria-label="용어와 뜻 사이 구분자"
                    className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-sm font-bold outline-none focus:border-sky-400"
                  />
                )}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-xs font-black text-slate-500">카드와 카드 사이</legend>
              <div className="flex flex-wrap gap-1.5">
                {ROW_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateFormat({ row: option.id })}
                    aria-pressed={format.row === option.id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${format.row === option.id ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {option.label}
                  </button>
                ))}
                {format.row === 'custom' && (
                  <input
                    value={format.customRow ?? ''}
                    onChange={(event) => updateFormat({ customRow: event.target.value })}
                    placeholder="예: /"
                    aria-label="카드와 카드 사이 구분자"
                    className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-sm font-bold outline-none focus:border-sky-400"
                  />
                )}
              </div>
            </fieldset>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
              <span>미리 보기 · {cards.length}장</span>
              {incomplete > 0 && <span className="text-xs font-bold text-amber-600">뜻이나 용어가 빈 카드 {incomplete}장</span>}
            </div>
            <div className="min-h-[160px] flex-1 overflow-y-auto rounded-xl border border-slate-200">
              {cards.length === 0 ? (
                <p className="p-4 text-sm font-medium text-slate-400">붙여 넣으면 여기에 카드가 보여요.</p>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {cards.slice(0, 200).map((card, index) => (
                    <li key={index} className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-3 py-2 text-sm">
                      <span className="font-bold text-slate-400">{index + 1}</span>
                      <span className={`break-words font-bold ${card.term ? 'text-slate-900' : 'text-amber-500'}`}>{card.term || '(용어 없음)'}</span>
                      <span className={`break-words ${card.definition ? 'text-slate-600' : 'text-amber-500'}`}>{card.definition || '(뜻 없음)'}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            취소
          </button>
          <button
            type="button"
            disabled={cards.length === 0}
            onClick={() => onImport(cards)}
            className="h-11 rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600 disabled:opacity-50"
          >
            카드 {cards.length}장 넣기
          </button>
        </div>
      </div>
    </div>
  )
}
