'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QuizView from './QuizView'
import { isAvatarPath } from '@/lib/utils/playerDisplay'
import {
    DB_THROTTLE_MS,
    POWERUP_COLLECT_RADIUS,
    SUMMIT_ALERT_MS,
    UI_SYNC_MS,
} from '@/components/dontlookdown/constants'
import type {
    BackgroundCloud,
    BackgroundStar,
    DontLookDownQuestion,
    GameParticle,
    QuizFeedback,
    TrailPoint,
} from '@/components/dontlookdown/types'
import {
    drawAltitudeMarkers,
    drawBackdrop,
    drawCharacter,
    drawClimbAxis,
    drawObstacles,
    drawParticles,
    drawPlatforms,
    drawPowerUps,
    drawRoutePath,
    drawSpeedLines,
    drawTrail,
} from '@/components/dontlookdown/renderer'

import PowerUpIcon from '@/components/dontlookdown/PowerUpIcon'
import {
    type DLDPlayer,
    type Platform,
    type PowerUp,
    type PowerUpType,
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
    SPAWNABLE_POWERUP_TYPES,
    getPlatformImagePath,
    getPowerUpImagePath,
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
    currentQuestion: DontLookDownQuestion | null
    onAnswerQuestion: (answer: string) => boolean | Promise<boolean>
    onPlatformImageSizesLoaded?: (sizes: Record<number, { w: number; h: number }>) => void
    remainingTime?: number
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
    // ============ Refs (게임 권위 상태) ============
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // 내 플레이어 - 클라이언트가 권위, 서버 값으로 덮어쓰지 않음
    const playerRef = useRef<DLDPlayer | null>(null)
    const cameraRef = useRef({ x: 0, y: 0 })
    const showQuizRef = useRef(false)

    // 외부 상태 스냅샷 (props → ref, 게임 루프는 항상 최신 ref를 읽음)
    const otherPlayersRef = useRef<DLDPlayer[]>([])
    const platformsRef = useRef<Platform[]>(platforms)
    const obstaclesRef = useRef<Obstacle[]>(obstacles)
    const powerUpsRef = useRef<PowerUp[]>(powerUps)
    const settingsRef = useRef<GameSettings>(settings)
    const characterImageRef = useRef<string>(characterImage)
    const onUpdatePlayerRef = useRef(onUpdatePlayer)
    const onCollectPowerUpRef = useRef(onCollectPowerUp)
    const activatePowerUpSlotRef = useRef<(index: number) => void>(() => {})

    // 입력
    const keysRef = useRef<Set<string>>(new Set())
    const jumpBufferRef = useRef(0)
    const coyoteTimerRef = useRef(0)

    // 타이밍
    const lastFrameTimeRef = useRef<number>(0)
    const lastDbUpdateRef = useRef<number>(0)
    const shakeRef = useRef(0)
    const particlesRef = useRef<GameParticle[]>([])
    const trailRef = useRef<TrailPoint[]>([])
    const cloudsRef = useRef<BackgroundCloud[]>([])
    const starsRef = useRef<BackgroundStar[]>([])
    const comboRef = useRef(0)

    // Summit 추적
    const summitTrackRef = useRef<number>(1)

    // 플랫폼 이미지 캐시
    const platformImagesRef = useRef<Record<number, HTMLImageElement>>({})
    const powerUpImagesRef = useRef<Partial<Record<PowerUpType, HTMLImageElement>>>({})
    const avatarImagesRef = useRef<Record<string, HTMLImageElement>>({})

    // ============ React UI 상태 (저빈도 동기화) ============
    const [uiPlayer, setUiPlayer] = useState<DLDPlayer | null>(null)
    const [showQuiz, setShowQuiz] = useState(false)
    const [showSummitAlert, setShowSummitAlert] = useState<number | null>(null)
    const [combo, setCombo] = useState(0)
    const [quizFeedback, setQuizFeedback] = useState<QuizFeedback | null>(null)
    const [isTouch, setIsTouch] = useState(false)

    // 터치 기기 감지 (태블릿/모바일에는 물리 키보드가 없으므로 화면 조작 버튼 제공)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const coarse = window.matchMedia?.('(pointer: coarse)').matches
        const forced = new URLSearchParams(window.location.search).get('touch') === '1'
        setIsTouch(forced || Boolean(coarse) || (navigator.maxTouchPoints ?? 0) > 0)
    }, [])

    // 화면 버튼 → 키보드와 동일한 입력 모델(keysRef) 사용
    const pressGameKey = (key: string) => {
        keysRef.current.add(key)
        if (key === 'jump') jumpBufferRef.current = PHYSICS.JUMP_BUFFER_TIME
    }
    const releaseGameKey = (key: string) => {
        keysRef.current.delete(key)
    }

    useEffect(() => {
        showQuizRef.current = showQuiz
    }, [showQuiz])

    if (cloudsRef.current.length === 0) {
        cloudsRef.current = Array.from({ length: 24 }, (_, index) => ({
            x: (index * 173) % WORLD.WIDTH,
            y: 80 + ((index * 113) % 1700),
            w: 90 + ((index * 37) % 120),
            speed: 0.12 + (index % 5) * 0.04,
            alpha: 0.2 + (index % 4) * 0.08,
        }))
    }
    if (starsRef.current.length === 0) {
        starsRef.current = Array.from({ length: 80 }, (_, index) => ({
            x: (index * 97) % WORLD.WIDTH,
            y: -5200 + ((index * 181) % 3600),
            size: 1 + (index % 3),
            alpha: 0.35 + (index % 5) * 0.12,
        }))
    }

    const showFeedback = (feedback: QuizFeedback) => {
        setQuizFeedback(feedback)
        window.setTimeout(() => setQuizFeedback(null), 1200)
    }

    const spawnBurst = (
        x: number,
        y: number,
        color: string,
        count = 12,
        speed = 220
    ) => {
        const next = particlesRef.current.slice()
        for (let i = 0; i < count; i += 1) {
            const angle = Math.random() * Math.PI * 2
            const velocity = speed * (0.35 + Math.random() * 0.75)
            next.push({
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - 80,
                life: 0.45 + Math.random() * 0.35,
                maxLife: 0.8,
                size: 2 + Math.random() * 5,
                color,
            })
        }
        particlesRef.current = next.slice(-120)
    }

    const spawnRocketExhaust = (player: DLDPlayer, dt: number) => {
        const next = particlesRef.current.slice()
        const count = Math.max(3, Math.ceil(dt * 260))
        for (let i = 0; i < count; i += 1) {
            const spread = (Math.random() - 0.5) * PLAYER_SIZE.WIDTH * 1.3
            next.push({
                x: player.x + PLAYER_SIZE.WIDTH / 2 + spread,
                y: player.y + PLAYER_SIZE.HEIGHT - 2,
                vx: (Math.random() - 0.5) * 120,
                vy: 260 + Math.random() * 360,
                life: 0.22 + Math.random() * 0.18,
                maxLife: 0.4,
                size: 4 + Math.random() * 8,
                color: Math.random() > 0.35 ? '#fb923c' : '#fde047',
            })
        }
        particlesRef.current = next.slice(-180)
    }

    activatePowerUpSlotRef.current = (index: number) => {
        const current = playerRef.current
        const powerUp = current?.powerUps[index]
        if (!current || !powerUp) return

        playerRef.current = applyPowerUp(current, index)
        const color = powerUp.type === 'rocket' ? '#fb923c' : '#fde047'
        const count = powerUp.type === 'rocket' ? 30 : 18
        const speed = powerUp.type === 'rocket' ? 420 : 260
        spawnBurst(
            playerRef.current.x + PLAYER_SIZE.WIDTH / 2,
            playerRef.current.y + PLAYER_SIZE.HEIGHT,
            color,
            count,
            speed
        )
        shakeRef.current = Math.max(shakeRef.current, powerUp.type === 'rocket' ? 10 : 6)
        setUiPlayer(playerRef.current)
    }

    const getAvatarImage = (avatar: string) => {
        const normalized = avatar.trim()
        if (!isAvatarPath(normalized)) return undefined
        const avatarPath = normalized.startsWith('/') ? normalized : `/${normalized}`
        return avatarImagesRef.current[avatarPath]
    }

    // ============ props → refs 동기화 ============
    useEffect(() => { platformsRef.current = platforms }, [platforms])
    useEffect(() => { obstaclesRef.current = obstacles }, [obstacles])
    useEffect(() => { powerUpsRef.current = powerUps }, [powerUps])
    useEffect(() => { settingsRef.current = settings }, [settings])
    useEffect(() => { characterImageRef.current = characterImage }, [characterImage])
    useEffect(() => { onUpdatePlayerRef.current = onUpdatePlayer }, [onUpdatePlayer])
    useEffect(() => { onCollectPowerUpRef.current = onCollectPowerUp }, [onCollectPowerUp])

    useEffect(() => {
        const avatarPaths = new Set<string>()
        const normalizedCharacterImage = characterImage.trim()
        if (isAvatarPath(normalizedCharacterImage)) {
            avatarPaths.add(normalizedCharacterImage.startsWith('/') ? normalizedCharacterImage : `/${normalizedCharacterImage}`)
        }
        for (const player of players) {
            const avatar = String(player.avatar || '').trim()
            if (isAvatarPath(avatar)) {
                avatarPaths.add(avatar.startsWith('/') ? avatar : `/${avatar}`)
            }
        }

        avatarPaths.forEach((avatarPath) => {
            if (avatarImagesRef.current[avatarPath]) return
            const img = document.createElement('img')
            img.src = avatarPath
            avatarImagesRef.current[avatarPath] = img
        })
    }, [characterImage, players])

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
                x: Math.max(0, Math.min(initial.x - WORLD.VIEW_WIDTH * 0.34, WORLD.WIDTH - WORLD.VIEW_WIDTH)),
                y: initial.y - WORLD.VIEW_HEIGHT * 0.68,
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

    useEffect(() => {
        for (const type of SPAWNABLE_POWERUP_TYPES) {
            const img = document.createElement('img')
            img.onload = () => {
                powerUpImagesRef.current[type] = img
            }
            img.src = getPowerUpImagePath(type)
        }
    }, [])

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
                activatePowerUpSlotRef.current(0)
            }
            if (gameKey === 'r' && playerRef.current && (playerRef.current.powerUps?.length ?? 0) > 1) {
                activatePowerUpSlotRef.current(1)
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

        const drawScene = () => {
            const canvas = canvasRef.current
            const player = playerRef.current
            if (!canvas || !player) return

            const ctx = canvas.getContext('2d')
            if (!ctx) return

            if (canvas.width !== WORLD.VIEW_WIDTH) canvas.width = WORLD.VIEW_WIDTH
            if (canvas.height !== WORLD.VIEW_HEIGHT) canvas.height = WORLD.VIEW_HEIGHT

            const shake = shakeRef.current
            const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0
            const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0
            const camX = cameraRef.current.x - shakeX
            const camY = cameraRef.current.y - shakeY
            const now = performance.now()

            drawBackdrop(ctx, {
                player,
                camX,
                camY,
                settings: settingsRef.current,
                clouds: cloudsRef.current,
                stars: starsRef.current,
            })

            ctx.save()
            ctx.translate(-camX, -camY)

            drawAltitudeMarkers(ctx, settingsRef.current.summitGoal)
            drawRoutePath(ctx, platformsRef.current)
            drawClimbAxis(ctx, settingsRef.current.summitGoal)
            drawPlatforms(ctx, {
                platforms: platformsRef.current,
                platformImages: platformImagesRef.current,
            })

            drawObstacles(ctx, obstaclesRef.current, now)
            drawPowerUps(ctx, powerUpsRef.current, powerUpImagesRef.current, now)

            // 다른 플레이어
            for (const op of otherPlayersRef.current) {
                const avatar = op.avatar || '🐕'
                drawCharacter(ctx, {
                    player: op,
                    avatar,
                    avatarImage: getAvatarImage(avatar),
                    isLocal: false,
                })
            }

            drawTrail(ctx, trailRef.current)

            // 내 플레이어
            drawCharacter(ctx, {
                player,
                avatar: characterImageRef.current,
                avatarImage: getAvatarImage(characterImageRef.current),
                isLocal: true,
            })

            drawParticles(ctx, particlesRef.current)

            ctx.restore()

            drawSpeedLines(ctx, player, now)
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

            if (showQuizRef.current) {
                drawScene()
                return
            }

            let player = player0
            const wasOnGround = player.isOnGround
            const previousX = player.x
            const previousY = player.y
            const previousVy = player.vy
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
                    spawnBurst(
                        player.x + PLAYER_SIZE.WIDTH / 2,
                        player.y + PLAYER_SIZE.HEIGHT,
                        '#facc15',
                        10,
                        160
                    )
                    shakeRef.current = Math.max(shakeRef.current, 3)
                    jumpBufferRef.current = 0
                    coyoteTimerRef.current = 0
                } else if (!player.isOnGround && player.canDoubleJump) {
                    if (player.energy >= ENERGY.DOUBLE_JUMP_COST) {
                        player = {
                            ...player,
                            vy: PHYSICS.DOUBLE_JUMP_POWER,
                            canDoubleJump: false,
                            energy: player.energy - ENERGY.DOUBLE_JUMP_COST,
                        }
                        spawnBurst(
                            player.x + PLAYER_SIZE.WIDTH / 2,
                            player.y + PLAYER_SIZE.HEIGHT / 2,
                            '#38bdf8',
                            16,
                            240
                        )
                        shakeRef.current = Math.max(shakeRef.current, 4)
                    }
                    jumpBufferRef.current = 0
                }
            }

            // 물리 (초 단위 dt). updatePlayerPhysics가 sweep 충돌로 tunneling 방지.
            player = updatePlayerPhysics(player, platformsRef.current, obstaclesRef.current, dt)

            if (player.activePowerUps.has('rocket')) {
                spawnRocketExhaust(player, dt)
                shakeRef.current = Math.max(shakeRef.current, 4)
            }

            if (!wasOnGround && player.isOnGround) {
                const landingForce = Math.min(1, Math.max(0.15, previousVy / PHYSICS.MAX_FALL_SPEED))
                spawnBurst(
                    player.x + PLAYER_SIZE.WIDTH / 2,
                    player.y + PLAYER_SIZE.HEIGHT,
                    '#e2e8f0',
                    8 + Math.floor(landingForce * 10),
                    120 + landingForce * 120
                )
                shakeRef.current = Math.max(shakeRef.current, 2 + landingForce * 5)
            }

            if (previousY > 650 && player.y < previousY - 70) {
                spawnBurst(previousX + PLAYER_SIZE.WIDTH / 2, previousY, '#fb7185', 22, 280)
                shakeRef.current = Math.max(shakeRef.current, 12)
                comboRef.current = 0
                setCombo(0)
                showFeedback({ text: '추락! 체크포인트에서 다시 시작', tone: 'bad' })
            }

            // 파워업 시간
            player = updateActivePowerUps(player, dt)

            // 파워업 수집
            for (const pu of powerUpsRef.current) {
                if (!pu.active) continue
                const dx = (player.x + PLAYER_SIZE.WIDTH / 2) - (pu.x + POWERUP_SIZE.WIDTH / 2)
                const dy = (player.y + PLAYER_SIZE.HEIGHT / 2) - (pu.y + POWERUP_SIZE.HEIGHT / 2)
                if (dx * dx + dy * dy < POWERUP_COLLECT_RADIUS * POWERUP_COLLECT_RADIUS) {
                    player = collectPowerUp(player, pu)
                    spawnBurst(pu.x + POWERUP_SIZE.WIDTH / 2, pu.y + POWERUP_SIZE.HEIGHT / 2, '#facc15', 18, 260)
                    shakeRef.current = Math.max(shakeRef.current, 3)
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
                Math.min(player.x - WORLD.VIEW_WIDTH * 0.34, WORLD.WIDTH - WORLD.VIEW_WIDTH)
            )
            const lookAhead = player.vy < 0 ? -70 : player.vy > 500 ? 35 : 0
            const targetCamY = player.y - WORLD.VIEW_HEIGHT * 0.68 + lookAhead
            const camAlpha = 1 - Math.pow(1 - PHYSICS.CAMERA_LERP, dt * 60)
            cameraRef.current.x += (targetCamX - cameraRef.current.x) * camAlpha
            cameraRef.current.y += (targetCamY - cameraRef.current.y) * camAlpha

            shakeRef.current = Math.max(0, shakeRef.current - dt * 24)
            trailRef.current = [
                ...trailRef.current
                    .map(point => ({ ...point, life: point.life - dt }))
                    .filter(point => point.life > 0),
                {
                    x: player.x,
                    y: player.y,
                    life: Math.min(0.35, 0.14 + (Math.abs(player.vx) + Math.abs(player.vy)) / 5200),
                },
            ].slice(-14)
            particlesRef.current = particlesRef.current
                .map(particle => ({
                    ...particle,
                    x: particle.x + particle.vx * dt,
                    y: particle.y + particle.vy * dt,
                    vy: particle.vy + 520 * dt,
                    life: particle.life - dt,
                }))
                .filter(particle => particle.life > 0)

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
    const handleAnswer = async (answer: string) => {
        const correct = await onAnswerQuestion(answer)

        if (playerRef.current && currentQuestion) {
            if (correct) {
                const nextCombo = comboRef.current + 1
                const comboBonus = Math.min(400, (nextCombo - 1) * 80)
                const boosted = giveEnergy(
                    playerRef.current,
                    settingsRef.current.energyPerQuestion + comboBonus
                )
                playerRef.current = {
                    ...boosted,
                    canDoubleJump: true,
                }
                comboRef.current = nextCombo
                setCombo(nextCombo)
                shakeRef.current = Math.max(shakeRef.current, nextCombo >= 3 ? 7 : 4)
                spawnBurst(
                    boosted.x + PLAYER_SIZE.WIDTH / 2,
                    boosted.y + PLAYER_SIZE.HEIGHT / 2,
                    nextCombo >= 3 ? '#38bdf8' : '#22c55e',
                    nextCombo >= 3 ? 24 : 16,
                    nextCombo >= 3 ? 320 : 240
                )
                showFeedback({
                    text: nextCombo >= 3 ? `${nextCombo}콤보! 에너지 대충전` : `정답! +에너지`,
                    tone: 'good',
                })
                setShowQuiz(false)
                return true
            }
        }

        if (playerRef.current) {
            playerRef.current = {
                ...playerRef.current,
                energy: Math.max(0, playerRef.current.energy - 180),
                vx: playerRef.current.vx * 0.55,
            }
            spawnBurst(
                playerRef.current.x + PLAYER_SIZE.WIDTH / 2,
                playerRef.current.y + PLAYER_SIZE.HEIGHT / 2,
                '#ef4444',
                12,
                180
            )
        }
        comboRef.current = 0
        setCombo(0)
        shakeRef.current = Math.max(shakeRef.current, 8)
        showFeedback({ text: '오답! 에너지 감소', tone: 'bad' })
        setShowQuiz(false)
        return false
    }

    // ============ 로딩 가드 ============
    if (!uiPlayer) {
        return <div className="w-full h-full flex items-center justify-center text-gray-700">불러오는 중...</div>
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
                        <span className="text-sm font-semibold text-gray-600">🏔️ 구역 {uiPlayer.currentSummit}/{SUMMITS.length}</span>
                        <span className="text-xs text-gray-500">{Math.floor(summitProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                            className="bg-gradient-to-r from-sky-400 to-sky-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${summitProgress}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-600">높이</span>
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
                            <span className="text-sm font-semibold text-gray-600">생명</span>
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
                        <span className="text-sm font-semibold text-gray-600">에너지</span>
                        <span className="text-xs text-gray-500">{Math.floor(uiPlayer.energy)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div
                            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (uiPlayer.energy / ENERGY.MAX) * 100)}%` }}
                        />
                    </div>

                    <div className="text-xs font-semibold text-gray-600 mb-2">파워업</div>
                    <div className="flex gap-2">
                        {[0, 1].map(index => {
                            const powerUp = uiPlayer.powerUps[index]
                            return (
                                <button
                                    type="button"
                                    key={index}
                                    onClick={() => activatePowerUpSlotRef.current(index)}
                                    disabled={!powerUp}
                                    aria-label={powerUp ? `${POWERUP_EFFECTS[powerUp.type].name} 사용` : `빈 파워업 슬롯 ${index + 1}`}
                                    title={powerUp ? `${POWERUP_EFFECTS[powerUp.type].name} 사용` : '빈 파워업 슬롯'}
                                    className={`flex h-12 w-12 touch-manipulation items-center justify-center rounded-lg border-2 text-2xl transition active:scale-95 disabled:active:scale-100 ${powerUp ? 'border-yellow-400 bg-yellow-100 hover:bg-yellow-200' : 'cursor-default border-gray-300 bg-gray-100'
                                        }`}
                                >
                                    {powerUp && <PowerUpIcon type={powerUp.type} size={36} />}
                                </button>
                            )
                        })}
                    </div>

                    {uiPlayer.activePowerUps.size > 0 && (
                        <div className="mt-3 space-y-1">
                            {Array.from(uiPlayer.activePowerUps.entries()).map(([type, time]) => (
                                <div key={type} className="text-xs bg-sky-100 px-2 py-1 rounded flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5">
                                        <PowerUpIcon type={type} size={16} />
                                        {POWERUP_EFFECTS[type].name}
                                    </span>
                                    <span className="font-bold">{Math.ceil(time)}초</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {quizFeedback && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -12 }}
                            className={`absolute top-24 left-1/2 -translate-x-1/2 rounded-xl px-6 py-3 text-xl font-black text-white shadow-2xl ${
                                quizFeedback.tone === 'good'
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                            }`}
                        >
                            {quizFeedback.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                {combo > 1 && (
                    <div className="absolute top-20 right-4 rounded-xl bg-sky-500 px-5 py-2 font-black text-white shadow-lg">
                        🔥 {combo} 콤보
                    </div>
                )}

                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white/95 rounded-xl px-4 py-2 shadow-lg min-w-[300px]">
                    <div className="text-xs font-bold text-gray-600 mb-2 text-center">순위</div>
                    <div className="space-y-1">
                        {leaderboard.map((player, index) => (
                            <div key={player.id} className={`flex items-center justify-between text-sm ${player.id === playerId ? 'font-bold text-blue-600' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                    <span className="truncate max-w-[120px]">{player.nickname}</span>
                                    {player.id === playerId && <span className="text-xs">(나)</span>}
                                </div>
                                <span>{Math.floor(player.height)}m</span>
                            </div>
                        ))}
                    </div>
                </div>

                {isTouch ? (
                    <div className="absolute inset-x-2 bottom-3 z-40 flex select-none items-end justify-between gap-2 pointer-events-none">
                        {/* 좌우 이동 */}
                        <div className="flex gap-2 pointer-events-auto">
                            <button
                                type="button"
                                aria-label="왼쪽 이동"
                                onContextMenu={(e) => e.preventDefault()}
                                onPointerDown={(e) => { e.preventDefault(); pressGameKey('left') }}
                                onPointerUp={() => releaseGameKey('left')}
                                onPointerLeave={() => releaseGameKey('left')}
                                onPointerCancel={() => releaseGameKey('left')}
                                className="flex h-16 w-16 touch-none items-center justify-center rounded-2xl bg-white/85 text-3xl font-black text-slate-700 shadow-lg active:bg-white"
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                aria-label="오른쪽 이동"
                                onContextMenu={(e) => e.preventDefault()}
                                onPointerDown={(e) => { e.preventDefault(); pressGameKey('right') }}
                                onPointerUp={() => releaseGameKey('right')}
                                onPointerLeave={() => releaseGameKey('right')}
                                onPointerCancel={() => releaseGameKey('right')}
                                className="flex h-16 w-16 touch-none items-center justify-center rounded-2xl bg-white/85 text-3xl font-black text-slate-700 shadow-lg active:bg-white"
                            >
                                →
                            </button>
                        </div>

                        {/* 퀴즈 */}
                        <button
                            type="button"
                            onClick={() => setShowQuiz(true)}
                            className="pointer-events-auto rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white shadow-lg active:bg-sky-600"
                        >
                            퀴즈 풀기
                        </button>

                        {/* 질주 + 점프 */}
                        <div className="flex items-end gap-2 pointer-events-auto">
                            <button
                                type="button"
                                aria-label="질주"
                                onContextMenu={(e) => e.preventDefault()}
                                onPointerDown={(e) => { e.preventDefault(); pressGameKey('shift') }}
                                onPointerUp={() => releaseGameKey('shift')}
                                onPointerLeave={() => releaseGameKey('shift')}
                                onPointerCancel={() => releaseGameKey('shift')}
                                className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl bg-white/85 text-xs font-black text-slate-700 shadow-lg active:bg-white"
                            >
                                질주
                            </button>
                            <button
                                type="button"
                                aria-label="점프"
                                onContextMenu={(e) => e.preventDefault()}
                                onPointerDown={(e) => { e.preventDefault(); pressGameKey('jump') }}
                                onPointerUp={() => releaseGameKey('jump')}
                                onPointerLeave={() => releaseGameKey('jump')}
                                onPointerCancel={() => releaseGameKey('jump')}
                                className="flex h-20 w-20 touch-none items-center justify-center rounded-full bg-amber-400 text-base font-black text-amber-950 shadow-xl active:bg-amber-500"
                            >
                                점프
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <motion.button
                            onClick={() => setShowQuiz(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="absolute bottom-4 left-4 bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg pointer-events-auto"
                        >
                            퀴즈 풀기
                        </motion.button>

                        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-4 py-3 rounded-xl text-sm space-y-1">
                            <div>←/→ 이동 · ↑/스페이스 점프</div>
                            <div>⇧ 질주 · Q 퀴즈</div>
                            <div>E/R 파워업 사용</div>
                        </div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {showSummitAlert && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: 50 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    >
                        <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white px-12 py-6 rounded-2xl shadow-2xl">
                            <div className="text-4xl font-bold text-center mb-2">
                                🏔️ 구역 {showSummitAlert} 도달!
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
                        className="absolute right-4 top-24 z-50 w-[min(420px,calc(100%-2rem))]"
                    >
                        <motion.div
                            initial={{ opacity: 0, x: 40, scale: 0.96 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 40, scale: 0.96 }}
                            className="rounded-2xl border-4 border-sky-300 bg-white/95 p-3 shadow-2xl backdrop-blur pointer-events-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="mb-2 flex items-center justify-between px-1">
                                <div className="text-sm font-black text-sky-700">
                                    빠른 충전 퀴즈
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowQuiz(false)}
                                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                                >
                                    닫기
                                </button>
                            </div>
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
