'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useAudioContext } from '@/components/AudioProvider'
import DontLookDownGame from '@/components/DontLookDownGame'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import AnimatedBackground from '@/components/AnimatedBackground'
import Leaderboard from '@/components/Leaderboard'
import {
    type DLDPlayer,
    type Platform,
    type PowerUp,
    type Obstacle,
    type GameSettings,
    DEFAULT_SETTINGS,
    createPlayer,
    estimateRouteX,
    METERS_PER_PIXEL,
    PLAYER_SIZE,
    generatePlatformMap,
    generateObstacles,
    spawnPowerUp,
    getLeaderboard,
    updateObstacles,
    updatePlatforms,
    respawnPlatforms,
    SUMMITS,
} from '@/lib/game/dontlookdown'
import { useGameBase } from '@/hooks/useGameBase'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

// 'quiz'는 훅(useGameBase)이 카운트다운과 시작 전 퀴즈를 마쳤을 때 넘겨주는 시작 신호.
// 이 페이지는 그 즉시 맵을 만들고 'game'으로 들어가므로 화면에 머무는 뷰는 아니다.
type DLDView = 'lobby' | 'quiz' | 'game' | 'result'

export default function DontLookDownPage() {
    const {
        roomCode,
        playerId,
        currentView,
        setCurrentView,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        questions,
        questionsLoading,
        questionsError,
        preStartQuizQuestion,
        preStartSubmittedCount,
        preStartQuizTotal,
        shouldShowPreStartQuiz,
        players,
        room,
        roomLoading,
        playersLoading,
        currentPlayer,
        currentQuestion,
        playSFX,
        handlePreStartQuizAnswer,
        checkAnswer,
        goToNextQuestion,
        commitPlayerPatch,
        sessionStartedAt,
        showCountdown,
        handleCountdownComplete,
    } = useGameBase({ expectedGameMode: 'dontlookdown' })

    const [gameSettings, setGameSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
    const [platforms, setPlatforms] = useState<Platform[]>([])
    const [powerUps, setPowerUps] = useState<PowerUp[]>([])
    const [obstacles, setObstacles] = useState<Obstacle[]>([])
    const [dldPlayers, setDldPlayers] = useState<Map<string, DLDPlayer>>(new Map())
    const [winner, setWinner] = useState<string | null>(null)
    const [gameStartTime, setGameStartTime] = useState<number>(0)
    const [remainingTime, setRemainingTime] = useState<number>(0)

    const platformsRef = useRef<Platform[]>([])
    const dldPlayersRef = useRef<Map<string, DLDPlayer>>(new Map())
    // 이번 판이 이미 시작됐는지. 훅의 goToNextQuestion은 문제마다 currentView를 'quiz'로
    // 되돌리므로, 'quiz'를 시작 신호로 쓰는 아래 효과가 판 중간에 맵을 다시 만들지 않게 막는다.
    const runStartedRef = useRef(false)
    // 과제 방은 학생 개인 시작 시각(sessionStartedAt)을 쓴다
    const resolvedGameStartTime = sessionStartedAt
        ? gameStartTime || new Date(sessionStartedAt).getTime()
        : gameStartTime
    const roomDurationSeconds = typeof room?.duration_seconds === 'number'
        ? room.duration_seconds
        : null

    useEffect(() => {
        if (!roomDurationSeconds) return
        setGameSettings(prev => (
            prev.duration === roomDurationSeconds
                ? prev
                : { ...prev, duration: roomDurationSeconds }
        ))
    }, [roomDurationSeconds])

    // 플랫폼 이미지 로드 시 크기로 박스 갱신 (이미지 크기 = 플랫폼 박스)
    const handlePlatformImageSizesLoaded = useCallback((sizes: Record<number, { w: number; h: number }>) => {
        setPlatforms(prev => prev.map(p =>
            p.imageId && sizes[p.imageId]
                ? { ...p, width: sizes[p.imageId].w, height: sizes[p.imageId].h }
                : p
        ))
    }, [])

    // 게임 시작. 카운트다운과 시작 전 퀴즈는 훅(useGameBase)이 진행한다: 방이 playing이 되면
    // showCountdown → (완료) → shouldShowPreStartQuiz → (완료) → currentView 'quiz'.
    // 이 페이지는 그 'quiz' 신호를 받아 맵을 만들고 'game'으로 들어간다.
    //
    // 예전에는 페이지가 자체 'countdown' 뷰만 쓰고 훅의 카운트다운을 한 번도 렌더하지 않아
    // 훅의 isCountdownComplete가 영원히 false였다. 시작 전 퀴즈 게이트는 그 값이 true여야
    // 뜨므로 뜨지 않았고, 이 페이지는 다시 그 퀴즈가 끝나기를 기다렸다. 서로 기다리는 사이
    // 학생 화면은 로비 소개 화면에서 영원히 멈춰 있었다.
    useEffect(() => {
        if (room?.status !== 'playing' || currentView !== 'quiz') return
        // 판 중간에 훅이 'quiz'로 되돌린 경우(문제 넘김)는 맵을 다시 만들지 않고 게임 화면만 유지
        if (runStartedRef.current) {
            setCurrentView('game')
            return
        }
        // 현재 플레이어가 players에 있을 때만 시작 (로딩 타임아웃 방지)
        if (!playerId || !players.some(p => p.id === playerId)) return

        runStartedRef.current = true
        setWinner(null)

        // 플랫폼 맵 생성
        const generatedPlatforms = generatePlatformMap(gameSettings.summitGoal, gameSettings)
        setPlatforms(generatedPlatforms)

        // 장애물 생성
        setObstacles(generateObstacles(generatedPlatforms))

        // 파워업 초기화
        setPowerUps([])

        // 플레이어 초기화
        const initialPlayers = new Map<string, DLDPlayer>()
        players.forEach(player => {
            initialPlayers.set(
                player.id,
                createPlayer(player.id, player.nickname, player.avatar || '', gameSettings)
            )
        })
        setDldPlayers(initialPlayers)

        setRemainingTime(gameSettings.duration)
        setGameStartTime(Date.now())
        setCurrentView('game')
    }, [room?.status, currentView, players, gameSettings, playerId, setCurrentView])

    // Update platformsRef when platforms change
    useEffect(() => {
        platformsRef.current = platforms
    }, [platforms])

    useEffect(() => {
        dldPlayersRef.current = dldPlayers
    }, [dldPlayers])

    // 다른 학생들의 진행 상황을 방 realtime에서 받아 반영한다.
    // 예전에는 게임 시작 때 createPlayer로 한 번 만들고 끝이라, 나머지 전원이 시작 발판에
    // 0m로 얼어붙은 채 그려지고 인게임 리더보드도 계속 0m였다. 각 클라이언트가 자기
    // 높이(score)와 에너지(gold)는 이미 DB에 쓰고 있으니 그걸 되읽어 쓴다.
    // x/y는 동기화되지 않으므로, 높이에 해당하는 등반 루트 좌표로 근사한다.
    useEffect(() => {
        if (currentView !== 'game') return

        setDldPlayers((prev) => {
            let changed = false
            const next = new Map(prev)

            for (const row of players) {
                if (row.id === playerId) continue
                const existing = next.get(row.id)
                if (!existing) continue

                const height = Math.max(0, Number(row.score ?? 0))
                const energy = Math.max(0, Number(row.gold ?? 0))
                if (existing.height === height && existing.energy === energy) continue

                next.set(row.id, {
                    ...existing,
                    height,
                    energy,
                    y: 600 - height / METERS_PER_PIXEL - PLAYER_SIZE.HEIGHT,
                    x: estimateRouteX(height, gameSettings.summitGoal),
                })
                changed = true
            }

            return changed ? next : prev
        })
    }, [currentView, gameSettings.summitGoal, playerId, players])

    // 월드 타이머(파워업 생성, 장애물·플랫폼 갱신, 플랫폼 리스폰)는 'game' 뷰 동안만 돌고,
    // 결과 화면이나 로비로 나가면 정리된다.
    useEffect(() => {
        if (currentView !== 'game') return

        const timers: ReturnType<typeof setInterval>[] = []

        // 파워업 생성 (10초마다)
        if (gameSettings.powerUpsEnabled) {
            timers.push(setInterval(() => {
                const newPowerUp = spawnPowerUp(platformsRef.current)
                if (newPowerUp) {
                    setPowerUps(prev => [...prev, newPowerUp])
                }
            }, 10000))
        }

        // 장애물 업데이트 (16ms 간격, dt는 초 단위)
        timers.push(setInterval(() => {
            setObstacles(prev => updateObstacles(prev, 0.016))
        }, 16))

        // 플랫폼 업데이트
        timers.push(setInterval(() => {
            setPlatforms(prev => updatePlatforms(prev))
        }, 100))

        // 플랫폼 리스폰 (5초마다)
        timers.push(setInterval(() => {
            setPlatforms(prev => respawnPlatforms(prev))
        }, 5000))

        return () => timers.forEach(timer => clearInterval(timer))
    }, [currentView, gameSettings.powerUpsEnabled])

    // 방이 playing이 아니게 되면(교사가 다시 대기로 돌리거나 종료) 다음 판을 새로 시작할 수 있게 한다
    useEffect(() => {
        if (room?.status !== 'playing') {
            runStartedRef.current = false
        }
    }, [room?.status])

    // 플레이어 업데이트
    const handleUpdatePlayer = async (player: DLDPlayer) => {
        setDldPlayers(prev => {
            const updated = new Map(prev)
            updated.set(player.id, player)
            return updated
        })

        // 데이터베이스 업데이트
        const updateData = {
            score: Math.floor(player.height),
            gold: Math.floor(player.energy),
        }
        await commitPlayerPatch(player.id, updateData, 'dontlookdown_score_sync')
    }

    // 파워업 수집
    const handleCollectPowerUp = (powerUpId: string) => {
        setPowerUps(prev => prev.map(p =>
            p.id === powerUpId ? { ...p, active: false } : p
        ))
        playSFX('item')
    }

    // 퀴즈 정답 처리
    const handleAnswer = async (answer: string) => {
        const correct = await checkAnswer(answer)
        if (correct) {
            playSFX('correct')
        } else {
            playSFX('incorrect')
        }
        window.setTimeout(() => {
            goToNextQuestion()
            setCurrentView('game')
        }, 250)
        return correct
    }

    // 게임 시간 체크 (제한 시간 종료 시 가장 높은 height = 승자)
    useEffect(() => {
        if (currentView !== 'game' || !resolvedGameStartTime) return

        const interval = setInterval(() => {
            const elapsed = (Date.now() - resolvedGameStartTime) / 1000
            const remaining = Math.max(0, Math.ceil(gameSettings.duration - elapsed))
            setRemainingTime(remaining)

            if (elapsed >= gameSettings.duration) {
                const leaderboard = getLeaderboard(dldPlayersRef.current)
                if (leaderboard.length > 0) {
                    // 학생은 자기 화면만 로컬 종료. 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당.
                    setWinner(leaderboard[0].id)
                    setCurrentView('result')
                }
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [currentView, gameSettings.duration, resolvedGameStartTime, setCurrentView])

    // roomCode/playerId 없거나 로딩 중
    if (!roomCode || !playerId) {
        return (
            <main className="min-h-dvh relative overflow-hidden font-bitbit">
                <AnimatedBackground />
                <div className="relative z-10 flex items-center justify-center min-h-dvh">
                    <div className="text-center text-white bg-black/50 backdrop-blur px-8 py-6 rounded-2xl">
                        <p className="text-xl font-bold mb-2">잘못된 접근입니다</p>
                        <p className="text-gray-300">방 코드와 플레이어 정보가 필요합니다. 로비에서 게임에 입장해주세요.</p>
                        <Link href="/" className="inline-block mt-4 text-cyan-400 hover:underline">홈으로 돌아가기</Link>
                    </div>
                </div>
            </main>
        )
    }

    if (roomLoading) {
        return (
            <main className="min-h-dvh relative overflow-hidden font-bitbit">
                <AnimatedBackground />
                <div className="relative z-10 flex items-center justify-center min-h-dvh">
                    <div className="text-center text-white">
                        <p className="text-2xl font-bold mb-2">방 정보 로딩 중...</p>
                        <p className="text-gray-300">잠시만 기다려주세요</p>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-dvh relative overflow-hidden font-bitbit">
            <AnimatedBackground />

            {shouldShowPreStartQuiz && (
                <PreStartQuizGate
                    question={preStartQuizQuestion}
                    submittedCount={preStartSubmittedCount}
                    total={preStartQuizTotal}
                    onAnswer={handlePreStartQuizAnswer}
                    questionsLoading={questionsLoading}
                    questionsError={questionsError}
                />
            )}

            {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

            <AnimatePresence mode="wait">
                {/* 로비 대기 ('quiz'는 게임으로 넘어가기 직전 한 프레임이라 로비를 그대로 둔다) */}
                {(currentView === 'lobby' || currentView === 'quiz') && (
                    <motion.div
                        key="lobby"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative z-10 flex items-center justify-center min-h-dvh p-8"
                    >
                        <div className="text-center max-w-2xl">
                            <div className="mb-8 flex justify-center">
                                <Image
                                    src="/title/jump_jump.webp"
                                    alt="점프점프"
                                    width={780}
                                    height={264}
                                    className="h-28 w-auto max-w-full object-contain sm:h-36 md:h-44"
                                    priority
                                />
                            </div>
                            <div className="bg-white/90 rounded-2xl p-8 mb-8">
                                <p className="text-2xl font-bold text-gray-800 mb-4">
                                    정상까지 먼저 올라가세요!
                                </p>
                                <p className="text-gray-600 mb-4">
                                    퀴즈를 풀어 에너지를 얻고, 플랫폼을 점프하며 {SUMMITS.length}개 구역을 넘어 정상을 정복하세요
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-sm text-left">
                                    <div className="bg-blue-50 p-3 rounded">
                                        <div className="font-bold mb-1">⚡ 파워업</div>
                                        <div className="text-xs text-gray-600">실드, 로켓, 에너지 등</div>
                                    </div>
                                    <div className="bg-sky-50 p-3 rounded">
                                        <div className="font-bold mb-1">🏔️ {SUMMITS.length}개 구역</div>
                                        <div className="text-xs text-gray-600">난이도가 점점 증가</div>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded">
                                        <div className="font-bold mb-1">💥 장애물</div>
                                        <div className="text-xs text-gray-600">레이저, 가시, 바람</div>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded">
                                        <div className="font-bold mb-1">💾 체크포인트</div>
                                        <div className="text-xs text-gray-600">떨어져도 안전</div>
                                    </div>
                                </div>
                            </div>
                            <Leaderboard players={players} />
                        </div>
                    </motion.div>
                )}

                {/* 게임 플레이 */}
                {currentView === 'game' && playerId && currentPlayer && (
                    <motion.div
                        key="game"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative z-10 w-full h-dvh"
                    >
                        <DontLookDownGame
                            playerId={playerId}
                            playerName={currentPlayer.nickname}
                            characterImage={currentPlayer.avatar || ''}
                            players={Array.from(dldPlayers.values())}
                            platforms={platforms}
                            powerUps={powerUps}
                            obstacles={obstacles}
                            settings={gameSettings}
                            onUpdatePlayer={handleUpdatePlayer}
                            onCollectPowerUp={handleCollectPowerUp}
                            currentQuestion={currentQuestion}
                            onAnswerQuestion={handleAnswer}
                            onPlatformImageSizesLoaded={handlePlatformImageSizesLoaded}
                            remainingTime={remainingTime}
                        />
                    </motion.div>
                )}

                {/* 결과 화면 */}
                {currentView === 'result' && (
                    <div className="relative z-10">
                        <GameResult
                            players={players}
                            currentPlayerId={winner}
                            gameMode="dontlookdown"
                        />
                    </div>
                )}
            </AnimatePresence>
        </main>
    )
}
