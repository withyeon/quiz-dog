'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomResync } from '@/hooks/useRoomResync'
import { useAudioContext } from '@/components/AudioProvider'
import GameCodeModal from '@/components/GameCodeModal'
import GameModeSelector from '@/components/dashboards/GameModeSelector'
import LiveDashboardRenderer from '@/components/dashboards/LiveDashboardRenderer'
import QRCodeSVG from 'react-qr-code'
import { DEFAULT_GAME_MODE, getGameModeConfig, isGameModeId, type GameModeId } from '@/lib/game/modes'
import { formatServiceError } from '@/lib/services/errors'
import {
  assertQuestionSetHasQuestions,
  createRoom,
  finishRoom,
  resetRoom,
  startRoom,
  updateRoomGameMode,
} from '@/lib/services/rooms'
import { saveGameReportSnapshot } from '@/lib/services/reports'

export default function TeacherDashboard() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [showGameCodeModal, setShowGameCodeModal] = useState(false)
  const [gameMode, setGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [factoryDurationMinutes, setFactoryDurationMinutes] = useState(5) // 편의점 게임 제한 시간(분)

  const { players, refreshPlayers } = usePlayersRealtime({ roomCode })
  const { room, refreshRoom } = useRoomRealtime({ roomCode })
  const resyncDashboard = useRoomResync(refreshRoom, refreshPlayers)
  const {
    status: realtimeStatus,
    onlineCount,
    sendEvent: sendRoomEvent,
  } = useRoomChannel({
    roomCode,
    role: 'teacher',
    enabled: Boolean(roomCode),
    onResyncNeeded: resyncDashboard,
  })
  const roomStatus = room?.status
  const activeModeConfig = getGameModeConfig(gameMode)
  const inviteUrl = typeof window !== 'undefined' && roomCode ? `${window.location.origin}/play/${roomCode}` : ''
  const { playSFX } = useAudioContext()

  const broadcastRoomPatch = useCallback((
    patch: Record<string, unknown>,
    reason: string,
  ) => {
    void sendRoomEvent('room:patch', { patch, reason })
    void sendRoomEvent('room:snapshot-hint', { reason })
  }, [sendRoomEvent])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const modeFromUrl = params.get('gameMode')
    if (isGameModeId(modeFromUrl)) {
      setGameMode(modeFromUrl)
    }
  }, [])

  // room의 game_mode를 초기값으로 사용
  useEffect(() => {
    if (room?.game_mode) {
      setGameMode(room.game_mode as GameModeId)
    }
  }, [room?.game_mode])

  useEffect(() => {
    if (!roomStatus) return
    setIsGameStarted(roomStatus === 'playing')
  }, [roomStatus])

  // 게임 모드 변경 핸들러 (방이 있으면 DB도 업데이트)
  const handleGameModeChange = async (newMode: GameModeId) => {
    setGameMode(newMode)

    // 이미 방이 있으면 game_mode 업데이트
    if (roomCode) {
      try {
        await updateRoomGameMode(roomCode, newMode)
        broadcastRoomPatch({ game_mode: newMode }, 'teacher_mode_change')
      } catch (error) {
        console.error('Error updating game mode:', error)
      }
    }
  }

  // 새 게임 생성 (랜덤 코드 생성)
  const handleCreateGame = async () => {
    playSFX('click')

    // Supabase 설정 확인
    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      alert(configCheck.error || 'Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }

    // URL에서 set_id 가져오기
    const params = new URLSearchParams(window.location.search)
    const setId = params.get('set')

    try {
      const createdRoom = await createRoom({ setId, gameMode })
      setRoomCode(createdRoom.room_code)

      // 방 생성 후에는 모달 대신 대기방 화면을 바로 보여준다.
      setShowGameCodeModal(false)
      setIsGameStarted(false)
    } catch (error) {
      console.error('Error creating room:', error)
      const errorMessage = formatServiceError(error)

      let userMessage = `방 생성에 실패했습니다: ${errorMessage}`
      if (errorMessage.includes('violates foreign key constraint')) {
        userMessage = `방 생성 실패: 선택한 문제집(ID: ${setId})이 존재하지 않거나 유효하지 않습니다.\n\n문제집 목록을 다시 불러오거나 다른 문제집을 선택해주세요.`
      } else {
        userMessage += `\n\n(요청한 Set ID: ${setId})`
      }

      alert(userMessage)
    }
  }

  // 실제 게임 시작 (모달에서 시작 버튼 클릭 시)
  const handleConfirmStart = async () => {
    if (!roomCode) return
    playSFX('click')

    try {
      const params = new URLSearchParams(window.location.search)
      const setId = params.get('set')
      const startedAt = new Date().toISOString()
      await assertQuestionSetHasQuestions(setId)
      await startRoom({
        roomCode,
        gameMode,
        durationSeconds: gameMode === 'factory' ? factoryDurationMinutes * 60 : null,
      })
      broadcastRoomPatch({
        status: 'playing',
        game_mode: gameMode,
        started_at: startedAt,
        duration_seconds: gameMode === 'factory' ? factoryDurationMinutes * 60 : null,
      }, 'teacher_start')

      setIsGameStarted(true)
      setShowGameCodeModal(false)
    } catch (error) {
      console.error('Error starting game:', error)
      alert('게임 시작에 실패했습니다: ' + formatServiceError(error))
    }
  }

  // 게임 종료
  const handleEndGame = async () => {
    if (!roomCode || !room) return
    playSFX('click')

    try {
      await finishRoom(roomCode)
      broadcastRoomPatch({ status: 'finished' }, 'teacher_finish')
      void sendRoomEvent('game:finished', {
        finishedBy: 'teacher',
        reason: 'teacher_finish',
      })

      // 게임 종료 순간의 최종 성적 스냅샷을 영구 보관함(game_reports)에 저장
      try {
        await saveGameReportSnapshot(room, players)
      } catch (reportError) {
        console.error('Error saving game report snapshot:', reportError)
      }

      setIsGameStarted(false)
      router.push(`/teacher/game/${roomCode}/end`)
    } catch (error) {
      console.error('Error ending game:', error)
      alert('게임 종료에 실패했습니다: ' + formatServiceError(error))
    }
  }

  // 게임 재시작
  const handleResetGame = async () => {
    if (!roomCode) return
    playSFX('click')

    try {
      await resetRoom(roomCode)
      broadcastRoomPatch({
        status: 'waiting',
        current_q_index: 0,
        started_at: null,
        duration_seconds: null,
      }, 'teacher_reset')

      setIsGameStarted(false)
      alert('게임이 초기화되었습니다.')
    } catch (error) {
      console.error('Error resetting game:', error)
      alert('게임 초기화에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const handleCopyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      alert('초대 링크가 복사되었습니다.')
    } catch (error) {
      console.error('초대 링크 복사 실패:', error)
      alert('복사에 실패했습니다. 링크를 직접 복사해주세요.')
    }
  }

  const renderPlayerAvatar = (avatar: string | null, nickname: string) => {
    if (avatar?.startsWith('/')) {
      return (
        <Image
          src={avatar}
          alt={nickname}
          fill
          className="object-contain scale-125"
          sizes="56px"
        />
      )
    }

    return avatar || '🐶'
  }

  return (
    <div>
      {/* 페이지 제목 - 블루킷 스타일 */}
      <h1 className="text-4xl font-bold text-gray-900 mb-8">게임 시작</h1>

      {/* 방 설정 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">

        {/* 게임 모드 선택 */}
        {!roomCode && (
          <GameModeSelector
            selectedMode={gameMode}
            onSelectMode={handleGameModeChange}
          />
        )}

        {roomCode ? (
          <div className="space-y-4">
            {/* 편의점: 게임 시간 설정 */}
            {gameMode === 'factory' && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <label className="block text-lg font-semibold text-amber-800 mb-2">⏱️ 게임 시간 (몇 분 후 자동 종료)</label>
                <div className="flex flex-wrap gap-3">
                  {[3, 5, 7, 10].map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => setFactoryDurationMinutes(minutes)}
                      className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${factoryDurationMinutes === minutes
                        ? 'border-amber-500 bg-amber-200 text-amber-900'
                        : 'border-amber-200 bg-white text-amber-800 hover:border-amber-400'
                        }`}
                    >
                      {minutes}분
                    </button>
                  ))}
                </div>
                <p className="text-sm text-amber-700 mt-2">시간이 되면 자동 종료되고, 돈 많은 순으로 순위가 정해져요.</p>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-md">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-blue-100">게임 참가 코드</p>
                    <div className="mt-2 text-7xl font-black tracking-wider">{roomCode}</div>
                  </div>
                  <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur">
                    {activeModeConfig.image ? (
                      <div className="relative h-20 w-44">
                        <Image
                          src={activeModeConfig.image}
                          alt={activeModeConfig.shortLabel}
                          fill
                          className="object-contain"
                          sizes="176px"
                        />
                      </div>
                    ) : (
                      <div className="text-6xl">{activeModeConfig.emoji}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-blue-50">
                  <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">참가자 {players.length}명</span>
                  <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">
                    실시간 {realtimeStatus === 'subscribed' ? '연결됨' : '연결 중'} · 온라인 {Math.max(players.length, onlineCount)}명
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="mb-3 text-sm font-black text-slate-500">QR 코드로 입장</p>
                <div className="mx-auto inline-block rounded-xl border-2 border-slate-200 bg-white p-3">
                  <QRCodeSVG
                    value={inviteUrl}
                    size={190}
                    level="H"
                  />
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                >
                  초대 링크 복사
                </button>
              </div>
            </div>

            {roomStatus === 'waiting' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">학생들이 입장하고 있어요</h2>
                  </div>
                  <button
                    onClick={handleConfirmStart}
                    disabled={players.length === 0}
                    className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    🎮 게임 시작
                  </button>
                </div>

                {players.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                    <div className="text-5xl">🐶</div>
                    <p className="mt-3 text-lg font-black text-slate-700">아직 입장한 학생이 없습니다</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">코드나 QR을 공유해주세요.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                      >
                        <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-3xl ring-1 ring-slate-200">
                          {renderPlayerAvatar(player.avatar, player.nickname)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-slate-950">{player.nickname}</div>
                          <div className="mt-1 text-xs font-bold text-emerald-600">준비 완료</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowGameCodeModal(true)}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                📋 코드 크게 보기
              </button>
              {isGameStarted && (
                <>
                  <button
                    onClick={handleEndGame}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                  >
                    ⏹️ 게임 종료
                  </button>
                  <button
                    onClick={handleResetGame}
                    className="flex-1 rounded-lg bg-gray-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-gray-700"
                  >
                    🔄 초기화
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-6 text-lg font-medium">게임을 시작하려면 아래 버튼을 클릭하세요</p>
            <button
              onClick={handleCreateGame}
              className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 rounded-lg transition-all font-semibold text-lg shadow-sm hover:shadow-md"
            >
              🎮 새 게임 시작하기
            </button>
          </div>
        )}

        {room && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-600">
              상태: <span className="font-semibold">{room.status}</span> | 문제 번호:{' '}
              <span className="font-semibold">{room.current_q_index + 1}</span>
            </div>
          </div>
        )}
      </div>

      {/* 게임 모드에 따른 표시 또는 통계 화면 */}
      {roomCode && room && room.status !== 'waiting' && (
        <LiveDashboardRenderer room={room} players={players} />
      )}

      {!roomCode && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-600">게임을 시작하면 여기에 참가자 목록이 표시됩니다.</p>
        </div>
      )}

      {/* 게임 코드 모달 */}
      <GameCodeModal
        roomCode={roomCode}
        isOpen={showGameCodeModal}
        onClose={() => setShowGameCodeModal(false)}
        onStartGame={handleConfirmStart}
        onCopy={() => {
          // 복사 완료 시 추가 동작 (선택적)
        }}
      />
    </div>
  )
}
