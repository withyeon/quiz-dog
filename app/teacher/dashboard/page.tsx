'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomResync } from '@/hooks/useRoomResync'
import { useAudioContext } from '@/components/AudioProvider'
import GameCodeModal from '@/components/GameCodeModal'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import GameModeSelector from '@/components/dashboards/GameModeSelector'
import LiveDashboardRenderer from '@/components/dashboards/LiveDashboardRenderer'
import TeacherBgmControl from '@/components/teacher/TeacherBgmControl'
import QRCodeSVG from 'react-qr-code'
import { DEFAULT_GAME_MODE, getGameModeConfig, isGameModeId, type GameModeId } from '@/lib/game/modes'
import { getTutorialHiddenStorageKey } from '@/lib/game/tutorials'
import { getZombieMeta, roomPlayerToZombiePlayer } from '@/lib/game/zombie'
import { isGameOver as isBattleGameOver } from '@/lib/game/battleRoyale'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import { formatServiceError } from '@/lib/services/errors'
import {
  assertQuestionSetHasQuestions,
  createRoom,
  finishRoom,
  getRoomByCode,
  pauseRoom,
  resetRoom,
  resumeRoom,
  startRoom,
  updateRoomGameMode,
} from '@/lib/services/rooms'
import { saveGameReportSnapshot } from '@/lib/services/reports'
import { getPlayerDisplayNickname, isAvatarPath } from '@/lib/utils/playerDisplay'

