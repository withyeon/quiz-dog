'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import QRCodeSVG from 'react-qr-code'
import type { Database } from '@/types/database.types'
import { filterNickname } from '@/lib/utils/profanityFilter'

// 게임 모드에 따른 버튼 컴포넌트
function GameModeButton({ roomCode, playerId }: { roomCode: string; playerId: string | null }) {
  const { room } = useRoomRealtime({ roomCode })
  const gameMode = room?.game_mode || 'gold_quest'
  
  const gameUrl = gameMode === 'racing' 
    ? `/racing?room=${roomCode}&playerId=${playerId}`
    : gameMode === 'battle_royale'
    ? `/battle?room=${roomCode}&playerId=${playerId}`
    : gameMode === 'fishing'
    ? `/fishing?room=${roomCode}&playerId=${playerId}`
    : gameMode === 'factory'
    ? `/factory?room=${roomCode}&playerId=${playerId}`
    : gameMode === 'dontlookdown'
    ? `/dontlookdown?room=${roomCode}&playerId=${playerId}`
    : gameMode === 'tower'
    ? `/tower?room=${roomCode}&playerId=${playerId}`
    : `/game?room=${roomCode}&playerId=${playerId}`
  
  return (
    <a
      href={gameUrl}
      className="block w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors font-medium text-center"
    >
      게임 시작하기 →
    </a>
  )
}

export default function PlayPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.room_code as string)?.replace(/[^0-9]/g, '') || ''
  
  const [nickname, setNickname] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState('🎮')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  const avatars = ['🎮', '👤', '🎯', '🏆', '⭐', '🔥', '💎', '🌟', '🎨', '🚀', '🎪', '🎭']

  const { players, loading, error } = usePlayersRealtime({
    roomCode,
    onPlayerUpdate: (player) => {
      console.log('Player updated:', player)
    },
  })

  const { room } = useRoomRealtime({ roomCode })

  // 게임 시작 감지 - 입장 후 로비에서 게임으로 이동
  useEffect(() => {
    if (room?.status === 'playing' && isJoined && playerId) {
      // 게임 페이지로 이동
      const gameMode = room?.game_mode || 'gold_quest'
      const gameUrl = gameMode === 'racing' 
        ? `/racing?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'battle_royale'
        ? `/battle?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'fishing'
        ? `/fishing?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'factory'
        ? `/factory?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'cafe'
        ? `/cafe?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'mafia'
        ? `/mafia?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'pool'
        ? `/pool?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'dontlookdown'
        ? `/dontlookdown?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'tower'
        ? `/tower?room=${roomCode}&playerId=${playerId}`
        : `/game?room=${roomCode}&playerId=${playerId}`
      
      window.location.href = gameUrl
    }
  }, [room?.status, isJoined, playerId, roomCode, room?.game_mode])

  // 로비에서는 소리 재생하지 않음 (게임 시작 후에만 재생)

  // 초대 URL 생성
  const getInviteUrl = () => {
    if (typeof window === 'undefined') return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/play/${roomCode}`
  }

  // URL 복사
  const handleCopyUrl = async () => {
    const url = getInviteUrl()
    try {
      await navigator.clipboard.writeText(url)
      alert('초대 링크가 복사되었습니다!')
    } catch (err) {
      console.error('복사 실패:', err)
      alert('복사에 실패했습니다. URL을 직접 복사해주세요.')
    }
  }

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
      // 먼저 room이 존재하는지 확인 (없으면 생성)
      let roomData: any = null
      const { data: existingRoomData, error: roomError } = await (supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single() as any)

      if (roomError && roomError.code === 'PGRST116') {
        // 방이 없으면 생성
        const { error: createError } = await (supabase
          .from('rooms')
          .insert({
            room_code: roomCode,
            status: 'waiting',
            current_q_index: 0,
          } as any) as any)

        if (createError) throw createError
        
        // 방 생성 후 다시 조회
        const { data: newRoomData } = await (supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single() as any)
        
        roomData = newRoomData
      } else if (roomError) {
        throw roomError
      } else {
        roomData = existingRoomData
      }

      // 게임 모드 확인 (Battle Royale일 경우 체력 초기화)
      const isBattleRoyale = roomData?.game_mode === 'battle_royale'

      // 플레이어 생성 (Guest Mode - 영구 계정 없음)
      const { data: playerData, error: playerError } = await (supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: nicknameCheck.filtered || nickname.trim(),
          score: 0,
          gold: 0,
          avatar: selectedAvatar,
          is_online: true,
          health: isBattleRoyale ? 100 : undefined,
        } as any)
        .select()
        .single() as any)

      if (playerError) throw playerError

      setPlayerId(playerData.id)
      setIsJoined(true)
    } catch (err) {
      console.error('Error joining room:', err)
      alert('방 입장에 실패했습니다: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-800">유효하지 않은 방 코드입니다.</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
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
                현재 {players.length}명 참가 중
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
                  아바타 선택
                </label>
                <div className="flex gap-2 flex-wrap">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`text-3xl p-2 rounded-lg border-2 transition-all ${
                        selectedAvatar === avatar
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
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
            {/* 로비: QR 코드 및 초대 링크 */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4">초대하기</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* QR 코드 */}
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-medium text-gray-700 mb-3">QR 코드로 입장</h3>
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <QRCodeSVG
                      value={getInviteUrl()}
                      size={200}
                      level="M"
                      style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    QR 코드를 스캔하여 입장하세요
                  </p>
                </div>
                {/* URL 복사 */}
                <div className="flex flex-col justify-center">
                  <h3 className="text-lg font-medium text-gray-700 mb-3">링크로 초대</h3>
                  <div className="bg-gray-50 border border-gray-300 rounded-md p-3 mb-3 break-all">
                    <p className="text-sm text-gray-600">{getInviteUrl()}</p>
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors font-medium"
                  >
                    📋 링크 복사하기
                  </button>
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    링크를 복사하여 학생들에게 공유하세요
                  </p>
                </div>
              </div>
            </div>

            {/* 입장 완료 메시지 */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
              <p className="text-green-800 font-medium mb-3">
                ✅ {nickname}님, 방에 입장하셨습니다!
              </p>
              <GameModeButton roomCode={roomCode} playerId={playerId} />
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
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        player.id === playerId
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{player.avatar || '🎮'}</span>
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
                            {player.is_online ? '🟢 온라인' : '🔴 오프라인'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-800">
                          {player.score}점
                        </div>
                        <div className="text-sm text-yellow-600">
                          💰 {player.gold} Gold
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
