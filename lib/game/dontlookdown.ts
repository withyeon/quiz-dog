/**
 * Don't Look Down 게임 로직 (개선판)
 * Gimkit의 Don't Look Down을 기반으로 한 플랫폼 점프 퀴즈 게임
 */

// ============================================
// 타입 정의
// ============================================

export type PowerUpType = 'shield' | 'rocket' | 'energy' | 'double_points' | 'ghost' | 'time_freeze'

export interface PowerUp {
    id: string
    type: PowerUpType
    x: number
    y: number
    active: boolean
    platformId: string
}

export interface PlayerPowerUp {
    type: PowerUpType
    duration?: number  // 지속 시간 (초), 즉시 효과는 undefined
}

export type ObstacleType = 'laser' | 'disappearing' | 'spike' | 'wind'

export interface Obstacle {
    id: string
    type: ObstacleType
    x: number
    y: number
    width: number
    height: number
    direction?: 'left' | 'right' | 'up' | 'down'  // 레이저/바람 방향
    speed?: number  // 이동 속도
    active: boolean
}

export interface DLDPlayer {
    id: string
    nickname: string
    avatar: string
    x: number              // X 좌표
    y: number              // Y 좌표 (높이)
    vx: number             // X 속도
    vy: number             // Y 속도
    energy: number         // 남은 에너지
    height: number         // 최고 도달 높이 (미터)
    isOnGround: boolean    // 플랫폼 위에 있는지
    canDoubleJump: boolean // 더블 점프 가능 여부
    facingRight: boolean   // 오른쪽을 보고 있는지
    lives: number          // 남은 생명
    currentSummit: number  // 현재 Summit (1-6)
    lastCheckpointY: number // 마지막 체크포인트 Y 좌표
    powerUps: PlayerPowerUp[] // 보유 중인 파워업 (최대 2개)
    activePowerUps: Map<PowerUpType, number> // 활성화된 파워업과 남은 시간
    hasShield: boolean     // 실드 보호 여부
    pointsMultiplier: number // 점수 배수
}

// 플랫폼 비주얼 스타일 (이미지 연결용)
export type PlatformStyle = 'stone' | 'wood' | 'chair' | 'barrel' | 'table' | 'brick'

export interface Platform {
    id: string
    x: number              // 왼쪽 끝 X 좌표
    y: number              // 상단 Y 좌표
    width: number          // 폭 (이미지 로드 전 기본값, 로드 후 이미지 크기로 갱신)
    height: number         // 높이
    type: 'normal' | 'narrow' | 'checkpoint' | 'peak' | 'start' | 'disappearing' | 'spike'
    style?: PlatformStyle  // 디자인 변형 (이미지 연결용)
    imageId?: number       // 1~9, public/dontlookdown/platforms/{imageId}.svg
    summit: number         // 속한 Summit (1-6)
    disappearTime?: number // 사라지는 플랫폼의 사라질 시간
    isVisible?: boolean    // 사라지는 플랫폼의 가시성
}

export const PLATFORM_IMAGE_COUNT = 9
export const getPlatformImagePath = (imageId: number) => `/dontlookdown/platforms/${imageId}.svg`

export interface GameSettings {
    duration: number           // 게임 시간 (초)
    energyPerQuestion: number  // 문제당 에너지
    summitGoal: number        // 정상 높이 (미터)
    checkpointsEnabled: boolean
    livesEnabled: boolean     // 생명 시스템 활성화
    startingLives: number     // 시작 생명
    fallPenalty: number       // 떨어졌을 때 에너지 페널티
    powerUpsEnabled: boolean  // 파워업 활성화
}

export interface DLDGameState {
    players: Map<string, DLDPlayer>
    platforms: Platform[]
    powerUps: PowerUp[]
    obstacles: Obstacle[]
    winner: string | null
    gameStartTime: number
    settings: GameSettings
}

// ============================================
// 게임 상수
// ============================================

