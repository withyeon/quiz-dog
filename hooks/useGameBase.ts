'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useAudioContext } from '@/components/AudioProvider'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export type Question = {
    id: string
    type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
    question_text: string
    options: string[]
    answer: string
}

export type AnswerRecord = {
    questionIndex: number
    isCorrect: boolean
    selectedAnswer?: string
}

type GameMode = Database['public']['Tables']['rooms']['Row']['game_mode']

/** 게임 모드별 URL 매핑 */
const GAME_MODE_URLS: Record<string, string> = {
    gold_quest: '/game',
    racing: '/racing',
    battle_royale: '/battle',
    fishing: '/fishing',
    factory: '/factory',
    cafe: '/cafe',
    mafia: '/mafia',
    pool: '/pool',
    tower: '/tower',
    dontlookdown: '/dontlookdown',
    allin: '/allin',
}

/** 게임 모드에 맞는 URL 생성 */
export function getGameModeUrl(gameMode: string, roomCode: string, playerId: string): string {
    const basePath = GAME_MODE_URLS[gameMode] || '/game'
    return `${basePath}?room=${roomCode}&playerId=${playerId}`
}

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

    const formatSupabaseError = (error: unknown): string => {
        if (error instanceof Error) return error.message
        if (error && typeof error === 'object') {
            const e = error as { message?: string; details?: string; hint?: string; code?: string }
            return [e.message, e.details, e.hint, e.code]
                .filter((v): v is string => typeof v === 'string' && v.length > 0)
                .join(' | ')
        }
        return String(error)
    }

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
    const { players, loading: playersLoading } = usePlayersRealtime({ roomCode })
    const { room, loading: roomLoading } = useRoomRealtime({ roomCode })
    const { playBGM, playSFX } = useAudioContext()

    // ─── 현재 플레이어 & 문제 ───
    const currentPlayer = players.find((p) => p.id === playerId) || null
    const currentQuestion = questions.length > 0
        ? questions[currentQuestionIndex % questions.length]
        : null

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
                window.location.href = correctUrl
            }
        }
    }, [room, roomLoading, roomCode, playerId, expectedGameMode])

    // ─── 문제 가져오기 ───
    useEffect(() => {
        if (!room?.set_id) return

        const fetchQuestions = async () => {
            try {
                // 보안 패치: 진짜 정답(answer)은 학생 폰으로 내려보내지 않음 (*) 대신 명시적 컬럼 선택
                const { data, error } = await ((supabase
                    .from('questions') as any)
                    .select('id, set_id, type, question_text, options, created_at')
                    .eq('set_id', room.set_id) as any)

                if (error) throw error
                setQuestions(data as Question[])
            } catch (error) {
                const msg =
                    error instanceof Error
                        ? error.message
                        : error && typeof error === 'object' && 'message' in error
                          ? String((error as { message?: string }).message)
                          : JSON.stringify(error)
                console.error('Error fetching questions:', msg, error)
            }
        }

        fetchQuestions()
    }, [room?.set_id])

    // ─── 게임 상태 전환 (waiting → playing → finished) ───
    useEffect(() => {
        if (!room) return

        if (room.status === 'playing') {
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
        } else if (room.status === 'waiting') {
            if (currentView !== 'lobby') {
                setCurrentView('lobby')
                setShowCountdown(false)
            }
        } else if (room.status === 'finished') {
            if (currentView !== 'result') {
                setCurrentView('result')
                playBGM('result')
            }
        }
    }, [room?.status, currentView, showCountdown, playBGM, roomCode])

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
            // 🚨 보안 패치: 진짜 정답을 폰에서 비교하지 않고, 서버의 RPC 함수('check_question_answer')에 채점을 요청함
            const { data, error } = await (supabase.rpc as any)('check_question_answer', {
                p_question_id: currentQuestion.id,
                p_submitted_answer: normalizedAnswer
            })

            if (error) {
                console.error('[Server Check] 채점 요청 실패:', formatSupabaseError(error), error)
                throw error
            }

            correct = Boolean(data)
        } catch (err) {
            console.error('채점 오류, 오답 처리함:', formatSupabaseError(err), err)
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
            (supabase
                .from('players') as any)
                .update({ answer_history: answerHistory })
                .eq('id', playerId)
                .then(({ error }: { error: any }) => {
                    if (error) {
                        const message = formatSupabaseError(error)
                        console.error('정답 기록 동기화 실패:', message, error)

                        // 구형 스키마에서는 answer_history 컬럼이 없을 수 있다.
                        if (
                            message.includes('answer_history')
                            || message.includes('42703')
                            || message.includes('column')
                        ) {
                            setCanSyncAnswerHistory(false)
                        }
                    }
                })
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
    const finishGame = useCallback(async () => {
        if (!roomCode || !room || room.status === 'finished') return
        try {
            await ((supabase
                .from('rooms') as any)
                .update({ status: 'finished' })
                .eq('room_code', roomCode) as any)
        } catch (error) {
            console.error('게임 종료 업데이트 실패:', error)
        }
    }, [roomCode, room])

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

        // 유틸
        isAllQuestionsAnswered,
        timeLimit,
        questionStartTime,
    }
}
