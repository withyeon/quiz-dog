'use client'

import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { Check, Folder, FolderOpen, FolderPlus, Inbox, Layers, X } from 'lucide-react'
import {
  FOLDER_NAME_MAX_LENGTH,
  validateFolderName,
  type QuestionSetFolder,
} from '@/lib/services/questionSetFolders'

/** 'all' = 전체, 'none' = 폴더 없음, 그 밖은 폴더 id */
export type FolderFilter = 'all' | 'none' | string

/** 목록 줄을 끌어 폴더 칩에 놓을 때 쓰는 dataTransfer 형식 */
export const SET_DRAG_TYPE = 'application/x-quizdog-set-id'

function hasDraggedSet(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(SET_DRAG_TYPE)
}

/**
 * 문제집 목록 위의 폴더 줄. 칩을 누르면 그 폴더만 보이고,
 * 데스크톱에서는 문제집 줄을 끌어다 칩에 놓으면 그 폴더로 옮겨진다.
 */
export function FolderBar({
  folders,
  counts,
  totalCount,
  unfiledCount,
  selected,
  onSelect,
  onCreate,
  onDropSet,
}: {
  folders: QuestionSetFolder[]
  counts: Map<string, number>
  totalCount: number
  unfiledCount: number
  selected: FolderFilter
  onSelect: (filter: FolderFilter) => void
  onCreate: () => void
  onDropSet: (setId: string, folderId: string | null) => void
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const chips: { key: FolderFilter; label: string; count: number; droppable: boolean }[] = [
    { key: 'all', label: '전체', count: totalCount, droppable: false },
    ...folders.map((folder) => ({ key: folder.id, label: folder.name, count: counts.get(folder.id) ?? 0, droppable: true })),
    // 폴더가 하나라도 있어야 '폴더 없음'이 의미가 있다
    ...(folders.length > 0 ? [{ key: 'none', label: '폴더 없음', count: unfiledCount, droppable: true }] : []),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const active = selected === chip.key
        const hovering = dropTarget === chip.key
        const Icon = chip.key === 'all' ? Layers : chip.key === 'none' ? Inbox : active ? FolderOpen : Folder
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onSelect(chip.key)}
            onDragOver={chip.droppable ? (event) => {
              if (!hasDraggedSet(event)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDropTarget(chip.key)
            } : undefined}
            onDragLeave={chip.droppable ? () => setDropTarget((prev) => (prev === chip.key ? null : prev)) : undefined}
            onDrop={chip.droppable ? (event) => {
              const setId = event.dataTransfer.getData(SET_DRAG_TYPE)
              setDropTarget(null)
              if (!setId) return
              event.preventDefault()
              onDropSet(setId, chip.key === 'none' ? null : chip.key)
            } : undefined}
            aria-pressed={active}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${
              hovering
                ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-400'
                : active
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{chip.label}</span>
            <span className={`text-xs font-black ${active && !hovering ? 'text-sky-100' : 'text-slate-400'}`}>{chip.count}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-bold text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
      >
        <FolderPlus className="h-4 w-4" />
        새 폴더
      </button>
    </div>
  )
}

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 새 폴더 만들기·이름 바꾸기 창. onSubmit 이 실패하면 창을 닫지 않고 오류를 보여 준다. */
export function FolderNameDialog({
  title,
  confirmLabel,
  initialName = '',
  folders,
  exceptId,
  onSubmit,
  onClose,
}: {
  title: string
  confirmLabel: string
  initialName?: string
  folders: QuestionSetFolder[]
  exceptId?: string
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const problem = validateFolderName(name, folders, exceptId)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    try {
      await onSubmit(name)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '저장하지 못했어요.')
      setSaving(false)
    }
  }

  return (
    <DialogShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <input
          autoFocus
          value={name}
          maxLength={FOLDER_NAME_MAX_LENGTH + 10}
          onChange={(event) => { setName(event.target.value); setError(null) }}
          placeholder="예: 3학년 2학기 수학"
          aria-label="폴더 이름"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
        />
        {error && <p className="mt-2 text-sm font-semibold text-rose-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? '저장 중…' : confirmLabel}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

/** 문제집 하나를 옮길 폴더를 고르는 창. 여기서 바로 새 폴더를 만들어 옮길 수도 있다. */
export function MoveToFolderDialog({
  setTitle,
  currentFolderId,
  folders,
  onMove,
  onCreateAndMove,
  onClose,
}: {
  setTitle: string
  currentFolderId: string | null
  folders: QuestionSetFolder[]
  onMove: (folderId: string | null) => Promise<void>
  onCreateAndMove: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [creating, setCreating] = useState(folders.length === 0)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (task: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await task()
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : '옮기지 못했어요.')
      setBusy(false)
    }
  }

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    const problem = validateFolderName(name, folders)
    if (problem) {
      setError(problem)
      return
    }
    void run(() => onCreateAndMove(name))
  }

  const options: { id: string | null; label: string }[] = [
    ...folders.map((folder) => ({ id: folder.id, label: folder.name })),
    ...(folders.length > 0 ? [{ id: null, label: '폴더 없음' }] : []),
  ]

  return (
    <DialogShell title="폴더로 옮기기" onClose={onClose}>
      <p className="-mt-2 mb-4 truncate text-sm font-medium text-slate-500">{setTitle}</p>

      {options.length > 0 && (
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {options.map((option) => {
            const current = option.id === currentFolderId
            const Icon = option.id === null ? Inbox : Folder
            return (
              <button
                key={option.id ?? 'none'}
                type="button"
                disabled={busy || current}
                onClick={() => void run(() => onMove(option.id))}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition ${
                  current
                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                    : 'border-slate-200 text-slate-700 hover:border-sky-200 hover:bg-sky-50 disabled:opacity-60'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {current && (
                  <span className="inline-flex items-center gap-1 text-xs font-black">
                    <Check className="h-3.5 w-3.5" />
                    지금 여기
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {creating ? (
        <form onSubmit={handleCreate} className={options.length > 0 ? 'mt-4 border-t border-slate-100 pt-4' : ''}>
          <label className="mb-2 block text-xs font-black text-slate-500">새 폴더를 만들어 옮기기</label>
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              maxLength={FOLDER_NAME_MAX_LENGTH + 10}
              onChange={(event) => { setName(event.target.value); setError(null) }}
              placeholder="폴더 이름"
              aria-label="새 폴더 이름"
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="submit"
              disabled={busy}
              className="whitespace-nowrap rounded-xl bg-sky-600 px-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              만들고 옮기기
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
        >
          <FolderPlus className="h-4 w-4" />
          새 폴더 만들기
        </button>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
    </DialogShell>
  )
}