// 모든 단위는 초(seconds) 기준.
// 속도: px/s, 가속도: px/s², 시간: s
// 마찰/공기저항: 60fps 기준 프레임당 곱셈값. 실제 적용 시 Math.pow(value, dt * 60) 사용.
export const PHYSICS = {
    GRAVITY: 2340,                  // px/s² (base gravity, 가변 중력 배수로 보정)
    GRAVITY_UP_MULTIPLIER: 0.7,     // 올라갈 때 (vy < 0): 더 가벼운 중력
    GRAVITY_DOWN_MULTIPLIER: 1.3,   // 떨어질 때 (vy > 0): 더 빠른 하강
    JUMP_POWER: -900,               // px/s
    DOUBLE_JUMP_POWER: -960,        // px/s
    MOVE_SPEED: 600,                // px/s (목표 속도)
    MOVE_ACCEL: 2880,               // px/s² (가속도)
    RUN_MULTIPLIER: 1.35,
    MAX_FALL_SPEED: 1200,           // px/s
    FRICTION: 0.92,                 // 60fps 프레임당 곱셈값
    AIR_RESISTANCE: 0.88,           // 60fps 프레임당 곱셈값
    STOP_DECEL: 0.35,               // 입력 없을 때 빠른 감속 (60fps 기준 프레임당)
    WIND_FORCE: 7200,               // px/s² (바람 가속도)
    COYOTE_TIME: 0.1,               // s
    JUMP_BUFFER_TIME: 0.1,          // s
    CAMERA_LERP: 0.08,              // 60fps 프레임당 카메라 추격 비율
} as const

export const ENERGY = {
    MOVE_COST: 0.2,            // 이동 시 에너지 소모 (프레임당) - 낮춤
    JUMP_COST: 4,              // 점프 에너지 소모
    DOUBLE_JUMP_COST: 8,       // 더블 점프 에너지 소모
    FALL_PENALTY: 25,          // 떨어졌을 때 페널티
    SPIKE_DAMAGE: 15,          // 가시 데미지
} as const

export const PLAYER_SIZE = {
    WIDTH: 30,
    HEIGHT: 40,
} as const

export const POWERUP_SIZE = {
    WIDTH: 24,
    HEIGHT: 24,
} as const

export const METERS_PER_PIXEL = 0.1 // 10픽셀 = 1미터

// 월드 크기 (오른쪽 위 방향 넓은 맵)
export const WORLD = {
    WIDTH: 3600,   // 더 넓은 우상향 맵
    HEIGHT: 6000,  // 세로 여유
    VIEW_WIDTH: 800,
    VIEW_HEIGHT: 600,
} as const

// 플랫폼 크기 (narrow = 한 칸, 아슬아슬)
export const PLATFORM = {
    NARROW_WIDTH: 45,   // 한 칸 = 플레이어보다 조금 넓음
    NORMAL_MIN: 90,
    NORMAL_MAX: 150,
} as const

// 플랫폼 이미지 경로 (public/dontlookdown/ 에 배치 시 사용)
export const PLATFORM_IMAGES: Record<PlatformStyle, string> = {
    stone: '/dontlookdown/platform_stone.png',
    wood: '/dontlookdown/platform_wood.png',
    chair: '/dontlookdown/platform_chair.png',
    barrel: '/dontlookdown/platform_barrel.png',
    table: '/dontlookdown/platform_table.png',
    brick: '/dontlookdown/platform_brick.png',
}

// Summit 구성 (8개 구역 - 위쪽 맵 확장)
export const SUMMITS = [
    { id: 1, name: '훈련장', startHeight: 0, endHeight: 15, color: '#87CEEB' },
    { id: 2, name: '산길', startHeight: 15, endHeight: 35, color: '#7CB9E8' },
    { id: 3, name: '중간 계곡', startHeight: 35, endHeight: 55, color: '#6495ED' },
    { id: 4, name: '바람 계곡', startHeight: 55, endHeight: 70, color: '#4169E1' },
    { id: 5, name: '가시 숲', startHeight: 70, endHeight: 85, color: '#0000CD' },
    { id: 6, name: '고원', startHeight: 85, endHeight: 100, color: '#000080' },
    { id: 7, name: '눈 덮인 길', startHeight: 100, endHeight: 115, color: '#E6E6FA' },
    { id: 8, name: '정상', startHeight: 115, endHeight: 130, color: '#2F2F4F' },
] as const

// 파워업 효과
export const POWERUP_EFFECTS = {
    shield: { duration: Infinity, icon: '🛡️', name: 'Shield' },
    rocket: { duration: 0, icon: '🚀', name: 'Rocket Boost' },
    energy: { duration: 0, icon: '⚡', name: 'Energy Surge' },
    double_points: { duration: 30, icon: '🌟', name: 'Double Points' },
    ghost: { duration: 5, icon: '👻', name: 'Ghost Mode' },
    time_freeze: { duration: 3, icon: '⏱️', name: 'Time Freeze' },
} as const

