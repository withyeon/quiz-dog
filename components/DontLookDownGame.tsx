'use client'

import { useState, useEffect, useRef } from 'react'
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
import {
    advanceParticles,
    advanceTrail,
    createClouds,
    createStars,
    withBurst,
    withRocketExhaust,
} from '@/components/dontlookdown/effects'
import { useGameAssets } from '@/components/dontlookdown/useGameAssets'
import { useGameInput } from '@/components/dontlookdown/useGameInput'
import { EnergyPanel, Leaderboard, ProgressPanel, TimeBadge } from '@/components/dontlookdown/StatusPanels'
import { KeyboardControls, TouchControls } from '@/components/dontlookdown/TouchControls'
import { FeedbackToast, QuizPanel, SummitAlert } from '@/components/dontlookdown/Overlays'
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
    WORLD,
    createPlayer,
    updatePlayerPhysics,
    movePlayer,
    giveEnergy,
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
    remainingTime?: number
    questionSetTitle?: string | null
}

/**
 * 점프점프 게임 화면. 캔버스 게임 루프가 ref에 든 권위 상태를 60fps로 돌리고,
 * React 상태(uiPlayer 등)는 150ms마다 한 번씩만 따라온다.
 *
 * - 그리기 함수: components/dontlookdown/renderer.ts
 * - 파티클·잔상·배경 생성: components/dontlookdown/effects.ts
 * - 이미지 로딩: useGameAssets, 입력: useGameInput
 * - HUD·버튼·오버레이: StatusPanels / TouchControls / Overlays
 */
