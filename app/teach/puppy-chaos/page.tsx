'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCodeSVG from 'react-qr-code'
import PomeMascot from '@/components/PomeMascot'
import PuppyChaosTeacherBoard from '@/components/강아지대소동/강아지대소동TeacherBoard'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { usePuppyChaosEvents } from '@/hooks/use강아지대소동Events'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomResync } from '@/hooks/useRoomResync'
import { formatServiceError } from '@/lib/services/errors'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import { assertQuestionSetHasQuestions, createRoom, finishRoom, pauseRoom, startRoom } from '@/lib/services/rooms'
import { updatePlayer } from '@/lib/services/players'
import { saveGameReportSnapshot } from '@/lib/services/reports'

export default function PuppyChaosTeacherPage() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(5)
  const autoFinishRequestedRef = useRef(false)

  const { players, refreshPlayers, applyPlayerPatch } = usePlayersRealtime({
    roomCode,
    enabled: Boolean(roomCode),
  })
  const { room, refreshRoom, applyRoomPatch } = useRoomRealtime({
    roomCode,
    enabled: Boolean(roomCode),
  })
  const { events } = usePuppyChaosEvents(roomCode, Boolean(roomCode))
  const resync = useRoomResync(refreshRoom, refreshPlayers)
  const { sendEvent, status: realtimeStatus, onlineCount } = useRoomChannel({
    roomCode,
    role: 'teacher',
    enabled: Boolean(roomCode),
    onResyncNeeded: resync,
  })

  const broadcastRoomPatch = useCallback((patch: Record<string, unknown>, reason: string) => {
    applyRoomPatch(patch)
    void sendEvent('room:patch', { patch, reason })
    void sendEvent('room:snapshot-hint', { reason })
  }, [applyRoomPatch, sendEvent])

  const handleCreateRoom = async () => {
    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      alert(configCheck.error || 'Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }

    setIsBusy(true)
    try {
      const setId = new URLSearchParams(window.location.search).get('set')
      if (!setId) {
        throw new Error('문제집에서 강아지 대소동을 선택해 시작해주세요.')
      }
      await assertQuestionSetHasQuestions(setId)
      const created = await createRoom({ setId, gameMode: 'poop_dodge' })
      setRoomCode(created.room_code)
    } catch (error) {
      alert('세션 생성에 실패했습니다: ' + formatServiceError(error))
    } finally {
      setIsBusy(false)
    }
  }

  const handleStart = async () => {
    if (!roomCode) return
    setIsBusy(true)
    try {
      if (!room?.set_id) {
        throw new Error('연결된 문제집이 없습니다. 문제집에서 다시 시작해주세요.')
      }
      await assertQuestionSetHasQuestions(room?.set_id ?? null)
      const startedAt = new Date().toISOString()
      await startRoom({ roomCode, gameMode: 'poop_dodge', durationSeconds: durationMinutes * 60 })
      broadcastRoomPatch({
        status: 'playing',
        game_mode: 'poop_dodge',
        started_at: startedAt,
        duration_seconds: durationMinutes * 60,
      }, 'poop_dodge_start')
    } catch (error) {
      alert('게임 시작에 실패했습니다: ' + formatServiceError(error))
    } finally {
      setIsBusy(false)
    }
  }

  useEffect(() => {
    if (!roomCode || !room || room.status !== 'playing' || !room.started_at || !room.duration_seconds) {
      autoFinishRequestedRef.current = false
      return
    }

    const finishByTimeLimit = async () => {
      if (autoFinishRequestedRef.current) return
      autoFinishRequestedRef.current = true

      try {
        await finishRoom(roomCode)
        broadcastRoomPatch({ status: 'finished' }, 'poop_dodge_time_up')
        void sendEvent('game:finished', {
          finishedBy: 'teacher',
          reason: 'poop_dodge_time_up',
        })
        try {
          await saveGameReportSnapshot(room, players)
        } catch (reportError) {
          console.error('강아지 대소동 결과 저장 실패:', reportError)
        }
        router.push(`/teacher/game/${roomCode}/end`)
      } catch (error) {
        autoFinishRequestedRef.current = false
        console.error('강아지 대소동 시간 종료 실패:', error)
      }
    }

    const started = new Date(room.started_at).getTime()
    const totalSeconds = Number(room.duration_seconds)
    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - started) / 1000)
      if (elapsedSeconds >= totalSeconds) void finishByTimeLimit()
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [broadcastRoomPatch, players, room, roomCode, router, sendEvent])

  const handlePause = async () => {
    if (!roomCode) return
    const remaining = room?.started_at && room.duration_seconds
      ? Math.max(1, Number(room.duration_seconds) - Math.floor((Date.now() - new Date(room.started_at).getTime()) / 1000))
      : null
    await pauseRoom(roomCode, remaining)
    broadcastRoomPatch({
      status: 'paused',
      ...(remaining != null ? { duration_seconds: remaining } : {}),
    }, 'poop_dodge_pause')
  }

  const handleResume = async () => {
    if (!roomCode) return
    const resumedDurationSeconds = room?.duration_seconds ?? durationMinutes * 60
    const startedAt = new Date().toISOString()
    await startRoom({ roomCode, gameMode: 'poop_dodge', durationSeconds: resumedDurationSeconds })
    broadcastRoomPatch({
      status: 'playing',
      started_at: startedAt,
      duration_seconds: resumedDurationSeconds,
    }, 'poop_dodge_resume')
  }

  const handleEnd = async () => {
    if (!roomCode) return
    await finishRoom(roomCode)
    broadcastRoomPatch({ status: 'finished' }, 'poop_dodge_end')
    void sendEvent('game:finished', { finishedBy: 'teacher', reason: 'poop_dodge_end' })
    try {
      if (room) await saveGameReportSnapshot(room, players)
    } catch (reportError) {
      console.error('강아지 대소동 결과 저장 실패:', reportError)
    }
    router.push(`/teacher/game/${roomCode}/end`)
  }

  const handleKick = async (playerId: string) => {
    await updatePlayer(playerId, { is_kicked: true, is_online: false })
    applyPlayerPatch(playerId, { is_kicked: true, is_online: false })
    void sendEvent('player:patch', {
      playerId,
      patch: { is_kicked: true, is_online: false },
      reason: 'poop_dodge_kick',
    })
  }

  const inviteUrl = typeof window !== 'undefined' && roomCode
    ? `${window.location.origin}/play/${roomCode}`
    : ''

  return (
    <main className="min-h-dvh bg-[#E0F2FE] p-5 text-slate-950" style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}>
      <div className="mx-auto max-w-7xl">
        {!roomCode || !room ? (
          <section className="grid min-h-[calc(100dvh-40px)] place-items-center">
            <div className="w-full max-w-2xl rounded-[32px] border-4 border-slate-950 bg-white p-5 text-center shadow-[8px_8px_0_#0f172a] sm:p-8">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <div className="absolute -left-6 -top-3 text-4xl">☂️</div>
                  <PomeMascot className="h-24 w-24" />
                </div>
              </div>
              <div className="text-lg font-black text-sky-700">새 게임 모드 MVP</div>
              <h1 className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl">강아지 대소동</h1>
              <p className="mt-3 text-xl font-black text-rose-600 sm:text-2xl">대소동을 버텨라!</p>
              <p className="mx-auto mt-5 max-w-xl text-base font-bold leading-7 text-slate-500">
                세션을 만들면 TV용 대기실이 열리고, 학생들은 QR로 들어와 자기 속도로 퀴즈와 미니게임을 진행합니다.
              </p>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleCreateRoom()}
                className="mt-8 rounded-[24px] border-4 border-slate-950 bg-sky-400 px-8 py-4 text-2xl font-black shadow-[5px_5px_0_#0f172a] disabled:opacity-60 sm:px-10 sm:py-5 sm:text-3xl"
              >
                세션 만들기
              </button>
            </div>
          </section>
        ) : room.status === 'waiting' ? (
          <section className="grid min-h-[calc(100dvh-40px)] place-items-center">
            <div className="w-full max-w-5xl rounded-[32px] border-4 border-slate-950 bg-white p-5 shadow-[8px_8px_0_#0f172a] sm:p-8">
              <div className="grid gap-8 md:grid-cols-[1fr_320px]">
                <div>
                  <div className="text-lg font-black text-sky-700">대기실</div>
                  <h1 className="mt-2 text-4xl font-black sm:text-6xl">강아지 대소동</h1>
                  <div className="mt-6 inline-block rounded-[28px] border-4 border-slate-950 bg-sky-500 px-6 py-4 text-5xl font-black tracking-widest text-white shadow-[5px_5px_0_#0f172a] sm:px-10 sm:py-5 sm:text-7xl">
                    {roomCode}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3 text-lg font-black text-slate-600">
                    <span>참가 {players.filter((player) => !player.is_kicked).length}명</span>
                    <span>실시간 {realtimeStatus === 'subscribed' ? '연결됨' : '연결 중'}</span>
                    <span>온라인 {Math.max(players.length, onlineCount)}명</span>
                  </div>
                  <div className="mt-8">
                    <h2 className="mb-3 text-2xl font-black">입장한 학생</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {players.filter((player) => !player.is_kicked).map((player) => (
                        <div key={player.id} className="rounded-2xl border-4 border-slate-200 bg-slate-50 px-4 py-3 text-xl font-black">
                          <span className="inline-flex items-center gap-2">
                            <PomeMascot className="h-8 w-8" />
                            {player.nickname}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-5 rounded-[28px] border-4 border-slate-950 bg-sky-50 p-5">
                  <div className="w-full rounded-[24px] border-4 border-slate-950 bg-white p-4 shadow-[4px_4px_0_#0f172a]">
                    <div className="mb-3 text-center text-xl font-black text-slate-950">게임 시간</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 5, 7, 10].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => setDurationMinutes(minutes)}
                          className={`rounded-2xl border-4 border-slate-950 py-2 text-lg font-black shadow-[2px_2px_0_#0f172a] ${
                            durationMinutes === minutes ? 'bg-amber-300' : 'bg-white'
                          }`}
                        >
                          {minutes}분
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-center text-sm font-black text-slate-500">
                      시간이 되면 자동 종료되고 순위를 공개해요.
                    </p>
                  </div>
                  <div className="rounded-3xl border-4 border-slate-950 bg-white p-4 shadow-[4px_4px_0_#0f172a]">
                    <QRCodeSVG value={inviteUrl} size={240} level="H" />
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || players.filter((player) => !player.is_kicked).length === 0}
                    onClick={() => void handleStart()}
                    className="w-full rounded-[24px] border-4 border-slate-950 bg-emerald-400 px-8 py-5 text-3xl font-black shadow-[5px_5px_0_#0f172a] disabled:opacity-50"
                  >
                    게임 시작
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <PuppyChaosTeacherBoard
            room={room}
            players={players}
            events={events}
            onPause={() => void handlePause()}
            onResume={() => void handleResume()}
            onEnd={() => void handleEnd()}
            onKick={(playerId) => void handleKick(playerId)}
          />
        )}
      </div>
    </main>
  )
}
