import { BookOpen } from 'lucide-react'

type QuizSetNameProps = {
  /** useGameBase의 questionSetTitle. 없으면 아무것도 그리지 않는다 */
  title: string | null | undefined
  /** 헤더 배경이 어두운 게임(마피아·좀비 등)에서 밝은 글씨로 */
  tone?: 'light' | 'dark'
  className?: string
}

/**
 * 게임 화면 헤더에 지금 푸는 문제집 이름을 띄운다.
 * 학생이 "무슨 퀴즈를 하는 중인지" 게임 중에도 알 수 있게 하는 용도.
 */
export default function QuizSetName({ title, tone = 'light', className = '' }: QuizSetNameProps) {
  if (!title) return null

  const toneClass =
    tone === 'dark'
      ? 'border-white/20 bg-white/10 text-white/90'
      : 'border-slate-200 bg-white/80 text-slate-600'

  return (
    <div
      title={title}
      className={`flex min-w-0 max-w-[220px] items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold sm:max-w-[280px] sm:text-xs ${toneClass} ${className}`}
    >
      <BookOpen className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate">{title}</span>
    </div>
  )
}
