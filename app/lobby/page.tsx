'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import QRCodeSVG from 'react-qr-code'
import type { Database } from '@/types/database.types'
import { filterNickname } from '@/lib/utils/profanityFilter'
import CharacterSelector from '@/components/CharacterSelector'
import Minigame from '@/components/Minigame'
import { CHARACTERS, type Character } from '@/lib/utils/characters'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getGameModeUrl } from '@/hooks/useGameBase'

// 게임 모드에 따른 버튼 컴포넌트
function GameModeButton({ roomCode, playerId }: { roomCode: string; playerId: string | null }) {
  const { room } = useRoomRealtime({ roomCode })
  const gameMode = room?.game_mode || 'gold_quest'
  const gameUrl = getGameModeUrl(gameMode, roomCode, playerId || '')

  return (
    <a
      href={gameUrl}
      className="block w-full sparkle-button text-white py-3 px-6 rounded-xl transition-all font-bold text-center mb-3 font-bitbit"
    >
      게임 시작하기 →
    </a>
  )
}

type LobbyStep = 'code' | 'nickname' | 'character' | 'minigame'

export default function LobbyPage() {
  const [step, setStep] = useState<LobbyStep>('code')
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0])
  const [isTeacher, setIsTeacher] = useState(false)
  const [minigameScore, setMinigameScore] = useState(0)

  const { players, loading, error } = usePlayersRealtime({
    roomCode: step !== 'code' ? roomCode : '',
    onPlayerUpdate: (player) => {
      console.log('Player updated:', player)
    },
  })

  const { room } = useRoomRealtime({ roomCode: step !== 'code' ? roomCode : '' })

  // 게임 시작 감지 - 로비나 미니게임에서 게임으로 이동
  useEffect(() => {
    if (room?.status === 'playing' && playerId && (step === 'character' || step === 'minigame')) {
      // 게임 페이지로 이동
      const gameMode = (room?.game_mode as string) || 'gold_quest'
      const gameUrl = getGameModeUrl(gameMode, roomCode, playerId)

      window.location.href = gameUrl
    }
  }, [room?.status, step, roomCode, playerId, room?.game_mode])

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

  // 게임 코드 입력 후 다음 단계
  const [isCheckingRoom, setIsCheckingRoom] = useState(false)
  const handleCodeSubmit = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      alert('6자리 게임 코드를 입력해주세요.')
      return
    }

    setIsCheckingRoom(true)
    try {
      // 방이 실제로 존재하는지 확인
      const { data: roomData, error: roomError } = await (supabase
        .from('rooms')
        .select('room_code, status')
        .eq('room_code', roomCode)
        .single() as any)

      if (roomError || !roomData) {
        alert('이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.')
        return
      }

      // 이미 끝난 게임인지 확인
      if ((roomData as any).status === 'finished') {
        alert('이미 끝난 게임이에요. 선생님께 새 게임을 열어달라고 해주세요.')
        return
      }

      setStep('nickname')
    } catch (err) {
      console.error('방 확인 실패:', err)
      alert('방 확인에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.')
    } finally {
      setIsCheckingRoom(false)
    }
  }

  // 닉네임 입력 후 다음 단계
  const handleNicknameSubmit = () => {
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

    setStep('character')
  }

  // 캐릭터 선택 후 방 입장
  const handleCharacterSelect = async (character: Character) => {
    setSelectedCharacter(character)

    try {
      // 먼저 room이 존재하는지 확인 (없으면 생성)
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single()

      if (roomError && roomError.code === 'PGRST116') {
        // 방이 없으면 생성
        const roomInsert: Database['public']['Tables']['rooms']['Insert'] = {
          room_code: roomCode,
          status: 'waiting',
          current_q_index: 0,
        }
        const { error: createError } = await (supabase
          .from('rooms')
          .insert(roomInsert as any) as any)

        if (createError) throw createError
      } else if (roomError) {
        throw roomError
      }

      // 게임 모드 확인 (Battle Royale일 경우 체력 초기화)
      const { data: roomDataForHealth } = await (supabase
        .from('rooms')
        .select('game_mode')
        .eq('room_code', roomCode)
        .single() as any)

      const isBattleRoyale = roomDataForHealth?.game_mode === 'battle_royale'

      // 닉네임 필터링
      const nicknameCheck = filterNickname(nickname)
      const finalNickname = nicknameCheck.filtered || nickname.trim()

      // 닉네임 중복 체크
      const { data: existingPlayers } = await (supabase
        .from('players')
        .select('id')
        .eq('room_code', roomCode)
        .eq('nickname', finalNickname) as any)

      if (existingPlayers && existingPlayers.length > 0) {
        alert('이미 같은 닉네임이 있어요! 다른 닉네임을 사용해주세요.')
        setStep('nickname')
        return
      }

      // 플레이어 생성
      const playerInsert: Database['public']['Tables']['players']['Insert'] = {
        room_code: roomCode,
        nickname: finalNickname,
        score: 0,
        gold: 0,
        avatar: character.emoji,
        is_online: true,
        health: isBattleRoyale ? 100 : undefined,
      }
      const { data: playerData, error: playerError } = await (supabase
        .from('players')
        .insert(playerInsert as any)
        .select()
        .single() as any)

      if (playerError) throw playerError

      setPlayerId(playerData.id)
      setIsJoined(true)
      // 캐릭터 선택 화면에 머물기 (미니게임은 선택사항)
    } catch (err) {
      console.error('Error joining room:', err)
      alert('방 입장에 실패했습니다: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // 강퇴 기능 (선생님만)
  const handleKickPlayer = async (targetPlayerId: string) => {
    if (!isTeacher) return

    if (!confirm('정말 이 플레이어를 강퇴하시겠습니까?')) return

    try {
      const { error } = await supabase.from('players').delete().eq('id', targetPlayerId)

      if (error) throw error
      alert('플레이어가 강퇴되었습니다.')
    } catch (err) {
      console.error('Error kicking player:', err)
      alert('강퇴에 실패했습니다: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // 점수 증가 (테스트용)
  const handleIncreaseScore = async () => {
    if (!playerId) return

    try {
      // 현재 점수 조회
      const { data: currentPlayer, error: fetchError } = await (supabase
        .from('players')
        .select('score, gold')
        .eq('id', playerId)
        .single() as any)

      if (fetchError) throw fetchError

      // 점수 증가
      const playerUpdate: Database['public']['Tables']['players']['Update'] = {
        score: (currentPlayer?.score || 0) + 10,
        gold: (currentPlayer?.gold || 0) + 10,
      }
      const { error: updateError } = await ((supabase
        .from('players') as any)
        .update(playerUpdate)
        .eq('id', playerId))

      if (updateError) throw updateError
    } catch (err) {
      console.error('Error updating score:', err)
      alert('점수 업데이트에 실패했습니다: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // 점수 감소 (테스트용)
  const handleDecreaseScore = async () => {
    if (!playerId) return

    try {
      // 현재 점수 조회
      const { data: currentPlayer, error: fetchError } = await (supabase
        .from('players')
        .select('score, gold')
        .eq('id', playerId)
        .single() as any)

      if (fetchError) throw fetchError

      // 점수 감소 (0 이하로 내려가지 않도록)
      const playerUpdate: Database['public']['Tables']['players']['Update'] = {
        score: Math.max((currentPlayer?.score || 0) - 10, 0),
        gold: Math.max((currentPlayer?.gold || 0) - 10, 0),
      }
      const { error: updateError } = await ((supabase
        .from('players') as any)
        .update(playerUpdate)
        .eq('id', playerId))

      if (updateError) throw updateError
    } catch (err) {
      console.error('Error updating score:', err)
      alert('점수 업데이트에 실패했습니다: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return (
    <main className="min-h-screen sky-background relative overflow-hidden">
      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.1) 35px, rgba(255,255,255,.1) 70px)`
        }}></div>
      </div>

      <Navbar />

      <div className="relative min-h-[calc(100vh-96px)] flex items-center justify-center p-8 pt-32">
        <AnimatePresence mode="wait">
          {/* 1단계: 게임 코드 입력 */}
          {step === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <div className="flex gap-2 items-center justify-center mb-8">
                <motion.input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isCheckingRoom) handleCodeSubmit() }}
                  className="px-6 py-4 text-2xl font-bold text-center cloud-card border-2 border-sky-300 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-800 font-bitbit"
                  placeholder="게임 코드"
                  maxLength={6}
                  autoFocus
                  whileFocus={{ scale: 1.02 }}
                />
                <motion.button
                  onClick={handleCodeSubmit}
                  disabled={isCheckingRoom}
                  className="px-6 py-4 cloud-card border-2 border-sky-300 rounded-xl shadow-lg hover:bg-sky-50 transition-colors text-2xl font-bold text-sky-700 disabled:opacity-50"
                  whileHover={{ scale: isCheckingRoom ? 1 : 1.05 }}
                  whileTap={{ scale: isCheckingRoom ? 1 : 0.95 }}
                >
                  {isCheckingRoom ? '⏳' : '→'}
                </motion.button>
              </div>
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <Image
                  src="/quizdog-logo.svg"
                  alt="퀴즈독 로고"
                  width={600}
                  height={200}
                  className="w-full max-w-2xl h-auto"
                  priority
                />
              </motion.div>
            </motion.div>
          )}

          {/* 2단계: 닉네임 입력 */}
          {step === 'nickname' && (
            <motion.div
              key="nickname"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <motion.h1
                className="text-5xl font-bold text-sky-800 mb-8 drop-shadow-lg font-bitbit"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                닉네임 입력
              </motion.h1>
              <div className="flex gap-2 items-center justify-center mb-4">
                <motion.input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  className="px-6 py-4 text-xl font-medium cloud-card border-2 border-sky-300 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-800 font-bitbit"
                  placeholder="닉네임 입력"
                  maxLength={20}
                  autoFocus
                  whileFocus={{ scale: 1.02 }}
                />
                <motion.button
                  onClick={handleNicknameSubmit}
                  className="px-6 py-4 cloud-card border-2 border-sky-300 rounded-xl shadow-lg hover:bg-sky-50 transition-colors text-2xl font-bold text-sky-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  →
                </motion.button>
              </div>
              {nickname && !filterNickname(nickname).isValid && (
                <p className="text-red-500 text-sm mb-2 font-bold">부적절한 단어가 포함되어 있습니다.</p>
              )}
              <div className="mt-4">
                <button className="px-4 py-2 cloud-card border-2 border-sky-200 text-sky-700 rounded-lg text-sm font-bold hover:bg-sky-50 transition-colors">
                  새 이름 (5회 남음)
                </button>
              </div>
            </motion.div>
          )}

          {/* 3단계: 캐릭터 선택 로비 */}
          {step === 'character' && (
            <motion.div
              key="character"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-6xl mx-auto"
            >
              <div className="cloud-card border-2 border-sky-300 text-sky-800 px-6 py-4 flex items-center justify-between mb-4 rounded-t-xl font-bitbit">
                <span className="font-bold text-xl">{nickname}</span>
                <span className="font-bold text-xl">로비 대기 중</span>
                <button className="text-sky-600 hover:text-sky-800">
                  ⚙️
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 캐릭터 선택 그리드 */}
                <div className="md:col-span-2 cloud-card border-2 border-sky-300 rounded-xl p-6 max-h-[600px] overflow-y-auto">
                  <CharacterSelector
                    selectedCharacterId={selectedCharacter.id}
                    onSelect={handleCharacterSelect}
                    showCategories={false}
                  />
                </div>
                {/* 선택된 캐릭터 표시 */}
                <div className="cloud-soft rounded-xl p-6 text-sky-800 border-2 border-sky-300">
                  <h2 className="text-3xl font-bold mb-6 font-bitbit">{selectedCharacter.name}</h2>
                  <div className="relative w-full aspect-square mb-4 max-w-[200px] mx-auto">
                    <Image
                      src={selectedCharacter.imagePath}
                      alt={selectedCharacter.name}
                      fill
                      className="object-contain"
                      sizes="200px"
                    />
                  </div>

                  {/* 미니게임 시작 버튼 (선택사항) */}
                  {isJoined && (
                    <motion.button
                      onClick={() => setStep('minigame')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all mb-4 font-bitbit"
                    >
                      🎮 미니게임 시작하기
                    </motion.button>
                  )}

                  <div className="cloud-card border-2 border-sky-300 rounded-xl p-4 flex items-center gap-2">
                    <span className="text-2xl">🎮</span>
                    <span className="font-bold text-sky-800 font-bitbit">호스트 대기 중</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4단계: 미니게임 */}
          {step === 'minigame' && (
            <motion.div
              key="minigame"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl mx-auto"
            >
              <div className="cloud-card border-2 border-sky-300 text-sky-800 px-6 py-4 flex items-center justify-between mb-4 rounded-t-xl font-bitbit">
                <span className="font-bold text-xl">{nickname}</span>
                <span className="font-bold text-xl">호스트 대기 중</span>
                <button className="text-sky-600 hover:text-sky-800">
                  ⚙️
                </button>
              </div>
              <div className="cloud-card border-2 border-sky-300 rounded-xl p-4 shadow-lg">
                <div className="aspect-video rounded-lg overflow-hidden">
                  <Minigame
                    characterImage={selectedCharacter.imagePath}
                    onScoreChange={setMinigameScore}
                  />
                </div>
              </div>
              <div className="mt-4 cloud-card border-2 border-sky-300 text-sky-800 px-6 py-4 rounded-b-xl flex items-center gap-2 font-bitbit">
                <span className="text-2xl">🎮</span>
                <span className="font-bold text-xl">호스트 대기 중</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