// 기본 설정
export const DEFAULT_SETTINGS: GameSettings = {
    duration: 300,             // 5분 (선생님이 설정하는 제한 시간 기준)
    energyPerQuestion: 800,    // 문제당 800 에너지 (Gimkit 스타일)
    summitGoal: 130,           // 정상 높이 (진행도 표시용, 8구역)
    checkpointsEnabled: true,
    livesEnabled: false,       // Don't Look Down: 생명 시스템 비활성화
    startingLives: 0,
    fallPenalty: 25,
    powerUpsEnabled: true,
}

// ============================================
// 플랫폼 맵 생성 (Summit 기반)
// ============================================

// 플랫폼 스타일 풀 (디자인 다양화)
const PLATFORM_STYLES: PlatformStyle[] = ['stone', 'wood', 'chair', 'barrel', 'table', 'brick']

export function generatePlatformMap(summitGoal: number, settings: GameSettings): Platform[] {
    const platforms: Platform[] = []

    // 시작 플랫폼 (바닥) - 왼쪽 하단
    platforms.push({
        id: 'start',
        x: 50,
        y: 600,
        width: 200,
        height: 40,
        type: 'start',
        style: 'brick',
        imageId: 1,
        summit: 1,
        isVisible: true,
    })

    const targetPixelHeight = summitGoal / METERS_PER_PIXEL
    let currentY = 560
    let currentX = 150  // 오른쪽 위로 쌓이므로 X 시작점
    let platformId = 0

    // 오른쪽 위 diagonal: 한 층당 X +80, Y -140 (플랫폼 간 충분한 간격)
    const X_STEP = 80
    const Y_STEP = 140

    // Gimkit 스타일: 6개 Summit, 오른쪽 위로 올라가는 계단
    SUMMITS.forEach((summit, summitIndex) => {
        const summitStartY = currentY
        const summitStartX = currentX
        const summitHeight = (summit.endHeight - summit.startHeight) / METERS_PER_PIXEL

        let summitCurrentY = summitStartY
        let summitCurrentX = summitStartX
        const summitEndY = summitStartY - summitHeight

        let checkpointAdded = false

        // narrow 비율: 구역이 올라갈수록 비율 증가 (8구역 기준)
        const maxSummitIndex = SUMMITS.length - 1
        const narrowRatio = maxSummitIndex <= 0 ? 0.05 : 0.05 + (summitIndex / maxSummitIndex) * 0.4

        while (summitCurrentY > summitEndY) {
            const difficulty = maxSummitIndex <= 0 ? 0 : summitIndex / maxSummitIndex
            const rowIndex = Math.floor((summitStartY - summitCurrentY) / Y_STEP)

            // 현재 층의 X 범위 (오른쪽 위로)
            const baseX = Math.min(summitCurrentX, WORLD.WIDTH - 300)

            // === 메인 루트 플랫폼 (항상 올라갈 수 있는 안전 발판) ===
            const mainWidth = PLATFORM.NORMAL_MIN + Math.random() * (PLATFORM.NORMAL_MAX - PLATFORM.NORMAL_MIN)
            const mainStyle = PLATFORM_STYLES[rowIndex % PLATFORM_STYLES.length]
            const mainImgId = 1 + (platformId % PLATFORM_IMAGE_COUNT)

            platforms.push({
                id: `platform_${platformId++}`,
                x: baseX,                   // 메인 루트는 랜덤 없이 일정하게 우상향
                y: summitCurrentY,
                width: mainWidth,
                height: 24,
                type: 'normal',            // 메인 루트는 항상 normal
                style: mainStyle,
                imageId: mainImgId,
                summit: summit.id,
                isVisible: true,
            })

            // === 선택 루트 플랫폼 (난이도용, 없어도 됨) ===
            if (Math.random() < 0.6) {
                const useNarrow2 = Math.random() < narrowRatio
                const width2 = useNarrow2 ? PLATFORM.NARROW_WIDTH : PLATFORM.NORMAL_MIN + 30

                let type2: Platform['type'] = useNarrow2 ? 'narrow' : 'normal'
                if (summit.id >= 2 && !useNarrow2 && Math.random() < 0.08) type2 = 'disappearing'
                else if (summit.id >= 5 && !useNarrow2 && Math.random() < 0.05) type2 = 'spike'

                const imgId2 = 1 + (platformId % PLATFORM_IMAGE_COUNT)
                platforms.push({
                    id: `platform_${platformId++}`,
                    x: baseX + 180 + Math.random() * 80,
                    y: summitCurrentY - 15 + Math.random() * 20,
                    width: width2,
                    height: 24,
                    type: type2,
                    style: PLATFORM_STYLES[(rowIndex + 1) % PLATFORM_STYLES.length],
                    imageId: imgId2,
                    summit: summit.id,
                    isVisible: true,
                })
            }

            // 체크포인트 (각 Summit 중간쯤)
            if (settings.checkpointsEnabled && !checkpointAdded && summitCurrentY < summitStartY - summitHeight * 0.35 && summitCurrentY > summitEndY + 80) {
                checkpointAdded = true
                platforms.push({
                    id: `checkpoint_summit${summit.id}`,
                    x: baseX + 80,
                    y: summitCurrentY - 25,
                    width: 120,
                    height: 28,
                    type: 'checkpoint',
                    style: 'stone',
                    imageId: 1 + (summit.id % PLATFORM_IMAGE_COUNT),
                    summit: summit.id,
                    isVisible: true,
                })
            }

            summitCurrentY -= Y_STEP
            summitCurrentX += X_STEP
        }

        currentY = summitCurrentY
        currentX = summitCurrentX
    })

    // 정상 플랫폼 (맨 오른쪽 위)
    const lastSummitId = SUMMITS[SUMMITS.length - 1].id
    platforms.push({
        id: 'peak',
        x: currentX - 100,
        y: currentY - 80,
        width: 200,
        height: 40,
        type: 'peak',
        style: 'stone',
        imageId: 9,
        summit: lastSummitId,
        isVisible: true,
    })

    return platforms
}

