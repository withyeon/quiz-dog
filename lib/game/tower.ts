// 타워 디펜스 게임 로직

// ==================== 타워 타입 ====================
export type TowerTypeId = 'BASIC' | 'MAGIC' | 'BOMB' | 'LASER' | 'SLOW'

export interface TowerType {
    id: TowerTypeId
    name: string
    emoji: string
    description: string
    cost: number
    damage: number
    range: number
    attackSpeed: number // attacks per second
    special?: string
}

export const TOWER_TYPES: Record<TowerTypeId, TowerType> = {
    BASIC: {
        id: 'BASIC',
        name: '애로우 포스트',
        emoji: '🏹',
        description: '저렴하고 안정적인 단일 표적 공격',
        cost: 100,
        damage: 10,
        range: 80,
        attackSpeed: 1, // 1 attack per second
    },
    MAGIC: {
        id: 'MAGIC',
        name: '아크 메이지',
        emoji: '🔮',
        description: '타격 지점 주변에 마력 피해',
        cost: 200,
        damage: 8,
        range: 100,
        attackSpeed: 0.8,
        special: 'splash',
    },
    BOMB: {
        id: 'BOMB',
        name: '블래스트 캐논',
        emoji: '💣',
        description: '느리지만 강력한 광역 폭발',
        cost: 300,
        damage: 25,
        range: 90,
        attackSpeed: 0.5,
        special: 'explosion',
    },
    LASER: {
        id: 'LASER',
        name: '펄스 레이저',
        emoji: '⚡',
        description: '빠른 연사로 라인을 관통 공격',
        cost: 350,
        damage: 5,
        range: 120,
        attackSpeed: 3,
        special: 'pierce',
    },
    SLOW: {
        id: 'SLOW',
        name: '프로스트 코어',
        emoji: '❄️',
        description: '적을 잠시 둔화시키는 보조 화력',
        cost: 150,
        damage: 5,
        range: 100,
        attackSpeed: 1,
        special: 'slow',
    },
}

// ==================== 적 타입 ====================
export type EnemyTypeId = 'NORMAL' | 'FAST' | 'STRONG' | 'BOSS'

