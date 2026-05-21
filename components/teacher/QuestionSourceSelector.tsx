'use client'

import { motion } from 'framer-motion'
import { Pencil, FileText, Youtube, ScanLine } from 'lucide-react'

type SourceType = 'topic' | 'youtube' | 'file' | 'exam'
type SourceTone = 'sky' | 'cyan' | 'rose' | 'amber'

interface QuestionSourceSelectorProps {
  sourceType: SourceType | null
  setSourceType: (type: SourceType) => void
  topic: string
  setTopic: (value: string) => void
  youtubeUrl: string
  setYoutubeUrl: (value: string) => void
  file: File | null
  setFile: (file: File | null) => void
  examFile: File | null
  setExamFile: (file: File | null) => void
}

export default function QuestionSourceSelector({
  sourceType,
  setSourceType,
  topic,
  setTopic,
  youtubeUrl,
  setYoutubeUrl,
  file,
  setFile,
  examFile,
  setExamFile,
}: QuestionSourceSelectorProps) {
  const sourceOptions: Array<{
    id: SourceType
    title: string
    description: string
    helper: string
    icon: typeof Pencil
    tone: SourceTone
    badge: string | null
  }> = [
    {
      id: 'topic' as const,
      title: '주제 입력',
      description: '수업 주제만 적고 초안을 빠르게 만듭니다',
      helper: '예: 초5 도형의 넓이',
      icon: Pencil,
      tone: 'sky',
      badge: null,
    },
    {
      id: 'file' as const,
      title: '자료 파일',
      description: 'PDF, 문서, PPT, 텍스트 자료를 문제로 바꿉니다',
      helper: 'PDF, DOCX, PPTX, PPT, TXT, CSV',
      icon: FileText,
      tone: 'cyan',
      badge: null,
    },
    {
      id: 'youtube' as const,
      title: '영상 자막',
      description: '자막이 있는 영상에서 핵심 내용을 뽑습니다',
      helper: '자막 있는 영상 지원',
      icon: Youtube,
      tone: 'rose',
      badge: 'Beta',
    },
    {
      id: 'exam' as const,
      title: '시험지 스캔',
      description: '시험지나 문제지 이미지를 그대로 가져옵니다',
      helper: 'PDF, JPG, PNG',
      icon: ScanLine,
      tone: 'amber',
      badge: 'New',
    },
  ]

  const toneClasses = {
    sky: {
      active: 'border-sky-400 bg-sky-50',
      icon: 'bg-sky-100 text-sky-700',
      focus: 'focus:border-sky-400 focus:ring-sky-100',
      selected: 'bg-sky-500',
      text: 'text-sky-700',
    },
    cyan: {
      active: 'border-cyan-400 bg-cyan-50',
      icon: 'bg-cyan-100 text-cyan-700',
      focus: 'focus:border-cyan-400 focus:ring-cyan-100',
      selected: 'bg-cyan-500',
      text: 'text-cyan-700',
    },
    rose: {
      active: 'border-rose-400 bg-rose-50',
      icon: 'bg-rose-100 text-rose-700',
      focus: 'focus:border-rose-400 focus:ring-rose-100',
      selected: 'bg-rose-500',
      text: 'text-rose-700',
    },
    amber: {
      active: 'border-amber-400 bg-amber-50',
      icon: 'bg-amber-100 text-amber-700',
      focus: 'focus:border-amber-400 focus:ring-amber-100',
      selected: 'bg-amber-500',
      text: 'text-amber-700',
    },
  }

  const renderInput = (id: SourceType) => {
    if (id === 'topic') {
      return (
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: 초5 도형의 넓이"
          className={`mt-4 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none ring-2 ring-transparent transition ${toneClasses.sky.focus}`}
          onClick={(e) => e.stopPropagation()}
        />
      )
    }

    if (id === 'file') {
      return (
        <div className="mt-4 space-y-2">
          <input
            type="file"
            accept=".pdf,.txt,.csv,.docx,.ppt,.pptx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent transition ${toneClasses.cyan.focus}`}
            onClick={(e) => e.stopPropagation()}
          />
          {file && <p className="truncate text-sm font-black text-cyan-700">선택됨: {file.name}</p>}
        </div>
      )
    }

    if (id === 'youtube') {
      return (
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className={`mt-4 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none ring-2 ring-transparent transition ${toneClasses.rose.focus}`}
          onClick={(e) => e.stopPropagation()}
        />
      )
    }

    return (
      <div className="mt-4 space-y-2">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setExamFile(e.target.files?.[0] || null)}
          className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent transition ${toneClasses.amber.focus}`}
          onClick={(e) => e.stopPropagation()}
        />
        {examFile && <p className="truncate text-sm font-black text-amber-700">선택됨: {examFile.name}</p>}
      </div>
    )
  }

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2">
      {sourceOptions.map((option) => {
        const Icon = option.icon
        const tone = toneClasses[option.tone]
        const isActive = sourceType === option.id

        return (
          <motion.div
            key={option.id}
            role="button"
            tabIndex={0}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSourceType(option.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setSourceType(option.id)
              }
            }}
            className={`relative min-h-[178px] rounded-lg border bg-white p-5 text-left shadow-sm transition ${
              isActive ? `${tone.active} shadow-md` : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">{option.title}</h3>
                  {option.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-black text-white ${tone.selected}`}>
                      {option.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{option.description}</p>
                {!isActive && <p className={`mt-4 text-sm font-black ${tone.text}`}>{option.helper}</p>}
              </div>
              <span className={`mt-1 h-3 w-3 rounded-full border ${
                isActive ? `${tone.selected} border-transparent` : 'border-slate-300'
              }`} />
            </div>
            {isActive && renderInput(option.id)}
          </motion.div>
        )
      })}
    </div>
  )
}