// ============================================
// 장애물 생성
// ============================================

export function generateObstacles(platforms: Platform[]): Obstacle[] {
    const obstacles: Obstacle[] = []
    let obstacleId = 0

    platforms.forEach(platform => {
        // Summit 4 이상부터 바람
        if (platform.summit >= 4 && Math.random() < 0.08) {
            obstacles.push({
                id: `wind_${obstacleId++}`,
                type: 'wind',
                x: platform.x - 50,
                y: platform.y - 100,
                width: platform.width + 100,
                height: 100,
                direction: Math.random() > 0.5 ? 'left' : 'right',
                active: true,
            })
        }
    })

    return obstacles
}

// ============================================
// 파워업 생성
// ============================================

export function spawnPowerUp(platforms: Platform[]): PowerUp | null {
    // 정상이 아닌 일반 플랫폼에서 랜덤 선택
    const eligiblePlatforms = platforms.filter(p =>
        p.type === 'normal' && p.summit >= 2 && p.isVisible
    )

    if (eligiblePlatforms.length === 0) return null

    const platform = eligiblePlatforms[Math.floor(Math.random() * eligiblePlatforms.length)]

    const powerUpTypes: PowerUpType[] = ['shield', 'rocket', 'energy', 'double_points', 'ghost']
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]

    return {
        id: `powerup_${Date.now()}_${Math.random()}`,
        type,
        x: platform.x + platform.width / 2 - POWERUP_SIZE.WIDTH / 2,
        y: platform.y - POWERUP_SIZE.HEIGHT - 5,
        active: true,
        platformId: platform.id,
    }
}

// ============================================
// 물리 및 충돌 감지
// ============================================

/**
 * 플레이어 물리 업데이트.
 * @param dt 경과 시간 (초). 60fps에서 약 0.0167.
 */
