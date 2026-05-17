'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useAudioContext } from '@/components/AudioProvider'
import DontLookDownGame from '@/components/DontLookDownGame'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
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
    generatePlatformMap,
    generateObstacles,
    spawnPowerUp,
    getLeaderboard,
    updateObstacles,
    updatePlatforms,
    respawnPlatforms,
} from '@/lib/game/dontlookdown'
import { useGameBase } from '@/hooks/useGameBase'
import type { Database } from '@/types/database.types'
import { updatePlayer } from '@/lib/services/players'

type Player = Database['public']['Tables']['players']['Row']

type DLDView = 'lobby' | 'countdown' | 'game' | 'result'

export default function DontLookDownPage() {
    const {
        roomCode,
        playerId,
        currentView,
        setCurrentView,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        questions,
        players,
        room,
        roomLoading,
        playersLoading,
        currentPlayer,
        currentQuestion,
        playBGM,
        playSFX,
        checkAnswer,
        handleWrongAnswer,
        isRoomHost,
        finishGame,
    } = useGameBase({ expectedGameMode: 'dontlookdown' })

    const [gameSettings, setGameSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
    const [platforms, setPlatforms] = useState<Platform[]>([])
    const [powerUps, setPowerUps] = useState<PowerUp[]>([])
    const [obstacles, setObstacles] = useState<Obstacle[]>([])
    const [dldPlayers, setDldPlayers] = useState<Map<string, DLDPlayer>>(new Map())
    const [winner, setWinner] = useState<string | null>(null)
    const [gameStartTime, setGameStartTime] = useState<number>(0)
    const [remainingTime, setRemainingTime] = useState<number>(0)

    const powerUpTimerRef = useRef<NodeJS.Timeout>()
    const obstacleUpdateRef = useRef<NodeJS.Timeout>()
    const platformUpdateRef = useRef<NodeJS.Timeout>()
    const platformRespawnRef = useRef<NodeJS.Timeout>()
    const platformsRef = useRef<Platform[]>([])
    const hasFinishedGameRef = useRef(false)
    const resolvedGameStartTime = room?.started_at
        ? new Date(room.started_at).getTime()
        : gameStartTime

    // 플랫폼 이미지 로드 시 크기로 박스 갱신 (이미지 크기 = 플랫폼 박스)
    const handlePlatformImageSizesLoaded = useCallback((sizes: Record<number, { w: number; h: number }>) => {
        setPlatforms(prev => prev.map(p =>
            p.imageId && sizes[p.imageId]
                ? { ...p, width: sizes[p.imageId].w, height: sizes[p.imageId].h }
                : p
        ))
    }, [])

    // 게임 시작 (플레이어 로드 완료 후에만)
    useEffect(() => {
        if (room?.status !== 'playing' || currentView !== 'lobby') return
        // 현재 플레이어가 players에 있을 때만 시작 (로딩 타임아웃 방지)
        if (!playerId || !players.some(p => p.id === playerId)) return

        hasFinishedGameRef.current = false
        setWinner(null)
        setCurrentView('countdown')

        // 플랫폼 맵 생성
        const generatedPlatforms = generatePlatformMap(gameSettings.summitGoal, gameSettings)
        setPlatforms(generatedPlatforms)

        // 장애물 생성
        const generatedObstacles = generateObstacles(generatedPlatforms)
        setObstacles(generatedObstacles)

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
        setGameStartTime(room?.started_at ? new Date(room.started_at).getTime() : Date.now())
    }, [room?.started_at, room?.status, currentView, players, gameSettings, playerId, setCurrentView])

    // Update platformsRef when platforms change
    useEffect(() => {
        platformsRef.current = platforms
    }, [platforms])

    // 카운트다운 완료
    const handleCountdownComplete = () => {
        setCurrentView('game')
        setRemainingTime(gameSettings.duration)
        playBGM('lobby')

        // 파워업 생성 타이머 시작 (10초마다)
        if (gameSettings.powerUpsEnabled) {
            console.log('[DLD] Powerup system enabled, starting spawn timer')
            powerUpTimerRef.current = setInterval(() => {
                const currentPlatforms = platformsRef.current
                const newPowerUp = spawnPowerUp(currentPlatforms)
                if (newPowerUp) {
                    setPowerUps(prev => [...prev, newPowerUp])
                }
            }, 10000)
        }

        // 장애물 업데이트 타이머 (16ms 간격, dt는 초 단위)
        obstacleUpdateRef.current = setInterval(() => {
            setObstacles(prev => updateObstacles(prev, 0.016))
        }, 16)

        // 플랫폼 업데이트 타이머
        platformUpdateRef.current = setInterval(() => {
            setPlatforms(prev => updatePlatforms(prev))
        }, 100)

        // 플랫폼 리스폰 타이머 (5초마다)
        platformRespawnRef.current = setInterval(() => {
            setPlatforms(prev => respawnPlatforms(prev))
        }, 5000)
    }

    // 게임 종료 시 타이머 정리
    useEffect(() => {
        if (room?.status !== 'playing') {
            hasFinishedGameRef.current = false
        }
    }, [room?.status])

    useEffect(() => {
        if (currentView !== 'game') {
            if (powerUpTimerRef.current) clearInterval(powerUpTimerRef.current)
            if (obstacleUpdateRef.current) clearInterval(obstacleUpdateRef.current)
            if (platformUpdateRef.current) clearInterval(platformUpdateRef.current)
            if (platformRespawnRef.current) clearInterval(platformRespawnRef.current)
        }
    }, [currentView])

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
        await updatePlayer(player.id, updateData)
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
            handleWrongAnswer()
        }
    }

    // 게임 시간 체크 (제한 시간 종료 시 가장 높은 height = 승자)
    useEffect(() => {
        if (currentView !== 'game' || !resolvedGameStartTime) return

        const interval = setInterval(() => {
            const elapsed = (Date.now() - resolvedGameStartTime) / 1000
            const remaining = Math.max(0, Math.ceil(gameSettings.duration - elapsed))
            setRemainingTime(remaining)

            if (elapsed >= gameSettings.duration) {
                const leaderboard = getLeaderboard(dldPlayers)
                if (leaderboard.length > 0) {
                    setWinner(leaderboard[0].id)
                    setCurrentView('result')
                    if (isRoomHost && !hasFinishedGameRef.current) {
                        hasFinishedGameRef.current = true
                        void finishGame().then((didFinish) => {
                            if (!didFinish) {
                                hasFinishedGameRef.current = false
                            }
                        })
                    }
                }
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [currentView, dldPlayers, finishGame, gameSettings, isRoomHost, resolvedGameStartTime, setCurrentView])

    // roomCode/playerId 없거나 로딩 중
    if (!roomCode || !playerId) {
        return (
            <main className="min-h-screen relative overflow-hidden">
                <AnimatedBackground />
                <div className="relative z-10 flex items-center justify-center min-h-screen">
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
            <main className="min-h-screen relative overflow-hidden">
                <AnimatedBackground />
                <div className="relative z-10 flex items-center justify-center min-h-screen">
                    <div className="text-center text-white">
                        <p className="text-2xl font-bold mb-2">방 정보 로딩 중...</p>
                        <p className="text-gray-300">잠시만 기다려주세요</p>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen relative overflow-hidden">
            <AnimatedBackground />

            <AnimatePresence mode="wait">
                {/* 로비 대기 */}
                {currentView === 'lobby' && (
                    <motion.div
                        key="lobby"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative z-10 flex items-center justify-center min-h-screen p-8"
                    >
                        <div className="text-center max-w-2xl">
                            <h1 className="text-6xl font-bold text-white mb-8 drop-shadow-lg font-bitbit">
                                ⛰️ Don&apos;t Look Down
                            </h1>
                            <div className="bg-white/90 rounded-2xl p-8 mb-8">
                                <p className="text-2xl font-bold text-gray-800 mb-4">
                                    정상까지 먼저 올라가세요!
                                </p>
                                <p className="text-gray-600 mb-4">
                                    퀴즈를 풀어 에너지를 얻고, 플랫폼을 점프하며 6개의 Summit을 넘어 정상을 정복하세요
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-sm text-left">
                                    <div className="bg-blue-50 p-3 rounded">
                                        <div className="font-bold mb-1">⚡ 파워업</div>
                                        <div className="text-xs text-gray-600">실드, 로켓, 에너지 등</div>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded">
                                        <div className="font-bold mb-1">🏔️ 6개 Summit</div>
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

                {/* 카운트다운 */}
                {currentView === 'countdown' && (
                    <div className="relative z-10">
                        <Countdown onComplete={handleCountdownComplete} />
                    </div>
                )}

                {/* 게임 플레이 */}
                {currentView === 'game' && playerId && currentPlayer && (
                    <motion.div
                        key="game"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative z-10 w-full h-screen"
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
