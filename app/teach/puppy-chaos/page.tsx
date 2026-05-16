'use client'

import { useCallback, useState } from 'react'
import QRCodeSVG from 'react-qr-code'
import PuppyChaosTeacherBoard from '@/components/강아지대소동/강아지대소동TeacherBoard'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { usePuppyChaosEvents } from '@/hooks/use강아지대소동Events'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import { createRoom, endRoom, pauseRoom, startRoom } from '@/lib/services/rooms'
import { updatePlayer } from '@/lib/services/players'

export default function PuppyChaosTeacherPage() {
  const [roomCode, setRoomCode] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const { players, refreshPlayers, applyPlayerPatch } = usePlayersRealtime({
    roomCode,
    enabled: Boolean(roomCode),
  })
  const { room, refreshRoom, applyRoomPatch } = useRoomRealtime({
    roomCode,
    enabled: Boolean(roomCode),
  })
  const { events } = usePuppyChaosEvents(roomCode, Boolean(roomCode))
  const resync = useCallback(async (reason?: string) => {
    if (reason === 'broadcast_hint') return
    await Promise.all([
      refreshRoom({ silent: true }),
      refreshPlayers({ silent: true }),
    ])
  }, [refreshPlayers, refreshRoom])
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
      const created = await createRoom({ setId: null, gameMode: 'poop_dodge' })
      setRoomCode(created.room_code)
    } catch (error) {
      alert('세션 생성에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsBusy(false)
    }
  }

  const handleStart = async () => {
    if (!roomCode) return
    setIsBusy(true)
    try {
      await startRoom({ roomCode, gameMode: 'poop_dodge' })
      broadcastRoomPatch({ status: 'playing', game_mode: 'poop_dodge', started_at: new Date().toISOString() }, 'poop_dodge_start')
    } catch (error) {
      alert('게임 시작에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsBusy(false)
    }
  }

  const handlePause = async () => {
    if (!roomCode) return
    await pauseRoom(roomCode)
    broadcastRoomPatch({ status: 'paused' }, 'poop_dodge_pause')
  }

  const handleResume = async () => {
    if (!roomCode) return
    await startRoom({ roomCode, gameMode: 'poop_dodge' })
    broadcastRoomPatch({ status: 'playing' }, 'poop_dodge_resume')
  }

  const handleEnd = async () => {
    if (!roomCode) return
    await endRoom(roomCode)
    broadcastRoomPatch({ status: 'ended' }, 'poop_dodge_end')
    void sendEvent('game:finished', { finishedBy: 'teacher', reason: 'poop_dodge_end' })
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
    <main className="min-h-screen bg-[#E0F2FE] p-5 text-slate-950" style={{ fontFamily: 'BMJUA, sans-serif' }}>
      <div className="mx-auto max-w-7xl">
        {!roomCode || !room ? (
          <section className="grid min-h-[calc(100vh-40px)] place-items-center">
            <div className="w-full max-w-2xl rounded-[32px] border-4 border-slate-950 bg-white p-8 text-center shadow-[8px_8px_0_#0f172a]">
              <div className="mb-4 text-7xl">☂️🐕</div>
              <div className="text-lg font-black text-sky-700">새 게임 모드 MVP</div>
              <h1 className="mt-2 text-5xl font-black text-slate-950">강아지 대소동</h1>
              <p className="mt-3 text-2xl font-black text-rose-600">대소동을 버텨라!</p>
              <p className="mx-auto mt-5 max-w-xl text-base font-bold leading-7 text-slate-500">
                세션을 만들면 TV용 대기실이 열리고, 학생들은 QR로 들어와 자기 속도로 퀴즈와 미니게임을 진행합니다.
              </p>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleCreateRoom()}
                className="mt-8 rounded-[24px] border-4 border-slate-950 bg-sky-400 px-10 py-5 text-3xl font-black shadow-[5px_5px_0_#0f172a] disabled:opacity-60"
              >
                세션 만들기
              </button>
            </div>
          </section>
        ) : room.status === 'waiting' ? (
          <section className="grid min-h-[calc(100vh-40px)] place-items-center">
            <div className="w-full max-w-5xl rounded-[32px] border-4 border-slate-950 bg-white p-8 shadow-[8px_8px_0_#0f172a]">
              <div className="grid gap-8 md:grid-cols-[1fr_320px]">
                <div>
                  <div className="text-lg font-black text-sky-700">대기실</div>
                  <h1 className="mt-2 text-6xl font-black">강아지 대소동</h1>
                  <div className="mt-6 inline-block rounded-[28px] border-4 border-slate-950 bg-sky-500 px-10 py-5 text-7xl font-black tracking-widest text-white shadow-[5px_5px_0_#0f172a]">
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
                          {player.avatar ?? '🐶'} {player.nickname}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-5 rounded-[28px] border-4 border-slate-950 bg-sky-50 p-5">
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
