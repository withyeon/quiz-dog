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
import type { HostMode } from '@/components/teacher/play/HomeworkPanel'
import { DEFAULT_STUDY_SETTINGS, buildRoomSettings, type StudySettings } from '@/lib/game/studySettings'
import { DEFAULT_GAME_MODE, getGameModeConfig, isGameModeId, type GameModeId } from '@/lib/game/modes'
import { getTutorialHiddenStorageKey } from '@/lib/game/tutorials'
import {
  DEFAULT_ZOMBIE_SETTINGS,
  buildZombieRoomSettings,
  getZombieMeta,
  roomPlayerToZombiePlayer,
  type ZombieSettings,
} from '@/lib/game/zombie'
import {
  DEFAULT_RAID_SETTINGS,
  buildRaidRoomSettings,
  computeRaidState,
  parseRaidSettings,
  type RaidSettings,
} from '@/lib/game/raid'
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

/**
 * 선생님 "게임 시작" 화면의 방 상태와 진행 규칙.
 * 방 만들기·시작·일시정지·재개·종료·초기화, 시간 종료와 모드별 조기 종료(좀비·레이드·눈싸움),
 * 시작 튜토리얼 방송, 배경음을 모두 여기서 처리하고 페이지(app/teacher/play/page.tsx)는 화면만 그린다.
 */