export function updatePlayerPhysics(
    player: DLDPlayer,
    platforms: Platform[],
    obstacles: Obstacle[],
    dt: number = 1 / 60
): DLDPlayer {
    const updated = { ...player }

    // 가변 중력: 올라갈 땐 가볍게, 떨어질 땐 무겁게 (점프 느낌 강화)
    const gravityMult = updated.vy < 0 ? PHYSICS.GRAVITY_UP_MULTIPLIER : PHYSICS.GRAVITY_DOWN_MULTIPLIER
    updated.vy += PHYSICS.GRAVITY * gravityMult * dt

    if (updated.vy > PHYSICS.MAX_FALL_SPEED) {
        updated.vy = PHYSICS.MAX_FALL_SPEED
    }

    // 바람 효과 (Ghost 모드가 아닐 때만)
    if (!updated.activePowerUps.has('ghost')) {
        for (const obstacle of obstacles) {
            if (obstacle.type === 'wind' && obstacle.active && checkObstacleCollision(updated, obstacle)) {
                const windForce = obstacle.direction === 'left' ? -PHYSICS.WIND_FORCE : PHYSICS.WIND_FORCE
                updated.vx += windForce * dt
            }
        }
    }

    // 적분 전 이전 위치 보관 (tunneling 방지용)
    const prevY = player.y
    const prevBottom = prevY + PLAYER_SIZE.HEIGHT

    updated.x += updated.vx * dt
    updated.y += updated.vy * dt

    if (updated.x < 0) updated.x = 0
    if (updated.x > WORLD.WIDTH - PLAYER_SIZE.WIDTH) updated.x = WORLD.WIDTH - PLAYER_SIZE.WIDTH

    updated.isOnGround = false

    for (const platform of platforms) {
        if (!platform.isVisible) continue

        // X축 겹침 체크
        const xOverlap =
            updated.x + PLAYER_SIZE.WIDTH > platform.x &&
            updated.x < platform.x + platform.width
        if (!xOverlap) continue

        const newBottom = updated.y + PLAYER_SIZE.HEIGHT
        const platformBottom = platform.y + platform.height

        // 위에서 착지: 이전 프레임 발끝이 플랫폼 윗면 위였고, 이번 프레임에 통과/접촉한 경우 (sweep)
        if (player.vy >= 0 && prevBottom <= platform.y + 1 && newBottom >= platform.y) {
            updated.y = platform.y - PLAYER_SIZE.HEIGHT
            updated.vy = 0
            updated.isOnGround = true
            updated.canDoubleJump = true

            // 바닥 마찰력 (60fps 기준 프레임당 FRICTION을 dt에 맞춰 적용)
            updated.vx *= Math.pow(PHYSICS.FRICTION, dt * 60)

            if (platform.type === 'checkpoint') {
                updated.lastCheckpointY = platform.y
            }
            if (platform.type === 'spike' && !updated.hasShield) {
                updated.energy = Math.max(0, updated.energy - ENERGY.SPIKE_DAMAGE)
            }
            if (platform.type === 'disappearing' && !platform.disappearTime) {
                platform.disappearTime = Date.now() + 2000
            }
        } else if (player.vy < 0 && prevY >= platformBottom && updated.y < platformBottom) {
            // 천장 박치기: 이전엔 아래였는데 이번에 박스 안으로 들어옴
            if (updated.y + PLAYER_SIZE.HEIGHT > platform.y) {
                updated.y = platformBottom
                updated.vy = 0
            }
        }
    }

    if (!updated.isOnGround) {
        updated.vx *= Math.pow(PHYSICS.AIR_RESISTANCE, dt * 60)
    }

    // 레이저 충돌 체크 (Ghost 모드가 아닐 때만)
    if (!updated.activePowerUps.has('ghost')) {
        for (const obstacle of obstacles) {
            if (obstacle.type === 'laser' && obstacle.active) {
                if (checkObstacleCollision(updated, obstacle)) {
                    // 레이저에 닿으면 떨어짐 처리
                    return handlePlayerFall(updated, platforms)
                }
            }
        }
    }

    // 높이 계산 (미터)
    const heightInMeters = Math.abs(updated.y - 600) * METERS_PER_PIXEL
    if (heightInMeters > updated.height) {
        updated.height = heightInMeters
    }

    // Summit 계산
    const newSummit = SUMMITS.findIndex(s =>
        heightInMeters >= s.startHeight && heightInMeters < s.endHeight
    ) + 1
    if (newSummit > 0 && newSummit !== updated.currentSummit) {
        updated.currentSummit = newSummit
    }

    // 너무 아래로 떨어지면 리스폰
    if (updated.y > 700) {
        return handlePlayerFall(updated, platforms)
    }

    return updated
}

function checkPlatformCollision(player: DLDPlayer, platform: Platform): boolean {
    return (
        player.x + PLAYER_SIZE.WIDTH > platform.x &&
        player.x < platform.x + platform.width &&
        player.y + PLAYER_SIZE.HEIGHT > platform.y &&
        player.y < platform.y + platform.height
    )
}

function checkObstacleCollision(player: DLDPlayer, obstacle: Obstacle): boolean {
    return (
        player.x + PLAYER_SIZE.WIDTH > obstacle.x &&
        player.x < obstacle.x + obstacle.width &&
        player.y + PLAYER_SIZE.HEIGHT > obstacle.y &&
        player.y < obstacle.y + obstacle.height
    )
}

