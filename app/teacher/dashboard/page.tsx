'use client'

import { useCallback, useState, useEffect } from 'react'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useAudioContext } from '@/components/AudioProvider'
import GameCodeModal from '@/components/GameCodeModal'
import GameModeSelector from '@/components/dashboards/GameModeSelector'
import LiveDashboardRenderer from '@/components/dashboards/LiveDashboardRenderer'
import QRCodeSVG from 'react-qr-code'
import { DEFAULT_GAME_MODE, isGameModeId, type GameModeId } from '@/lib/game/modes'
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
  const [roomCode, setRoomCode] = useState('')
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [showGameCodeModal, setShowGameCodeModal] = useState(false)
  const [gameMode, setGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [factoryDurationMinutes, setFactoryDurationMinutes] = useState(5) // 편의점 게임 제한 시간(분)

  const { players, refreshPlayers } = usePlayersRealtime({ roomCode })
  const { room, refreshRoom } = useRoomRealtime({ roomCode })
  const resyncDashboard = useCallback(async (reason?: string) => {
    if (reason === 'broadcast_hint') return
    await Promise.all([
      refreshRoom({ silent: true }),
      refreshPlayers({ silent: true }),
    ])
  }, [refreshPlayers, refreshRoom])
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

      // 게임 코드 모달 표시
      setShowGameCodeModal(true)
      setIsGameStarted(false)
    } catch (error: any) {
      console.error('Error creating room:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? error.message // Supabase error often has a message property
          : JSON.stringify(error)

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
      alert('게임 시작에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
      alert('게임이 종료되었습니다.')
    } catch (error) {
      console.error('Error ending game:', error)
      alert('게임 종료에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
      alert('게임 초기화에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
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

            {/* 현재 방 코드 표시 - 깔끔한 디자인 */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 text-center shadow-md">
              <p className="text-blue-100 text-sm mb-3 font-medium">게임 참가 코드</p>
              <div className="text-7xl font-bold text-white tracking-wider mb-4">
                {roomCode}
              </div>
              <div className="flex items-center justify-center gap-4 text-blue-50">
                <span className="text-lg font-semibold">참가자: {players.length}명</span>
                <span className="text-sm font-medium">
                  실시간 {realtimeStatus === 'subscribed' ? '연결됨' : '연결 중'} · 온라인 {Math.max(players.length, onlineCount)}명
                </span>
              </div>
            </div>

            {/* QR 코드 미리보기 */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-md border-2 border-gray-200">
                <QRCodeSVG
                  value={typeof window !== 'undefined' ? `${window.location.origin}/play/${roomCode}` : ''}
                  size={180}
                  level="H"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGameCodeModal(true)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-semibold border border-gray-200"
              >
                📋 코드 다시 보기
              </button>
              {!isGameStarted ? (
                <button
                  onClick={handleConfirmStart}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                >
                  🎮 게임 시작
                </button>
              ) : (
                <>
                  <button
                    onClick={handleEndGame}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-sm"
                  >
                    ⏹️ 게임 종료
                  </button>
                  <button
                    onClick={handleResetGame}
                    className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-sm"
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
      {roomCode && room && (
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
