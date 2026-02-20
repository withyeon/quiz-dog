'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
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
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

type Question = {
    id: string
    type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
    question_text: string
    options: string[]
    answer: string
}

type DLDView = 'lobby' | 'countdown' | 'game' | 'result'

export default function DontLookDownPage() {
    const [roomCode, setRoomCode] = useState('')
    const [playerId, setPlayerId] = useState<string | null>(null)
    const [currentView, setCurrentView] = useState<DLDView>('lobby')
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [questions, setQuestions] = useState<Question[]>([])
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

    // 플랫폼 이미지 로드 시 크기로 박스 갱신 (이미지 크기 = 플랫폼 박스)
    const handlePlatformImageSizesLoaded = useCallback((sizes: Record<number, { w: number; h: number }>) => {
        setPlatforms(prev => prev.map(p =>
            p.imageId && sizes[p.imageId]
                ? { ...p, width: sizes[p.imageId].w, height: sizes[p.imageId].h }
                : p
        ))
    }, [])

    // URL에서 roomCode와 playerId 가져오기
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const code = params.get('room')
            const id = params.get('playerId')
            if (code) setRoomCode(code)
            if (id) setPlayerId(id)
        }
    }, [])

    const { players, loading: playersLoading } = usePlayersRealtime({ roomCode })
    const { room, loading: roomLoading } = useRoomRealtime({ roomCode })
    const { playBGM, playSFX } = useAudioContext()

    // 게임 모드 확인 및 리다이렉트
    useEffect(() => {
        if (!room || roomLoading) return

        const gameMode = room.game_mode || 'gold_quest'

        if ((gameMode as string) !== 'dontlookdown') {
            const gameUrl = gameMode === 'gold_quest'
                ? `/game?room=${roomCode}&playerId=${playerId}`
                : gameMode === 'racing'
                    ? `/racing?room=${roomCode}&playerId=${playerId}`
                    : gameMode === 'battle_royale'
                        ? `/battle?room=${roomCode}&playerId=${playerId}`
                        : gameMode === 'fishing'
                            ? `/fishing?room=${roomCode}&playerId=${playerId}`
                            : gameMode === 'factory'
                                ? `/factory?room=${roomCode}&playerId=${playerId}`
                                : gameMode === 'cafe'
                                    ? `/cafe?room=${roomCode}&playerId=${playerId}`
                                    : gameMode === 'pool'
                                        ? `/pool?room=${roomCode}&playerId=${playerId}`
                                        : `/game?room=${roomCode}&playerId=${playerId}`

            window.location.href = gameUrl
        }
    }, [room, roomLoading, roomCode, playerId])

    // 퀴즈 세트 로드
    useEffect(() => {
        if (!room?.set_id) return

        const loadQuestions = async () => {
            const { data, error } = await (supabase
                .from('questions')
                .select('*')
                .eq('set_id', room.set_id || '') as any)
                .order('created_at')

            if (error) {
                console.error('Error loading questions:', error)
                return
            }

            if (data) {
                setQuestions(data.map((q: any) => ({
                    id: q.id,
                    type: (q.type as any) || 'CHOICE',
                    question_text: q.question_text,
                    options: q.options || [],
                    answer: q.answer,
                })))
            }
        }

        loadQuestions()
    }, [room?.set_id])

    // 게임 시작 (플레이어 로드 완료 후에만)
    useEffect(() => {
        if (room?.status !== 'playing' || currentView !== 'lobby') return
        // 현재 플레이어가 players에 있을 때만 시작 (로딩 타임아웃 방지)
        if (!playerId || !players.some(p => p.id === playerId)) return

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
        setGameStartTime(Date.now())
    }, [room?.status, currentView, players, gameSettings])

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
                console.log('[DLD] Attempting to spawn powerup...', {
                    platformCount: currentPlatforms.length,
                    eligiblePlatforms: currentPlatforms.filter(p => p.type === 'normal' && p.summit >= 2 && p.isVisible).length
                })
                const newPowerUp = spawnPowerUp(currentPlatforms)
                if (newPowerUp) {
                    console.log('[DLD] Powerup spawned:', newPowerUp.type, 'at position', { x: newPowerUp.x, y: newPowerUp.y })
                    setPowerUps(prev => [...prev, newPowerUp])
                } else {
                    console.warn('[DLD] Failed to spawn powerup - no eligible platforms found')
                }
            }, 10000)
        } else {
            console.warn('[DLD] Powerup system is disabled in settings')
        }

        // 장애물 업데이트 타이머
        obstacleUpdateRef.current = setInterval(() => {
            setObstacles(prev => updateObstacles(prev, 1))
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
        await ((supabase
            .from('players') as any)
            .update(updateData)
            .eq('id', player.id))

        // Don't Look Down: 승리는 제한 시간 종료 시만 결정 (가장 높은 height = 승자). 정상 도달로 즉시 종료하지 않음.
    }

    // 파워업 수집
    const handleCollectPowerUp = (powerUpId: string) => {
        console.log('[DLD] Powerup collected:', powerUpId)
        setPowerUps(prev => prev.map(p =>
            p.id === powerUpId ? { ...p, active: false } : p
        ))
        playSFX('correct')
    }

    // 퀴즈 정답 처리
    const handleAnswerQuestion = async (answer: string) => {
        if (!playerId || !questions[currentQuestionIndex]) return

        const currentQuestion = questions[currentQuestionIndex]
        const isCorrect = answer === currentQuestion.answer

        if (isCorrect) {
            playSFX('correct')
        } else {
            playSFX('correct' as any)
        }

        // 다음 문제
        setCurrentQuestionIndex(prev => (prev + 1) % questions.length)
    }

    // 게임 시간 체크 (제한 시간 종료 시 가장 높은 height = 승자)
    useEffect(() => {
        if (currentView !== 'game' || !gameStartTime) return

        const interval = setInterval(() => {
            const elapsed = (Date.now() - gameStartTime) / 1000
            const remaining = Math.max(0, Math.ceil(gameSettings.duration - elapsed))
            setRemainingTime(remaining)

            if (elapsed >= gameSettings.duration) {
                const leaderboard = getLeaderboard(dldPlayers)
                if (leaderboard.length > 0) {
                    setWinner(leaderboard[0].id)
                    setCurrentView('result')
                        ; (supabase.from('rooms') as any)
                            .update({ status: 'finished' })
                            .eq('room_code', roomCode)
                }
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [currentView, gameStartTime, dldPlayers, gameSettings, roomCode])

    const currentPlayer = players.find(p => p.id === playerId)

    // roomCode/playerId 없거나 로딩 중
    if (!roomCode || !playerId) {
        return (
            <main className="min-h-screen relative overflow-hidden">
                <AnimatedBackground />
                <div className="relative z-10 flex items-center justify-center min-h-screen">
                    <div className="text-center text-white bg-black/50 backdrop-blur px-8 py-6 rounded-2xl">
                        <p className="text-xl font-bold mb-2">잘못된 접근입니다</p>
                        <p className="text-gray-300">방 코드와 플레이어 정보가 필요합니다. 로비에서 게임에 입장해주세요.</p>
                        <a href="/" className="inline-block mt-4 text-cyan-400 hover:underline">홈으로 돌아가기</a>
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
                                ⛰️ Don't Look Down
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
                            currentQuestion={questions[currentQuestionIndex] || null}
                            onAnswerQuestion={handleAnswerQuestion}
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
                        />
                    </div>
                )}
            </AnimatePresence>
        </main>
    )
}