export function useTeacherPlayRoom() {
  const router = useRouter()
  const { user } = useAuth()
  const ownerId = user?.id ?? null
  const [roomCode, setRoomCode] = useState('')
  // 게임 시작에 쓸 문제집. 고르는 곳은 자료실 한 곳이고, 여기로는 ?set= 으로 넘어온다.
  const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string>('')
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [showGameCodeModal, setShowGameCodeModal] = useState(false)
  const [gameMode, setGameMode] = useState<GameModeId>(DEFAULT_GAME_MODE)
  const [timedDurationMinutes, setTimedDurationMinutes] = useState(5)
  // 공부 모드 옵션 — 방을 만들 때 rooms.settings 에 담긴다
  const [studySettings, setStudySettings] = useState<StudySettings>(DEFAULT_STUDY_SETTINGS)
  // 좀비 모드 옵션 — 게임 시간처럼 시작 버튼을 누를 때 rooms.settings 에 담긴다
  const [zombieSettings, setZombieSettings] = useState<ZombieSettings>(DEFAULT_ZOMBIE_SETTINGS)
  // 펭귄 레이드 옵션(펭귄 수) — 시작 버튼을 누를 때 참가 인원과 함께 rooms.settings 에 담긴다
  const [raidSettings, setRaidSettings] = useState<RaidSettings>(DEFAULT_RAID_SETTINGS)
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
  // 자료실에서 골라 ?set= 으로 넘어온 문제집. 이 화면에서는 고르지 않고 보여주기만 한다.
  const selectedSet = useMemo(
    () => questionSets.find((set) => set.id === selectedSetId) ?? null,
    [questionSets, selectedSetId],
  )
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

  // 시간 종료·좀비 전멸·레이드 승리·눈싸움 결판이 함께 쓰는 자동 종료.
  // autoFinishRequestedRef 로 한 번만 실행하고, 실패하면 플래그를 풀어 다음 판정 때 다시 시도한다.
  const finishAutomatically = useCallback(async (
    reason: string,
    failLabel: string,
    reportFailLabel: string,
  ) => {
    if (!roomCode || !room) return
    if (autoFinishRequestedRef.current) return
    autoFinishRequestedRef.current = true

    try {
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
        console.error(reportFailLabel, reportError)
      }
      stopBGM()
      router.push(`/teacher/game/${roomCode}/end`)
    } catch (error) {
      autoFinishRequestedRef.current = false
      console.error(failLabel, error)
    }
  }, [ownerId, broadcastRoomPatch, players, room, roomCode, router, sendRoomEvent, stopBGM])

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

    const started = new Date(room.started_at).getTime()
    const totalSeconds = Number(room.duration_seconds)
    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - started) / 1000)
      if (elapsedSeconds >= totalSeconds) {
        const reason = room.game_mode === 'poop_dodge'
          ? 'poop_dodge_time_up'
          : `${room.game_mode || 'game'}_time_up`
        void finishAutomatically(reason, '시간 종료 실패:', 'Error saving timed game report snapshot:')
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [finishAutomatically, room, roomCode])

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

    void finishAutomatically('zombie_all_humans_infected', '좀비 조기 종료 실패:', 'Error saving zombie game report snapshot:')
  }, [finishAutomatically, players, room, roomCode])

  // 펭귄 레이드: 펭귄을 전부 쓰러뜨리면(반 전체 승리) 자동 종료
  useEffect(() => {
    if (
      !roomCode
      || !room
      || room.status !== 'playing'
      || room.game_mode !== 'raid'
      || autoFinishRequestedRef.current
    ) {
      return
    }

    const raidState = computeRaidState(players, parseRaidSettings(room.settings))
    if (raidState.roster.length === 0 || !raidState.allDefeated) return

    void finishAutomatically('raid_victory', '펭귄 레이드 승리 종료 실패:', 'Error saving raid game report snapshot:')
  }, [finishAutomatically, players, room, roomCode])

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

    void finishAutomatically('battle_royale_decided', '눈싸움 조기 종료 실패:', 'Error saving battle game report snapshot:')
  }, [finishAutomatically, players, room, roomCode])

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

        // 문제집은 자료실에서 고르고 ?set= 으로 넘어온다.
        // 예전에는 ?set= 이 없으면 목록의 첫 문제집을 자동으로 골랐는데,
        // 선생님이 의도하지 않은 문제집으로 수업이 시작될 수 있어 없앴다.
        const fromUrl = new URLSearchParams(window.location.search).get('set')
        setSelectedSetId((prev) => {
          if (prev) return prev
          return fromUrl && usable.some((set) => set.id === fromUrl) ? fromUrl : ''
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
              : '이 게임은 문제집이 필요합니다. 자료실에서 문제집을 먼저 골라주세요.',
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
      const startSettings = gameMode === 'zombie'
        ? buildZombieRoomSettings(zombieSettings, room?.settings)
        : gameMode === 'raid'
          // 펭귄 체력의 기준 인원은 시작 순간의 참가자 수로 고정한다 (시작 뒤 입장해도 체력이 흔들리지 않게)
          ? buildRaidRoomSettings(
            { ...raidSettings, playerCount: players.filter((player) => !player.is_kicked).length },
            room?.settings,
          )
          : undefined
      await startRoom({
        roomCode,
        gameMode,
        durationSeconds: timedDurationMinutes * 60,
        ...(startSettings ? { settings: startSettings } : {}),
      })
      broadcastRoomPatch({
        status: 'playing',
        game_mode: gameMode,
        started_at: startedAt,
        duration_seconds: timedDurationMinutes * 60,
        ...(startSettings ? { settings: startSettings } : {}),
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

  return {
    roomCode,
    room,
    roomStatus,
    players,
    ownerId,
    // 문제집
    questionSets,
    selectedSetId,
    selectedSet,
    setsLoading,
    setsError,
    activeSetLabel,
    // 모드·옵션
    gameMode,
    activeModeConfig,
    hostMode,
    setHostMode,
    timedDurationMinutes,
    setTimedDurationMinutes,
    studySettings,
    setStudySettings,
    zombieSettings,
    setZombieSettings,
    raidSettings,
    setRaidSettings,
    // 진행 상태
    isGameStarted,
    timerDisplaySeconds,
    inviteUrl,
    // 모달·튜토리얼
    showGameCodeModal,
    setShowGameCodeModal,
    showStartTutorial,
    tutorialStepIndex,
    hideTutorialNextTime,
    setHideTutorialNextTime,
    setTutorialStep,
    // 핸들러
    handleGameModeChange,
    handleCreateGame,
    handleConfirmStart,
    handleStartButtonClick,
    handleStartFromTutorial,
    handleCloseStartTutorial,
    handleEndGame,
    handlePauseGame,
    handleResumeGame,
    handleResetGame,
    handleCopyInvite,
  }
}
