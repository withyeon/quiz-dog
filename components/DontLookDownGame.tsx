'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import QuizView from './QuizView'

type Question = {
    id: string
    type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
    question_text: string
    options: string[]
    answer: string
}

import {
    type DLDPlayer,
    type Platform,
    type PowerUp,
    type Obstacle,
    type GameSettings,
    type PowerUpType,
    PHYSICS,
    ENERGY,
    PLAYER_SIZE,
    POWERUP_SIZE,
    METERS_PER_PIXEL,
    SUMMITS,
    WORLD,
    POWERUP_EFFECTS,
    PLATFORM_IMAGE_COUNT,
    getPlatformImagePath,
    createPlayer,
    updatePlayerPhysics,
    movePlayer,
    jumpPlayer,
    giveEnergy,
    isPlayerAtPeak,
    collectPowerUp,
    usePowerUp,
    updateActivePowerUps,
    updateObstacles,
    updatePlatforms,
    handlePlayerFall,
} from '@/lib/game/dontlookdown'

interface DontLookDownGameProps {
    playerId: string
    playerName: string
    characterImage: string
    players: DLDPlayer[]
    platforms: Platform[]
    powerUps: PowerUp[]
    obstacles: Obstacle[]
    settings: GameSettings
    onUpdatePlayer: (player: DLDPlayer) => void
    onCollectPowerUp: (powerUpId: string) => void
    currentQuestion: Question | null
    onAnswerQuestion: (answer: string) => void
    onPlatformImageSizesLoaded?: (sizes: Record<number, { w: number; h: number }>) => void
    remainingTime?: number  // 제한 시간 남은 초 (선생님 설정)
}

