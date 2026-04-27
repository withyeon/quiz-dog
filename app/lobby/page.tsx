'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import type { Database } from '@/types/database.types'
import { filterNickname } from '@/lib/utils/profanityFilter'
import CharacterSelector from '@/components/CharacterSelector'
import Minigame from '@/components/Minigame'
import { CHARACTERS, type Character } from '@/lib/utils/characters'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { getGameModeUrl } from '@/hooks/useGameBase'
import { ShibaDog, MalteseDog, BeretDog, DogGroup } from '@/components/PixelDogs'

/* ─────────────────────────────────────────────────────────────
   픽셀 버튼
───────────────────────────────────────────────────────────── */
function PixelBtn({
  children,
  color = 'blue',
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const colors = {
    blue:   { bg: '#2E7BD4', border: '#1A4F9C', shadow: '#0D2E6B' },
    green:  { bg: '#2D9E5E', border: '#1A6B3A', shadow: '#0D4022' },
    orange: { bg: '#E87A1A', border: '#A85210', shadow: '#6B3008' },
    red:    { bg: '#D43030', border: '#9C1A1A', shadow: '#6B0D0D' },
    purple: { bg: '#7B4FCC', border: '#4F2F9A', shadow: '#2D1860' },
  }
  const c = colors[color]
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -2, scale: 1.02 }}
      whileTap={disabled ? {} : { y: 3, scale: 0.98 }}
      className={`relative font-black text-white rounded-xl px-6 py-3 transition-opacity ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{
        background: c.bg,
        border: `3px solid ${c.border}`,
        boxShadow: disabled ? 'none' : `0 5px 0 ${c.shadow}, 0 8px 20px rgba(0,0,0,0.2)`,
        fontFamily: "'BMJUA', sans-serif",
        textShadow: `0 2px 0 ${c.shadow}`,
      }}
    >
      {children}
    </motion.button>
  )
}

/* ─────────────────────────────────────────────────────────────
   픽셀 입력 필드
───────────────────────────────────────────────────────────── */
function PixelInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`px-5 py-4 rounded-xl font-black text-center outline-none text-gray-800 ${props.className ?? ''}`}
      style={{
        background: '#FFFBF2',
        border: '3px solid #C17B3A',
        boxShadow: '0 4px 0 rgba(91,58,26,0.25), inset 0 2px 4px rgba(91,58,26,0.08)',
        fontFamily: "'BMJUA', sans-serif",
        fontSize: '1.5rem',
        ...props.style,
      }}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   픽셀 패널
───────────────────────────────────────────────────────────── */
function PixelPanel({
  children,
  label,
  labelColor = '#C17B3A',
  className = '',
}: {
  children: React.ReactNode
  label?: string
  labelColor?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {label && (
        <div
          className="absolute -top-5 left-5 px-4 py-1.5 rounded-lg font-black text-sm text-white z-10"
          style={{
            background: labelColor,
            border: '3px solid rgba(0,0,0,0.2)',
            boxShadow: '0 3px 0 rgba(0,0,0,0.2)',
            fontFamily: "'BMJUA', sans-serif",
          }}
        >
          {label}
        </div>
      )}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,250,240,0.95)',
          border: '3px solid rgba(193,123,58,0.4)',
          boxShadow: '0 6px 0 rgba(91,58,26,0.2), 0 12px 32px rgba(91,58,26,0.12)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   교실 배경 (로비용, 심플하게)
───────────────────────────────────────────────────────────── */
function LobbyClassroomBg() {
  return (
    <svg
      viewBox="0 0 1200 800"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'crisp-edges' }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="1200" height="800" fill="#F2E4C8" />
      {[120, 240, 360, 480, 600].map((y) => (
        <line key={y} x1="0" y1={y} x2="1200" y2={y} stroke="#DDD0B0" strokeWidth="2" />
      ))}
      <rect y="620" width="1200" height="180" fill="#C4923A" />
      {[0, 200, 400, 600, 800, 1000, 1200].map((x) => (
        <line key={x} x1={x} y1="620" x2={x} y2="800" stroke="#A87020" strokeWidth="2" />
      ))}
      {/* 칠판 */}
      <rect x="280" y="40" width="640" height="240" rx="4" fill="#2A2A18" />
      <rect x="292" y="52" width="616" height="216" rx="2" fill="#1E5C3A" />
      <rect x="292" y="52" width="616" height="8" fill="rgba(255,255,255,0.06)" />
      <text x="330" y="120" fill="rgba(255,255,255,0.22)" fontSize="20" fontFamily="monospace">오늘의 퀴즈: 게임 코드를 입력하세요 🐶</text>
      <text x="380" y="200" fill="rgba(255,255,255,0.14)" fontSize="16" fontFamily="monospace">틀려도 괜찮아! 함께 배우자!</text>
      <rect x="280" y="278" width="640" height="14" rx="3" fill="#1E1008" />
      {[300, 335, 370, 405].map((x, i) => (
        <rect key={i} x={x} y={280} width={24} height={9} rx="2"
          fill={['#FEF9F0', '#FFB0B0', '#B8D8FF', '#FFFE90'][i]} />
      ))}
      {/* 창문 */}
      {[30, 1080].map((x) => (
        <g key={x}>
          <rect x={x} y="60" width="130" height="180" rx="4" fill="#87CEEB" opacity="0.85" />
          <rect x={x} y="60" width="130" height="180" rx="4" fill="none" stroke="#6A501A" strokeWidth="5" />
          <line x1={x + 65} y1="60" x2={x + 65} y2="240" stroke="#6A501A" strokeWidth="4" />
          <line x1={x} y1="150" x2={x + 130} y2="150" stroke="#6A501A" strokeWidth="4" />
          <rect x={x + 5} y="65" width="56" height="80" fill="rgba(255,255,255,0.28)" rx="2" />
        </g>
      ))}
      {/* 책상들 (배경 장식) */}
      {[60, 340, 620, 900].map((x) => (
        <g key={x} opacity="0.7">
          <rect x={x} y="600" width="160" height="22" rx="4" fill="#B07030" />
          <rect x={x + 20} y="622" width="12" height="32" rx="2" fill="#8B5A1A" />
          <rect x={x + 128} y="622" width="12" height="32" rx="2" fill="#8B5A1A" />
        </g>
      ))}
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   게임 모드 버튼 컴포넌트
───────────────────────────────────────────────────────────── */
function GameModeButton({ roomCode, playerId }: { roomCode: string; playerId: string | null }) {
  const { room } = useRoomRealtime({ roomCode })
  const gameMode = room?.game_mode || 'gold_quest'
  const gameUrl = getGameModeUrl(gameMode, roomCode, playerId || '')

  return (
    <a href={gameUrl} className="block">
      <PixelBtn color="green" className="w-full text-lg py-4">
        🚀 게임 시작하기 →
      </PixelBtn>
    </a>
  )
}

/* ─────────────────────────────────────────────────────────────
   플레이어 아바타
───────────────────────────────────────────────────────────── */
function PlayerAvatar({ nickname, avatar, isReady = false }: { nickname: string; avatar: string; isReady?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-1"
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl relative"
        style={{
          background: 'rgba(193,123,58,0.15)',
          border: `3px solid ${isReady ? '#2D9E5E' : '#C17B3A'}`,
          boxShadow: `0 3px 0 ${isReady ? '#1A6B3A' : 'rgba(91,58,26,0.3)'}`,
        }}
      >
        {avatar}
        {isReady && (
          <div className="absolute -top-2 -right-2 text-xs bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-black">
            ✓
          </div>
        )}
      </div>
      <span className="text-xs font-black truncate max-w-[56px]" style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}>
        {nickname}
      </span>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────
   LobbyStep 타입
───────────────────────────────────────────────────────────── */
type LobbyStep = 'code' | 'nickname' | 'character' | 'minigame'

/* ─────────────────────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────────────────────── */
export default function LobbyPage() {
  const [step, setStep] = useState<LobbyStep>('code')
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0])
  const [isTeacher, setIsTeacher] = useState(false)
  const [minigameScore, setMinigameScore] = useState(0)
  const [isCheckingRoom, setIsCheckingRoom] = useState(false)
  const [dogIndex, setDogIndex] = useState(0)

  const { players, loading, error } = usePlayersRealtime({
    roomCode: step !== 'code' ? roomCode : '',
    onPlayerUpdate: (player) => { console.log('Player updated:', player) },
  })

  const { room } = useRoomRealtime({ roomCode: step !== 'code' ? roomCode : '' })

  // 강아지 순환 애니메이션
  useEffect(() => {
    const timer = setInterval(() => setDogIndex((i) => (i + 1) % 3), 2000)
    return () => clearInterval(timer)
  }, [])

  // 게임 시작 감지
  useEffect(() => {
    if (room?.status === 'playing' && playerId && (step === 'character' || step === 'minigame')) {
      const gameMode = (room?.game_mode as string) || 'gold_quest'
      const gameUrl = getGameModeUrl(gameMode, roomCode, playerId)
      window.location.href = gameUrl
    }
  }, [room?.status, step, roomCode, playerId, room?.game_mode])

  const getInviteUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/play/${roomCode}`
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getInviteUrl())
      alert('초대 링크가 복사되었습니다!')
    } catch {
      alert('복사에 실패했습니다.')
    }
  }

  const handleCodeSubmit = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      alert('6자리 게임 코드를 입력해주세요.')
      return
    }
    setIsCheckingRoom(true)
    try {
      const { data: roomData, error: roomError } = await (supabase
        .from('rooms')
        .select('room_code, status')
        .eq('room_code', roomCode)
        .single() as any)

      if (roomError || !roomData) {
        alert('이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.')
        return
      }
      if ((roomData as any).status === 'finished') {
        alert('이미 끝난 게임이에요. 선생님께 새 게임을 열어달라고 해주세요.')
        return
      }
      setStep('nickname')
    } catch {
      alert('방 확인에 실패했어요. 인터넷 연결을 확인해주세요.')
    } finally {
      setIsCheckingRoom(false)
    }
  }

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) { alert('닉네임을 입력해주세요.'); return }
    const check = filterNickname(nickname)
    if (!check.isValid) { alert('닉네임에 부적절한 단어가 포함되어 있습니다. (최대 20자)'); return }
    setStep('character')
  }

  const handleCharacterSelect = async (character: Character) => {
    setSelectedCharacter(character)
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms').select('*').eq('room_code', roomCode).single()

      if (roomError && roomError.code === 'PGRST116') {
        const roomInsert: Database['public']['Tables']['rooms']['Insert'] = {
          room_code: roomCode, status: 'waiting', current_q_index: 0,
        }
        const { error: createError } = await (supabase.from('rooms').insert(roomInsert as any) as any)
        if (createError) throw createError
      } else if (roomError) throw roomError

      const { data: roomDataForHealth } = await (supabase
        .from('rooms').select('game_mode').eq('room_code', roomCode).single() as any)

      const isBattleRoyale = roomDataForHealth?.game_mode === 'battle_royale'
      const nicknameCheck = filterNickname(nickname)
      const finalNickname = nicknameCheck.filtered || nickname.trim()

      const { data: existingPlayers } = await (supabase
        .from('players').select('id').eq('room_code', roomCode).eq('nickname', finalNickname) as any)

      if (existingPlayers && existingPlayers.length > 0) {
        alert('이미 같은 닉네임이 있어요! 다른 닉네임을 사용해주세요.')
        setStep('nickname')
        return
      }

      const playerInsert: Database['public']['Tables']['players']['Insert'] = {
        room_code: roomCode, nickname: finalNickname, score: 0, gold: 0,
        avatar: character.emoji, is_online: true,
        health: isBattleRoyale ? 100 : undefined,
      }
      const { data: playerData, error: playerError } = await (supabase
        .from('players').insert(playerInsert as any).select().single() as any)

      if (playerError) throw playerError
      setPlayerId(playerData.id)
      setIsJoined(true)
    } catch (err) {
      console.error('Error joining room:', err)
      alert('방 입장에 실패했습니다: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return (
    <main
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FFF3DC 0%, #FFE8C0 50%, #FFF0D0 100%)' }}
    >
      {/* 교실 배경 */}
      <div className="absolute inset-0">
        <LobbyClassroomBg />
        <div className="absolute inset-0" style={{ background: 'rgba(255,243,220,0.6)' }} />
      </div>

      {/* 상단 헤더 바 */}
      <div
        className="relative z-20 flex items-center justify-between px-6 py-3"
        style={{
          background: 'rgba(91,45,10,0.92)',
          borderBottom: '4px solid #3B1A05',
          boxShadow: '0 4px 0 #2A1005, 0 8px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/header-logo.svg" alt="퀴즈독" width={120} height={40} className="h-8 w-auto" />
        </Link>

        {/* 현재 단계 표시 */}
        <div className="flex items-center gap-2">
          {(['code', 'nickname', 'character', 'minigame'] as LobbyStep[]).map((s, i) => (
            <div
              key={s}
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{
                background: step === s ? '#FFD700' : 'rgba(255,255,255,0.25)',
                border: '2px solid rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>

        {/* 홈 버튼 */}
        <Link href="/">
          <PixelBtn color="orange" className="text-sm px-4 py-2">
            🏠 홈으로
          </PixelBtn>
        </Link>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 min-h-[calc(100vh-72px)] flex items-center justify-center p-6">
        <AnimatePresence mode="wait">

          {/* ── 1단계: 게임 코드 입력 ── */}
          {step === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="text-center w-full max-w-md"
            >
              <PixelPanel label="🐶 퀴즈독 입장하기" labelColor="#C17B3A">
                <div className="p-10 pt-12">
                  {/* 로고 */}
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="mb-6"
                  >
                    <Image
                      src="/quizdog-logo.svg"
                      alt="퀴즈독"
                      width={320}
                      height={100}
                      className="w-full max-w-xs mx-auto"
                      priority
                    />
                  </motion.div>

                  {/* 강아지 3마리 */}
                  <div className="flex justify-center mb-8">
                    <DogGroup size={70} />
                  </div>

                  <p className="mb-5 font-black" style={{ color: '#5B3A1A', fontFamily: "'BMJUA', sans-serif", fontSize: '1.1rem' }}>
                    선생님께 받은 게임 코드를 입력하세요!
                  </p>

                  <div className="flex gap-3 items-center justify-center mb-6">
                    <PixelInput
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isCheckingRoom) handleCodeSubmit() }}
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      className="flex-1"
                    />
                    <PixelBtn
                      color="blue"
                      onClick={handleCodeSubmit}
                      disabled={isCheckingRoom}
                      className="text-xl px-5 py-4"
                    >
                      {isCheckingRoom ? '⏳' : '→'}
                    </PixelBtn>
                  </div>

                  <PixelBtn color="green" onClick={handleCodeSubmit} disabled={isCheckingRoom} className="w-full text-lg py-4">
                    {isCheckingRoom ? '⏳ 확인 중...' : '🚪 입장하기'}
                  </PixelBtn>
                </div>
              </PixelPanel>
            </motion.div>
          )}

          {/* ── 2단계: 닉네임 ── */}
          {step === 'nickname' && (
            <motion.div
              key="nickname"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="text-center w-full max-w-md"
            >
              <PixelPanel label="💬 닉네임 설정" labelColor="#2E7BD4">
                <div className="p-10 pt-12">
                  <motion.div
                    className="flex justify-center mb-6"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ShibaDog size={100} />
                  </motion.div>

                  <h2 className="text-2xl font-black mb-2" style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}>
                    뭐라고 부를까? 🐾
                  </h2>
                  <p className="mb-6 text-sm" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
                    게임에서 사용할 닉네임을 입력하세요
                  </p>

                  <div className="flex gap-3 items-center mb-6">
                    <PixelInput
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleNicknameSubmit() }}
                      placeholder="닉네임"
                      maxLength={20}
                      autoFocus
                      className="flex-1"
                      style={{ fontSize: '1.2rem' }}
                    />
                    <PixelBtn color="blue" onClick={handleNicknameSubmit} className="text-xl px-5 py-4">
                      →
                    </PixelBtn>
                  </div>

                  {nickname && !filterNickname(nickname).isValid && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-sm mb-4 font-black"
                      style={{ fontFamily: "'BMJUA', sans-serif" }}
                    >
                      ⚠️ 부적절한 단어가 포함되어 있습니다
                    </motion.p>
                  )}

                  <PixelBtn color="blue" onClick={handleNicknameSubmit} className="w-full text-lg py-4">
                    🐶 다음으로 →
                  </PixelBtn>
                </div>
              </PixelPanel>
            </motion.div>
          )}

          {/* ── 3단계: 캐릭터 선택 / 로비 ── */}
          {step === 'character' && (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-6xl"
            >
              {/* 상태 바 */}
              <div
                className="rounded-2xl px-6 py-3 flex items-center justify-between mb-4"
                style={{
                  background: 'rgba(91,45,10,0.85)',
                  border: '3px solid #3B1A05',
                  boxShadow: '0 4px 0 #2A1005',
                  fontFamily: "'BMJUA', sans-serif",
                }}
              >
                <span className="text-white font-black text-lg">👤 {nickname}</span>
                <span className="text-amber-300 font-black">
                  🎮 {room?.game_mode || '?'} 모드 · 대기 중...
                </span>
                <span className="text-green-300 font-black">
                  👥 {players.length}명 접속 중
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                {/* 캐릭터 선택 */}
                <div className="md:col-span-2">
                  <PixelPanel label="🐾 캐릭터 선택" labelColor="#7B4FCC">
                    <div className="p-6 pt-8 max-h-[520px] overflow-y-auto">
                      <CharacterSelector
                        selectedCharacterId={selectedCharacter.id}
                        onSelect={handleCharacterSelect}
                        showCategories={false}
                      />
                    </div>
                  </PixelPanel>
                </div>

                {/* 선택된 캐릭터 & 대기 정보 */}
                <div className="flex flex-col gap-4">
                  <PixelPanel label="✨ 선택된 캐릭터" labelColor="#E87A1A">
                    <div className="p-6 pt-8 text-center">
                      <div className="relative w-32 h-32 mx-auto mb-3">
                        <Image
                          src={selectedCharacter.imagePath}
                          alt={selectedCharacter.name}
                          fill
                          className="object-contain"
                          sizes="128px"
                        />
                      </div>
                      <h3 className="text-xl font-black mb-4" style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}>
                        {selectedCharacter.name}
                      </h3>

                      {isJoined ? (
                        <>
                          <GameModeButton roomCode={roomCode} playerId={playerId} />
                          <PixelBtn
                            color="purple"
                            onClick={() => setStep('minigame')}
                            className="w-full text-base py-3 mt-3"
                          >
                            🎮 미니게임 하기
                          </PixelBtn>
                        </>
                      ) : (
                        <div
                          className="py-3 px-4 rounded-xl text-center font-black"
                          style={{
                            background: 'rgba(193,123,58,0.15)',
                            border: '3px solid rgba(193,123,58,0.4)',
                            color: '#7B4B1A',
                            fontFamily: "'BMJUA', sans-serif",
                          }}
                        >
                          ⏳ 캐릭터를 선택해주세요!
                        </div>
                      )}
                    </div>
                  </PixelPanel>

                  {/* 접속한 플레이어 목록 */}
                  <PixelPanel label={`👥 플레이어 (${players.length}명)`} labelColor="#2D9E5E">
                    <div className="p-4 pt-8">
                      <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                        {players.length === 0 ? (
                          <div className="col-span-4 text-center py-4 font-black" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
                            아직 아무도 없어요...
                          </div>
                        ) : (
                          players.map((p: any) => (
                            <PlayerAvatar
                              key={p.id}
                              nickname={p.nickname}
                              avatar={p.avatar || '🐶'}
                              isReady={isJoined && p.id === playerId}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </PixelPanel>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 4단계: 미니게임 ── */}
          {step === 'minigame' && (
            <motion.div
              key="minigame"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl"
            >
              <div
                className="rounded-2xl px-6 py-3 flex items-center justify-between mb-4"
                style={{
                  background: 'rgba(91,45,10,0.85)',
                  border: '3px solid #3B1A05',
                  boxShadow: '0 4px 0 #2A1005',
                  fontFamily: "'BMJUA', sans-serif",
                }}
              >
                <span className="text-white font-black text-lg">👤 {nickname}</span>
                <span className="text-amber-300 font-black">🎮 미니게임 점수: {minigameScore}</span>
                <PixelBtn color="orange" onClick={() => setStep('character')} className="text-sm py-2 px-4">
                  ← 돌아가기
                </PixelBtn>
              </div>

              <PixelPanel label="🕹️ 미니게임" labelColor="#7B4FCC">
                <div className="p-5 pt-8">
                  <div className="aspect-video rounded-xl overflow-hidden">
                    <Minigame
                      characterImage={selectedCharacter.imagePath}
                      onScoreChange={setMinigameScore}
                    />
                  </div>
                </div>
              </PixelPanel>

              <div
                className="mt-4 rounded-2xl px-6 py-4 flex items-center gap-3"
                style={{
                  background: 'rgba(255,250,240,0.9)',
                  border: '3px solid rgba(193,123,58,0.35)',
                  boxShadow: '0 4px 0 rgba(91,58,26,0.2)',
                  fontFamily: "'BMJUA', sans-serif",
                }}
              >
                <span className="text-2xl">⏳</span>
                <span className="font-black" style={{ color: '#3B1F0A' }}>
                  선생님이 게임을 시작하면 자동으로 이동돼요!
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  )
}