export interface EnemyType {
    id: EnemyTypeId
    name: string
    emoji: string
    hp: number
    speed: number // pixels per second
    goldReward: number
    leakDamage: number
    armor?: number
    slowFactor?: number
    description: string
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyType> = {
    NORMAL: {
        id: 'NORMAL',
        name: '일반 적',
        emoji: '👾',
        hp: 50,
        speed: 50,
        goldReward: 10,
        leakDamage: 8,
        description: '기본적인 적',
    },
    FAST: {
        id: 'FAST',
        name: '빠른 적',
        emoji: '🏃',
        hp: 34,
        speed: 108,
        goldReward: 12,
        leakDamage: 8,
        description: '빠르지만 약한 적',
    },
    STRONG: {
        id: 'STRONG',
        name: '강한 적',
        emoji: '🛡️',
        hp: 170,
        speed: 30,
        goldReward: 24,
        leakDamage: 14,
        armor: 2,
        description: '느리지만 강한 적',
    },
    BOSS: {
        id: 'BOSS',
        name: '보스',
        emoji: '👹',
        hp: 620,
        speed: 42,
        goldReward: 80,
        leakDamage: 28,
        armor: 4,
        slowFactor: 0.78,
        description: '강력한 보스 적',
    },
}

// ==================== 게임 상수 ====================
export const MAP_WIDTH = 800
export const MAP_HEIGHT = 600
export const PLAYER_START_HP = 100
export const PLAYER_START_GOLD = 300
export const MAX_TOWER_LEVEL = 4
export const QUIZ_HP_PENALTY = 5

// 적이 이동할 경로 (시작점 -> 끝점)
export const PATH_POINTS: { x: number; y: number }[] = [
    { x: 0, y: 200 },
    { x: 150, y: 200 },
    { x: 150, y: 400 },
    { x: 350, y: 400 },
    { x: 350, y: 150 },
    { x: 550, y: 150 },
    { x: 550, y: 350 },
    { x: 700, y: 350 },
    { x: 700, y: 500 },
    { x: MAP_WIDTH, y: 500 },
]

// 원본 맵 위에만 표시되는 고정 건설 슬롯입니다. 배경 이미지는 변경하지 않습니다.
export interface BuildSlot {
    id: string
    x: number
    y: number
    radius: number
}

export const BUILD_SLOTS: BuildSlot[] = [
    { id: 'slot-1', x: 90, y: 120, radius: 36 },
    { id: 'slot-2', x: 235, y: 275, radius: 36 },
    { id: 'slot-3', x: 245, y: 500, radius: 36 },
    { id: 'slot-4', x: 425, y: 300, radius: 36 },
    { id: 'slot-5', x: 460, y: 70, radius: 36 },
    { id: 'slot-6', x: 640, y: 235, radius: 36 },
    { id: 'slot-7', x: 610, y: 450, radius: 36 },
    { id: 'slot-8', x: 745, y: 270, radius: 36 },
]

// ==================== 웨이브 시스템 ====================
export interface Wave {
    wave: number
    enemies: { type: EnemyTypeId; count: number; spawnDelay: number }[]
}

export const WAVES: Wave[] = [
    {
        wave: 1,
        enemies: [{ type: 'NORMAL', count: 9, spawnDelay: 900 }],
    },
    {
        wave: 2,
        enemies: [
            { type: 'NORMAL', count: 10, spawnDelay: 850 },
            { type: 'FAST', count: 4, spawnDelay: 700 },
        ],
    },
    {
        wave: 3,
        enemies: [
            { type: 'NORMAL', count: 12, spawnDelay: 700 },
            { type: 'FAST', count: 7, spawnDelay: 520 },
        ],
    },
    {
        wave: 4,
        enemies: [
            { type: 'NORMAL', count: 12, spawnDelay: 620 },
            { type: 'FAST', count: 8, spawnDelay: 480 },
            { type: 'STRONG', count: 3, spawnDelay: 1300 },
        ],
    },
    {
        wave: 5,
        enemies: [
            { type: 'NORMAL', count: 12, spawnDelay: 560 },
            { type: 'FAST', count: 8, spawnDelay: 430 },
            { type: 'BOSS', count: 1, spawnDelay: 2600 },
        ],
    },
    {
        wave: 6,
        enemies: [
            { type: 'NORMAL', count: 14, spawnDelay: 520 },
            { type: 'FAST', count: 10, spawnDelay: 380 },
            { type: 'STRONG', count: 6, spawnDelay: 1100 },
        ],
    },
    {
        wave: 7,
        enemies: [
            { type: 'NORMAL', count: 14, spawnDelay: 450 },
            { type: 'FAST', count: 16, spawnDelay: 300 },
            { type: 'STRONG', count: 6, spawnDelay: 920 },
        ],
    },
    {
        wave: 8,
        enemies: [
            { type: 'NORMAL', count: 16, spawnDelay: 420 },
            { type: 'FAST', count: 14, spawnDelay: 310 },
            { type: 'STRONG', count: 9, spawnDelay: 780 },
        ],
    },
    {
        wave: 9,
        enemies: [
            { type: 'NORMAL', count: 18, spawnDelay: 360 },
            { type: 'FAST', count: 18, spawnDelay: 260 },
            { type: 'STRONG', count: 10, spawnDelay: 680 },
            { type: 'BOSS', count: 1, spawnDelay: 1900 },
        ],
    },
    {
        wave: 10,
        enemies: [
            { type: 'NORMAL', count: 24, spawnDelay: 330 },
            { type: 'FAST', count: 20, spawnDelay: 230 },
            { type: 'STRONG', count: 13, spawnDelay: 560 },
            { type: 'BOSS', count: 2, spawnDelay: 1400 },
        ],
    },
]

// ==================== 게임 엔티티 ====================
export interface Tower {
    id: string
    type: TowerTypeId
    slotId?: string
    x: number
    y: number
    level: number
    lastAttackTime: number
}

export interface Enemy {
    id: string
    type: EnemyTypeId
    hp: number
    maxHp: number
    speed: number
    currentPathIndex: number
    x: number
    y: number
    slowedUntil?: number
}

export interface Projectile {
    id: string
    towerId: string
    towerType: TowerTypeId
    x: number
    y: number
    targetX: number
    targetY: number
    targetEnemyId: string
    speed: number
    damage: number
}

// ==================== 게임 로직 함수 ====================

/**
 * 퀴즈 정답 시 골드 보상 계산
 * @param answerTime 답변 시간 (초)
 * @param timeLimit 제한 시간 (초)
 * @returns 획득 골드
 */
export function calculateQuizGoldReward(
    answerTime: number,
    timeLimit: number
): number {
    const timeRatio = Math.max(0, Math.min(1, (timeLimit - answerTime) / timeLimit))
    return Math.floor(60 + timeRatio * 60)
}

/**
 * 클릭 위치의 건설 슬롯 찾기
 */
export function getBuildSlotAtPoint(
    x: number,
    y: number,
    slots: BuildSlot[] = BUILD_SLOTS
): BuildSlot | null {
    return slots.find(slot => getDistance(x, y, slot.x, slot.y) <= slot.radius) ?? null
}

/**
 * 슬롯 배치 가능 여부 확인
 */
export function canPlaceTowerOnSlot(slotId: string, towers: Tower[]): boolean {
    return !towers.some(tower => tower.slotId === slotId)
}

/**
 * 타워 배치 가능 여부 확인
 */
export function canPlaceTower(
    x: number,
    y: number,
    towers: Tower[]
): boolean {
    const slot = getBuildSlotAtPoint(x, y)
    return Boolean(slot && canPlaceTowerOnSlot(slot.id, towers))
}

/**
 * 타워 업그레이드 비용 계산
 */
export function getTowerUpgradeCost(towerType: TowerTypeId, currentLevel: number): number {
    const baseCost = TOWER_TYPES[towerType].cost
    return Math.floor(baseCost * (0.65 + (currentLevel - 1) * 0.3))
}

/**
 * 타워의 실제 데미지 계산 (레벨 적용)
 */
export function getTowerDamage(towerType: TowerTypeId, level: number): number {
    const baseDamage = TOWER_TYPES[towerType].damage
    return baseDamage * level
}

/**
 * 타워의 실제 범위 계산 (레벨 적용)
 */
export function getTowerRange(towerType: TowerTypeId, level: number): number {
    const baseRange = TOWER_TYPES[towerType].range
    return baseRange + (level - 1) * 10
}

/**
 * 두 점 사이의 거리 계산
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * 방어력이 있는 적에게 적용되는 실제 피해량
 */
export function getEffectiveDamage(enemyType: EnemyTypeId, rawDamage: number): number {
    const armor = ENEMY_TYPES[enemyType].armor ?? 0
    return Math.max(1, rawDamage - armor)
}

export function getEnemyLeakDamage(enemyType: EnemyTypeId): number {
    return ENEMY_TYPES[enemyType].leakDamage
}

export function getLaserPierceCount(level: number): number {
    return Math.max(2, level + 1)
}

/**
 * 경로상의 다음 위치 계산
 */
export function getNextPosition(
    enemy: Enemy,
    deltaTime: number
): { x: number; y: number; pathIndex: number } {
    const nextPoint = PATH_POINTS[enemy.currentPathIndex + 1]

    if (!nextPoint) {
        // 경로의 끝에 도달
        return { x: enemy.x, y: enemy.y, pathIndex: enemy.currentPathIndex }
    }

    // 이동 거리 계산
    const slowFactor = ENEMY_TYPES[enemy.type].slowFactor ?? 0.55
    const effectiveSpeed = enemy.slowedUntil && enemy.slowedUntil > Date.now()
        ? enemy.speed * slowFactor
        : enemy.speed
    const moveDistance = effectiveSpeed * deltaTime

    // 현재 위치에서 다음 포인트까지의 거리
    const currentDx = nextPoint.x - enemy.x
    const currentDy = nextPoint.y - enemy.y
    const currentDistance = Math.sqrt(currentDx * currentDx + currentDy * currentDy)

    if (moveDistance >= currentDistance) {
        // 다음 포인트에 도달
        return {
            x: nextPoint.x,
            y: nextPoint.y,
            pathIndex: enemy.currentPathIndex + 1,
        }
    } else {
        // 다음 포인트로 조금 이동
        const ratio = moveDistance / currentDistance
        return {
            x: enemy.x + currentDx * ratio,
            y: enemy.y + currentDy * ratio,
            pathIndex: enemy.currentPathIndex,
        }
    }
}

/**
 * 적이 목표 지점에 도달했는지 확인
 */
export function hasReachedEnd(enemy: Enemy): boolean {
    return enemy.currentPathIndex >= PATH_POINTS.length - 1
}

/**
 * 발사체의 다음 위치 계산
 */
export function moveProjectile(
    projectile: Projectile,
    deltaTime: number
): { x: number; y: number; reached: boolean } {
    const dx = projectile.targetX - projectile.x
    const dy = projectile.targetY - projectile.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    const moveDistance = projectile.speed * deltaTime

    if (moveDistance >= distance) {
        return {
            x: projectile.targetX,
            y: projectile.targetY,
            reached: true,
        }
    }

    const ratio = moveDistance / distance
    return {
        x: projectile.x + dx * ratio,
        y: projectile.y + dy * ratio,
        reached: false,
    }
}
