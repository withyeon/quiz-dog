'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatTime } from '@/lib/utils/formatTime'

interface GameTimeBadgeProps {
  /** room.started_at (ISO 문자열) */
  startedAt?: string | null
  /** room.duration_seconds (선생님이 정한 전체 제한 시간, 초) */
  durationSeconds?: number | null
  /** room.status — 'playing'일 때만 표시 */
  status?: string | null
  /** 위치 미세 조정용 추가 클래스 (예: top 값) */
  className?: string
}

/**
 * 학생(게스트) 화면 상단에 전체 남은 시간을 표시하는 공통 배지.
 * 선생님이 제한 시간(duration_seconds)을 설정하지 않았거나
 * 게임이 진행 중이 아니면 아무것도 렌더링하지 않는다 — 기존 UI를 건드리지 않도록.
 */
export default function GameTimeBadge({
  startedAt,
  durationSeconds,
  status,
  className = '',
}: GameTimeBadgeProps) {
  const enabled =
    status === 'playing' &&
    !!startedAt &&
    typeof durationSeconds === 'number' &&
    durationSeconds > 0

  const computeRemaining = () => {
    if (!enabled || !startedAt || typeof durationSeconds !== 'number') return 0
    const started = new Date(startedAt).getTime()
    const elapsed = Math.floor((Date.now() - started) / 1000)
    return Math.max(0, durationSeconds - elapsed)
  }

  const [remaining, setRemaining] = useState(computeRemaining)

  useEffect(() => {
    if (!enabled) return
    setRemaining(computeRemaining())
    const id = window.setInterval(() => setRemaining(computeRemaining()), 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, startedAt, durationSeconds])

  if (!enabled) return null

  const isUrgent = remaining <= 30

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-2 z-50 -translate-x-1/2 ${className}`}
    >
      <div
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-bitbit text-sm font-bold shadow-md backdrop-blur-sm transition-colors ${
          isUrgent
            ? 'animate-pulse border-red-300 bg-red-500/90 text-white'
            : 'border-white/40 bg-black/55 text-white'
        }`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span className="tabular-nums">{formatTime(remaining)}</span>
      </div>
    </div>
  )
}
