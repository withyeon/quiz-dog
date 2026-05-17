'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useAudioContext } from '@/components/AudioProvider'
import { getGameModeUrl } from '@/lib/game/modes'
import { isRoomHostPlayer } from '@/lib/realtime/roomChannel'
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

interface UseGameBaseOptions {
    /** 이 게임 페이지가 어떤 게임 모드인지 (리다이렉트용) */
    expectedGameMode: string
    /** 오답 후 대기 시간 (ms). 기본값: 2000 */
    wrongAnswerDelay?: number
    /** 퀴즈 제한 시간 (초). 기본값: 30 */
    timeLimit?: number
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
    const { expectedGameMode, wrongAnswerDelay = 2000, timeLimit = 30 } = options
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
    const [isAnswerLocked, setIsAnswerLocked] = useState(false) // 중복 제출 방지

    const questionStartTime = useRef<number>(Date.now())
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
    const resyncRoomSnapshot = useCallback(async (reason?: string) => {
        if (reason === 'broadcast_hint') return
        await Promise.all([
            refreshRoom({ silent: true }),
            refreshPlayers({ silent: true }),
        ])
    }, [refreshPlayers, refreshRoom])
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

    // ─── 현재 플레이어 & 문제 ───
    const currentPlayer = players.find((p) => p.id === playerId) || null
    const currentQuestion = questions.length > 0
        ? questions[currentQuestionIndex % questions.length]
        : null
    const isRoomHost = useMemo(
        () => isRoomHostPlayer(playerId, players, presence),
        [playerId, players, presence],
    )

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
        if (!room?.set_id) return
        const setId = room.set_id

        const fetchQuestions = async () => {
            try {
                const loadedQuestions = await listQuestionsForGame(setId)
                setQuestions(loadedQuestions)
            } catch (error) {
                const msg = formatServiceError(error)
                console.error('Error fetching questions:', msg, error)
            }
        }

        fetchQuestions()
    }, [room?.set_id])

    // ─── 게임 상태 전환 (waiting → playing → finished) ───
    useEffect(() => {
        if (!room) return

        if (roomStatus === 'playing') {
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
        } else if (roomStatus === 'finished') {
            if (roomCode && playerId) {
                router.replace(`/student/game/${roomCode}/result?playerId=${playerId}`)
                return
            }
            if (currentView !== 'result') {
                setCurrentView('result')
                playBGM('result')
            }
        }
    }, [roomStatus, currentView, showCountdown, playBGM, roomCode, room, playerId, router])

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

    // ─── 게임 종료 (모든 문제 풀었을 때) ───
    const finishGame = useCallback(async (): Promise<boolean> => {
        if (!roomCode || !room || room.status === 'finished') return false
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
        isAnswerLocked,

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