// ============================================
// 떨어짐 처리
// ============================================

export function handlePlayerFall(player: DLDPlayer, platforms: Platform[]): DLDPlayer {
    const updated = { ...player }

    // 실드가 있으면 보호하고 실드 제거
    if (updated.hasShield) {
        updated.hasShield = false
        updated.powerUps = updated.powerUps.filter(p => p.type !== 'shield')
        return updated
    }

    // 생명 감소
    updated.lives = Math.max(0, updated.lives - 1)

    // 에너지 페널티
    updated.energy = Math.max(0, updated.energy - ENERGY.FALL_PENALTY)

    // 리스폰 위치 결정
    if (updated.lastCheckpointY > 0) {
        updated.y = updated.lastCheckpointY - PLAYER_SIZE.HEIGHT - 10
        updated.x = 200  // 체크포인트 근처
    } else {
        // 시작 지점 (왼쪽 하단)
        updated.y = 560
        updated.x = 150
    }

    // 완전히 리셋된 상태로, 바닥에 안정적으로 서 있도록 처리
    updated.vx = 0
    updated.vy = 0
    updated.isOnGround = true
    updated.canDoubleJump = true

    return updated
}

// ============================================
// 플레이어 액션
// ============================================

/**
 * 가속 기반 이동. dt를 통해 프레임레이트에 독립적인 가속을 적용.
 * @param dt 경과 시간 (초)
 */
export function movePlayer(
    player: DLDPlayer,
    direction: 'left' | 'right',
    isRunning: boolean = false,
    dt: number = 1 / 60
): DLDPlayer {
    if (player.energy < ENERGY.MOVE_COST) return player

    const accel = isRunning ? PHYSICS.MOVE_ACCEL * 1.4 : PHYSICS.MOVE_ACCEL
    const maxSpeed = isRunning ? PHYSICS.MOVE_SPEED * PHYSICS.RUN_MULTIPLIER : PHYSICS.MOVE_SPEED

    let newVx = player.vx + (direction === 'left' ? -accel * dt : accel * dt)
    newVx = Math.max(-maxSpeed, Math.min(maxSpeed, newVx))

    // 에너지는 시간 비례 소모 (60fps 기준 프레임당 ENERGY.MOVE_COST)
    return {
        ...player,
        vx: newVx,
        facingRight: direction === 'right',
        energy: player.energy - ENERGY.MOVE_COST * (dt * 60),
    }
}

export function jumpPlayer(player: DLDPlayer, isDoubleJump: boolean = false): DLDPlayer {
    if (isDoubleJump) {
        // 더블 점프: 에너지 상관없이 항상 한 번은 가능하도록 완화
        if (!player.canDoubleJump) {
            return player
        }

        return {
            ...player,
            vy: PHYSICS.DOUBLE_JUMP_POWER,
            canDoubleJump: false,
        }
    } else {
        // 일반 점프
        if (!player.isOnGround || player.energy < ENERGY.JUMP_COST) {
            return player
        }

        return {
            ...player,
            vy: PHYSICS.JUMP_POWER,
            isOnGround: false,
            energy: player.energy - ENERGY.JUMP_COST,
        }
    }
}

export function giveEnergy(player: DLDPlayer, amount: number): DLDPlayer {
    const multiplier = player.activePowerUps.has('double_points') ? 2 : 1
    return {
        ...player,
        energy: player.energy + (amount * multiplier),
    }
}

// ============================================
// 파워업 관련
// ============================================

export function collectPowerUp(player: DLDPlayer, powerUp: PowerUp): DLDPlayer {
    const updated = { ...player }

    // 이미 2개를 가지고 있으면 수집 불가
    if (updated.powerUps.length >= 2) {
        return player
    }

    // 파워업 추가
    updated.powerUps = [...updated.powerUps, { type: powerUp.type }]

    return updated
}

