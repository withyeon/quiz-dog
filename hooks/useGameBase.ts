'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomResync } from '@/hooks/useRoomResync'
import { useAudioContext } from '@/components/AudioProvider'
import { getGameModeUrl } from '@/lib/game/modes'
import { isTerminalRoomStatus, type RoomStatus } from '@/lib/game/roomStatus'
import {
    isRoomHostPlayer,
    subscribeRoomRuntimeEvent,
    type RoomPatchPayload,
} from '@/lib/realtime/roomChannel'
import { finishRoom } from '@/lib/services/rooms'
import { formatServiceError } from '@/lib/services/errors'
import { updatePlayer } from '@/lib/services/players'
import {
    checkQuestionAnswer,
    listQuestionsForGame,
    type GameQuestion,
} from '@/lib/services/questions'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type PlayerPatch = Partial<Player> & Record<string, unknown>

export type Question = GameQuestion

export type AnswerRecord = {
    questionIndex: number
    isCorrect: boolean
    selectedAnswer?: string
}

export { getGameModeUrl }

export const DEFAULT_PRE_START_QUIZ_TOTAL = 3

interface UseGameBaseOptions {
    /** 이 게임 페이지가 어떤 게임 모드인지 (리다이렉트용) */
    expectedGameMode: string
    /** 오답 후 대기 시간 (ms). 기본값: 2000 */
    wrongAnswerDelay?: number
    /** 퀴즈 제한 시간 (초). 기본값: 30 */
    timeLimit?: number
    /** 게임 시작 전 제출해야 하는 문제 수. 기본값: 3 */
    preStartQuizTotal?: number
}

/**
 * 모든 게임 모드에서 공통으로 사용하는 기본 훅.
 *
 * 포함 기능:
 * - URL에서 roomCode / playerId 파싱
 * - 실시간 room / players 구독
 * - 문제 가져오기
 * - 게임 상태(waiting → playing → finished) 감지 및 화면 전환
 * - 정답 비교 (checkAnswer)
 * - 퀴즈 인덱스 관리 + sessionStorage 복구
 * - 게임 모드 불일치 시 자동 리다이렉트
 * - 정답/오답 기록 (answerHistory)
 */