export default function DontLookDownGame({
    questionSetTitle,
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
    remainingTime,
}: DontLookDownGameProps) {
    // ============ Refs (게임 권위 상태) ============
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    // 컨테이너는 플레이어 준비 뒤에야 마운트된다(그 전엔 로딩 화면). 마운트 시 한 번 도는 효과는
    // 그때 ref가 null이라 놓치므로, 실제로 붙은 시점을 state로 받아 그 뒤에 측정한다.
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)

    // 내 플레이어 - 클라이언트가 권위, 서버 값으로 덮어쓰지 않음
    const playerRef = useRef<DLDPlayer | null>(null)
    const cameraRef = useRef({ x: 0, y: 0 })
    // 한 화면에 담는 월드 크기 = 컨테이너 CSS 크기 ÷ WORLD.VIEW_SCALE. 캔버스 픽셀과 CSS 비율이
    // 항상 같아 늘어나 보이지 않고, 어떤 기기에서도 요소가 같은 크기로 보인다.
    const viewRef = useRef<{ w: number; h: number }>({ w: WORLD.VIEW_WIDTH, h: WORLD.VIEW_HEIGHT })
    const showQuizRef = useRef(false)

    // 외부 상태 스냅샷 (props → ref, 게임 루프는 항상 최신 ref를 읽음)
    const otherPlayersRef = useRef<DLDPlayer[]>([])
    // 다른 학생의 화면상 위치. 좌표 패킷은 200ms 간격으로 띄엄띄엄 오므로, 받은 좌표(목표)를 향해
    // 매 프레임 조금씩 따라가게 해서 순간이동처럼 보이지 않게 한다.
    const otherDisplayRef = useRef<Map<string, { x: number; y: number }>>(new Map())
    const lastDrawTimeRef = useRef<number>(0)
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

    // 이미지 캐시
    const {
        platformImagesRef,
        propImagesRef,
        backdropImagesRef,
        powerUpImagesRef,
        getAvatarImage,
    } = useGameAssets(characterImage, players)

    // ============ React UI 상태 (저빈도 동기화) ============
    const [uiPlayer, setUiPlayer] = useState<DLDPlayer | null>(null)
    const [showQuiz, setShowQuiz] = useState(false)
    const [showSummitAlert, setShowSummitAlert] = useState<number | null>(null)
    const [combo, setCombo] = useState(0)
    const [quizFeedback, setQuizFeedback] = useState<QuizFeedback | null>(null)

    const { isTouch, pressGameKey, releaseGameKey } = useGameInput({
        keysRef,
        jumpBufferRef,
        onQuizKey: () => setShowQuiz(true),
        onPowerUpKey: (slotIndex) => {
            const current = playerRef.current
            if (current && (current.powerUps?.length ?? 0) > slotIndex) {
                activatePowerUpSlotRef.current(slotIndex)
            }
        },
    })

    useEffect(() => {
        showQuizRef.current = showQuiz
    }, [showQuiz])

    if (cloudsRef.current.length === 0) cloudsRef.current = createClouds()
    if (starsRef.current.length === 0) starsRef.current = createStars()

    const showFeedback = (feedback: QuizFeedback) => {
        setQuizFeedback(feedback)
        window.setTimeout(() => setQuizFeedback(null), 1200)
    }

    const spawnBurst = (x: number, y: number, color: string, count = 12, speed = 220) => {
        particlesRef.current = withBurst(particlesRef.current, x, y, color, count, speed)
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
            const view = viewRef.current
            cameraRef.current = {
                x: Math.max(0, Math.min(initial.x - view.w * 0.34, WORLD.WIDTH - view.w)),
                y: initial.y - view.h * 0.68,
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

    // ============ 화면 비율 측정 → 뷰 크기 ============
    useEffect(() => {
        const el = containerEl
        if (!el) return
        const measure = () => {
            const rect = el.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) return
            const w = Math.round(Math.max(WORLD.VIEW_MIN_WIDTH, Math.min(WORLD.WIDTH, rect.width / WORLD.VIEW_SCALE)))
            const h = Math.round(Math.max(WORLD.VIEW_MIN_HEIGHT, Math.min(WORLD.VIEW_MAX_HEIGHT, rect.height / WORLD.VIEW_SCALE)))
            viewRef.current = { w, h }
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
    }, [containerEl])

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

            const view = viewRef.current
            if (canvas.width !== view.w) canvas.width = view.w
            if (canvas.height !== view.h) canvas.height = view.h

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
                view,
                settings: settingsRef.current,
                clouds: cloudsRef.current,
                stars: starsRef.current,
                layers: backdropImagesRef.current,
            })

            ctx.save()
            ctx.translate(-camX, -camY)

            drawAltitudeMarkers(ctx, settingsRef.current.summitGoal)
            drawRoutePath(ctx, platformsRef.current)
            drawClimbAxis(ctx, settingsRef.current.summitGoal)
            drawPlatforms(ctx, {
                platforms: platformsRef.current,
                platformImages: platformImagesRef.current,
                propImages: propImagesRef.current,
            })

            drawObstacles(ctx, obstaclesRef.current, now)
            drawPowerUps(ctx, powerUpsRef.current, powerUpImagesRef.current, now)

            // 다른 플레이어 (목표 좌표를 향해 보간)
            const drawNow = performance.now()
            const drawDt = Math.min(0.05, Math.max(0, (drawNow - (lastDrawTimeRef.current || drawNow)) / 1000))
            lastDrawTimeRef.current = drawNow
            // 약 80ms 시간상수: 200ms 패킷 간격 안에 목표에 거의 도달한다
            const follow = 1 - Math.exp(-drawDt / 0.08)
            const displayMap = otherDisplayRef.current
            const aliveIds = new Set<string>()
            for (const op of otherPlayersRef.current) {
                aliveIds.add(op.id)
                let display = displayMap.get(op.id)
                if (!display || Math.hypot(display.x - op.x, display.y - op.y) > 900) {
                    // 첫 등장이거나 체크포인트로 떨어지는 등 큰 점프면 바로 이동
                    display = { x: op.x, y: op.y }
                } else {
                    display = {
                        x: display.x + (op.x - display.x) * follow,
                        y: display.y + (op.y - display.y) * follow,
                    }
                }
                displayMap.set(op.id, display)

                const avatar = op.avatar || '🐕'
                drawCharacter(ctx, {
                    player: { ...op, x: display.x, y: display.y },
                    avatar,
                    avatarImage: getAvatarImage(avatar),
                    isLocal: false,
                })
            }
            displayMap.forEach((_, id) => {
                if (!aliveIds.has(id)) displayMap.delete(id)
            })

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

            drawSpeedLines(ctx, player, now, view)
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
                particlesRef.current = withRocketExhaust(particlesRef.current, player, dt)
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
            const view = viewRef.current
            const targetCamX = Math.max(
                0,
                Math.min(player.x - view.w * 0.34, WORLD.WIDTH - view.w)
            )
            const lookAhead = player.vy < 0 ? -70 : player.vy > 500 ? 35 : 0
            const targetCamY = player.y - view.h * 0.68 + lookAhead
            const camAlpha = 1 - Math.pow(1 - PHYSICS.CAMERA_LERP, dt * 60)
            cameraRef.current.x += (targetCamX - cameraRef.current.x) * camAlpha
            cameraRef.current.y += (targetCamY - cameraRef.current.y) * camAlpha

            shakeRef.current = Math.max(0, shakeRef.current - dt * 24)
            trailRef.current = advanceTrail(trailRef.current, player, dt)
            particlesRef.current = advanceParticles(particlesRef.current, dt)

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
    // ⚠ 빈 deps — 게임 루프는 마운트 시 한 번만 시작. useGameAssets 가 돌려주는 ref·getAvatarImage 는
    // 모두 고정 참조라 deps 에 넣어도 같지만, 루프가 다시 시작되는 것처럼 읽히지 않도록 비워 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
        return <div className="w-full h-full flex items-center justify-center text-gray-700">불러오는 중</div>
    }

    // 리더보드: 내 플레이어는 권위(uiPlayer) 기준, 나머지는 props.players
    const leaderboard = [...players.filter(p => p.id !== playerId), uiPlayer]
        .sort((a, b) => b.height - a.height)
        .slice(0, 3)

    return (
        <div
            ref={(el) => {
                containerRef.current = el
                setContainerEl(el)
            }}
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
                {remainingTime !== undefined && <TimeBadge remainingTime={remainingTime} />}

                <ProgressPanel player={uiPlayer} settings={settings} questionSetTitle={questionSetTitle} />
                <EnergyPanel player={uiPlayer} onActivatePowerUp={(index) => activatePowerUpSlotRef.current(index)} />

                <FeedbackToast feedback={quizFeedback} />

                {combo > 1 && (
                    <div className="absolute top-20 right-4 rounded-xl bg-sky-500 px-5 py-2 font-black text-white shadow-lg">
                        🔥 {combo} 콤보
                    </div>
                )}

                <Leaderboard players={leaderboard} playerId={playerId} />

                {isTouch ? (
                    <TouchControls
                        onPress={pressGameKey}
                        onRelease={releaseGameKey}
                        onOpenQuiz={() => setShowQuiz(true)}
                    />
                ) : (
                    <KeyboardControls onOpenQuiz={() => setShowQuiz(true)} />
                )}
            </div>

            <SummitAlert summit={showSummitAlert} />

            <QuizPanel
                open={showQuiz}
                question={currentQuestion}
                onAnswer={handleAnswer}
                onClose={() => setShowQuiz(false)}
            />
        </div>
    )
}