export function applyPowerUp(player: DLDPlayer, powerUpIndex: number): DLDPlayer {
    if (powerUpIndex < 0 || powerUpIndex >= player.powerUps.length) {
        return player
    }

    const updated = { ...player, activePowerUps: new Map(player.activePowerUps) }
    const powerUp = updated.powerUps[powerUpIndex]

    switch (powerUp.type) {
        case 'shield':
            updated.hasShield = true
            break
        case 'rocket':
            updated.y -= 200
            updated.vy = 0
            break
        case 'energy':
            updated.energy += 50
            break
        case 'double_points':
            updated.activePowerUps.set('double_points', 30)
            break
        case 'ghost':
            updated.activePowerUps.set('ghost', 5)
            break
    }

    if (powerUp.type !== 'shield') {
        updated.powerUps = updated.powerUps.filter((_, i) => i !== powerUpIndex)
    }

    return updated
}

/**
 * @param dt 경과 시간 (초)
 */
export function updateActivePowerUps(player: DLDPlayer, dt: number): DLDPlayer {
    const updated = { ...player }
    const newActivePowerUps = new Map(updated.activePowerUps)

    newActivePowerUps.forEach((timeLeft, type) => {
        const newTime = timeLeft - dt
        if (newTime <= 0) {
            newActivePowerUps.delete(type)
            // double_points 종료 시 인벤토리에서도 제거
            if (type === 'double_points') {
                updated.powerUps = updated.powerUps.filter(p => p.type !== type)
            }
        } else {
            newActivePowerUps.set(type, newTime)
        }
    })

    updated.activePowerUps = newActivePowerUps

    return updated
}

// ============================================
// 장애물 업데이트
// ============================================

/**
 * @param dt 경과 시간 (초). 레이저 속도는 px/s.
 */
export function updateObstacles(obstacles: Obstacle[], dt: number): Obstacle[] {
    return obstacles.map(obstacle => {
        if (obstacle.type === 'laser' && obstacle.direction) {
            const newX = obstacle.x + (obstacle.direction === 'left' ? -obstacle.speed! : obstacle.speed!) * dt

            // 범위 제한 (100 ~ 700)
            if (newX < 100 || newX > 700) {
                return {
                    ...obstacle,
                    direction: obstacle.direction === 'left' ? 'right' : 'left',
                }
            }

            return {
                ...obstacle,
                x: newX,
            }
        }
        return obstacle
    })
}

// ============================================
// 플랫폼 업데이트 (사라지는 플랫폼)
// ============================================

export function updatePlatforms(platforms: Platform[]): Platform[] {
    const now = Date.now()

    return platforms.map(platform => {
        if (platform.type === 'disappearing' && platform.disappearTime) {
            if (now >= platform.disappearTime) {
                return {
                    ...platform,
                    isVisible: false,
                    disappearTime: undefined,
                }
            }
        }
        return platform
    })
}

// 사라진 플랫폼 복구
export function respawnPlatforms(platforms: Platform[]): Platform[] {
    return platforms.map(platform => {
        if (!platform.isVisible && platform.type === 'disappearing') {
            return {
                ...platform,
                isVisible: true,
                disappearTime: undefined,
            }
        }
        return platform
    })
}

// ============================================
// 게임 상태 확인
// ============================================

export function checkWinner(
    players: Map<string, DLDPlayer>,
    summitGoal: number
): string | null {
    for (const [id, player] of players) {
        if (player.height >= summitGoal) {
            return id
        }
    }
    return null
}

export function getLeaderboard(players: Map<string, DLDPlayer>): DLDPlayer[] {
    return Array.from(players.values())
        .sort((a, b) => b.height - a.height)
}

export function isPlayerAtPeak(player: DLDPlayer, platforms: Platform[]): boolean {
    const peakPlatform = platforms.find(p => p.type === 'peak')
    if (!peakPlatform) return false

    return checkPlatformCollision(player, peakPlatform) && player.isOnGround
}

export function checkGameOver(player: DLDPlayer, settings: GameSettings): boolean {
    if (settings.livesEnabled) {
        return player.lives <= 0
    }
    return false
}

// ============================================
// 초기 플레이어 생성
// ============================================

export function createPlayer(
    id: string,
    nickname: string,
    avatar: string,
    settings: GameSettings = DEFAULT_SETTINGS
): DLDPlayer {
    return {
        id,
        nickname,
        avatar,
        x: 150,
        y: 560,
        vx: 0,
        vy: 0,
        energy: 2000,          // Gimkit: 시작 에너지 2000
        height: 0,
        isOnGround: true,
        canDoubleJump: true,
        facingRight: true,
        lives: settings.startingLives,
        currentSummit: 1,
        lastCheckpointY: 0,
        powerUps: [],
        activePowerUps: new Map(),
        hasShield: false,
        pointsMultiplier: 1,
    }
}