export function useGameBase(options: UseGameBaseOptions) {
    const {
        expectedGameMode,
        wrongAnswerDelay = 2000,
        timeLimit = 30,
        preStartQuizTotal = DEFAULT_PRE_START_QUIZ_TOTAL,
    } = options
    const requiredPreStartQuizCount = Math.max(0, preStartQuizTotal)
    const router = useRouter()

    // ─── 핵심 상태 ───
    const [roomCode, setRoomCode] = useState('')
    const [playerId, setPlayerId] = useState<string | null>(null)
    const [currentView, setCurrentView] = useState<string>('lobby')
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedAnswer, setSelectedAnswer] = useState<string>('')
    const [isCorrect, setIsCorrect] = useState(false)
    const [showCountdown, setShowCountdown] = useState(false)
    const [consecutiveCorrect, setConsecutiveCorrect] = useState(0)
    const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([])
    const [questions, setQuestions] = useState<Question[]>([])
    const [questionsLoading, setQuestionsLoading] = useState(false)
    const [questionsError, setQuestionsError] = useState<string | null>(null)
    const [isAnswerLocked, setIsAnswerLocked] = useState(false) // 중복 제출 방지
    const [preStartSubmittedCount, setPreStartSubmittedCount] = useState(0)
    const [preStartQuestionIndex, setPreStartQuestionIndex] = useState(0)
    const [isPreStartAnswerLocked, setIsPreStartAnswerLocked] = useState(false)

    const questionStartTime = useRef<number>(Date.now())
    const autoFinishRequestedRef = useRef(false)
    const [hasRestoredData, setHasRestoredData] = useState(false)
    const [canSyncAnswerHistory, setCanSyncAnswerHistory] = useState(true)

    // ─── 세션으로 플레이어 복구 ───
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const code = params.get('room')
            const id = params.get('playerId')
            if (code) setRoomCode(code)
            if (id) setPlayerId(id)

            // 새로고침 복구
            if (code) {
                const savedIndex = sessionStorage.getItem(`quiz_index_${code}`)
                if (savedIndex) {
                    setCurrentQuestionIndex(parseInt(savedIndex, 10))
                }
            }
        }
    }, [])

    // ─── 실시간 구독 ───
    const {
        players,
        loading: playersLoading,
        refreshPlayers,
        applyPlayerPatch,
    } = usePlayersRealtime({ roomCode })
    const {
        room,
        loading: roomLoading,
        refreshRoom,
    } = useRoomRealtime({ roomCode })
    const resyncRoomSnapshot = useRoomResync(refreshRoom, refreshPlayers)
    const roomChannel = useRoomChannel({
        roomCode,
        playerId,
        role: 'student',
        enabled: Boolean(roomCode),
        onResyncNeeded: resyncRoomSnapshot,
    })
    const {
        presence,
        status: roomChannelStatus,
        onlineCount: roomOnlineCount,
        sendEvent: sendRoomEvent,
        requestResync: requestRoomResync,
    } = roomChannel
    const roomStatus = room?.status
    const { playBGM, playSFX } = useAudioContext()

    const forceFinishForStudent = useCallback((reason = 'forced_finish') => {
        setShowCountdown(false)
        setCurrentView('result')
        playBGM('result')

        if (roomCode && playerId) {
            router.replace(`/student/game/${roomCode}/result?playerId=${playerId}&reason=${encodeURIComponent(reason)}`)
        }
    }, [playBGM, playerId, roomCode, router])

    // ─── 현재 플레이어 & 문제 ───
    const currentPlayer = players.find((p) => p.id === playerId) || null
    const currentQuestion = questions.length > 0
        ? questions[currentQuestionIndex % questions.length]
        : null
    const preStartQuizQuestion = questions.length > 0
        ? questions[preStartQuestionIndex % questions.length]
        : null
    const preStartQuizSessionKey = useMemo(() => {
        if (!roomCode || !playerId || !room?.started_at) return null
        return `pre_start_quiz_${expectedGameMode}_${roomCode}_${playerId}_${room.started_at}`
    }, [expectedGameMode, playerId, room?.started_at, roomCode])
    const isPreStartQuizComplete = requiredPreStartQuizCount === 0
        || preStartSubmittedCount >= requiredPreStartQuizCount
    const shouldShowPreStartQuiz = roomStatus === 'playing' && !isPreStartQuizComplete
    const isRoomHost = useMemo(
        () => isRoomHostPlayer(playerId, players, presence),
        [playerId, players, presence],
    )

    useEffect(() => {
        if (!roomCode) return

        return subscribeRoomRuntimeEvent((event) => {
            if (event.roomCode !== roomCode) return

            if (event.type === 'game:finished') {
                const payload = event.payload as { reason?: string } | undefined
                forceFinishForStudent(payload?.reason || 'game_finished_event')
                return
            }

            if (event.type === 'room:patch') {
                const payload = event.payload as RoomPatchPayload | undefined
                if (isTerminalRoomStatus(payload?.patch?.status as RoomStatus | undefined)) {
                    forceFinishForStudent(payload?.reason || 'room_finished_patch')
                }
            }
        })
    }, [forceFinishForStudent, roomCode])

    const commitPlayerPatch = useCallback(async (
        targetPlayerId: string,
        patch: PlayerPatch,
        reason = 'player_update',
    ) => {
        applyPlayerPatch(targetPlayerId, patch)
        void sendRoomEvent('player:patch', {
            playerId: targetPlayerId,
            patch,
            reason,
        })

        try {
            await updatePlayer(targetPlayerId, patch)
        } catch (error) {
            requestRoomResync('manual')
            throw error
        }
    }, [applyPlayerPatch, requestRoomResync, sendRoomEvent])

    // ─── 기존 데이터 복구 (새로고침 방어) ───
    useEffect(() => {
        if (currentPlayer && !hasRestoredData) {
            if (currentPlayer.answer_history && Array.isArray(currentPlayer.answer_history) && currentPlayer.answer_history.length > 0) {
                setAnswerHistory(currentPlayer.answer_history as any)
            }
            setHasRestoredData(true)
        }
    }, [currentPlayer, hasRestoredData])

    // ─── 게임 모드 리다이렉트 ───
    useEffect(() => {
        if (!room || roomLoading || !roomCode || !playerId) return

        const gameMode = room.game_mode || 'gold_quest'
        if (gameMode !== expectedGameMode) {
            const correctUrl = getGameModeUrl(gameMode, roomCode, playerId)
            if (correctUrl !== window.location.pathname + window.location.search) {
                router.replace(correctUrl)
            }
        }
    }, [room, roomLoading, roomCode, playerId, expectedGameMode, router])

    // ─── 문제 가져오기 ───
    useEffect(() => {
        if (!room?.set_id) {
            setQuestions([])
            setQuestionsLoading(false)
            setQuestionsError(null)
            return
        }
        const setId = room.set_id
        let isMounted = true

        const fetchQuestions = async () => {
            setQuestionsLoading(true)
            setQuestionsError(null)
            setQuestions([])
            try {
                const loadedQuestions = await listQuestionsForGame(setId)
                if (isMounted) setQuestions(loadedQuestions)
            } catch (error) {
                const msg = formatServiceError(error)
                console.error('Error fetching questions:', msg, error)
                if (isMounted) {
                    setQuestions([])
                    setQuestionsError(msg)
                }
            } finally {
                if (isMounted) setQuestionsLoading(false)
            }
        }

        fetchQuestions()
        return () => {
            isMounted = false
        }
    }, [room?.set_id])

    // ─── 게임 시작 전 3문제 제출 게이트 ───
    useEffect(() => {
        if (requiredPreStartQuizCount === 0) {
            setPreStartSubmittedCount(0)
            setPreStartQuestionIndex(0)
            setIsPreStartAnswerLocked(false)
            return
        }

        if (roomStatus === 'waiting') {
            setPreStartSubmittedCount(0)
            setPreStartQuestionIndex(0)
            setIsPreStartAnswerLocked(false)
            return
        }

        if (roomStatus !== 'playing' || !preStartQuizSessionKey || typeof window === 'undefined') return

        const savedCount = Number(window.sessionStorage.getItem(preStartQuizSessionKey) ?? '0')
        const restoredCount = Number.isFinite(savedCount)
            ? Math.min(requiredPreStartQuizCount, Math.max(0, savedCount))
            : 0

        setPreStartSubmittedCount(restoredCount)
        setPreStartQuestionIndex(restoredCount)
        setIsPreStartAnswerLocked(false)
    }, [preStartQuizSessionKey, requiredPreStartQuizCount, roomStatus])

    useEffect(() => {
        if (
            requiredPreStartQuizCount === 0
            || roomStatus !== 'playing'
            || !preStartQuizSessionKey
            || typeof window === 'undefined'
        ) {
            return
        }

        window.sessionStorage.setItem(
            preStartQuizSessionKey,
            String(Math.min(preStartSubmittedCount, requiredPreStartQuizCount)),
        )
    }, [preStartQuizSessionKey, preStartSubmittedCount, requiredPreStartQuizCount, roomStatus])

    // ─── 게임 상태 전환 (waiting → playing → finished) ───
    useEffect(() => {
        if (!room) return

        if (roomStatus === 'playing') {
            if (!isPreStartQuizComplete) {
                if (showCountdown) setShowCountdown(false)
                return
            }

            if (currentView === 'lobby' && !showCountdown) {
                // 새로고침 복구: 인덱스 남아있으면 카운트다운 건너뛰기
                const savedIndex = roomCode ? sessionStorage.getItem(`quiz_index_${roomCode}`) : null
                if (savedIndex && parseInt(savedIndex, 10) > 0) {
                    setCurrentView('quiz')
                    playBGM('game')
                } else {
                    setShowCountdown(true)
                }
            }
        } else if (roomStatus === 'waiting') {
            if (currentView !== 'lobby') {
                setCurrentView('lobby')
                setShowCountdown(false)
            }
        } else if (isTerminalRoomStatus(roomStatus)) {
            forceFinishForStudent(`room_status_${roomStatus}`)
        }
    }, [roomStatus, currentView, showCountdown, playBGM, roomCode, room, playerId, router, isPreStartQuizComplete, forceFinishForStudent])

    useEffect(() => {
        if (roomStatus !== 'playing') {
            autoFinishRequestedRef.current = false
        }
    }, [roomStatus])

    // 주기적 정합성 보정: 실시간 채널이 '구독됨'이지만 조용히 이벤트를 놓치는 경우에도
    // 시작/종료/점수 상태가 일정 주기로 다시 맞춰지도록 방·플레이어 스냅샷을 silent 재동기화한다.
    // (실시간=즉시성, 폴링=정합성 보정. 교실 라이브 게임에서 '멈춤' 방지의 안전망)
    useEffect(() => {
        if (!roomCode) return
        const interval = window.setInterval(() => {
            void resyncRoomSnapshot('periodic')
        }, 30000)
        return () => window.clearInterval(interval)
    }, [roomCode, resyncRoomSnapshot])

    // 제한 시간 종료(학생 측). 학생은 세션 권한이 없으므로 DB에 쓰지 않는다.
    // 종료 시각(started_at + duration_seconds)에 도달하면 '자기 화면만' 결과로 전환한다(로컬 표시).
    // 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당하며, 학생은 그 신호를 받아
    // 결과 페이지로 이동한다. 이 로컬 종료는 신호가 늦어도 학생이 멈추지 않게 하는 안전망이다.
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

        const startedMs = new Date(room.started_at).getTime()
        const durationSeconds = Number(room.duration_seconds)
        if (!Number.isFinite(startedMs) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return

        const tick = () => {
            if (autoFinishRequestedRef.current) return
            const elapsedSeconds = Math.floor((Date.now() - startedMs) / 1000)
            if (elapsedSeconds >= durationSeconds) {
                autoFinishRequestedRef.current = true
                forceFinishForStudent(`${expectedGameMode}_time_up_local`)
            }
        }

        tick()
        const interval = window.setInterval(tick, 1000)
        return () => window.clearInterval(interval)
    }, [expectedGameMode, forceFinishForStudent, room, roomCode])

    // ─── 카운트다운 완료 처리 ───
    const handleCountdownComplete = useCallback(() => {
        setShowCountdown(false)
        setCurrentView('quiz')
        playBGM('game')
        questionStartTime.current = Date.now()
    }, [playBGM])

    // ─── 문제 인덱스 저장 ───
    useEffect(() => {
        if (roomCode && currentQuestionIndex > 0) {
            sessionStorage.setItem(`quiz_index_${roomCode}`, String(currentQuestionIndex))
        }
    }, [currentQuestionIndex, roomCode])

    // ─── 정답 비교 (서버 검증 RPC 호출) ───
    const checkAnswer = useCallback(async (answer: string): Promise<boolean> => {
        if (!currentQuestion || isAnswerLocked) return false

        setIsAnswerLocked(true)
        setSelectedAnswer(answer)

        // 시간 초과 (빈 답안)
        if (answer === '') {
            setIsCorrect(false)
            setAnswerHistory((prev) => [...prev, { questionIndex: currentQuestionIndex, isCorrect: false, selectedAnswer: '' }])
            setConsecutiveCorrect(0)
            return false
        }

        const normalizedAnswer = String(answer).trim()
        let correct = false

        try {
            correct = await checkQuestionAnswer(currentQuestion.id, normalizedAnswer)
        } catch (err) {
            console.error('채점 오류, 오답 처리함:', formatServiceError(err), err)
            correct = false
        }

        setIsCorrect(correct)
        setAnswerHistory((prev) => [...prev, { questionIndex: currentQuestionIndex, isCorrect: correct, selectedAnswer: normalizedAnswer }])

        if (correct) {
            setConsecutiveCorrect((prev) => prev + 1)
        } else {
            setConsecutiveCorrect(0)
        }

        return correct
    }, [currentQuestion, currentQuestionIndex, isAnswerLocked])

    // ─── 정답 기록 DB 동기화 ───
    useEffect(() => {
        if (playerId && answerHistory.length > 0 && canSyncAnswerHistory) {
            const syncTimer = window.setTimeout(() => {
                updatePlayer(playerId, { answer_history: answerHistory })
                .catch((error) => {
                    const message = formatServiceError(error)
                    console.error('정답 기록 동기화 실패:', message, error)

                    // 구형 스키마에서는 answer_history 컬럼이 없을 수 있다.
                    if (
                        message.includes('answer_history')
                        || message.includes('42703')
                        || message.includes('column')
                    ) {
                        setCanSyncAnswerHistory(false)
                    }
                })
            }, 700)

            return () => window.clearTimeout(syncTimer)
        }
    }, [answerHistory, playerId, canSyncAnswerHistory])

    // ─── 다음 문제로 이동 ───
    const goToNextQuestion = useCallback(() => {
        setCurrentView('quiz')
        setCurrentQuestionIndex((prev) => prev + 1)
        setSelectedAnswer('')
        setIsCorrect(false)
        setIsAnswerLocked(false) // 잠금 해제
        questionStartTime.current = Date.now()
    }, [])

    // ─── 오답 처리 (공통 패턴: wrong 뷰 보여주고 → 일정 시간 후 다음 문제) ───
    const handleWrongAnswer = useCallback(() => {
        setCurrentView('wrong')
        setTimeout(() => {
            goToNextQuestion()
        }, wrongAnswerDelay)
    }, [wrongAnswerDelay, goToNextQuestion])

    // ─── 시작 전 퀴즈: 정답 보상 없이 제출 수만 카운트 ───
    const handlePreStartQuizAnswer = useCallback(async (answer: string): Promise<boolean> => {
        if (
            !preStartQuizQuestion
            || isPreStartAnswerLocked
            || isPreStartQuizComplete
            || roomStatus !== 'playing'
        ) {
            return false
        }

        setIsPreStartAnswerLocked(true)

        const submittedAnswer = String(answer).trim()
        let correct = false

        if (submittedAnswer !== '') {
            try {
                correct = await checkQuestionAnswer(preStartQuizQuestion.id, submittedAnswer)
            } catch (err) {
                console.error('시작 전 퀴즈 채점 오류, 오답 처리함:', formatServiceError(err), err)
                correct = false
            }
        }

        const recordedQuestionIndex = questions.length > 0
            ? preStartQuestionIndex % questions.length
            : preStartQuestionIndex

        setAnswerHistory((prev) => [
            ...prev,
            {
                questionIndex: recordedQuestionIndex,
                isCorrect: correct,
                selectedAnswer: submittedAnswer,
            },
        ])

        window.setTimeout(() => {
            setPreStartSubmittedCount((prev) => Math.min(requiredPreStartQuizCount, prev + 1))
            setPreStartQuestionIndex((prev) => prev + 1)
            setIsPreStartAnswerLocked(false)
            questionStartTime.current = Date.now()
        }, 650)

        return correct
    }, [
        isPreStartAnswerLocked,
        isPreStartQuizComplete,
        preStartQuestionIndex,
        preStartQuizQuestion,
        questions.length,
        requiredPreStartQuizCount,
        roomStatus,
    ])

    // ─── 게임 종료 (모든 문제 풀었을 때) ───
    const finishGame = useCallback(async (): Promise<boolean> => {
        if (!roomCode || !room || isTerminalRoomStatus(room.status)) return false
        try {
            await finishRoom(roomCode)
            void sendRoomEvent('room:patch', {
                patch: { status: 'finished' },
                reason: 'student_finished',
            })
            void sendRoomEvent('game:finished', {
                finishedBy: playerId,
                reason: 'student_finished',
            })
            return true
        } catch (error) {
            console.error('게임 종료 업데이트 실패:', error)
            return false
        }
    }, [playerId, roomCode, room, sendRoomEvent])

    // ─── 문제가 다 끝났는지 확인 ───
    const isAllQuestionsAnswered = questions.length > 0 && currentQuestionIndex >= questions.length

    // ─── 시간 측정 ───
    const getElapsedSeconds = useCallback(() => {
        return (Date.now() - questionStartTime.current) / 1000
    }, [])

    return {
        // 상태
        roomCode,
        playerId,
        currentView,
        setCurrentView,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        selectedAnswer,
        isCorrect,
        showCountdown,
        setShowCountdown,
        consecutiveCorrect,
        answerHistory,
        questions,
        questionsLoading,
        questionsError,
        isAnswerLocked,
        preStartQuizQuestion,
        preStartSubmittedCount,
        preStartQuizTotal: requiredPreStartQuizCount,
        isPreStartQuizComplete,
        shouldShowPreStartQuiz,
        isPreStartAnswerLocked,

        // 실시간 데이터
        players,
        room,
        playersLoading,
        roomLoading,
        currentPlayer,
        currentQuestion,
        roomChannelStatus,
        roomOnlineCount,
        presence,
        isRoomHost,

        // 오디오
        playBGM,
        playSFX,

        // 함수
        checkAnswer,
        handlePreStartQuizAnswer,
        goToNextQuestion,
        handleWrongAnswer,
        handleCountdownComplete,
        finishGame,
        getElapsedSeconds,
        sendRoomEvent,
        requestRoomResync,
        applyPlayerPatch,
        commitPlayerPatch,

        // 유틸
        isAllQuestionsAnswered,
        timeLimit,
        questionStartTime,
    }
}
