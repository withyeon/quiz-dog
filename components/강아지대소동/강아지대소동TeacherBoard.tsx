'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCodeSVG from 'react-qr-code'
import { motion } from 'framer-motion'
import EventOverlay from '@/components/강아지대소동/EventOverlay'
import { DUMMY_QUESTIONS } from '@/lib/game/강아지대소동'
import { createPuppyChaosEvent, type PuppyChaosEvent } from '@/lib/services/강아지대소동Events'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

type PuppyChaosTeacherBoardProps = {
  room: Room
  players: Player[]
  events: PuppyChaosEvent[]
  onPause?: () => void
  onResume?: () => void
  onEnd?: () => void
  onKick?: (playerId: string) => void
}

function PomeMascot({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <img
      src="/mascot_pome.png"
      alt="퀴즈독 마스코트"
      className={`inline-block object-contain drop-shadow-sm ${className}`}
    />
  )
}

export default function PuppyChaosTeacherBoard({
  room,
  players,
  events,
  onPause,
  onResume,
  onEnd,
  onKick,
}: PuppyChaosTeacherBoardProps) {
  const previousLeaderRef = useRef<string | null>(null)
  const [overlayEvent, setOverlayEvent] = useState<PuppyChaosEvent | null>(null)
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/${room.room_code}` : ''

  const activePlayers = useMemo(
    () => players.filter((player) => !player.is_kicked),
    [players],
  )

  const sortedPlayers = useMemo(
    () => [...activePlayers].sort((a, b) => {
      const scoreCompare = (b.score ?? 0) - (a.score ?? 0)
      if (scoreCompare !== 0) return scoreCompare
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
    }),
    [activePlayers],
  )

  useEffect(() => {
    const latest = events[0]
    if (!latest) return
    setOverlayEvent(latest)
    const timer = window.setTimeout(() => setOverlayEvent(null), latest.type === 'legendary' ? 2200 : 1500)
    return () => window.clearTimeout(timer)
  }, [events])

  useEffect(() => {
    const leader = sortedPlayers[0]
    if (!leader || room.status !== 'playing') return
    if (!previousLeaderRef.current) {
      previousLeaderRef.current = leader.id
      return
    }
    if (previousLeaderRef.current === leader.id) return
    previousLeaderRef.current = leader.id
    void createPuppyChaosEvent({
      session_id: room.room_code,
      type: 'rank_change',
      actor_nickname: leader.nickname,
      payload: { score: leader.score ?? 0 },
    }).catch(() => {})
  }, [room.room_code, room.status, sortedPlayers])

  return (
    <div className="relative min-h-[720px] overflow-hidden rounded-[28px] border-4 border-slate-950 bg-[#F8FAFC] p-4 shadow-[8px_8px_0_#0f172a] sm:p-6">
      <EventOverlay event={overlayEvent} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <div className="text-lg font-black text-sky-700">강아지 대소동</div>
          <h2 className="text-4xl font-black text-slate-950 sm:text-5xl">대소동을 버텨라!</h2>
          <div className="mt-3 flex gap-3 text-sm font-bold text-slate-600">
            <span>방 코드 {room.room_code}</span>
            <span>참가 {activePlayers.length}명</span>
            <span>상태 {room.status}</span>
          </div>
        </div>

        <div className="w-fit rounded-3xl border-4 border-slate-950 bg-white p-3 shadow-[4px_4px_0_#0f172a]">
          <QRCodeSVG value={inviteUrl} size={110} level="M" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[24px] border-4 border-slate-950 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-950">실시간 순위</h3>
            <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-black text-sky-700">
              퀴즈 70% · 미니게임 30%
            </span>
          </div>

          <div className="space-y-3">
            {sortedPlayers.map((player, index) => {
              const rankTone = index === 0
                ? 'bg-amber-100 border-amber-500'
                : index === 1
                  ? 'bg-slate-100 border-slate-400'
                  : index === 2
                    ? 'bg-orange-100 border-orange-500'
                    : 'bg-white border-slate-200'
              return (
                <motion.div
                  layout
                  key={player.id}
                  className={`grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-2xl border-4 px-3 py-3 sm:grid-cols-[64px_minmax(0,1fr)_120px_96px] sm:items-center sm:px-4 ${rankTone}`}
                >
                  <div className="text-3xl font-black text-slate-950">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2 truncate text-2xl font-black text-slate-950">
                      <PomeMascot className="h-9 w-9 flex-shrink-0" />
                      <span className="truncate">{player.nickname}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-500">
                      {player.combo_count ?? 0}콤보
                    </div>
                  </div>
                  <div className="col-start-2 text-left text-2xl font-black text-slate-950 sm:col-start-auto sm:text-right sm:text-3xl">
                    {(player.score ?? 0).toLocaleString()}
                  </div>
                  <div className="col-start-2 text-left text-sm font-black text-slate-600 sm:col-start-auto sm:text-right">
                    {Math.min((player.current_question_index ?? 0) + 1, DUMMY_QUESTIONS.length)}/{DUMMY_QUESTIONS.length}
                  </div>
                </motion.div>
              )
            })}

            {sortedPlayers.length === 0 && (
              <div className="rounded-2xl border-4 border-dashed border-slate-300 p-12 text-center text-2xl font-black text-slate-400">
                학생 입장을 기다리는 중
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[24px] border-4 border-slate-950 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
            <h3 className="mb-4 text-2xl font-black text-slate-950">진행률</h3>
            <div className="space-y-3">
              {activePlayers.map((player) => {
                const progress = Math.min(100, ((player.current_question_index ?? 0) / DUMMY_QUESTIONS.length) * 100)
                return (
                  <div key={player.id}>
                    <div className="mb-1 flex justify-between text-sm font-black text-slate-600">
                      <span>{player.nickname}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[24px] border-4 border-slate-950 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
            <h3 className="mb-4 text-2xl font-black text-slate-950">교사 통제</h3>
            <div className="grid gap-3">
              {room.status === 'paused' ? (
                <button type="button" onClick={onResume} className="rounded-2xl border-4 border-slate-950 bg-emerald-400 py-3 text-xl font-black shadow-[3px_3px_0_#0f172a]">
                  다시 시작
                </button>
              ) : (
                <button type="button" onClick={onPause} className="rounded-2xl border-4 border-slate-950 bg-amber-300 py-3 text-xl font-black shadow-[3px_3px_0_#0f172a]">
                  일시정지
                </button>
              )}
              <button type="button" onClick={onEnd} className="rounded-2xl border-4 border-slate-950 bg-rose-400 py-3 text-xl font-black text-white shadow-[3px_3px_0_#0f172a]">
                강제 종료
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border-4 border-slate-950 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
            <h3 className="mb-4 text-2xl font-black text-slate-950">학생 관리</h3>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {activePlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="truncate font-black text-slate-700">{player.nickname}</span>
                  <button type="button" onClick={() => onKick?.(player.id)} className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-black text-white">
                    강퇴
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
