'use client'

import { toast } from '@/components/ui/Toaster'
import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomResync } from '@/hooks/useRoomResync'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { filterNickname } from '@/lib/utils/profanityFilter'
import CharacterSelector from '@/components/CharacterSelector'
import Minigame from '@/components/Minigame'
import { CHARACTERS, type Character } from '@/lib/utils/characters'
import { resolveAvatarSrc } from '@/lib/utils/playerDisplay'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import { DEFAULT_GAME_MODE, getGameModeConfig, getGameModeUrl, isGameModeId, type GameModeId } from '@/lib/game/modes'
import { isTerminalRoomStatus } from '@/lib/game/roomStatus'
import { formatServiceError } from '@/lib/services/errors'
import type { RoomChannelEvent } from '@/lib/realtime/roomChannel'
import { createPlayerForRoom, getRoomByCode, isNicknameConflictError, nicknameExists } from '@/lib/services/rooms'
import { getPlayerById, updatePlayer } from '@/lib/services/players'
import { clearLobbyPlayerId, loadLobbyPlayerId, saveLobbyPlayerId } from '@/lib/utils/lobbySession'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import {
  LobbyNotice,
  LobbyShell,
  LobbyStatusBar,
  LobbyStepBar,
  MascotDuo,
  MascotPome,
  NAVY,
  PixelBtn,
  PixelInput,
  PixelPanel,
  PlayerAvatar,
  StatusChip,
} from '@/components/lobby/LobbyUI'

type LobbyStep = 'code' | 'nickname' | 'character' | 'minigame'

const LOBBY_STEPS: { key: LobbyStep; label: string }[] = [
  { key: 'code', label: '코드 입력' },
  { key: 'nickname', label: '닉네임' },
  { key: 'character', label: '캐릭터' },
  { key: 'minigame', label: '미니게임' },
]

export default function LobbyPageWrapper() {
  return (
    <Suspense>
      <LobbyPage />
    </Suspense>
  )
}

function LobbyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<LobbyStep>('code')
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0])
  const [minigameScore, setMinigameScore] = useState(0)
  const [isCheckingRoom, setIsCheckingRoom] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialGameMode, setTutorialGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const joiningRef = useRef(false)

  useEffect(() => {
    const code = searchParams.get('code')?.replace(/[^0-9]/g, '').slice(0, 6) ?? ''
    if (code.length === 6) {
      setRoomCode(code)
      setIsCheckingRoom(true)
      getRoomByCode(code).then((roomData) => {
        if (!roomData || isTerminalRoomStatus(roomData.status)) {
          setCodeError(roomData ? '이미 끝난 게임이에요. 선생님께 새 게임을 열어달라고 해주세요.' : '이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.')
        } else {
          setStep('nickname')
        }
      }).catch(() => {
        setCodeError('방 확인에 실패했어요. 인터넷 연결을 확인해주세요.')
      }).finally(() => setIsCheckingRoom(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { players, refreshPlayers } = usePlayersRealtime({
    roomCode: step !== 'code' ? roomCode : '',
  })

  // 같은 방 다른 친구들이 이미 고른 캐릭터(본인 제외) → 중복 선택 방지용
  const takenCharacterIds = useMemo(() => {
    const taken = new Set<string>()
    for (const p of players) {
      if (p.id === playerId) continue
      const character = CHARACTERS.find((c) => c.imagePath === p.avatar)
      if (character) taken.add(character.id)
    }
    // 학생 수가 캐릭터 수보다 많으면(전부 사용중) 더는 막지 않는다(아무도 못 고르는 상황 방지).
    if (taken.size >= CHARACTERS.length) return new Set<string>()
    return taken
  }, [players, playerId])

  // 캐릭터 변경 DB 반영 디바운스(빠르게 여러 번 눌러도 마지막 것만 저장 → 렉 방지)
  const avatarSyncTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => () => {
    if (avatarSyncTimer.current) clearTimeout(avatarSyncTimer.current)
  }, [])

  // 입장 전 기본 미리보기 캐릭터가 이미 사용중이면, 비어있는 첫 캐릭터로 바꿔준다.
  useEffect(() => {
    if (isJoined || step !== 'character') return
    if (!takenCharacterIds.has(selectedCharacter.id)) return
    const firstAvailable = CHARACTERS.find((c) => !takenCharacterIds.has(c.id))
    if (firstAvailable) setSelectedCharacter(firstAvailable)
  }, [step, isJoined, takenCharacterIds, selectedCharacter.id])

  const { room, refreshRoom } = useRoomRealtime({ roomCode: step !== 'code' ? roomCode : '' })

  // 새로고침/뒤로 가기 후 같은 학생을 새로 만들지 않고 이 탭의 기존 참가자를 복구한다.
  useEffect(() => {
    if (!roomCode || step === 'code' || playerId) return
    const savedPlayerId = loadLobbyPlayerId(roomCode)
    if (!savedPlayerId) return

    joiningRef.current = true
    void getPlayerById(savedPlayerId).then((savedPlayer) => {
      if (!savedPlayer || savedPlayer.room_code !== roomCode || savedPlayer.is_kicked) {
        clearLobbyPlayerId(roomCode)
        return
      }
      setPlayerId(savedPlayer.id)
      setNickname(savedPlayer.nickname)
      const character = CHARACTERS.find((candidate) => candidate.imagePath === savedPlayer.avatar)
      if (character) setSelectedCharacter(character)
      setIsJoined(true)
      setStep('character')
      void updatePlayer(savedPlayer.id, { is_online: true })
    }).catch(() => clearLobbyPlayerId(roomCode))
      .finally(() => { joiningRef.current = false })
  }, [playerId, roomCode, step])

  const resyncLobby = useRoomResync(refreshRoom, refreshPlayers)
  const handleRoomEvent = (event: RoomChannelEvent) => {
    if (event.type !== 'tutorial:show' && event.type !== 'tutorial:slide' && event.type !== 'tutorial:hide') return
    const payload = event.payload as { gameMode?: unknown; stepIndex?: unknown } | undefined
    const nextMode = isGameModeId(payload?.gameMode) ? payload.gameMode : DEFAULT_GAME_MODE
    if (event.type === 'tutorial:hide') { setTutorialOpen(false); return }
    setTutorialGameMode(nextMode)
    setTutorialStepIndex(typeof payload?.stepIndex === 'number' ? payload.stepIndex : 0)
    setTutorialOpen(true)
  }

  const { status: realtimeStatus, onlineCount, sendEvent: sendRoomEvent } = useRoomChannel({
    roomCode,
    playerId,
    role: 'student',
    enabled: step !== 'code' && Boolean(roomCode),
    onResyncNeeded: resyncLobby,
    onEvent: handleRoomEvent,
  })

  // 게임 시작 감지
  useEffect(() => {
    if (room?.status === 'playing' && playerId && (step === 'character' || step === 'minigame')) {
      const gameMode = room?.game_mode || DEFAULT_GAME_MODE
      const gameUrl = getGameModeUrl(gameMode, roomCode, playerId)
      router.replace(gameUrl)
    }
  }, [room?.status, step, roomCode, playerId, room?.game_mode, router])

  const handleCodeSubmit = async () => {
    setCodeError(null)
    if (!roomCode.trim() || roomCode.length !== 6) {
      setCodeError('6자리 게임 코드를 입력해주세요.')
      return
    }
    setIsCheckingRoom(true)
    try {
      const roomData = await getRoomByCode(roomCode)

      if (!roomData) {
        setCodeError('이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.')
        return
      }
      if (isTerminalRoomStatus(roomData.status)) {
        setCodeError('이미 끝난 게임이에요. 선생님께 새 게임을 열어달라고 해주세요.')
        return
      }
      setStep('nickname')
    } catch {
      setCodeError('방 확인에 실패했어요. 인터넷 연결을 확인해주세요.')
    } finally {
      setIsCheckingRoom(false)
    }
  }

  const handleNicknameSubmit = () => {
    setNicknameError(null)
    if (!nickname.trim()) { setNicknameError('닉네임을 입력해주세요.'); return }
    const check = filterNickname(nickname)
    if (!check.isValid) { setNicknameError('사용할 수 없는 닉네임이에요. 다른 이름을 써주세요. (최대 20자)'); return }
    setStep('character')
  }

  const handleCharacterSelect = async (character: Character) => {
    // 다른 친구가 이미 고른 캐릭터는 선택 불가
    if (takenCharacterIds.has(character.id)) return

    // 시각 반영은 즉시 (네트워크를 기다리지 않음)
    setSelectedCharacter(character)
    const avatar = character.imagePath || character.emoji

    // 이미 입장한 학생이 캐릭터만 바꾸는 경우:
    // 방/닉네임 재검증 없이 가벼운 아바타 업데이트만 디바운스로 처리한다(렉 방지).
    if (isJoined && playerId) {
      const targetPlayerId = playerId
      if (avatarSyncTimer.current) clearTimeout(avatarSyncTimer.current)
      avatarSyncTimer.current = setTimeout(() => {
        updatePlayer(targetPlayerId, { avatar })
          .then(() => sendRoomEvent('room:snapshot-hint', { reason: 'player_updated' }))
          .catch((err) => console.error('캐릭터 변경 실패:', formatServiceError(err)))
      }, 300)
      return
    }

    if (joiningRef.current) return
    joiningRef.current = true

    // 첫 입장: 이때만 방/닉네임을 검증하고 플레이어를 생성한다.
    try {
      const roomData = await getRoomByCode(roomCode)
      if (!roomData) {
        setCodeError('이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.')
        setStep('code')
        return
      }
      if (isTerminalRoomStatus(roomData.status)) {
        setCodeError('이미 끝난 게임이에요. 선생님께 새 게임 코드를 받아주세요.')
        setStep('code')
        return
      }
      const nicknameCheck = filterNickname(nickname)
      const finalNickname = nicknameCheck.filtered || nickname.trim()

      if (await nicknameExists(roomCode, finalNickname, playerId)) {
        setNicknameError('이미 같은 닉네임이 있어요! 다른 닉네임을 사용해주세요.')
        setStep('nickname')
        return
      }

      const playerData = await createPlayerForRoom({
        roomCode,
        nickname: finalNickname,
        avatar,
        gameMode: roomData.game_mode,
      })

      setPlayerId(playerData.id)
      setIsJoined(true)
      saveLobbyPlayerId(roomCode, playerData.id)
      void sendRoomEvent('room:snapshot-hint', { reason: 'player_joined' })

      if (roomData.status === 'playing') {
        router.replace(getGameModeUrl(roomData.game_mode || DEFAULT_GAME_MODE, roomCode, playerData.id))
      }
    } catch (err) {
      if (isNicknameConflictError(err)) {
        setNicknameError('이미 같은 닉네임이 있어요! 다른 닉네임을 사용해주세요.')
        setStep('nickname')
      } else {
        console.warn('방 입장 실패:', formatServiceError(err))
        toast.error('방 입장에 실패했어요: ' + formatServiceError(err))
      }
    } finally {
      joiningRef.current = false
    }
  }

  return (
    <LobbyShell>
      <GameStartTutorialModal
        gameMode={tutorialGameMode}
        isOpen={tutorialOpen}
        stepIndex={tutorialStepIndex}
        role="student"
      />

      <LobbyStepBar steps={LOBBY_STEPS} current={step} />

      <div className="flex min-h-[calc(100dvh-72px)] items-center justify-center px-3 pb-10 pt-2 sm:px-6 sm:pb-12">
        <AnimatePresence mode="wait">
          {step === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="w-full max-w-md text-center"
            >
              <PixelPanel label="🐶 퀴즈독 입장하기">
                <div className="p-5 pt-10 sm:p-9 sm:pt-12">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }} className="mb-4">
                    <Image src="/quizdog-logo.webp" alt="퀴즈독" width={320} height={100} className="mx-auto w-full max-w-[240px] sm:max-w-[280px]" priority />
                  </motion.div>

                  <MascotDuo size={68} className="mb-5" />

                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    <PixelHeading>
                      게임 <PixelAccent>코드</PixelAccent>를 입력하세요
                    </PixelHeading>
                  </h1>
                  <p className="-mt-1 mb-5 text-sm font-black sm:text-base" style={{ color: '#334155' }}>
                    선생님이 알려준 숫자 6자리예요
                  </p>

                  <div className="mb-4 flex items-center justify-center gap-2 sm:gap-3">
                    <PixelInput
                      type="text"
                      inputMode="numeric"
                      value={roomCode}
                      onChange={(e) => { setCodeError(null); setRoomCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isCheckingRoom) handleCodeSubmit() }}
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      className="flex-1 tracking-[0.25em] placeholder:tracking-[0.25em]"
                    />
                    <PixelBtn color="white" onClick={handleCodeSubmit} disabled={isCheckingRoom} className="px-5 py-4 text-xl">
                      {isCheckingRoom ? '⏳' : '→'}
                    </PixelBtn>
                  </div>

                  {codeError && (
                    <LobbyNotice tone="error" role="alert" className="mb-4">
                      {codeError}
                    </LobbyNotice>
                  )}

                  <PixelBtn color="blue" onClick={handleCodeSubmit} disabled={isCheckingRoom} className="w-full py-4 text-lg">
                    {isCheckingRoom ? '⏳ 확인 중...' : '🚪 입장하기'}
                  </PixelBtn>
                </div>
              </PixelPanel>
            </motion.div>
          )}

          {step === 'nickname' && (
            <motion.div
              key="nickname"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="w-full max-w-md text-center"
            >
              <PixelPanel label="💬 닉네임 설정" labelColor="#38BDF8">
                <div className="p-5 pt-10 sm:p-9 sm:pt-12">
                  <MascotPome size={104} className="mb-5 flex justify-center" />

                  <h2 className="text-2xl leading-tight sm:text-3xl">
                    <PixelHeading>뭐라고 부를까?</PixelHeading>
                  </h2>
                  <p className="-mt-1 mb-6 text-sm font-black sm:text-base" style={{ color: '#334155' }}>
                    게임에서 사용할 닉네임을 입력하세요
                  </p>

                  <div className="mb-4 flex items-center gap-2 sm:gap-3">
                    <PixelInput
                      type="text"
                      value={nickname}
                      onChange={(e) => { setNicknameError(null); setNickname(e.target.value.slice(0, 20)) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleNicknameSubmit() }}
                      placeholder="닉네임"
                      maxLength={20}
                      autoFocus
                      className="flex-1"
                    />
                    <PixelBtn color="white" onClick={handleNicknameSubmit} className="px-5 py-4 text-xl">→</PixelBtn>
                  </div>

                  {nicknameError && (
                    <LobbyNotice tone="error" role="alert" className="mb-4">
                      {nicknameError}
                    </LobbyNotice>
                  )}

                  {nickname && !filterNickname(nickname).isValid && (
                    <LobbyNotice tone="error" className="mb-4">
                      ⚠️ 부적절한 단어가 포함되어 있습니다
                    </LobbyNotice>
                  )}

                  <PixelBtn color="blue" onClick={handleNicknameSubmit} className="w-full py-4 text-lg">
                    🐶 다음으로 →
                  </PixelBtn>
                </div>
              </PixelPanel>
            </motion.div>
          )}

          {step === 'character' && (
            <motion.div key="character" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-6xl">
              <LobbyStatusBar>
                <StatusChip tone="navy">👤 {nickname}</StatusChip>
                <StatusChip tone="sun">
                  {getGameModeConfig(room?.game_mode || DEFAULT_GAME_MODE).emoji}{' '}
                  {getGameModeConfig(room?.game_mode || DEFAULT_GAME_MODE).shortLabel} · 대기 중
                </StatusChip>
                <StatusChip tone="mint">👥 {players.length}명 · 온라인 {Math.max(players.length, onlineCount)}명</StatusChip>
                <StatusChip tone="sky">{realtimeStatus === 'subscribed' ? '🟢 실시간 연결됨' : '🟡 연결 중...'}</StatusChip>
              </LobbyStatusBar>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="md:col-span-2">
                  <PixelPanel label="🐾 캐릭터 선택" labelColor="#8B5CF6">
                    <div className="max-h-[520px] overflow-y-auto p-5 pt-8 sm:p-6 sm:pt-9">
                      <CharacterSelector selectedCharacterId={selectedCharacter.id} onSelect={handleCharacterSelect} showCategories={false} takenCharacterIds={takenCharacterIds} />
                    </div>
                  </PixelPanel>
                </div>

                <div className="flex flex-col gap-6">
                  <PixelPanel label="✨ 선택된 캐릭터" labelColor="#F97316">
                    <div className="p-5 pt-8 text-center sm:p-6 sm:pt-9">
                      <div
                        className="relative mx-auto mb-3 h-32 w-32 rounded-3xl"
                        style={{ backgroundColor: '#F0F9FF', border: '2px solid #BAE6FD', boxShadow: 'inset 0 2px 8px rgba(14,165,233,0.12)' }}
                      >
                        <Image src={resolveAvatarSrc(selectedCharacter.imagePath)} alt={selectedCharacter.name} fill className="object-contain p-2" sizes="128px" />
                      </div>
                      <h3 className="mb-4 text-xl font-black" style={{ color: NAVY }}>{selectedCharacter.name}</h3>

                      {isJoined ? (
                        <div className="space-y-3">
                          <LobbyNotice tone="success">
                            <div className="mb-1 text-2xl">✅</div>
                            <div>입장 완료!</div>
                            <div className="mt-1 text-xs opacity-80">선생님이 시작하면 자동으로 이동해요</div>
                          </LobbyNotice>
                          <PixelBtn color="purple" onClick={() => setStep('minigame')} className="w-full py-3 text-base">
                            🎮 기다리는 동안 미니게임
                          </PixelBtn>
                        </div>
                      ) : (
                        <LobbyNotice tone="info">⏳ 캐릭터를 선택해주세요!</LobbyNotice>
                      )}
                    </div>
                  </PixelPanel>

                  <PixelPanel label={`👥 플레이어 (${players.length}명)`} labelColor="#22C55E">
                    <div className="p-4 pt-8 sm:pt-9">
                      {room && (
                        <div
                          className="mb-3 rounded-2xl px-3 py-2 text-center text-sm font-black"
                          style={{ backgroundColor: '#F0F9FF', border: '2px solid #E0F2FE', color: '#0369A1' }}
                        >
                          {getGameModeConfig(room.game_mode || DEFAULT_GAME_MODE).emoji} {getGameModeConfig(room.game_mode || DEFAULT_GAME_MODE).shortLabel} 대기방
                        </div>
                      )}
                      <div className="grid max-h-48 grid-cols-4 gap-3 overflow-y-auto">
                        {players.length === 0 ? (
                          <div className="col-span-4 py-4 text-center text-sm font-black" style={{ color: '#64748B' }}>아직 아무도 없어요...</div>
                        ) : (
                          players.map((p: any) => (
                            <PlayerAvatar key={p.id} nickname={p.nickname} avatar={p.avatar || '🐶'} isReady={isJoined && p.id === playerId} />
                          ))
                        )}
                      </div>
                    </div>
                  </PixelPanel>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'minigame' && (
            <motion.div key="minigame" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-4xl">
              <LobbyStatusBar>
                <StatusChip tone="navy">👤 {nickname}</StatusChip>
                <StatusChip tone="sun">🎮 미니게임 점수: {minigameScore}</StatusChip>
                <PixelBtn color="white" onClick={() => setStep('character')} className="px-4 py-2 text-sm">← 돌아가기</PixelBtn>
              </LobbyStatusBar>

              <PixelPanel label="🕹️ 미니게임" labelColor="#8B5CF6">
                <div className="p-4 pt-8 sm:p-5 sm:pt-9">
                  <div className="aspect-video overflow-hidden rounded-2xl" style={{ border: '2px solid #BAE6FD' }}>
                    <Minigame characterImage={selectedCharacter.imagePath} onScoreChange={setMinigameScore} />
                  </div>
                </div>
              </PixelPanel>

              <div className="mt-4">
                <LobbyNotice tone="info" className="flex items-center justify-center gap-2 text-base">
                  <span className="text-xl">⏳</span>
                  선생님이 게임을 시작하면 자동으로 이동돼요!
                </LobbyNotice>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LobbyShell>
  )
}
