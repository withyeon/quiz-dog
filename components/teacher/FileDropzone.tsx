'use client'

import { useRef, useState, type DragEvent } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, FileText, X } from 'lucide-react'

type Tone = 'sky' | 'cyan' | 'rose' | 'amber'

interface FileDropzoneProps {
  /** 현재 선택된 파일 */
  file: File | null
  onSelect: (file: File | null) => void
  /** accept 속성 (예: '.pdf,.docx,.pptx') */
  accept: string
  /** 허용 확장자 안내 문구 */
  hint: string
  /** 최대 크기 (MB). 초과 시 onError 호출 */
  maxSizeMb?: number
  onError?: (message: string) => void
  tone?: Tone
  disabled?: boolean
}

const TONE: Record<Tone, { drag: string; icon: string; accent: string }> = {
  sky: { drag: 'border-sky-400 bg-sky-50', icon: 'text-sky-500', accent: 'text-sky-700' },
  cyan: { drag: 'border-cyan-400 bg-cyan-50', icon: 'text-cyan-600', accent: 'text-cyan-700' },
  rose: { drag: 'border-rose-400 bg-rose-50', icon: 'text-rose-500', accent: 'text-rose-700' },
  amber: { drag: 'border-amber-400 bg-amber-50', icon: 'text-amber-600', accent: 'text-amber-700' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 드래그&드롭 + 클릭 업로드 지원 파일 선택기.
 * 외부 라이브러리 없이 네이티브 DnD로 구현해 의존성을 늘리지 않는다.
 */
export default function FileDropzone({
  file,
  onSelect,
  accept,
  hint,
  maxSizeMb = 12,
  onError,
  tone = 'sky',
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const t = TONE[tone]

  const acceptExtensions = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const isAccepted = (candidate: File): boolean => {
    if (acceptExtensions.length === 0) return true
    const name = candidate.name.toLowerCase()
    return acceptExtensions.some((ext) => name.endsWith(ext))
  }

  const handleFile = (candidate: File | null | undefined) => {
    if (!candidate) return
    if (!isAccepted(candidate)) {
      onError?.(`지원하지 않는 형식이에요. (${hint})`)
      return
    }
    if (candidate.size > maxSizeMb * 1024 * 1024) {
      onError?.(`파일이 너무 커요. 최대 ${maxSizeMb}MB까지 올릴 수 있어요.`)
      return
    }
    onSelect(candidate)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    handleFile(e.dataTransfer.files?.[0])
  }

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  // 파일이 선택된 상태: 파일 카드 표시
  if (file) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 ${t.icon}`}>
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{file.name}</p>
          <p className="text-xs font-semibold text-slate-500">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
          aria-label="파일 제거"
        >
          <X className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <motion.div
      whileTap={disabled ? undefined : { scale: 0.995 }}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        openPicker()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`mt-4 flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
        isDragging ? t.drag : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/60'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <UploadCloud className={`mb-2 h-8 w-8 ${isDragging ? t.icon : 'text-slate-400'}`} />
      <p className="text-sm font-black text-slate-700">
        {isDragging ? '여기에 놓아주세요' : '파일을 끌어다 놓거나 클릭해서 선택'}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{hint} · 최대 {maxSizeMb}MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled}
      />
    </motion.div>
  )
}
