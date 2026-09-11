'use client'

import { toast } from '@/components/ui/Toaster'
import { bumpSharePlay } from '@/lib/services/sharing'
import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomResync } from '@/hooks/useRoomResync'
import { useAudioContext } from '@/components/AudioProvider'
import GameCodeModal from '@/components/GameCodeModal'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import GameModeSelector from '@/components/dashboards/GameModeSelector'
import PlaySteps from '@/components/teacher/play/PlaySteps'
import QuestionSetPicker from '@/components/teacher/play/QuestionSetPicker'
import WaitingPlayers from '@/components/teacher/play/WaitingPlayers'
import GameDurationPicker from '@/components/teacher/play/GameDurationPicker'
import RoomCodePanel from '@/components/teacher/play/RoomCodePanel'
import HomeworkPanel, { HostModeToggle, type HostMode } from '@/components/teacher/play/HomeworkPanel'
import StudyOptionsFields from '@/components/teacher/play/StudyOptionsFields'
import { DEFAULT_STUDY_SETTINGS, buildRoomSettings, type StudySettings } from '@/lib/game/studySettings'
import LiveDashboardRenderer from '@/components/dashboards/LiveDashboardRenderer'
import TeacherBgmControl from '@/components/teacher/TeacherBgmControl'
import QRCodeSVG from 'react-qr-code'
import { Play, Pause, Square, RotateCcw } from 'lucide-react'
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
import { useAuth } from '@/contexts/AuthContext'
import { listQuestionSetsWithCounts, type QuestionSetSummary } from '@/lib/services/questionSets'

