'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, RefreshCw, X } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { uploadQuestionImage } from '@/lib/services/questionImages'
import { QUESTION_IMAGE_ACCEPT } from '@/lib/quiz/questionImage'

interface QuestionImageFieldProps {
  value: string | null | undefined
  onChange: (url: string | null) => void
  /** 카드 안에서 작게 쓸 때 */
  compact?: boolean
}

/**
 * 문제 편집기의 "그림 넣기" 칸. 파일 선택·드래그 앤 드롭·붙여넣기(Ctrl+V)를 받는다.
 * 올리는 동안은 버튼을 잠그고, 성공하면 부모에 URL을 넘긴다.
 */
export default function QuestionImageField({ value, onChange, compact = false }: QuestionImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const upload = async (file: File | null | undefined) => {
    if (!file || uploading) return
    setUploading(true)
    try {
      const url = await uploadQuestionImage(file)
      onChange(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '그림 업로드에 실패했어요.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const pickFile = () => {
    if (!uploading) inputRef.current?.click()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) {
      e.preventDefault()
      void upload(file)
    }
  }

  return (
    <div onPaste={onPaste}>
      <input
        ref={inputRef}
        type="file"
        accept={QUESTION_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />

      {value ? (
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={pickFile}
            title="클릭해서 다른 그림으로 바꾸기"
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="문제 그림"
              className={`${compact ? 'max-h-28' : 'max-h-44'} w-auto max-w-full object-contain`}
            />
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
              </span>
            )}
          </button>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={pickFile}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              바꾸기
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              지우기
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void upload(e.dataTransfer.files?.[0])
          }}
          className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 text-left transition ${
            compact ? 'py-2.5' : 'py-3'
          } ${
            dragging
              ? 'border-sky-400 bg-sky-50'
              : 'border-slate-200 bg-slate-50/60 hover:border-sky-300 hover:bg-sky-50/40'
          } disabled:opacity-60`}
        >
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-white text-sky-500 shadow-sm">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-700">
              {uploading ? '그림을 올리는 중…' : '그림 넣기 (선택)'}
            </span>
            <span className="block text-xs font-semibold text-slate-400">
              지도·도형·사진을 붙이면 학생 화면에 문제와 함께 보여요. 끌어다 놓거나 붙여넣기도 돼요.
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
