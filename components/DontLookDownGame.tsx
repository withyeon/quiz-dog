'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
    PHYSICS,
    ENERGY,
    PLAYER_SIZE,
    POWERUP_SIZE,
    SUMMITS,
    WORLD,
    POWERUP_EFFECTS,
    PLATFORM_IMAGE_COUNT,
    getPlatformImagePath,
    createPlayer,
    updatePlayerPhysics,
    movePlayer,
    giveEnergy,
    isPlayerAtPeak,
    collectPowerUp,
    applyPowerUp,
    updateActivePowerUps,
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
    remainingTime?: number
}

const DB_THROTTLE_MS = 200
const UI_SYNC_MS = 150
const SUMMIT_ALERT_MS = 3000
const POWERUP_COLLECT_RADIUS = 30

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
    // ============ Refs (게임 권위 상태) ============
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // 내 플레이어 - 클라이언트가 권위, 서버 값으로 덮어쓰지 않음
    const playerRef = useRef<DLDPlayer | null>(null)
    const cameraRef = useRef({ x: 0, y: 0 })

    // 외부 상태 스냅샷 (props → ref, 게임 루프는 항상 최신 ref를 읽음)
    const otherPlayersRef = useRef<DLDPlayer[]>([])
    const platformsRef = useRef<Platform[]>(platforms)
    const obstaclesRef = useRef<Obstacle[]>(obstacles)
    const powerUpsRef = useRef<PowerUp[]>(powerUps)
    const settingsRef = useRef<GameSettings>(settings)
    const characterImageRef = useRef<string>(characterImage)
    const onUpdatePlayerRef = useRef(onUpdatePlayer)
    const onCollectPowerUpRef = useRef(onCollectPowerUp)

    // 입력
    const keysRef = useRef<Set<string>>(new Set())
    const jumpBufferRef = useRef(0)
    const coyoteTimerRef = useRef(0)

    // 타이밍
    const lastFrameTimeRef = useRef<number>(0)
    const lastDbUpdateRef = useRef<number>(0)

    // Summit 추적
    const summitTrackRef = useRef<number>(1)

    // 플랫폼 이미지 캐시
    const platformImagesRef = useRef<Record<number, HTMLImageElement>>({})

    // ============ React UI 상태 (저빈도 동기화) ============
    const [uiPlayer, setUiPlayer] = useState<DLDPlayer | null>(null)
    const [showQuiz, setShowQuiz] = useState(false)
    const [showSummitAlert, setShowSummitAlert] = useState<number | null>(null)

    // ============ props → refs 동기화 ============
    useEffect(() => { platformsRef.current = platforms }, [platforms])
    useEffect(() => { obstaclesRef.current = obstacles }, [obstacles])
    useEffect(() => { powerUpsRef.current = powerUps }, [powerUps])
    useEffect(() => { settingsRef.current = settings }, [settings])
    useEffect(() => { characterImageRef.current = characterImage }, [characterImage])
    useEffect(() => { onUpdatePlayerRef.current = onUpdatePlayer }, [onUpdatePlayer])
    useEffect(() => { onCollectPowerUpRef.current = onCollectPowerUp }, [onCollectPowerUp])

    // 다른 플레이어만 따로 보관 — 내 플레이어는 props에서 무시 (서버가 내 좌표를 덮어쓰지 않게)
    useEffect(() => {
        otherPlayersRef.current = players.filter(p => p.id !== playerId)
    }, [players, playerId])

    // ============ 최초 플레이어 초기화 (한 번만) ============
    useEffect(() => {
        if (playerRef.current) return
        const fromServer = players.find(p => p.id === playerId)
        const initial = fromServer
            ?? (playerId && playerName ? createPlayer(playerId, playerName, characterImage, settings) : null)
        if (initial) {
            playerRef.current = initial
            cameraRef.current = {
                x: Math.max(0, Math.min(initial.x - WORLD.VIEW_WIDTH / 2, WORLD.WIDTH - WORLD.VIEW_WIDTH)),
                y: initial.y - WORLD.VIEW_HEIGHT / 2,
            }
            summitTrackRef.current = initial.currentSummit
            setUiPlayer(initial)
        }
    }, [players, playerId, playerName, characterImage, settings])

    // ============ UI 동기화: ref → state (저빈도) ============
    useEffect(() => {
        const id = window.setInterval(() => {
            if (playerRef.current) setUiPlayer(playerRef.current)
        }, UI_SYNC_MS)
        return () => window.clearInterval(id)
    }, [])

    // ============ 플랫폼 이미지 로드 ============
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

    // ============ 키보드 핸들러 (마운트 시 한 번) ============
    useEffect(() => {
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

        const handleKeyDown = (e: KeyboardEvent) => {
            const gameKey = getGameKey(e)
            if (!gameKey) return
            e.preventDefault()
            e.stopPropagation()

            keysRef.current.add(gameKey)

            // OS 키 반복은 한 번만 처리 (점프 버퍼/액션은 edge-triggered)
            if (e.repeat) return

            if (gameKey === 'jump') {
                jumpBufferRef.current = PHYSICS.JUMP_BUFFER_TIME
            }
            if (gameKey === 'q') {
                setShowQuiz(true)
            }
            if (gameKey === 'e' && playerRef.current && (playerRef.current.powerUps?.length ?? 0) > 0) {
                playerRef.current = applyPowerUp(playerRef.current, 0)
            }
            if (gameKey === 'r' && playerRef.current && (playerRef.current.powerUps?.length ?? 0) > 1) {
                playerRef.current = applyPowerUp(playerRef.current, 1)
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            const gameKey = getGameKey(e)
            if (!gameKey) return
            e.preventDefault()
            e.stopPropagation()
            keysRef.current.delete(gameKey)
        }

        const handleBlur = () => keysRef.current.clear()

        window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false })
        window.addEventListener('keyup', handleKeyUp, { capture: true, passive: false })
        window.addEventListener('blur', handleBlur)

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true })
            window.removeEventListener('keyup', handleKeyUp, { capture: true })
            window.removeEventListener('blur', handleBlur)
        }
    }, [])

    // ============ 마운트 시 포커스 ============
    useEffect(() => {
        containerRef.current?.focus()
    }, [])

    // ============ 게임 루프 (마운트 시 한 번 시작, deps 비움) ============
    useEffect(() => {
        let rafId = 0

        const drawCharacter = (
            ctx: CanvasRenderingContext2D,
            player: DLDPlayer,
            avatar: string,
            isLocal: boolean
        ) => {
            const cx = player.x + PLAYER_SIZE.WIDTH / 2
            const cy = player.y + PLAYER_SIZE.HEIGHT / 2

            // Shield ring
            if (player.hasShield) {
                ctx.save()
                ctx.strokeStyle = '#60a5fa'
                ctx.lineWidth = 3
                ctx.beginPath()
                ctx.arc(cx, cy, PLAYER_SIZE.WIDTH / 2 + 8, 0, Math.PI * 2)
                ctx.stroke()
                ctx.restore()
            }

            // Ghost overlay
            const ghostActive = !!(player.activePowerUps && player.activePowerUps.has?.('ghost'))

            // Emoji 캐릭터
            ctx.save()
            if (ghostActive) ctx.globalAlpha = 0.55
            ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            if (!player.facingRight) {
                ctx.translate(cx, cy)
                ctx.scale(-1, 1)
                ctx.fillText(avatar, 0, 0)
            } else {
                ctx.fillText(avatar, cx, cy)
            }
            ctx.restore()

            // 닉네임 (내 캐릭터는 생략)
            if (!isLocal) {
                ctx.save()
                ctx.font = 'bold 11px Arial'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                const m = ctx.measureText(player.nickname)
                const padX = 5
                const h = 14
                const ny = player.y - 12
                ctx.fillStyle = 'rgba(0,0,0,0.6)'
                ctx.fillRect(cx - m.width / 2 - padX, ny - h / 2, m.width + padX * 2, h)
                ctx.fillStyle = '#fff'
                ctx.fillText(player.nickname, cx, ny)
                ctx.restore()
            }
        }

        const drawScene = () => {
            const canvas = canvasRef.current
            const player = playerRef.current
            if (!canvas || !player) return

            const ctx = canvas.getContext('2d')
            if (!ctx) return

            if (canvas.width !== WORLD.VIEW_WIDTH) canvas.width = WORLD.VIEW_WIDTH
            if (canvas.height !== WORLD.VIEW_HEIGHT) canvas.height = WORLD.VIEW_HEIGHT

            const camX = cameraRef.current.x
            const camY = cameraRef.current.y

            // 배경 그라데이션
            const summit = SUMMITS.find(s => player.currentSummit === s.id)
            const bgColor = summit?.color || '#87CEEB'
            const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.VIEW_HEIGHT)
            gradient.addColorStop(0, bgColor)
            gradient.addColorStop(1, '#E0F6FF')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, WORLD.VIEW_WIDTH, WORLD.VIEW_HEIGHT)

            ctx.save()
            ctx.translate(-camX, -camY)

            // 플랫폼
            const imgs = platformImagesRef.current
            const platformsList = platformsRef.current
            for (const platform of platformsList) {
                if (!platform.isVisible) continue

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
                    let pc = styleColors[platform.style || 'stone'] ?? '#808080'
                    if (platform.type === 'peak') pc = '#FFD700'
                    else if (platform.type === 'start') pc = '#654321'
                    else if (platform.type === 'checkpoint') pc = '#2E8B57'
                    else if (platform.type === 'disappearing') pc = '#FFA500'
                    else if (platform.type === 'spike') pc = '#A52A2A'
                    ctx.fillStyle = pc
                    ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
                }

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
            }

            // 장애물
            for (const obstacle of obstaclesRef.current) {
                if (!obstacle.active) continue
                if (obstacle.type === 'laser') {
                    ctx.fillStyle = '#FF0000'
                    ctx.shadowColor = '#FF0000'
                    ctx.shadowBlur = 10
                    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
                    ctx.shadowBlur = 0
                } else if (obstacle.type === 'wind') {
                    ctx.fillStyle = 'rgba(200, 200, 255, 0.2)'
                    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
                    ctx.fillStyle = 'rgba(200, 200, 255, 0.5)'
                    ctx.font = 'bold 20px Arial'
                    ctx.textAlign = 'center'
                    const sym = obstacle.direction === 'left' ? '←' : '→'
                    for (let i = 0; i < 3; i++) {
                        ctx.fillText(sym, obstacle.x + obstacle.width / 2, obstacle.y + 30 + i * 30)
                    }
                }
            }

            // 파워업
            const pulse = Math.sin(performance.now() / 200) * 0.2 + 0.8
            for (const pu of powerUpsRef.current) {
                if (!pu.active) continue
                const icon = POWERUP_EFFECTS[pu.type].icon
                ctx.globalAlpha = pulse
                ctx.fillStyle = '#FFD700'
                ctx.beginPath()
                ctx.arc(pu.x + POWERUP_SIZE.WIDTH / 2, pu.y + POWERUP_SIZE.HEIGHT / 2, 15, 0, Math.PI * 2)
                ctx.fill()
                ctx.globalAlpha = 1
                ctx.font = 'bold 20px Arial'
                ctx.textAlign = 'center'
                ctx.fillText(icon, pu.x + POWERUP_SIZE.WIDTH / 2, pu.y + POWERUP_SIZE.HEIGHT / 2 + 7)
            }
            ctx.globalAlpha = 1

            // 다른 플레이어
            for (const op of otherPlayersRef.current) {
                drawCharacter(ctx, op, op.avatar || '🐕', false)
            }

            // 내 플레이어
            drawCharacter(ctx, player, characterImageRef.current, true)

            ctx.restore()
        }

        const tick = (now: number) => {
            rafId = requestAnimationFrame(tick)

            const player0 = playerRef.current
            if (!player0) {
                lastFrameTimeRef.current = now
                return
            }

            // dt 초 단위. 첫 프레임 보호 + 큰 멈춤 클램프.
            const lastT = lastFrameTimeRef.current || now
            const dt = Math.min((now - lastT) / 1000, 0.05)
            lastFrameTimeRef.current = now

            let player = player0
            const keys = keysRef.current
            const left = keys.has('left')
            const right = keys.has('right')
            const run = keys.has('shift')

            // 코요테 타임: 바닥에 있을 때마다 리셋, 아니면 감소
            if (player.isOnGround) {
                coyoteTimerRef.current = PHYSICS.COYOTE_TIME
            } else {
                coyoteTimerRef.current = Math.max(0, coyoteTimerRef.current - dt)
            }

            // 점프 버퍼 감소
            jumpBufferRef.current = Math.max(0, jumpBufferRef.current - dt)

            // 이동 입력
            if (left && !right) {
                player = movePlayer(player, 'left', run, dt)
            } else if (right && !left) {
                player = movePlayer(player, 'right', run, dt)
            } else {
                // 입력 없을 때 빠른 감속
                const decel = Math.pow(PHYSICS.STOP_DECEL, dt * 60)
                player = { ...player, vx: player.vx * decel }
            }

            // 점프 (버퍼 + 코요테)
            if (jumpBufferRef.current > 0) {
                const canGroundJump =
                    (player.isOnGround || coyoteTimerRef.current > 0)
                    && player.energy >= ENERGY.JUMP_COST
                    && player.vy >= -50 // 이미 점프 중이면 추가 점프 안 됨

                if (canGroundJump) {
                    player = {
                        ...player,
                        vy: PHYSICS.JUMP_POWER,
                        isOnGround: false,
                        energy: player.energy - ENERGY.JUMP_COST,
                    }
                    jumpBufferRef.current = 0
                    coyoteTimerRef.current = 0
                } else if (!player.isOnGround && player.canDoubleJump) {
                    player = {
                        ...player,
                        vy: PHYSICS.DOUBLE_JUMP_POWER,
                        canDoubleJump: false,
                    }
                    jumpBufferRef.current = 0
                }
            }

            // 물리 (초 단위 dt). updatePlayerPhysics가 sweep 충돌로 tunneling 방지.
            player = updatePlayerPhysics(player, platformsRef.current, obstaclesRef.current, dt)

            // 파워업 시간
            player = updateActivePowerUps(player, dt)

            // 파워업 수집
            for (const pu of powerUpsRef.current) {
                if (!pu.active) continue
                const dx = (player.x + PLAYER_SIZE.WIDTH / 2) - (pu.x + POWERUP_SIZE.WIDTH / 2)
                const dy = (player.y + PLAYER_SIZE.HEIGHT / 2) - (pu.y + POWERUP_SIZE.HEIGHT / 2)
                if (dx * dx + dy * dy < POWERUP_COLLECT_RADIUS * POWERUP_COLLECT_RADIUS) {
                    player = collectPowerUp(player, pu)
                    onCollectPowerUpRef.current(pu.id)
                }
            }

            // 정상 도달
            if (isPlayerAtPeak(player, platformsRef.current)) {
                // 승리 처리는 page.tsx 측에 위임 (DB 업데이트 시 height로 판정)
            }

            // Summit 도달 알림 (트랙은 ref로 - state는 알림이 떴을 때만 갱신)
            if (player.currentSummit > summitTrackRef.current) {
                const newSummit = player.currentSummit
                summitTrackRef.current = newSummit
                setShowSummitAlert(newSummit)
                window.setTimeout(() => setShowSummitAlert(null), SUMMIT_ALERT_MS)
            }

            // 권위 상태 갱신
            playerRef.current = player

            // 카메라 lerp (프레임레이트 독립적)
            const targetCamX = Math.max(
                0,
                Math.min(player.x - WORLD.VIEW_WIDTH / 2, WORLD.WIDTH - WORLD.VIEW_WIDTH)
            )
            const targetCamY = player.y - WORLD.VIEW_HEIGHT / 2
            const camAlpha = 1 - Math.pow(1 - PHYSICS.CAMERA_LERP, dt * 60)
            cameraRef.current.x += (targetCamX - cameraRef.current.x) * camAlpha
            cameraRef.current.y += (targetCamY - cameraRef.current.y) * camAlpha

            // DB 업데이트 (throttled, 200ms)
            if (now - lastDbUpdateRef.current >= DB_THROTTLE_MS) {
                lastDbUpdateRef.current = now
                onUpdatePlayerRef.current(player)
            }

            // 렌더
            drawScene()
        }

        rafId = requestAnimationFrame((t) => {
            lastFrameTimeRef.current = t
            tick(t)
        })

        return () => {
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, []) // ⚠ 빈 deps — 게임 루프는 마운트 시 한 번만 시작

    // ============ 퀴즈 답안 처리 ============
    const handleAnswer = (answer: string) => {
        onAnswerQuestion(answer)

        if (playerRef.current && currentQuestion) {
            const correct = String(answer).trim() === String(currentQuestion.answer).trim()
            if (correct) {
                playerRef.current = giveEnergy(playerRef.current, settingsRef.current.energyPerQuestion)
                setShowQuiz(false)
                return true
            }
        }

        setShowQuiz(false)
        return false
    }

    // ============ 로딩 가드 ============
    if (!uiPlayer) {
        return <div className="w-full h-full flex items-center justify-center text-gray-700">Loading...</div>
    }

    // ============ UI 파생값 (uiPlayer 기반) ============
    const summitProgress =
        SUMMITS.length <= 1 ? 0 : ((uiPlayer.currentSummit - 1) / (SUMMITS.length - 1)) * 100
    const heightProgress = (uiPlayer.height / settings.summitGoal) * 100

    // 리더보드: 내 플레이어는 권위(uiPlayer) 기준, 나머지는 props.players
    const leaderboardSource = [
        ...players.filter(p => p.id !== playerId),
        uiPlayer,
    ]
    const leaderboard = leaderboardSource
        .sort((a, b) => b.height - a.height)
        .slice(0, 3)

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-gradient-to-b from-sky-400 to-sky-200 outline-none"
            tabIndex={0}
        >
            {/* 모든 게임 렌더링은 Canvas로 통일 */}
            <canvas
                ref={canvasRef}
                className="w-full h-full"
            />

            {/* UI 오버레이 (저빈도 React 렌더링) */}
            <div className="absolute inset-0 pointer-events-none">
                {remainingTime !== undefined && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-6 py-2 rounded-xl font-bold text-xl tabular-nums">
                        ⏱️ {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
                    </div>
                )}

                <div className="absolute top-4 left-4 bg-white/95 rounded-xl px-5 py-3 shadow-lg pointer-events-auto min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-600">🏔️ Summit {uiPlayer.currentSummit}/{SUMMITS.length}</span>
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
                        <span className="text-xs text-gray-500">{Math.floor(uiPlayer.height)}m / {settings.summitGoal}m</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, heightProgress)}%` }}
                        />
                    </div>

                    {settings.livesEnabled && (
                        <div className="mt-3 flex items-center gap-1">
                            <span className="text-sm font-semibold text-gray-600">Lives:</span>
                            {Array.from({ length: settings.startingLives }).map((_, i) => (
                                <span key={i} className="text-lg">
                                    {i < uiPlayer.lives ? '❤️' : '🖤'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="absolute top-4 right-4 bg-white/95 rounded-xl px-5 py-3 shadow-lg pointer-events-auto min-w-[180px]">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-600">Energy</span>
                        <span className="text-xs text-gray-500">{Math.floor(uiPlayer.energy)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div
                            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (uiPlayer.energy / 5000) * 100)}%` }}
                        />
                    </div>

                    <div className="text-xs font-semibold text-gray-600 mb-2">Power-ups</div>
                    <div className="flex gap-2">
                        {[0, 1].map(index => {
                            const powerUp = uiPlayer.powerUps[index]
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

                    {uiPlayer.activePowerUps.size > 0 && (
                        <div className="mt-3 space-y-1">
                            {Array.from(uiPlayer.activePowerUps.entries()).map(([type, time]) => (
                                <div key={type} className="text-xs bg-purple-100 px-2 py-1 rounded flex items-center justify-between">
                                    <span>{POWERUP_EFFECTS[type].icon} {POWERUP_EFFECTS[type].name}</span>
                                    <span className="font-bold">{Math.ceil(time)}s</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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

                <motion.button
                    onClick={() => setShowQuiz(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute bottom-4 left-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg pointer-events-auto"
                >
                    Answer Questions (Q)
                </motion.button>

                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-4 py-3 rounded-xl text-sm space-y-1">
                    <div>⬅️➡️ Move | ⬆️ Jump</div>
                    <div>Space: Double Jump | Shift: Run</div>
                    <div>Q: Quiz | E/R: Use Power-up</div>
                </div>
            </div>

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
