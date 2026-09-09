'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2, Users, RefreshCw, BrushCleaning } from 'lucide-react'
import { fetchAdminJson, fetchAdmin } from '@/lib/admin/fetchAdmin'
import { getGameModeConfig } from '@/lib/game/modes'
import { toast } from '@/components/ui/Toaster'

interface Session {
  roomCode: string
  status: string
  gameMode: string | null
  setTitle: string | null
  playerCount: number
  createdAt: string
  startedAt: string | null
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  waiting: { label: '대기 중', cls: 'bg-amber-50 text-amber-600' },
  playing: { label: '진행 중', cls: 'bg-emerald-50 text-emerald-600' },
  paused: { label: '일시정지', cls: 'bg-sky-50 text-sky-600' },
  finished: { label: '종료', cls: 'bg-slate-100 text-slate-500' },
  ended: { label: '종료', cls: 'bg-slate-100 text-slate-500' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [sweeping, setSweeping] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchAdminJson<{ sessions: Session[] }>(`/api/admin/sessions${activeOnly ? '?active=1' : ''}`)
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false))
  }, [activeOnly])

  useEffect(() => {
    load()
  }, [load])

  // 선생님이 종료를 안 누르고 탭을 닫은 방을 즉시 정리한다.
  // (목록을 열 때도 자동으로 도는 작업이지만, 결과를 눈으로 확인하고 싶을 때 쓴다)
  const sweepStale = async () => {
    setSweeping(true)
    try {
      const data = await fetchAdminJson<{ expiredCount: number; skippedLive: string[] }>(
        '/api/cron/expire-rooms',
        { method: 'POST' },
      )
      if (data.expiredCount > 0) {
        toast.success(`방치된 방 ${data.expiredCount}개를 종료 처리했습니다.`)
      } else {
        toast.success('정리할 방치된 방이 없습니다.')
      }
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '정리에 실패했습니다.')
    } finally {
      setSweeping(false)
    }
  }

  const remove = async (roomCode: string) => {
    if (!confirm(`'${roomCode}' 게임 룸과 참여자 데이터를 삭제할까요?`)) return
    setDeleting(roomCode)
    try {
      const res = await fetchAdmin('/api/admin/sessions', {
        method: 'DELETE',
        body: JSON.stringify({ roomCode }),
      })
      if (!res.ok) throw new Error()
      setSessions((prev) => prev.filter((s) => s.roomCode !== roomCode))
      toast.success('삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">게임 / 세션</h1>
          <p className="mt-1 text-sm text-slate-500">최근 게임 룸 {sessions.length}개</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            진행 중만
          </label>
          <button
            onClick={sweepStale}
            disabled={sweeping}
            title="3시간 이상 방치된 대기방, 6시간 이상 방치된 진행 중 게임을 종료 처리합니다. 학생이 활동 중인 방은 건드리지 않습니다."
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {sweeping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrushCleaning className="h-4 w-4" />
            )}
            방치된 방 정리
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          표시할 게임 룸이 없습니다.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => {
            const st = STATUS_STYLE[s.status] ?? { label: s.status, cls: 'bg-slate-100 text-slate-500' }
            const mode = s.gameMode ? getGameModeConfig(s.gameMode) : null
            return (
              <div key={s.roomCode} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold tracking-wider text-slate-900">
                    {s.roomCode}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{mode?.label ?? '게임 모드 미지정'}</p>
                {s.setTitle && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">📚 {s.setTitle}</p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Users className="h-4 w-4 text-slate-400" />
                    {s.playerCount}명
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(s.createdAt)}</span>
                </div>
                <button
                  onClick={() => remove(s.roomCode)}
                  disabled={deleting === s.roomCode}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting === s.roomCode ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      정리
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