export default function DontLookDownGame({
    playerId,
    playerName,
    characterImage,
    players,
    platforms,
    powerUps,
    obstacles,
    settings,
    onUpdatePlayer,
    onCollectPowerUp,
    currentQuestion,
    onAnswerQuestion,
    onPlatformImageSizesLoaded,
    remainingTime,
}: DontLookDownGameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // players에서 찾거나, 없으면 props로 초기 플레이어 생성 (로딩 문제 방지)
    const initialPlayer = players.find(p => p.id === playerId) ?? (playerId && playerName ? createPlayer(playerId, playerName, characterImage, settings) : null)
    const [localPlayer, setLocalPlayer] = useState<DLDPlayer | null>(initialPlayer)
    const [showQuiz, setShowQuiz] = useState(false)
    const [cameraX, setCameraX] = useState(0)
    const [cameraY, setCameraY] = useState(0)
    const [keys, setKeys] = useState<Set<string>>(new Set())
    const [showSummitAlert, setShowSummitAlert] = useState<number | null>(null)

    const gameLoopRef = useRef<number>()
    const lastTimeRef = useRef<number>(Date.now())
    const localPlayerRef = useRef<DLDPlayer | null>(null)
    const keysRef = useRef<Set<string>>(new Set())
    const containerRef = useRef<HTMLDivElement>(null)
    const platformImagesRef = useRef<Record<number, HTMLImageElement>>({})

    // ref 동기화
    localPlayerRef.current = localPlayer
    keysRef.current = keys

    // 현재 플레이어 찾기
    useEffect(() => {
        const player = players.find(p => p.id === playerId)
        if (player) {
            // Summit이 변경되었는지 확인
            if (localPlayer && player.currentSummit > localPlayer.currentSummit) {
                setShowSummitAlert(player.currentSummit)
                setTimeout(() => setShowSummitAlert(null), 3000)
            }
            setLocalPlayer(player)
        }
    }, [players, playerId, localPlayer])

    // 키 코드 → 게임 키 매핑 (ArrowLeft, Left, a 등 모두 지원)
    const getGameKey = (e: KeyboardEvent): string | null => {
        const key = e.key.toLowerCase()
        const code = e.code?.toLowerCase()
        if (key === 'arrowleft' || code === 'arrowleft' || key === 'a') return 'left'
        if (key === 'arrowright' || code === 'arrowright' || key === 'd') return 'right'
        if (key === 'arrowup' || code === 'arrowup' || key === 'w' || key === ' ') return 'jump'
        if (key === 'arrowdown' || code === 'arrowdown') return 'down'
        if (key === 'shift') return 'shift'
        if (key === 'q') return 'q'
        if (key === 'e') return 'e'
        if (key === 'r') return 'r'
        return null
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const gameKey = getGameKey(e)
            if (gameKey) {
                e.preventDefault()
                e.stopPropagation()
                setKeys(prev => new Set(prev).add(gameKey))

                if (gameKey === 'q' && !showQuiz) setShowQuiz(true)
                if (gameKey === 'e' && localPlayer && (localPlayer.powerUps?.length ?? 0) > 0) {
                    const updated = usePowerUp(localPlayer, 0)
                    setLocalPlayer(updated)
                    onUpdatePlayer(updated)
                }
                if (gameKey === 'r' && localPlayer && (localPlayer.powerUps?.length ?? 0) > 1) {
                    const updated = usePowerUp(localPlayer, 1)
                    setLocalPlayer(updated)
                    onUpdatePlayer(updated)
                }
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            const gameKey = getGameKey(e)
            if (gameKey) {
                e.preventDefault()
                e.stopPropagation()
                setKeys(prev => {
                    const next = new Set(prev)
                    next.delete(gameKey)
                    return next
                })
            }
        }

        const handleBlur = () => setKeys(new Set())

        window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false })
        window.addEventListener('keyup', handleKeyUp, { capture: true, passive: false })
        window.addEventListener('blur', handleBlur)

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true })
            window.removeEventListener('keyup', handleKeyUp, { capture: true })
            window.removeEventListener('blur', handleBlur)
        }
    }, [showQuiz, localPlayer, onUpdatePlayer])

    // 게임 시작 시 포커스 (방향키 입력 받기 위함)
    useEffect(() => {
        containerRef.current?.focus()
    }, [])

    // 플랫폼 이미지 1.svg~9.svg 로드, 크기 전달 후 박스=이미지 크기로 사용
    useEffect(() => {
        const sizes: Record<number, { w: number; h: number }> = {}
        let loaded = 0
        const total = PLATFORM_IMAGE_COUNT

        const checkAllLoaded = () => {
            loaded++
            if (loaded === total && onPlatformImageSizesLoaded) {
                onPlatformImageSizesLoaded(sizes)
            }
        }

        for (let i = 1; i <= total; i++) {
            const img = document.createElement('img')
            img.onload = () => {
                sizes[i] = { w: img.naturalWidth, h: img.naturalHeight }
                platformImagesRef.current[i] = img
                checkAllLoaded()
            }
            img.onerror = () => checkAllLoaded()
            img.src = getPlatformImagePath(i)
        }
    }, [onPlatformImageSizesLoaded])

    // 게임 루프 (ref 사용으로 매 프레임 안정적 실행)
    useEffect(() => {
        if (!localPlayer) return

        const gameLoop = () => {
            const currentPlayer = localPlayerRef.current
            if (!currentPlayer) return

            const now = Date.now()
            const deltaTime = Math.min((now - lastTimeRef.current) / 16, 2)
            lastTimeRef.current = now

            let updatedPlayer = { ...currentPlayer }

            // 키 입력 처리 (통일된 게임 키 사용)
            const currentKeys = keysRef.current
            const isMovingLeft = currentKeys.has('left')
            const isMovingRight = currentKeys.has('right')
            const isJumping = currentKeys.has('jump')
            const isRunning = currentKeys.has('shift')

            // 이동 (키를 뗐을 때 빠르게 정지 - 살짝 누르면 조금만 이동)
            if (isMovingLeft && !isMovingRight) {
                updatedPlayer = movePlayer(updatedPlayer, 'left', isRunning)
            } else if (isMovingRight && !isMovingLeft) {
                updatedPlayer = movePlayer(updatedPlayer, 'right', isRunning)
            } else {
                // 키를 뗐을 때 즉시 감속
                updatedPlayer = { ...updatedPlayer, vx: updatedPlayer.vx * 0.35 }
            }

            // 점프
            if (isJumping) {
                if (updatedPlayer.isOnGround) {
                    updatedPlayer = jumpPlayer(updatedPlayer, false)
                } else if (updatedPlayer.canDoubleJump) {
                    updatedPlayer = jumpPlayer(updatedPlayer, true)
                }
            }

            // 물리 업데이트
            updatedPlayer = updatePlayerPhysics(updatedPlayer, platforms, obstacles, deltaTime)

            // 파워업 시간 업데이트
            updatedPlayer = updateActivePowerUps(updatedPlayer, deltaTime / 60)

            // 파워업 수집 체크
            powerUps.forEach(powerUp => {
                if (!powerUp.active) return

                const dx = (updatedPlayer.x + PLAYER_SIZE.WIDTH / 2) - (powerUp.x + POWERUP_SIZE.WIDTH / 2)
                const dy = (updatedPlayer.y + PLAYER_SIZE.HEIGHT / 2) - (powerUp.y + POWERUP_SIZE.HEIGHT / 2)
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance < 30) {
                    updatedPlayer = collectPowerUp(updatedPlayer, powerUp)
                    onCollectPowerUp(powerUp.id)
                }
            })

            // 정상 도달 체크
            if (isPlayerAtPeak(updatedPlayer, platforms)) {
                // 승리!
            }

            // 착지 (파티클 제거 - 캐릭터 주변 흰색 효과 없음)

            setLocalPlayer(updatedPlayer)
            onUpdatePlayer(updatedPlayer)

            // 카메라 업데이트 (플레이어 중앙, 오른쪽 위 맵)
            const camX = Math.max(0, Math.min(updatedPlayer.x - WORLD.VIEW_WIDTH / 2, WORLD.WIDTH - WORLD.VIEW_WIDTH))
            // 위로 많이 올라가면 y가 0보다 작아지므로, 위쪽도 끝까지 보이도록 클램프 제거
            const camY = updatedPlayer.y - WORLD.VIEW_HEIGHT / 2
            setCameraX(camX)
            setCameraY(camY)

            gameLoopRef.current = requestAnimationFrame(gameLoop)
        }

        gameLoopRef.current = requestAnimationFrame(gameLoop)

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current)
            }
        }
    }, [localPlayer, platforms, obstacles, powerUps, onUpdatePlayer, onCollectPowerUp])

    // Debug: Log powerup changes
    useEffect(() => {
        console.log('[DLD Game] Powerup props updated:', { count: powerUps.length, powerUps: powerUps.map(p => ({ id: p.id.substring(0, 10), type: p.type, active: p.active })) })
    }, [powerUps])

    // Canvas 렌더링
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = WORLD.VIEW_WIDTH
        canvas.height = WORLD.VIEW_HEIGHT

        // Summit별 배경 색상
        const currentSummit = SUMMITS.find(s => localPlayer && localPlayer.currentSummit === s.id)
        const bgColor = currentSummit?.color || '#87CEEB'

        const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.VIEW_HEIGHT)
        gradient.addColorStop(0, bgColor)
        gradient.addColorStop(1, '#E0F6FF')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, WORLD.VIEW_WIDTH, WORLD.VIEW_HEIGHT)

        ctx.save()
        ctx.translate(-cameraX, -cameraY)

        // 플랫폼 그리기 (이미지 있으면 이미지, 없으면 색상 박스)
        const imgs = platformImagesRef.current
        platforms.forEach(platform => {
            if (!platform.isVisible) return

            const img = platform.imageId ? imgs[platform.imageId] : null

            if (platform.type === 'disappearing' && platform.disappearTime) {
                const timeLeft = platform.disappearTime - Date.now()
                ctx.globalAlpha = Math.max(0.3, timeLeft / 2000)
            } else {
                ctx.globalAlpha = 1
            }

            if (img && img.complete && img.naturalWidth) {
                ctx.drawImage(
                    img,
                    0, 0, img.naturalWidth, img.naturalHeight,
                    platform.x, platform.y, platform.width, platform.height
                )
            } else {
                const styleColors: Record<string, string> = {
                    stone: '#8B8682',
                    wood: '#8B6914',
                    chair: '#A0522D',
                    barrel: '#654321',
                    table: '#DEB887',
                    brick: '#8B4513',
                }
                let platformColor = styleColors[platform.style || 'stone'] ?? '#808080'
                if (platform.type === 'peak') platformColor = '#FFD700'
                else if (platform.type === 'start') platformColor = '#654321'
                else if (platform.type === 'checkpoint') platformColor = '#2E8B57'
                else if (platform.type === 'disappearing') platformColor = '#FFA500'
                else if (platform.type === 'spike') platformColor = '#A52A2A'
                ctx.fillStyle = platformColor
                ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
            }

            // 박스 테두리 없음 (투명)
            ctx.strokeStyle = 'transparent'
            ctx.lineWidth = 0
            ctx.strokeRect(platform.x, platform.y, platform.width, platform.height)

            if (platform.type === 'checkpoint') {
                ctx.fillStyle = '#FFFFFF'
                ctx.font = 'bold 14px Arial'
                ctx.textAlign = 'center'
                ctx.fillText('💾', platform.x + platform.width / 2, platform.y + platform.height / 2 + 4)
            }
            if (platform.type === 'spike') {
                ctx.fillStyle = '#FFFFFF'
                ctx.font = 'bold 12px Arial'
                ctx.textAlign = 'center'
                for (let i = 0; i < platform.width / 15; i++) {
                    ctx.fillText('▲', platform.x + 10 + i * 15, platform.y + 5)
                }
            }

            ctx.globalAlpha = 1
        })

        // 장애물 그리기
        obstacles.forEach(obstacle => {
            if (!obstacle.active) return

            if (obstacle.type === 'laser') {
                ctx.fillStyle = '#FF0000'
                ctx.shadowColor = '#FF0000'
                ctx.shadowBlur = 10
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
                ctx.shadowBlur = 0
            } else if (obstacle.type === 'wind') {
                ctx.fillStyle = 'rgba(200, 200, 255, 0.2)'
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)

                // 바람 방향 표시
                ctx.fillStyle = 'rgba(200, 200, 255, 0.5)'
                ctx.font = 'bold 20px Arial'
                ctx.textAlign = 'center'
                const windSymbol = obstacle.direction === 'left' ? '←' : '→'
                for (let i = 0; i < 3; i++) {
                    ctx.fillText(windSymbol, obstacle.x + obstacle.width / 2, obstacle.y + 30 + i * 30)
                }
            }
        })

        // 파워업 그리기
        powerUps.forEach(powerUp => {
            if (!powerUp.active) return

            const icon = POWERUP_EFFECTS[powerUp.type].icon

            // 반짝이는 효과
            const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8
            ctx.globalAlpha = pulse

            // 배경 원
            ctx.fillStyle = '#FFD700'
            ctx.beginPath()
            ctx.arc(powerUp.x + POWERUP_SIZE.WIDTH / 2, powerUp.y + POWERUP_SIZE.HEIGHT / 2, 15, 0, Math.PI * 2)
            ctx.fill()

            // 아이콘
            ctx.globalAlpha = 1
            ctx.font = 'bold 20px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(icon, powerUp.x + POWERUP_SIZE.WIDTH / 2, powerUp.y + POWERUP_SIZE.HEIGHT / 2 + 7)
        })

        ctx.globalAlpha = 1
        ctx.restore()
    }, [platforms, obstacles, powerUps, localPlayer, cameraX, cameraY])

    // 퀴즈 정답 처리
    const handleAnswer = (answer: string) => {
        onAnswerQuestion(answer)

        if (localPlayer && currentQuestion && answer === currentQuestion.answer) {
            const updatedPlayer = giveEnergy(localPlayer, settings.energyPerQuestion)
            setLocalPlayer(updatedPlayer)
        }

        setShowQuiz(false)
    }

    if (!localPlayer) {
        return <div>Loading...</div>
    }

    // Summit 진행률 (8구역 기준)
    const summitProgress = SUMMITS.length <= 1 ? 0 : ((localPlayer.currentSummit - 1) / (SUMMITS.length - 1)) * 100
    const heightProgress = (localPlayer.height / settings.summitGoal) * 100

    // 리더보드 (상위 3명)
    const leaderboard = [...players].sort((a, b) => b.height - a.height).slice(0, 3)

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-gradient-to-b from-sky-400 to-sky-200 outline-none"
            tabIndex={0}
        >
            {/* 게임 캔버스 */}
            <canvas
                ref={canvasRef}
                className="w-full h-full"
            />

            {/* 캐릭터 이미지 레이어 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* 다른 플레이어들 */}
                {players.map(player => {
                    if (player.id === playerId) return null

                    const screenX = player.x - cameraX
                    const screenY = player.y - cameraY
                    if (screenX < -50 || screenX > 850 || screenY < -100 || screenY > 700) return null

                    return (
                        <div
                            key={player.id}
                            className="absolute transition-all duration-100"
                            style={{
                                left: `${(screenX / WORLD.VIEW_WIDTH) * 100}%`,
                                top: `${(screenY / WORLD.VIEW_HEIGHT) * 100}%`,
                                width: `${(PLAYER_SIZE.WIDTH / WORLD.VIEW_WIDTH) * 100}%`,
                                height: `${(PLAYER_SIZE.HEIGHT / WORLD.VIEW_HEIGHT) * 100}%`,
                                transform: player.facingRight ? 'scaleX(1)' : 'scaleX(-1)',
                            }}
                        >
                            {/* 캐릭터 표시 (이모지) */}
                            <div className="w-full h-full flex items-center justify-center text-4xl drop-shadow-lg">
                                {player.avatar || '🐕'}
                            </div>
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                <span className="bg-black/50 text-white text-xs px-2 py-1 rounded font-bold">
                                    {player.nickname}
                                </span>
                            </div>
                            {/* 실드 표시 */}
                            {player.hasShield && (
                                <div className="absolute -inset-2 border-4 border-blue-400 rounded-full animate-pulse" />
                            )}
                        </div>
                    )
                })}

                {/* 로컬 플레이어 */}
                <div
                    className="absolute transition-all duration-75"
                    style={{
                        left: `${((localPlayer.x - cameraX) / WORLD.VIEW_WIDTH) * 100}%`,
                        top: `${((localPlayer.y - cameraY) / WORLD.VIEW_HEIGHT) * 100}%`,
                        width: `${(PLAYER_SIZE.WIDTH / WORLD.VIEW_WIDTH) * 100}%`,
                        height: `${(PLAYER_SIZE.HEIGHT / WORLD.VIEW_HEIGHT) * 100}%`,
                        transform: localPlayer.facingRight ? 'scaleX(1)' : 'scaleX(-1)',
                    }}
                >
                    {/* 캐릭터 표시 (이모지) */}
                    <div className="w-full h-full flex items-center justify-center text-4xl drop-shadow-2xl">
                        {characterImage}
                    </div>
                    {/* 실드 표시 */}
                    {localPlayer.hasShield && (
                        <div className="absolute -inset-2 border-4 border-blue-400 rounded-full animate-pulse" />
                    )}
                    {/* Ghost 모드 표시 */}
                    {localPlayer.activePowerUps.has('ghost') && (
                        <div className="absolute inset-0 bg-purple-500/30 rounded animate-pulse" />
                    )}
                </div>
            </div>

            {/* UI 오버레이 */}
            <div className="absolute inset-0 pointer-events-none">
                {/* 상단 중앙 - 제한 시간 */}
                {remainingTime !== undefined && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-6 py-2 rounded-xl font-bold text-xl tabular-nums">
                        ⏱️ {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
                    </div>
                )}
                {/* 좌측 상단 - Summit & 높이 */}
                <div className="absolute top-4 left-4 bg-white/95 rounded-xl px-5 py-3 shadow-lg pointer-events-auto min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-600">🏔️ Summit {localPlayer.currentSummit}/{SUMMITS.length}</span>
                        <span className="text-xs text-gray-500">{Math.floor(summitProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${summitProgress}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-600">Height</span>
                        <span className="text-xs text-gray-500">{Math.floor(localPlayer.height)}m / {settings.summitGoal}m</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, heightProgress)}%` }}
                        />
                    </div>

                    {/* 생명 표시 */}
                    {settings.livesEnabled && (
                        <div className="mt-3 flex items-center gap-1">
                            <span className="text-sm font-semibold text-gray-600">Lives:</span>
                            {Array.from({ length: settings.startingLives }).map((_, i) => (
                                <span key={i} className="text-lg">
                                    {i < localPlayer.lives ? '❤️' : '🖤'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* 우측 상단 - 에너지 & 파워업 */}
                <div className="absolute top-4 right-4 bg-white/95 rounded-xl px-5 py-3 shadow-lg pointer-events-auto min-w-[180px]">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-600">Energy</span>
                        <span className="text-xs text-gray-500">{Math.floor(localPlayer.energy)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div
                            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (localPlayer.energy / 5000) * 100)}%` }}
                        />
                    </div>

                    <div className="text-xs font-semibold text-gray-600 mb-2">Power-ups</div>
                    <div className="flex gap-2">
                        {[0, 1].map(index => {
                            const powerUp = localPlayer.powerUps[index]
                            return (
                                <div
                                    key={index}
                                    className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl ${powerUp ? 'bg-yellow-100 border-yellow-400' : 'bg-gray-100 border-gray-300'
                                        }`}
                                >
                                    {powerUp && POWERUP_EFFECTS[powerUp.type].icon}
                                </div>
                            )
                        })}
                    </div>

                    {/* 활성 파워업 타이머 */}
                    {localPlayer.activePowerUps.size > 0 && (
                        <div className="mt-3 space-y-1">
                            {Array.from(localPlayer.activePowerUps.entries()).map(([type, time]) => (
                                <div key={type} className="text-xs bg-purple-100 px-2 py-1 rounded flex items-center justify-between">
                                    <span>{POWERUP_EFFECTS[type].icon} {POWERUP_EFFECTS[type].name}</span>
                                    <span className="font-bold">{Math.ceil(time)}s</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 하단 중앙 - 미니 리더보드 */}
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white/95 rounded-xl px-4 py-2 shadow-lg min-w-[300px]">
                    <div className="text-xs font-bold text-gray-600 mb-2 text-center">Leaderboard</div>
                    <div className="space-y-1">
                        {leaderboard.map((player, index) => (
                            <div key={player.id} className={`flex items-center justify-between text-sm ${player.id === playerId ? 'font-bold text-blue-600' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                    <span className="truncate max-w-[120px]">{player.nickname}</span>
                                    {player.id === playerId && <span className="text-xs">(You)</span>}
                                </div>
                                <span>{Math.floor(player.height)}m</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 하단 좌측 - 퀴즈 버튼 */}
                <motion.button
                    onClick={() => setShowQuiz(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute bottom-4 left-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg pointer-events-auto"
                >
                    Answer Questions (Q)
                </motion.button>

                {/* 하단 우측 - 조작 안내 */}
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-4 py-3 rounded-xl text-sm space-y-1">
                    <div>⬅️➡️ Move | ⬆️ Jump</div>
                    <div>Space: Double Jump | Shift: Run</div>
                    <div>Q: Quiz | E/R: Use Power-up</div>
                </div>
            </div>

            {/* Summit 도달 알림 */}
            <AnimatePresence>
                {showSummitAlert && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: 50 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-6 rounded-2xl shadow-2xl">
                            <div className="text-4xl font-bold text-center mb-2">
                                🏔️ Summit {showSummitAlert} 도달!
                            </div>
                            <div className="text-xl text-center opacity-90">
                                {SUMMITS[showSummitAlert - 1]?.name}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 퀴즈 모달 */}
            <AnimatePresence>
                {showQuiz && currentQuestion && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                        onClick={() => setShowQuiz(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="max-w-2xl w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <QuizView
                                question={currentQuestion}
                                onAnswer={handleAnswer}
                                timeLimit={30}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