export default function TeacherDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const ownerId = user?.id ?? null
  const [roomCode, setRoomCode] = useState('')
  // 게임 시작에 쓸 문제집 — 예전에는 URL(?set=)로만 받아서 대시보드에서 고를 방법이 없었다.
  const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string>('')
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [showGameCodeModal, setShowGameCodeModal] = useState(false)
  const [showLargeQrModal, setShowLargeQrModal] = useState(false)
  const [gameMode, setGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [timedDurationMinutes, setTimedDurationMinutes] = useState(5)
  // 공부 모드 옵션 — 방을 만들 때 rooms.settings 에 담긴다
  const [studySettings, setStudySettings] = useState<StudySettings>(DEFAULT_STUDY_SETTINGS)
  const [hostMode, setHostMode] = useState<HostMode>('live')
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
  // 현재 방(또는 선택된) 문제집 제목 — 대기방에서 어떤 문제집인지 확인용
  const activeSetLabel = useMemo(() => {
    const activeId = room?.set_id || selectedSetId
    if (!activeId) return null
    const found = questionSets.find((set) => set.id === activeId)
    return found ? `${found.title} (${found.question_count}문제)` : null
  }, [room?.set_id, selectedSetId, questionSets])
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
        const reason = room.game_mode === 'poop_dodge'
          ? 'poop_dodge_time_up'
          : `${room.game_mode || 'game'}_time_up`
        const finishPromise = finishRoom(roomCode)
        broadcastRoomPatch({ status: 'finished' }, reason)
        void sendRoomEvent('game:finished', {
          finishedBy: 'teacher',
          reason,
        })
        await finishPromise
        try {
          await saveGameReportSnapshot(room, players, ownerId)
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
  }, [ownerId, broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

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
        const reason = 'zombie_all_humans_infected'
        const finishPromise = finishRoom(roomCode)
        broadcastRoomPatch({ status: 'finished' }, reason)
        void sendRoomEvent('game:finished', {
          finishedBy: 'teacher',
          reason,
        })
        await finishPromise
        try {
          await saveGameReportSnapshot(room, players, ownerId)
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
  }, [ownerId, broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

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

    // 실제로 싸우고 있는 학생(장비=직업을 고른 학생)만으로 판정한다.
    // 예전에는 전원이 직업을 골랐는지 확인했는데, 게임 도중 들어와 직업 선택 화면에
    // 머무는 학생이 한 명만 있어도 자동 종료가 영영 걸리지 않았다.
    const activePlayers = players.filter((player) => !player.is_kicked)
    const combatants = activePlayers.filter((player) => player.player_class)
    if (combatants.length < 2) return

    if (!isBattleGameOver(combatants)) return

    const finishByBattleEnd = async () => {
      if (autoFinishRequestedRef.current) return
      autoFinishRequestedRef.current = true

      try {
        const reason = 'battle_royale_decided'
        const finishPromise = finishRoom(roomCode)
        broadcastRoomPatch({ status: 'finished' }, reason)
        void sendRoomEvent('game:finished', {
          finishedBy: 'teacher',
          reason,
        })
        await finishPromise
        try {
          await saveGameReportSnapshot(room, players, ownerId)
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
  }, [ownerId, broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

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

  // 문제집 목록 로드 (대시보드에서 바로 고를 수 있도록)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setSetsLoading(true)
      setSetsError(null)
      try {
        const sets = await listQuestionSetsWithCounts()
        if (cancelled) return
        const usable = sets.filter((set) => (set.question_count ?? 0) > 0)
        setQuestionSets(usable)

        // URL(?set=)로 들어온 경우 우선 선택, 없으면 첫 문제집
        const fromUrl = new URLSearchParams(window.location.search).get('set')
        setSelectedSetId((prev) => {
          if (prev) return prev
          if (fromUrl && usable.some((set) => set.id === fromUrl)) return fromUrl
          return usable[0]?.id ?? ''
        })
      } catch (error) {
        if (!cancelled) setSetsError(formatServiceError(error))
      } finally {
        if (!cancelled) setSetsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // 새 게임 생성 (랜덤 코드 생성)
  const handleCreateGame = async () => {
    playSFX('click')

    // Supabase 설정 확인
    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      toast.error(configCheck.error || 'Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }

    // 대시보드에서 고른 문제집을 우선 사용하고, 없으면 URL(?set=)을 폴백으로 쓴다.
    const setId = selectedSetId || new URLSearchParams(window.location.search).get('set')

    try {
      if (activeModeConfig.requiresQuestionSet) {
        if (!setId) {
          toast.info(
            questionSets.length === 0
              ? '아직 사용할 수 있는 문제집이 없어요. 먼저 문제집을 만들어주세요.'
              : '이 게임은 문제집이 필요합니다. 위에서 문제집을 선택해주세요.',
          )
          return
        }
        playBGM('game', activeBgmTrack)
        await assertQuestionSetHasQuestions(setId)
      } else {
        playBGM('game', activeBgmTrack)
      }

      const createdRoom = await createRoom({
        setId,
        gameMode,
        ...(gameMode === 'study' ? { settings: buildRoomSettings(studySettings) } : {}),
      })
      setRoomCode(createdRoom.room_code)

      // 공유받은 문제집이 실제 수업으로 이어졌는지 세어 둔다.
      // (인디스쿨에 뿌린 링크의 효과를 "열어본 횟수"와 나눠 보기 위한 것)
      if (setId) void bumpSharePlay(setId)

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

      toast.info(userMessage)
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
          toast.info('이 방에는 문제집이 연결되어 있지 않습니다. 문제집을 선택해 새 게임을 만들어주세요.')
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
      toast.error('게임 시작에 실패했습니다: ' + formatServiceError(error))
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
      const finishPromise = finishRoom(roomCode)
      broadcastRoomPatch({ status: 'finished' }, 'teacher_finish')
      void sendRoomEvent('game:finished', {
        finishedBy: 'teacher',
        reason: 'teacher_finish',
      })
      await finishPromise

      // 게임 종료 순간의 최종 성적 스냅샷을 영구 보관함(game_reports)에 저장
      try {
        await saveGameReportSnapshot(room, players, ownerId)
      } catch (reportError) {
        console.error('Error saving game report snapshot:', reportError)
      }

      setIsGameStarted(false)
      stopBGM()
      router.push(`/teacher/game/${roomCode}/end`)
    } catch (error) {
      console.error('Error ending game:', error)
      toast.error('게임 종료에 실패했습니다: ' + formatServiceError(error))
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
      toast.error('게임 일시정지에 실패했습니다: ' + formatServiceError(error))
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
      toast.error('게임 재개에 실패했습니다: ' + formatServiceError(error))
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
      toast.success('게임이 초기화되었습니다.')
    } catch (error) {
      console.error('Error resetting game:', error)
      toast.error('게임 초기화에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const handleCopyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('초대 링크가 복사되었습니다.')
    } catch (error) {
      console.error('초대 링크 복사 실패:', error)
      toast.success('복사에 실패했습니다. 링크를 직접 복사해주세요.')
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-4xl font-black tracking-tight text-slate-900">게임 시작</h1>

      <PlaySteps
        hasRoom={Boolean(roomCode)}
        roomStatus={room?.status}
        requiresQuestionSet={activeModeConfig.requiresQuestionSet}
        hasSelectedSet={Boolean(selectedSetId)}
        playerCount={players.length}
      />

      {/* 실시간 수업 / 과제로 내기 */}
      {!roomCode && <HostModeToggle value={hostMode} onChange={setHostMode} />}
      {!roomCode && hostMode === 'homework' && (
        <HomeworkPanel
          questionSets={questionSets}
          selectedSetId={selectedSetId}
          onSelectSet={setSelectedSetId}
          setsLoading={setsLoading}
          setsError={setsError}
          ownerId={ownerId}
        />
      )}

      {/* 방 설정 (실시간 수업) */}
      <div className={`mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${!roomCode && hostMode === 'homework' ? 'hidden' : ''}`}>

        {/* 게임 모드 선택 */}
        {!roomCode && (
          <GameModeSelector
            selectedMode={gameMode}
            onSelectMode={handleGameModeChange}
          />
        )}

        {/* 공부 모드 옵션 — 방을 만들기 전에 정한다 */}
        {!roomCode && gameMode === 'study' && (
          <div className="mb-6">
            <StudyOptionsFields value={studySettings} onChange={setStudySettings} context="live" />
          </div>
        )}

        {roomCode ? (
          <div className="space-y-4">
            <GameDurationPicker minutes={timedDurationMinutes} onChange={setTimedDurationMinutes} />

            {roomStatus !== 'finished' && <TeacherBgmControl />}

            <RoomCodePanel
              roomCode={roomCode}
              roomStatus={roomStatus}
              inviteUrl={inviteUrl}
              modeConfig={activeModeConfig}
              playerCount={players.length}
              activeSetLabel={activeSetLabel}
              timerDisplaySeconds={timerDisplaySeconds}
              onShowLargeQr={() => setShowLargeQrModal(true)}
              onCopyInvite={handleCopyInvite}
            />

            {roomStatus === 'waiting' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">학생 입장 대기 중</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">참가자 {players.length}명</p>
                  </div>
                  <button
                    onClick={handleStartButtonClick}
                    disabled={players.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-4 text-lg font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    게임 시작
                  </button>
                </div>

                <WaitingPlayers players={players} />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowGameCodeModal(true)}
                className="flex-1 rounded-2xl border border-sky-200 bg-sky-50 px-6 py-5 text-xl font-extrabold text-sky-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-100 hover:shadow-md"
              >
                코드 크게 보기
              </button>
              {isGameStarted && (
                <>
                  {roomStatus === 'paused' ? (
                    <button
                      onClick={handleResumeGame}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                      <Play className="h-5 w-5 fill-current" /> 다시 시작
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseGame}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
                    >
                      <Pause className="h-5 w-5 fill-current" /> 일시정지
                    </button>
                  )}
                  <button
                    onClick={handleEndGame}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-red-600"
                  >
                    <Square className="h-5 w-5 fill-current" /> 게임 종료
                  </button>
                  <button
                    onClick={handleResetGame}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-slate-600"
                  >
                    <RotateCcw className="h-5 w-5" /> 초기화
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12">
            {/* 문제집 선택 — 예전에는 URL(?set=)로만 지정할 수 있어서
                대시보드에서 바로 게임을 시작할 방법이 없었다. */}
            {activeModeConfig.requiresQuestionSet && (
              <QuestionSetPicker
                questionSets={questionSets}
                selectedSetId={selectedSetId}
                loading={setsLoading}
                error={setsError}
                onSelect={setSelectedSetId}
                onCreateQuestionSet={() => router.push('/teacher/create')}
              />
            )}

            <div className="text-center">
              <p className="mb-6 text-lg font-medium text-slate-500">
                {activeModeConfig.requiresQuestionSet && !selectedSetId
                  ? '문제집을 선택하면 게임을 시작할 수 있어요'
                  : '모드를 고르고 새 게임 만들기'}
              </p>
              <button
                onClick={handleCreateGame}
                disabled={activeModeConfig.requiresQuestionSet && !selectedSetId}
                className="rounded-2xl bg-sky-500 px-9 py-4 text-lg font-bold text-white shadow-sm shadow-sky-200 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:hover:translate-y-0"
              >
                새 게임 만들기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 게임 모드에 따른 표시 또는 통계 화면 */}
      {roomCode && room && room.status !== 'waiting' && (
        <div className="font-bitbit">
          <LiveDashboardRenderer room={room} players={players} />
        </div>
      )}

      {!roomCode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="font-medium text-slate-500">게임을 만들면 참가자 목록이 여기에 표시돼요</p>
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

      <div className="font-bitbit">
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
      </div>

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
