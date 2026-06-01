'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomResync } from '@/hooks/useRoomResync'
import { filterNickname } from '@/lib/utils/profanityFilter'
import CharacterSelector from '@/components/CharacterSelector'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { CHARACTERS, type Character } from '@/lib/utils/characters'
import { DEFAULT_GAME_MODE, getGameModeUrl, isGameModeId, type GameModeId } from '@/lib/game/modes'
import { isTerminalRoomStatus } from '@/lib/game/roomStatus'
import type { RoomChannelEvent } from '@/lib/realtime/roomChannel'
import { getScoreDisplay } from '@/lib/game/scoreDisplay'
import { formatServiceError } from '@/lib/services/errors'
import { createPlayerForRoom, getRoomByCode, nicknameExists } from '@/lib/services/rooms'

export default function PlayPageClient({ roomCode }: { roomCode: string }) {
  const router = useRouter()
  
  const [nickname, setNickname] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0])
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialGameMode, setTutorialGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)

  const { players, loading, error, refreshPlayers } = usePlayersRealtime({
    roomCode,
    onPlayerUpdate: (player) => {
      console.log('Player updated:', player)
    },
  })

  const { room, refreshRoom } = useRoomRealtime({ roomCode })
  const resyncPlay = useRoomResync(refreshRoom, refreshPlayers)
  const handleRoomEvent = (event: RoomChannelEvent) => {
    if (
      event.type !== 'tutorial:show'
      && event.type !== 'tutorial:slide'
      && event.type !== 'tutorial:hide'
    ) {
      return
    }

    const payload = event.payload as { gameMode?: unknown; stepIndex?: unknown } | undefined
    const nextMode = isGameModeId(payload?.gameMode) ? payload.gameMode : DEFAULT_GAME_MODE

    if (event.type === 'tutorial:hide') {
      setTutorialOpen(false)
      return
    }

    setTutorialGameMode(nextMode)
    setTutorialStepIndex(typeof payload?.stepIndex === 'number' ? payload.stepIndex : 0)
    setTutorialOpen(true)
  }

  const { status: realtimeStatus, presence, onlineCount, sendEvent: sendRoomEvent } = useRoomChannel({
    roomCode,
    playerId,
    role: 'student',
    enabled: Boolean(roomCode),
    onEvent: handleRoomEvent,
    onResyncNeeded: resyncPlay,
  })
  const onlinePlayerIds = useMemo(() => new Set(
    presence
      .filter((meta) => meta.role === 'student' && meta.playerId)
      .map((meta) => String(meta.playerId)),
  ), [presence])

  // 게임 시작 감지 - 입장 후 로비에서 게임으로 이동
  useEffect(() => {
    if (room?.status === 'playing' && isJoined && playerId) {
      router.replace(getGameModeUrl(room?.game_mode || DEFAULT_GAME_MODE, roomCode, playerId))
    }
  }, [room?.status, isJoined, playerId, roomCode, room?.game_mode, router])

  // 로비에서는 소리 재생하지 않음 (게임 시작 후에만 재생)

  // 방 입장
  const handleJoinRoom = async () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.')
      return
    }

    // 닉네임 필터링
    const nicknameCheck = filterNickname(nickname)
    if (!nicknameCheck.isValid) {
      alert('닉네임에 부적절한 단어가 포함되어 있거나 너무 깁니다. (최대 20자)')
      return
    }

    try {
      const roomData = await getRoomByCode(roomCode)
      if (!roomData) {
        alert('이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.')
        return
      }
      if (isTerminalRoomStatus(roomData.status)) {
        alert('이미 끝난 게임이에요. 선생님께 새 게임 코드를 받아주세요.')
        return
      }
      const finalNickname = nicknameCheck.filtered || nickname.trim()
      if (await nicknameExists(roomCode, finalNickname)) {
        alert('이미 같은 닉네임이 있어요! 다른 닉네임을 사용해주세요.')
        return
      }
      const playerData = await createPlayerForRoom({
        roomCode,
        nickname: finalNickname,
        avatar: selectedCharacter.imagePath || selectedCharacter.emoji,
        gameMode: roomData.game_mode,
      })

      setPlayerId(playerData.id)
      setIsJoined(true)
      void sendRoomEvent('room:snapshot-hint', { reason: 'player_joined' })

      if (roomData.status === 'playing') {
        router.replace(getGameModeUrl(roomData.game_mode || DEFAULT_GAME_MODE, roomCode, playerData.id))
      }
    } catch (err) {
      console.error('Error joining room:', err)
      alert('방 입장에 실패했습니다: ' + formatServiceError(err))
    }
  }

  if (!roomCode) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-800">유효하지 않은 방 코드입니다.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <main className="min-h-dvh bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-gray-800 flex items-center justify-center gap-2">
            <span className="text-5xl">🐶</span>
            퀴즈독
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            방 코드: <span className="font-bold">{roomCode}</span>
          </p>
          {players.length > 0 && (
            <div className="inline-flex items-center gap-2 bg-primary-50 px-4 py-2 rounded-full border border-primary-200">
              <span className="text-sm font-medium text-primary-700">
                현재 {players.length}명 참가 중 · 실시간 {realtimeStatus === 'subscribed' ? '연결됨' : '연결 중'} · 온라인 {Math.max(players.length, onlineCount)}명
              </span>
            </div>
          )}
        </div>

        {!isJoined ? (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">방 입장</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="닉네임을 입력하세요 (최대 20자)"
                  maxLength={20}
                />
                {nickname && !filterNickname(nickname).isValid && (
                  <p className="text-red-500 text-xs mt-1">
                    부적절한 단어가 포함되어 있습니다.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  캐릭터 선택
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <CharacterSelector
                    selectedCharacterId={selectedCharacter.id}
                    onSelect={setSelectedCharacter}
                    showCategories={false}
                  />
                </div>
              </div>
              <button
                onClick={handleJoinRoom}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors font-medium"
              >
                방 입장하기
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 입장 완료 메시지 */}
            <div className="bg-green-50 border border-green-200 rounded-md p-5 mb-6 text-center">
              <p className="text-green-800 font-bold mb-2">
                ✅ {nickname}님, 방에 입장하셨습니다!
              </p>
              <p className="text-green-700 font-medium">
                선생님이 게임을 시작하면 모두 함께 자동으로 이동합니다.
              </p>
            </div>
          </>
        )}

        {/* 플레이어 목록 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">플레이어 목록 (실시간)</h2>
          
          {loading && (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800">에러: {error.message}</p>
            </div>
          )}
          
          {!loading && !error && (
            <>
              {players.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  아직 플레이어가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {players.map((player) => {
                    const scoreDisplay = getScoreDisplay(player, room?.game_mode || DEFAULT_GAME_MODE)
                    const isOnline = onlinePlayerIds.has(player.id)

                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                          player.id === playerId
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <PlayerAvatarDisplay
                            avatar={player.avatar}
                            nickname={player.nickname}
                            fallback="🎮"
                            className="relative h-10 w-10 overflow-hidden rounded-lg bg-white text-2xl ring-1 ring-gray-200"
                            sizes="40px"
                          />
                          <div>
                            <div className="font-semibold text-gray-800">
                              {player.nickname}
                              {player.id === playerId && (
                                <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                                  나
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {isOnline ? '🟢 온라인' : '🔴 오프라인'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            scoreDisplay.tone === 'money'
                              ? 'text-emerald-600'
                              : scoreDisplay.tone === 'gold'
                                ? 'text-yellow-600'
                                : 'text-gray-800'
                          }`}>
                            {scoreDisplay.text}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </main>
      <GameStartTutorialModal
        gameMode={tutorialGameMode}
        isOpen={tutorialOpen}
        stepIndex={tutorialStepIndex}
        role="student"
      />
    </>
  )
}