export default function TeacherDashboard() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [showGameCodeModal, setShowGameCodeModal] = useState(false)
  const [showLargeQrModal, setShowLargeQrModal] = useState(false)
  const [gameMode, setGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [timedDurationMinutes, setTimedDurationMinutes] = useState(5)
  const [showStartTutorial, setShowStartTutorial] = useState(false)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const [hideTutorialNextTime, setHideTutorialNextTime] = useState(false)
  const [timerDisplaySeconds, setTimerDisplaySeconds] = useState<number | null>(null)
  const autoFinishRequestedRef = useRef(false)
  const tutorialStateRef = useRef({
    isOpen: false,
    gameMode: DEFAULT_GAME_MODE,
    stepIndex: 0,
  })

  const { players, refreshPlayers } = usePlayersRealtime({ roomCode })
  const { room, refreshRoom } = useRoomRealtime({ roomCode })
  const resyncDashboard = useRoomResync(refreshRoom, refreshPlayers)
  const {
    sendEvent: sendRoomEvent,
  } = useRoomChannel({
    roomCode,
    role: 'teacher',
    enabled: Boolean(roomCode),
    onResyncNeeded: resyncDashboard,
  })
  const roomStatus = room?.status
  const activeModeConfig = getGameModeConfig(gameMode)
  const activeBgmTrack = useMemo(() => ({
    id: activeModeConfig.id,
    title: activeModeConfig.bgm.title,
    src: activeModeConfig.bgm.src,
  }), [activeModeConfig])
  const inviteUrl = typeof window !== 'undefined' && roomCode ? `${window.location.origin}/lobby?code=${roomCode}` : ''
  const { playBGM, pauseBGM, playSFX, stopBGM } = useAudioContext()

  const broadcastRoomPatch = useCallback((
    patch: Record<string, unknown>,
    reason: string,
  ) => {
    void sendRoomEvent('room:patch', { patch, reason })
    void sendRoomEvent('room:snapshot-hint', { reason })
  }, [sendRoomEvent])

  const broadcastTutorialState = useCallback((
    isOpen: boolean,
    stepIndex = tutorialStepIndex,
    nextMode = gameMode,
  ) => {
    tutorialStateRef.current = {
      isOpen,
      gameMode: nextMode,
      stepIndex,
    }

    if (!roomCode) return
    if (isOpen) {
      void sendRoomEvent('tutorial:show', { gameMode: nextMode, stepIndex })
    } else {
      void sendRoomEvent('tutorial:hide', { gameMode: nextMode })
    }
  }, [gameMode, roomCode, sendRoomEvent, tutorialStepIndex])

  const setTutorialStep = useCallback((nextStepIndex: number) => {
    setTutorialStepIndex(nextStepIndex)
    tutorialStateRef.current = {
      isOpen: true,
      gameMode,
      stepIndex: nextStepIndex,
    }
    if (roomCode) {
      void sendRoomEvent('tutorial:slide', { gameMode, stepIndex: nextStepIndex })
    }
  }, [gameMode, roomCode, sendRoomEvent])

  useEffect(() => {
    if (!roomCode) return

    return subscribeRoomRuntimeEvent((event) => {
      if (event.roomCode !== roomCode || event.type !== 'room:snapshot-hint') return
      const payload = event.payload as { reason?: string } | undefined
      if (payload?.reason !== 'player_joined') return

      const tutorialState = tutorialStateRef.current
      if (!tutorialState.isOpen) return
      void sendRoomEvent('tutorial:show', {
        gameMode: tutorialState.gameMode,
        stepIndex: tutorialState.stepIndex,
      })
    })
  }, [roomCode, sendRoomEvent])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const modeFromUrl = params.get('gameMode')
    const roomFromUrl = params.get('room')
    if (isGameModeId(modeFromUrl)) {
      setGameMode(modeFromUrl)
    }
    if (roomFromUrl) {
      setRoomCode(roomFromUrl)
      void getRoomByCode(roomFromUrl)
        .then((loadedRoom) => {
          if (loadedRoom?.game_mode && isGameModeId(loadedRoom.game_mode)) {
            setGameMode(loadedRoom.game_mode)
          }
        })
        .catch((error) => {
          console.error('Error loading room from URL:', error)
        })
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
    setIsGameStarted(roomStatus === 'playing' || roomStatus === 'paused')
    if (roomStatus !== 'playing' && roomStatus !== 'paused') {
      autoFinishRequestedRef.current = false
    }
  }, [roomStatus])

  useEffect(() => {
    if (!roomCode) {
      stopBGM()
      return
    }

    if (!roomStatus) return

    if (roomStatus === 'waiting' || roomStatus === 'playing') {
      playBGM('game', activeBgmTrack)
      return
    }

    if (roomStatus === 'paused') {
      pauseBGM()
      return
    }

    stopBGM()
  }, [activeBgmTrack, pauseBGM, playBGM, roomCode, roomStatus, stopBGM])

  useEffect(() => {
    return () => stopBGM()
  }, [stopBGM])

  useEffect(() => {
    if (
      !roomCode
      || !room
      || room.status !== 'playing'
      || !room.started_at
      || !room.duration_seconds
    ) {
      return
    }

    const finishByTimeLimit = async () => {
      if (autoFinishRequestedRef.current) return
      autoFinishRequestedRef.current = true

      try {
        await finishRoom(roomCode)
        const reason = room.game_mode === 'poop_dodge'
          ? 'poop_dodge_time_up'
          : `${room.game_mode || 'game'}_time_up`
        broadcastRoomPatch({ status: 'finished' }, reason)
        void sendRoomEvent('game:finished', {
          finishedBy: 'teacher',
          reason,
        })
        try {
          await saveGameReportSnapshot(room, players)
        } catch (reportError) {
          console.error('Error saving timed game report snapshot:', reportError)
        }
        stopBGM()
        router.push(`/teacher/game/${roomCode}/end`)
      } catch (error) {
        autoFinishRequestedRef.current = false
        console.error('시간 종료 실패:', error)
      }
    }

    const started = new Date(room.started_at).getTime()
    const totalSeconds = Number(room.duration_seconds)
    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - started) / 1000)
      if (elapsedSeconds >= totalSeconds) {
        void finishByTimeLimit()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

  useEffect(() => {
    if (room?.status === 'paused' && room.duration_seconds) {
      setTimerDisplaySeconds(Number(room.duration_seconds))
      return
    }
    if (room?.status !== 'playing' || !room.started_at || !room.duration_seconds) {
      setTimerDisplaySeconds(null)
      return
    }
    const started = new Date(room.started_at).getTime()
    const total = Number(room.duration_seconds)
    const update = () => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      setTimerDisplaySeconds(Math.max(0, total - elapsed))
    }
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [room?.status, room?.started_at, room?.duration_seconds])

  useEffect(() => {
    if (
      !roomCode
      || !room
      || room.status !== 'playing'
      || room.game_mode !== 'zombie'
      || autoFinishRequestedRef.current
    ) {
      return
    }

    const activePlayers = players.filter((player) => !player.is_kicked)
    // 게임 시작 전 입장한 플레이어만 체크 (도중 입장자는 active_item이 null)
    const playersWithRoles = activePlayers.filter((player) => getZombieMeta(player))
    if (playersWithRoles.length === 0) return

    const zombiePlayers = playersWithRoles.map(roomPlayerToZombiePlayer)
    const humans = zombiePlayers.filter((player) => player.role === 'human')
    if (humans.length > 0) return

    const finishByZombieWin = async () => {
      if (autoFinishRequestedRef.current) return
      autoFinishRequestedRef.current = true

      try {
        await finishRoom(roomCode)
        const reason = 'zombie_all_humans_infected'
        broadcastRoomPatch({ status: 'finished' }, reason)
        void sendRoomEvent('game:finished', {
          finishedBy: 'teacher',
          reason,
        })
        try {
          await saveGameReportSnapshot(room, players)
        } catch (reportError) {
          console.error('Error saving zombie game report snapshot:', reportError)
        }
        stopBGM()
        router.push(`/teacher/game/${roomCode}/end`)
      } catch (error) {
        autoFinishRequestedRef.current = false
        console.error('좀비 조기 종료 실패:', error)
      }
    }

    void finishByZombieWin()
  }, [broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

  // 눈싸움 대작전: 한 팀 전멸(또는 개인전 최후 생존) 시 자동 종료
  useEffect(() => {
    if (
      !roomCode
      || !room
      || room.status !== 'playing'
      || room.game_mode !== 'battle_royale'
      || autoFinishRequestedRef.current
    ) {
      return
    }

    // 게임이 실제로 시작됐는지 — 모든 활성 플레이어가 장비(직업)를 선택한 뒤에만 판정.
    // (직업 선택 전에는 체력 변화가 없어 오판할 일이 없지만, 0/1명 등 엣지에서의 조기 종료를 막는다.)
    const activePlayers = players.filter((player) => !player.is_kicked)
    if (activePlayers.length < 2) return
    const allReady = activePlayers.every((player) => player.player_class)
    if (!allReady) return

    if (!isBattleGameOver(activePlayers)) return

    const finishByBattleEnd = async () => {
      if (autoFinishRequestedRef.current) return
      autoFinishRequestedRef.current = true

      try {
        await finishRoom(roomCode)
        const reason = 'battle_royale_decided'
        broadcastRoomPatch({ status: 'finished' }, reason)
        void sendRoomEvent('game:finished', {
          finishedBy: 'teacher',
          reason,
        })
        try {
          await saveGameReportSnapshot(room, players)
        } catch (reportError) {
          console.error('Error saving battle game report snapshot:', reportError)
        }
        stopBGM()
        router.push(`/teacher/game/${roomCode}/end`)
      } catch (error) {
        autoFinishRequestedRef.current = false
        console.error('눈싸움 조기 종료 실패:', error)
      }
    }

    void finishByBattleEnd()
  }, [broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

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
      if (activeModeConfig.requiresQuestionSet) {
        if (!setId) {
          alert('이 게임은 문제집이 필요합니다. 문제집을 선택한 뒤 새 게임을 만들어주세요.')
          return
        }
        playBGM('game', activeBgmTrack)
        await assertQuestionSetHasQuestions(setId)
      } else {
        playBGM('game', activeBgmTrack)
      }

      const createdRoom = await createRoom({ setId, gameMode })
      setRoomCode(createdRoom.room_code)

      // 방 생성 후에는 모달 대신 대기방 화면을 바로 보여준다.
      setShowGameCodeModal(false)
      setIsGameStarted(false)
    } catch (error) {
      stopBGM()
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
      const setId = room?.set_id ?? params.get('set')
      const startedAt = new Date().toISOString()
      if (activeModeConfig.requiresQuestionSet) {
        if (!setId) {
          alert('이 방에는 문제집이 연결되어 있지 않습니다. 문제집을 선택해 새 게임을 만들어주세요.')
          return
        }
        await assertQuestionSetHasQuestions(setId)
      }
      await startRoom({
        roomCode,
        gameMode,
        durationSeconds: timedDurationMinutes * 60,
      })
      broadcastRoomPatch({
        status: 'playing',
        game_mode: gameMode,
        started_at: startedAt,
        duration_seconds: timedDurationMinutes * 60,
      }, 'teacher_start')

      setIsGameStarted(true)
      setShowGameCodeModal(false)
      setShowStartTutorial(false)
      broadcastTutorialState(false)
      playBGM('game', activeBgmTrack)
    } catch (error) {
      console.error('Error starting game:', error)
      alert('게임 시작에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const handleStartButtonClick = () => {
    if (!roomCode) return
    const shouldHideTutorial = window.localStorage.getItem(getTutorialHiddenStorageKey(gameMode)) === 'true'
    if (shouldHideTutorial) {
      void handleConfirmStart()
      return
    }

    setTutorialStepIndex(0)
    setHideTutorialNextTime(false)
    setShowStartTutorial(true)
    broadcastTutorialState(true, 0, gameMode)
  }

  const handleStartFromTutorial = () => {
    if (hideTutorialNextTime) {
      window.localStorage.setItem(getTutorialHiddenStorageKey(gameMode), 'true')
    }
    broadcastTutorialState(false)
    void handleConfirmStart()
  }

  const handleCloseStartTutorial = () => {
    setShowStartTutorial(false)
    broadcastTutorialState(false)
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
      stopBGM()
      router.push(`/teacher/game/${roomCode}/end`)
    } catch (error) {
      console.error('Error ending game:', error)
      alert('게임 종료에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const getTimedRemainingSeconds = useCallback(() => {
    if (!room?.started_at || !room.duration_seconds) return null
    const elapsedSeconds = Math.floor((Date.now() - new Date(room.started_at).getTime()) / 1000)
    return Math.max(1, Number(room.duration_seconds) - elapsedSeconds)
  }, [room?.duration_seconds, room?.started_at])

  const handlePauseGame = async () => {
    if (!roomCode || !room || room.status !== 'playing') return
    playSFX('click')

    try {
      const remaining = getTimedRemainingSeconds()
      await pauseRoom(roomCode, remaining)
      broadcastRoomPatch({
        status: 'paused',
        ...(remaining != null ? { duration_seconds: remaining } : {}),
      }, 'teacher_pause')
      pauseBGM()
    } catch (error) {
      console.error('Error pausing game:', error)
      alert('게임 일시정지에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const handleResumeGame = async () => {
    if (!roomCode || !room || room.status !== 'paused') return
    playSFX('click')

    try {
      const startedAt = new Date().toISOString()
      await resumeRoom(roomCode, room.duration_seconds)
      broadcastRoomPatch({
        status: 'playing',
        started_at: startedAt,
        ...(room.duration_seconds != null ? { duration_seconds: room.duration_seconds } : {}),
      }, 'teacher_resume')
      playBGM('game', activeBgmTrack)
    } catch (error) {
      console.error('Error resuming game:', error)
      alert('게임 재개에 실패했습니다: ' + formatServiceError(error))
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
      stopBGM()
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
    const normalizedAvatar = String(avatar || '').trim()
    const displayNickname = getPlayerDisplayNickname(nickname, avatar)

    if (isAvatarPath(normalizedAvatar)) {
      return (
        <Image
          src={normalizedAvatar.startsWith('/') ? normalizedAvatar : `/${normalizedAvatar}`}
          alt={displayNickname}
          fill
          className="object-contain scale-125"
          sizes="56px"
        />
      )
    }

    return normalizedAvatar || '🐶'
  }

  return (
    <div className="font-bitbit">
      {/* 페이지 제목 - 블루킷 스타일 */}
      <h1 className="text-4xl font-bold text-black mb-8">게임 시작</h1>

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
            {/* 공통 게임 시간 설정 */}
            {(
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <label className="block text-lg font-semibold text-amber-800 mb-2">⏱️ 게임 시간 (몇 분 후 자동 종료)</label>
                <div className="flex flex-wrap gap-3">
                  {[3, 5, 7, 10].map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => setTimedDurationMinutes(minutes)}
                      className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${timedDurationMinutes === minutes
                        ? 'border-amber-500 bg-amber-200 text-amber-900'
                        : 'border-amber-200 bg-white text-amber-800 hover:border-amber-400'
                        }`}
                    >
                      {minutes}분
                    </button>
                  ))}
                </div>
                <p className="text-sm text-amber-700 mt-2">
                  시간이 되면 자동 종료되고 순위를 공개해요.
                </p>
              </div>
            )}

            {roomStatus !== 'finished' && <TeacherBgmControl />}

            {roomStatus === 'waiting' ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-3xl bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 p-6 text-white shadow-xl shadow-sky-200">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-sky-50">참가코드</p>
                      <div className="mt-1 text-6xl font-black tracking-wider">{roomCode}</div>
                    </div>
                    {activeModeConfig.image ? (
                        <div className="relative h-24 w-56">
                          <Image
                            src={activeModeConfig.image}
                            alt={activeModeConfig.shortLabel}
                            fill
                            className="object-contain"
                            sizes="224px"
                          />
                        </div>
                      ) : (
                        <div className="text-7xl">{activeModeConfig.emoji}</div>
                      )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sky-50">
                    <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">참가자 {players.length}명</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-xl shadow-sky-100">
                  <p className="mb-3 text-sm font-black text-slate-500">QR 코드로 입장</p>
                  <button
                    type="button"
                    onClick={() => setShowLargeQrModal(true)}
                    className="mx-auto inline-block rounded-2xl border-2 border-sky-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
                    aria-label="QR 코드 크게 보기"
                  >
                    <QRCodeSVG
                      value={inviteUrl}
                      size={260}
                      level="H"
                    />
                  </button>
                  <p className="mt-2 text-xs font-bold text-slate-400">QR을 누르면 크게 볼 수 있어요</p>
                  <button
                    onClick={handleCopyInvite}
                    className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    초대 링크 복사
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-5 rounded-3xl border border-sky-100 bg-white px-6 py-5 text-center shadow-xl shadow-sky-100">
                <div>
                  <p className="text-xs font-black text-sky-500">참가코드</p>
                  <div className="text-4xl font-black tracking-wider text-black">{roomCode}</div>
                </div>
                {timerDisplaySeconds !== null && (
                  <div className={`flex flex-col items-center rounded-2xl px-6 py-3 ${
                    timerDisplaySeconds <= 60
                      ? 'bg-red-50 ring-2 ring-red-400'
                      : timerDisplaySeconds <= 120
                        ? 'bg-amber-50 ring-2 ring-amber-300'
                        : 'bg-slate-50 ring-1 ring-slate-200'
                  }`}>
                    <p className={`text-xs font-black ${timerDisplaySeconds <= 60 ? 'text-red-500' : timerDisplaySeconds <= 120 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {roomStatus === 'paused' ? '⏸ 일시정지' : '⏱ 남은 시간'}
                    </p>
                    <div className={`text-5xl font-black tabular-nums ${timerDisplaySeconds <= 60 ? 'text-red-600' : timerDisplaySeconds <= 120 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {timerDisplaySeconds >= 60
                        ? `${Math.floor(timerDisplaySeconds / 60)}분 ${String(timerDisplaySeconds % 60).padStart(2, '0')}초`
                        : `${timerDisplaySeconds}초`}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowLargeQrModal(true)}
                  className="rounded-2xl border-2 border-sky-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
                  aria-label="QR 코드 크게 보기"
                >
                  <QRCodeSVG
                    value={inviteUrl}
                    size={110}
                    level="H"
                  />
                </button>
              </div>
            )}

            {roomStatus === 'waiting' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="mt-1 text-2xl font-black text-black">학생들이 입장하고 있어요</h2>
                  </div>
                  <button
                    onClick={handleStartButtonClick}
                    disabled={players.length === 0}
                    className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    🎮 게임 시작
                  </button>
                </div>

                {players.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
                    <div className="mb-3 text-4xl">🐶</div>
                    <p className="text-lg font-black text-slate-700">아직 참가한 학생이 없어요</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      학생들이 게임 코드를 입력하면 여기에 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {players.map((player) => {
                      const displayNickname = getPlayerDisplayNickname(player.nickname, player.avatar)

                      return (
                        <div
                          key={player.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                        >
                          <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-3xl ring-1 ring-slate-200">
                            {renderPlayerAvatar(player.avatar, displayNickname)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-black text-black">{displayNickname}</div>
                            <div className="mt-1 text-xs font-bold text-emerald-600">준비 완료</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowGameCodeModal(true)}
                className="flex-1 rounded-2xl border border-sky-200 bg-sky-50 px-6 py-5 text-xl font-black text-black shadow-lg shadow-sky-100 transition-all hover:-translate-y-0.5 hover:bg-sky-100 hover:shadow-xl"
              >
                코드 크게 보기
              </button>
              {isGameStarted && (
                <>
                  {roomStatus === 'paused' ? (
                    <button
                      onClick={handleResumeGame}
                      className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                    >
                      ▶️ 다시 시작
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseGame}
                      className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
                    >
                      ⏸️ 일시정지
                    </button>
                  )}
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
              className="rounded-2xl bg-sky-500 px-9 py-4 text-lg font-black text-white shadow-lg shadow-sky-200 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-sky-200"
            >
              게임 시작하기
            </button>
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

      <GameStartTutorialModal
        gameMode={gameMode}
        isOpen={showStartTutorial}
        stepIndex={tutorialStepIndex}
        role="teacher"
        hideNextTime={hideTutorialNextTime}
        onHideNextTimeChange={setHideTutorialNextTime}
        onStepChange={setTutorialStep}
        onStart={handleStartFromTutorial}
        onClose={handleCloseStartTutorial}
      />

      {showLargeQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl">
            <p className="text-base font-black text-sky-500">참가코드</p>
            <div className="mt-1 text-6xl font-black tracking-wider text-black">{roomCode}</div>
            <div className="mx-auto mt-6 inline-block rounded-3xl border-4 border-sky-100 bg-white p-6 shadow-lg">
              <QRCodeSVG
                value={inviteUrl}
                size={360}
                level="H"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex-1 rounded-2xl bg-sky-500 px-5 py-4 text-lg font-black text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600"
              >
                초대 링크 복사
              </button>
              <button
                type="button"
                onClick={() => setShowLargeQrModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-black text-slate-700 transition hover:bg-slate-100"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
