'use client'

import { FileText, Pencil, ScanLine, Youtube, type LucideIcon } from 'lucide-react'
import FileDropzone from '@/components/teacher/FileDropzone'
import { toast } from '@/components/ui/Toaster'

export type SourceType = 'topic' | 'file' | 'youtube' | 'exam'

type SourceOption = {
  id: SourceType
  title: string
  caption: string
  icon: LucideIcon
  iconClass: string
  badge: string | null
}

export const SOURCE_OPTIONS: SourceOption[] = [
  { id: 'topic', title: '주제', caption: '배울 단원이나 내용을 적어요', icon: Pencil, iconClass: 'bg-sky-100 text-sky-600', badge: null },
  { id: 'file', title: '수업 자료', caption: 'PDF · PPT · DOCX · TXT 파일', icon: FileText, iconClass: 'bg-emerald-100 text-emerald-600', badge: null },
  { id: 'youtube', title: '유튜브 영상', caption: '자막이 있는 영상 링크', icon: Youtube, iconClass: 'bg-rose-100 text-rose-600', badge: '베타' },
  { id: 'exam', title: '종이 시험지', caption: '사진 · 스캔 PDF 속 문제를 옮겨요', icon: ScanLine, iconClass: 'bg-amber-100 text-amber-600', badge: null },
]

export function getSourceOption(id: SourceType): SourceOption {
  return SOURCE_OPTIONS.find((option) => option.id === id) ?? SOURCE_OPTIONS[0]
}

// 처음 써 보는 선생님이 "뭘 적어야 하지?" 하고 멈추지 않게, 눌러서 바로 채울 수 있는 예시
const TOPIC_EXAMPLES = [
  '초4 과학 물의 상태 변화',
  '초5 수학 분수의 덧셈과 뺄셈',
  '초6 사회 조선의 건국',
  '초3 국어 속담의 뜻',
  '중1 과학 광합성',
  '중2 영어 과거형 동사',
]

interface SourcePickerProps {
  sourceType: SourceType
  onSelect: (type: SourceType) => void
  topic: string
  setTopic: (value: string) => void
  youtubeUrl: string
  setYoutubeUrl: (value: string) => void
  file: File | null
  setFile: (file: File | null) => void
  examFile: File | null
  setExamFile: (file: File | null) => void
  disabled?: boolean
}

const inputClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50'

/**
 * 1단계 — 무엇으로 문제를 만들지 고르고 그 자료를 넣는 곳.
 * 네 방식을 한 줄 타일로 두고 아래 한 패널만 바뀌게 해서, 카드 안에서 입력칸이 튀어나오던 것을 없앴다.
 */
export default function SourcePicker({
  sourceType,
  onSelect,
  topic,
  setTopic,
  youtubeUrl,
  setYoutubeUrl,
  file,
  setFile,
  examFile,
  setExamFile,
  disabled = false,
}: SourcePickerProps) {
  return (
    <div>
      <div role="tablist" aria-label="문제를 만들 자료" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOURCE_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = sourceType === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => onSelect(option.id)}
              className={`relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left transition sm:p-3.5 ${
                active
                  ? 'border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-100'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${option.iconClass}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className={`break-keep text-sm font-black ${active ? 'text-sky-800' : 'text-slate-800'}`}>{option.title}</span>
                  {option.badge && (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-black text-white">{option.badge}</span>
                  )}
                </span>
                <span className="mt-0.5 block break-keep text-xs font-medium leading-5 text-slate-500">{option.caption}</span>
              </span>
              {active && (
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        {sourceType === 'topic' && (
          <div>
            <label htmlFor="create-topic" className="mb-2 block text-sm font-bold text-slate-700">
              무엇을 배우나요?
            </label>
            <input
              id="create-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 120))}
              placeholder="예: 초4 과학 물의 상태 변화"
              className={inputClass}
              disabled={disabled}
              autoComplete="off"
            />
            <p className="mt-2 break-keep text-xs font-medium leading-5 text-slate-500">
              학년 · 과목 · 단원명을 함께 적으면 훨씬 정확해져요. 꼭 다룰 개념이 있으면 뒤에 덧붙여 주세요.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TOPIC_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTopic(example)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                    topic === example
                      ? 'border-sky-400 bg-sky-100 text-sky-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'
                  }`}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {sourceType === 'file' && (
          <div>
            <p className="text-sm font-bold text-slate-700">수업 자료 올리기</p>
            <p className="mt-1 break-keep text-xs font-medium leading-5 text-slate-500">
              글자가 들어 있는 파일이어야 해요. 사진으로 찍은 자료는 <span className="font-bold text-slate-700">종이 시험지 옮기기</span>를 써 주세요.
            </p>
            <FileDropzone
              file={file}
              onSelect={setFile}
              accept=".pdf,.txt,.csv,.docx,.ppt,.pptx"
              hint="PDF · DOCX · PPTX · PPT · TXT · CSV"
              tone="sky"
              disabled={disabled}
              onError={(msg) => toast.error(msg)}
            />
          </div>
        )}

        {sourceType === 'youtube' && (
          <div>
            <label htmlFor="create-youtube" className="mb-2 block text-sm font-bold text-slate-700">
              영상 링크
            </label>
            <input
              id="create-youtube"
              type="url"
              inputMode="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value.trim())}
              placeholder="https://youtube.com/watch?v=..."
              className={inputClass}
              disabled={disabled}
              autoComplete="off"
            />
            <p className="mt-2 break-keep text-xs font-medium leading-5 text-slate-500">
              자막(자동 생성 포함)이 있는 공개 영상만 돼요. 영상 속 설명을 바탕으로 문제를 만들고, 영상 화면은 쓰지 않아요.
            </p>
          </div>
        )}

        {sourceType === 'exam' && (
          <div>
            <p className="text-sm font-bold text-slate-700">시험지 사진이나 스캔 파일 올리기</p>
            <p className="mt-1 break-keep text-xs font-medium leading-5 text-slate-500">
              문제 · 보기 · 정답 표시를 그대로 옮기고, 그림이 있으면 잘라서 붙여요. 글자가 또렷하게 보이는 사진일수록 잘 읽어요.
            </p>
            <FileDropzone
              file={examFile}
              onSelect={setExamFile}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              hint="PDF · JPG · PNG · WEBP"
              tone="amber"
              disabled={disabled}
              onError={(msg) => toast.error(msg)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
