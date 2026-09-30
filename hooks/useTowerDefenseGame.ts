'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    TOWER_TYPES,
    ENEMY_TYPES,
    WAVES,
    MAX_TOWER_LEVEL,
    PLAYER_START_HP,
    PLAYER_START_GOLD,
    QUIZ_HP_PENALTY,
    TOWER_QUIZZES_PER_WAVE,
    TOWER_QUIZ_TIME_LIMIT,
    LASER_BEAM_DURATION_MS,
    AIRSTRIKE_DAMAGE,
    AIRSTRIKE_RADIUS,
    PATH_POINTS,
    PROJECTILE_HIT_RADIUS,
    PROJECTILE_SPEED,
    applyProjectileHit,
    calculateQuizGoldReward,
    canPlaceTowerAtPoint,
    getAirstrikePoint,
    getEnemyLeakDamage,
    getLaserPierceCount,
    getTowerDamage,
    getTowerHitDamage,
    getTowerQuizStatus,
    getTowerSellValue,
    getTowerRange,
    getTowerUpgradeCost,
    getTowerWaveOutlook,
    getDistance,
    getNextPosition,
    hasReachedEnd,
    moveProjectile,
    type Tower,
    type Enemy,
    type Projectile,
    type LaserBeam,
    type BuildSlot,
    type TowerTypeId,
    type EnemyTypeId,
} from '@/lib/game/tower'
import {
    createHitParticles,
    updateParticles,
    type Particle,
} from '@/lib/game/particles'
import { SKILLS, getItemBlockReason as getSkillBlockReason, type SkillId } from '@/lib/game/skills'
import type { SFXType } from '@/hooks/useAudio'

// 상수 정의는 lib/game/tower.ts 로 이동. 기존 import 경로 호환을 위해 재수출합니다.
export { TOWER_QUIZZES_PER_WAVE }

type WaveQuizProgress = {
    answered: number
    correct: number
}

// 화면에 남는 파티클 상한 (오래된 것부터 버린다)
const MAX_PARTICLES = 240
// 탭이 백그라운드에 있다 돌아왔을 때 한 틱에 너무 큰 시간이 흐른 것으로 계산되지 않게 막는다 (초)
const MAX_TICK_DELTA = 0.25

interface UseTowerDefenseGameOptions {
    roomCode: string
    roomStatus?: string | null
    currentView: string
    currentQuestionAvailable: boolean
    setCurrentView: (view: string) => void
    setCurrentQuestionIndex: (index: number) => void
    setShowCountdown: (show: boolean) => void
    playSFX: (sound: SFXType) => void
}

export function useTowerDefenseGame({
    roomCode,
    roomStatus,
    currentView,
    currentQuestionAvailable,
    setCurrentView,
    setCurrentQuestionIndex,
    setShowCountdown,
    playSFX,
}: UseTowerDefenseGameOptions) {
    const [hp, setHp] = useState(PLAYER_START_HP)
    const [gold, setGold] = useState(PLAYER_START_GOLD)
    const [currentWave, setCurrentWave] = useState(0)
    const [towers, setTowers] = useState<Tower[]>([])
    const [enemies, setEnemies] = useState<Enemy[]>([])
    const [projectiles, setProjectiles] = useState<Projectile[]>([])
    const [laserBeams, setLaserBeams] = useState<LaserBeam[]>([])
    const [particles, setParticles] = useState<Particle[]>([])
    const [shakeIntensity, setShakeIntensity] = useState(0)
    const [waveClearToast, setWaveClearToast] = useState<number | null>(null)
    const [bossKillToast, setBossKillToast] = useState(false)
    const [overclockUntil, setOverclockUntil] = useState(0)
    const [selectedTowerType, setSelectedTowerType] = useState<TowerTypeId | null>(null)
    const [selectedTower, setSelectedTower] = useState<Tower | null>(null)
    const [isWaveActive, setIsWaveActive] = useState(false)
    const [waveEnemiesRemaining, setWaveEnemiesRemaining] = useState(0)
    const [quizProgressByWave, setQuizProgressByWave] = useState<Record<number, WaveQuizProgress>>({})
    const [totalEnemiesKilled, setTotalEnemiesKilled] = useState(0)
    const [totalGoldEarned, setTotalGoldEarned] = useState(0)
    const [totalTowersPlaced, setTotalTowersPlaced] = useState(0)
    // 퀴즈 3문제를 다 맞혀 받은 아이템. 뽑는 순간 쓰이지 않고 여기 보관됐다가 consumeItem 으로 쓴다.
    const [items, setItems] = useState<SkillId[]>([])

    const gameLoopRef = useRef<NodeJS.Timeout>()
    // 적·타워·발사체·빔은 ref 가 진실이다. 게임 루프와 아이템/판매/업그레이드가 전부 ref 를 고치고
    // 그 값을 state 로 내보내므로, 예전처럼 setState 안에서 또 setState 를 부르다 StrictMode 에서
    // 피해·보상이 두 번 들어가던 문제가 없다. (mutateEnemies / mutateTowers 로만 고칠 것)
    const enemiesRef = useRef<Enemy[]>([])
    const towersRef = useRef<Tower[]>([])
    const projectilesRef = useRef<Projectile[]>([])
    const laserBeamsRef = useRef<LaserBeam[]>([])
    const isWaveActiveRef = useRef(false)
    const currentWaveRef = useRef(0)
    const enemySpawnQueueRef = useRef<{ type: EnemyTypeId; spawnTime: number }[]>([])
    const lastUpdateRef = useRef<number>(Date.now())
    const nextEnemyIdRef = useRef(0)
    const nextTowerIdRef = useRef(0)
    const nextProjectileIdRef = useRef(0)
    const nextBeamIdRef = useRef(0)
    const overclockUntilRef = useRef(0)
    const quizProgressByWaveRef = useRef<Record<number, WaveQuizProgress>>({})
    const quizStorageKey = roomCode ? `tower_quiz_progress_${roomCode}` : null
    const currentWaveQuizProgress = quizProgressByWave[currentWave] ?? { answered: 0, correct: 0 }
    // 헤더 퀴즈 칸·버튼 문구까지 한 곳(lib/game/tower)에서 정한다. 튜토리얼 데모도 같은 함수를 쓴다.
    const {
        isComplete: isCurrentWaveQuizComplete,
        isPerfect: isCurrentWaveQuizPerfect,
        isQuizAvailable,
        canStartWave,
        quizHudValue,
        quizHudDetail,
        quizButtonLabel,
        startWaveButtonLabel,
    } = getTowerQuizStatus({
        progress: currentWaveQuizProgress,
        currentWave,
        isWaveActive,
        waveEnemiesRemaining,
        currentQuestionAvailable,
    })

    const mutateEnemies = useCallback((update: (current: Enemy[]) => Enemy[]) => {
        const next = update(enemiesRef.current)
        enemiesRef.current = next
        setEnemies(next)
        return next
    }, [])

    const mutateTowers = useCallback((update: (current: Tower[]) => Tower[]) => {
        const next = update(towersRef.current)
        towersRef.current = next
        setTowers(next)
        return next
    }, [])

    const pushParticles = useCallback((created: Particle[]) => {
        if (created.length === 0) return
        setParticles(prev => [...prev, ...created].slice(-MAX_PARTICLES))
    }, [])

    const applyEnemyRewards = useCallback((deadEnemies: Enemy[]) => {
        if (deadEnemies.length === 0) return

        const goldGain = deadEnemies.reduce((sum, enemy) => sum + ENEMY_TYPES[enemy.type].goldReward, 0)
        setGold(current => current + goldGain)
        setTotalGoldEarned(current => current + goldGain)
        setTotalEnemiesKilled(current => current + deadEnemies.length)
    }, [])

    const triggerShake = useCallback((intensity: number, durationMs: number) => {
        setShakeIntensity(intensity)
        window.setTimeout(() => setShakeIntensity(0), durationMs)
    }, [])

    const applyDeadEnemyEffects = useCallback((deadEnemies: Enemy[]) => {
        if (deadEnemies.length === 0) return

        pushParticles(deadEnemies.flatMap(enemy => (
            createHitParticles(enemy.x, enemy.y, enemy.type === 'BOSS' ? 'BOSS_DIE' : 'ENEMY_DIE')
        )))

        if (deadEnemies.some(enemy => enemy.type === 'BOSS')) {
            setBossKillToast(true)
            triggerShake(12, 600)
            window.setTimeout(() => setBossKillToast(false), 600)
        }
    }, [pushParticles, triggerShake])

    // 죽은 적을 목록에서 빼고 보상·연출까지 한 번에 처리한다.
    const removeDeadEnemies = useCallback((current: Enemy[]) => {
        const deadEnemies = current.filter(enemy => enemy.hp <= 0)
        if (deadEnemies.length === 0) return current
        applyEnemyRewards(deadEnemies)
        applyDeadEnemyEffects(deadEnemies)
        return current.filter(enemy => enemy.hp > 0)
    }, [applyDeadEnemyEffects, applyEnemyRewards])

    useEffect(() => {
        if (!quizStorageKey || typeof window === 'undefined') return

        try {
            const saved = window.sessionStorage.getItem(quizStorageKey)
            const parsed = saved ? JSON.parse(saved) : {}
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                setQuizProgressByWave({})
                quizProgressByWaveRef.current = {}
                return
            }

            const nextProgress = Object.entries(parsed).reduce<Record<number, WaveQuizProgress>>((acc, [wave, value]) => {
                if (!Number.isInteger(Number(wave)) || !value || typeof value !== 'object') return acc

                const progress = value as Partial<WaveQuizProgress>
                acc[Number(wave)] = {
                    answered: Math.min(
                        TOWER_QUIZZES_PER_WAVE,
                        Math.max(0, Number(progress.answered) || 0),
                    ),
                    correct: Math.min(
                        TOWER_QUIZZES_PER_WAVE,
                        Math.max(0, Number(progress.correct) || 0),
                    ),
                }
                return acc
            }, {})

            quizProgressByWaveRef.current = nextProgress
            setQuizProgressByWave(nextProgress)
        } catch {
            quizProgressByWaveRef.current = {}
            setQuizProgressByWave({})
        }
    }, [quizStorageKey])

    useEffect(() => {
        if (roomStatus !== 'waiting') return

        setQuizProgressByWave({})
        quizProgressByWaveRef.current = {}
        if (quizStorageKey && typeof window !== 'undefined') {
            window.sessionStorage.removeItem(quizStorageKey)
        }
    }, [quizStorageKey, roomStatus])

    useEffect(() => {
        overclockUntilRef.current = overclockUntil
    }, [overclockUntil])

    useEffect(() => {
        isWaveActiveRef.current = isWaveActive
    }, [isWaveActive])

    useEffect(() => {
        currentWaveRef.current = currentWave
    }, [currentWave])

    const recordQuizResult = useCallback((wave: number, correct: boolean) => {
        const current = quizProgressByWaveRef.current[wave] ?? { answered: 0, correct: 0 }
        const nextForWave = {
            answered: Math.min(TOWER_QUIZZES_PER_WAVE, current.answered + 1),
            correct: Math.min(TOWER_QUIZZES_PER_WAVE, current.correct + (correct ? 1 : 0)),
        }
        const nextProgress = {
            ...quizProgressByWaveRef.current,
            [wave]: nextForWave,
        }

        quizProgressByWaveRef.current = nextProgress
        setQuizProgressByWave(nextProgress)

        if (quizStorageKey && typeof window !== 'undefined') {
            window.sessionStorage.setItem(quizStorageKey, JSON.stringify(nextProgress))
        }

        return {
            ...nextForWave,
            completed: nextForWave.answered >= TOWER_QUIZZES_PER_WAVE,
            allCorrect: nextForWave.correct >= TOWER_QUIZZES_PER_WAVE,
        }
    }, [quizStorageKey])

    const resetGame = useCallback(() => {
        setHp(PLAYER_START_HP)
        setGold(PLAYER_START_GOLD)
        setCurrentWave(0)
        setTowers([])
        setEnemies([])
        setProjectiles([])
        setLaserBeams([])
        setParticles([])
        setShakeIntensity(0)
        setWaveClearToast(null)
        setBossKillToast(false)
        setOverclockUntil(0)
        setSelectedTowerType(null)
        setSelectedTower(null)
        setIsWaveActive(false)
        setWaveEnemiesRemaining(0)
        setQuizProgressByWave({})
        setTotalEnemiesKilled(0)
        setTotalGoldEarned(0)
        setTotalTowersPlaced(0)
        setItems([])

        enemiesRef.current = []
        towersRef.current = []
        projectilesRef.current = []
        laserBeamsRef.current = []
        enemySpawnQueueRef.current = []
        isWaveActiveRef.current = false
        currentWaveRef.current = 0
        lastUpdateRef.current = Date.now()
        nextEnemyIdRef.current = 0
        nextTowerIdRef.current = 0
        nextProjectileIdRef.current = 0
        nextBeamIdRef.current = 0
        overclockUntilRef.current = 0
        quizProgressByWaveRef.current = {}

        if (roomCode && typeof window !== 'undefined') {
            window.sessionStorage.removeItem(`quiz_index_${roomCode}`)
            window.sessionStorage.removeItem(`tower_quiz_used_${roomCode}`)
            window.sessionStorage.removeItem(`tower_quiz_progress_${roomCode}`)
        }

        setCurrentQuestionIndex(0)
        setCurrentView('lobby')
        setShowCountdown(true)
    }, [roomCode, setCurrentQuestionIndex, setCurrentView, setShowCountdown])

    const handlePlaceTower = useCallback((slot: BuildSlot) => {
        if (!selectedTowerType) return

        const towerType = TOWER_TYPES[selectedTowerType]
        if (gold < towerType.cost) {
            playSFX('incorrect')
            return
        }

        if (!canPlaceTowerAtPoint(slot.x, slot.y, towersRef.current)) {
            playSFX('incorrect')
            return
        }

        const newTower: Tower = {
            id: `tower-${nextTowerIdRef.current++}`,
            type: selectedTowerType,
            slotId: slot.id,
            x: slot.x,
            y: slot.y,
            level: 1,
            lastAttackTime: 0,
        }

        mutateTowers(current => [...current, newTower])
        setGold(prev => prev - towerType.cost)
        setTotalTowersPlaced(prev => prev + 1)
        setSelectedTowerType(null)
        playSFX('click')
    }, [gold, mutateTowers, playSFX, selectedTowerType])

    const handleUpgradeTower = useCallback(() => {
        if (!selectedTower) return

        if (selectedTower.level >= MAX_TOWER_LEVEL) {
            playSFX('incorrect')
            return
        }

        const upgradeCost = getTowerUpgradeCost(selectedTower.type, selectedTower.level)
        if (gold < upgradeCost) {
            playSFX('incorrect')
            return
        }

        setGold(prev => prev - upgradeCost)
        mutateTowers(current => current.map(tower => (
            tower.id === selectedTower.id
                ? { ...tower, level: tower.level + 1 }
                : tower
        )))
        playSFX('click')
    }, [gold, mutateTowers, playSFX, selectedTower])

    const handleSellTower = useCallback(() => {
        if (!selectedTower) return

        const refund = getTowerSellValue(selectedTower)
        mutateTowers(current => current.filter(tower => tower.id !== selectedTower.id))
        setGold(prev => prev + refund)
        setSelectedTower(null)
        playSFX('click')
    }, [mutateTowers, playSFX, selectedTower])

    const startWave = useCallback(() => {
        if (currentWave >= WAVES.length) return
        const progress = quizProgressByWaveRef.current[currentWave] ?? { answered: 0, correct: 0 }
        if (progress.answered < TOWER_QUIZZES_PER_WAVE) {
            playSFX('incorrect')
            return
        }

        const wave = WAVES[currentWave]
        setIsWaveActive(true)
        isWaveActiveRef.current = true
        playSFX('click')

        const spawnQueue: { type: EnemyTypeId; spawnTime: number }[] = []
        let currentTime = Date.now() + 1000

        wave.enemies.forEach(enemyGroup => {
            for (let i = 0; i < enemyGroup.count; i += 1) {
                spawnQueue.push({
                    type: enemyGroup.type,
                    spawnTime: currentTime,
                })
                currentTime += enemyGroup.spawnDelay
            }
        })

        enemySpawnQueueRef.current = spawnQueue
        setWaveEnemiesRemaining(spawnQueue.length)
    }, [currentWave, playSFX])

    const grantQuizGold = useCallback((timeElapsed: number, timeLimit = TOWER_QUIZ_TIME_LIMIT) => {
        const goldReward = calculateQuizGoldReward(timeElapsed, timeLimit)
        setGold(prev => prev + goldReward)
        setTotalGoldEarned(prev => prev + goldReward)
        return goldReward
    }, [])

    const applyQuizPenalty = useCallback(() => {
        setHp(prev => Math.max(0, prev - QUIZ_HP_PENALTY))
    }, [])

    // 오답 페널티: 출구에 가장 가까운 적 하나가 5초 동안 격노(빠르고 체력 회복)한다.
    const enrageLeadingEnemy = useCallback(() => {
        mutateEnemies(current => {
            const leading = [...current].sort((a, b) => b.currentPathIndex - a.currentPathIndex)[0]
            if (!leading) return current

            return current.map(enemy => (
                enemy.id === leading.id
                    ? {
                        ...enemy,
                        buffedUntil: Date.now() + 5000,
                        buffType: 'ENRAGE' as const,
                        hp: Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.3),
                    }
                    : enemy
            ))
        })
    }, [mutateEnemies])

    // ==================== 아이템 ====================

    const addItem = useCallback((skillId: SkillId) => {
        setItems(prev => [...prev, skillId])
    }, [])

    /** 지금 이 아이템을 쓸 수 없는 이유. 쓸 수 있으면 null. */
    const getItemBlockReason = useCallback((skillId: SkillId): string | null => (
        getSkillBlockReason(skillId, { enemyCount: enemies.length, isWaveActive, hp })
    ), [enemies.length, hp, isWaveActive])

    const activateSkill = useCallback((skillId: SkillId) => {
        switch (skillId) {
            case 'THUNDER': {
                const target = [...enemiesRef.current].sort((a, b) => b.hp - a.hp)[0]
                if (!target) return
                pushParticles(createHitParticles(target.x, target.y, 'BOSS_DIE'))
                triggerShake(8, 400)
                mutateEnemies(current => removeDeadEnemies(current.map(enemy => (
                    enemy.id === target.id ? { ...enemy, hp: 0 } : enemy
                ))))
                break
            }
            case 'BLIZZARD': {
                const until = Date.now() + 4000
                mutateEnemies(current => current.map(enemy => ({
                    ...enemy,
                    frozenUntil: until,
                    slowedUntil: until,
                })))
                pushParticles(Array.from({ length: 5 }, (_, index) => (
                    createHitParticles(100 + index * 150, 150 + Math.random() * 300, 'SLOW')
                )).flat())
                break
            }
            case 'OVERCLOCK': {
                const until = Date.now() + 8000
                overclockUntilRef.current = until
                setOverclockUntil(until)
                pushParticles(createHitParticles(400, 300, 'MAGIC'))
                break
            }
            case 'AIRSTRIKE': {
                const point = getAirstrikePoint(enemiesRef.current) ?? PATH_POINTS[Math.floor(PATH_POINTS.length / 2)]
                mutateEnemies(current => removeDeadEnemies(current.map(enemy => (
                    getDistance(enemy.x, enemy.y, point.x, point.y) <= AIRSTRIKE_RADIUS
                        ? { ...enemy, hp: enemy.hp - AIRSTRIKE_DAMAGE }
                        : enemy
                ))))
                pushParticles([
                    ...createHitParticles(point.x, point.y, 'BOMB'),
                    ...createHitParticles(point.x, point.y, 'BOSS_DIE'),
                ])
                triggerShake(10, 500)
                break
            }
            case 'HEAL': {
                setHp(prev => Math.min(PLAYER_START_HP, prev + 20))
                pushParticles(createHitParticles(400, 300, 'HEAL'))
                break
            }
            case 'GOLD_RUSH': {
                setGold(prev => prev + 200)
                setTotalGoldEarned(prev => prev + 200)
                pushParticles(createHitParticles(400, 300, 'GOLD'))
                break
            }
        }
    }, [mutateEnemies, pushParticles, removeDeadEnemies, triggerShake])

    /** 보관 중인 아이템을 쓴다. 지금 쓸 수 없으면 false. */
    const consumeItem = useCallback((index: number): boolean => {
        const skillId = items[index]
        if (!skillId || getItemBlockReason(skillId)) {
            playSFX('incorrect')
            return false
        }

        setItems(prev => prev.filter((_, itemIndex) => itemIndex !== index))
        activateSkill(skillId)
        playSFX('item')
        return true
    }, [activateSkill, getItemBlockReason, items, playSFX])

    // ==================== 게임 루프 ====================
    // 한 틱을 ref 위에서 동기적으로 전부 계산한 뒤 state 로 한 번에 내보낸다.
    useEffect(() => {
        if (currentView !== 'playing') return

        lastUpdateRef.current = Date.now()

        const tick = () => {
            const now = Date.now()
            const deltaTime = Math.min(MAX_TICK_DELTA, Math.max(0, (now - lastUpdateRef.current) / 1000))
            lastUpdateRef.current = now

            let enemies = enemiesRef.current
            let towers = towersRef.current
            let projectiles = projectilesRef.current
            const newParticles: Particle[] = []
            const newBeams: LaserBeam[] = []
            const shake = { intensity: 0, durationMs: 0 }
            const requestShake = (intensity: number, durationMs: number) => {
                if (intensity > shake.intensity) {
                    shake.intensity = intensity
                    shake.durationMs = durationMs
                }
            }

            // 1. 스폰
            if (isWaveActiveRef.current && enemySpawnQueueRef.current.length > 0) {
                const toSpawn = enemySpawnQueueRef.current.filter(enemy => enemy.spawnTime <= now)
                if (toSpawn.length > 0) {
                    enemies = [
                        ...enemies,
                        ...toSpawn.map(enemy => {
                            const enemyType = ENEMY_TYPES[enemy.type]
                            return {
                                id: `enemy-${nextEnemyIdRef.current++}`,
                                type: enemy.type,
                                hp: enemyType.hp,
                                maxHp: enemyType.hp,
                                speed: enemyType.speed,
                                currentPathIndex: 0,
                                x: PATH_POINTS[0].x,
                                y: PATH_POINTS[0].y,
                            }
                        }),
                    ]
                    enemySpawnQueueRef.current = enemySpawnQueueRef.current.filter(enemy => enemy.spawnTime > now)
                    setWaveEnemiesRemaining(enemySpawnQueueRef.current.length)
                }
            }

            // 2. 이동 + 출구 도달
            if (enemies.length > 0) {
                const moved = enemies.map(enemy => {
                    const isEnraged = enemy.buffType === 'ENRAGE' && (enemy.buffedUntil ?? 0) > now
                    const effectiveEnemy = isEnraged
                        ? { ...enemy, speed: enemy.speed * 1.5 }
                        : enemy
                    const newPos = getNextPosition(effectiveEnemy, deltaTime)
                    return {
                        ...enemy,
                        x: newPos.x,
                        y: newPos.y,
                        currentPathIndex: newPos.pathIndex,
                        buffType: isEnraged ? enemy.buffType : undefined,
                        buffedUntil: isEnraged ? enemy.buffedUntil : undefined,
                    }
                })

                const arrived = moved.filter(enemy => hasReachedEnd(enemy))
                if (arrived.length > 0) {
                    const leakDamage = arrived.reduce((sum, enemy) => sum + getEnemyLeakDamage(enemy.type), 0)
                    setHp(current => Math.max(0, current - leakDamage))
                    requestShake(6, 300)
                }

                enemies = moved.filter(enemy => !hasReachedEnd(enemy))
            }

            // 3. 타워 공격 (레이저는 즉시 피해 + 빔, 나머지는 발사체)
            if (towers.length > 0 && enemies.length > 0) {
                const isOverclocked = overclockUntilRef.current > now
                const pendingDamage = new Map<string, number>()
                let towersChanged = false

                towers = towers.map(tower => {
                    const towerType = TOWER_TYPES[tower.type]
                    const attackInterval = (1000 / towerType.attackSpeed) / (isOverclocked ? 2 : 1)
                    if (now - tower.lastAttackTime < attackInterval) return tower

                    const range = getTowerRange(tower.type, tower.level)
                    const damage = getTowerDamage(tower.type, tower.level)
                    const enemiesInRange = enemies
                        .filter(enemy => (
                            enemy.hp - (pendingDamage.get(enemy.id) ?? 0) > 0
                            && getDistance(tower.x, tower.y, enemy.x, enemy.y) <= range
                        ))
                        .sort((a, b) => b.currentPathIndex - a.currentPathIndex)
                    if (enemiesInRange.length === 0) return tower

                    towersChanged = true

                    if (tower.type === 'LASER') {
                        const targets = enemiesInRange.slice(0, getLaserPierceCount(tower.level))
                        targets.forEach(target => {
                            pendingDamage.set(
                                target.id,
                                (pendingDamage.get(target.id) ?? 0) + getTowerHitDamage('LASER', target.type, damage),
                            )
                            newParticles.push(...createHitParticles(target.x, target.y, 'LASER'))
                        })
                        newBeams.push({
                            id: `beam-${nextBeamIdRef.current++}`,
                            towerId: tower.id,
                            fromX: tower.x,
                            fromY: tower.y,
                            targets: targets.map(target => ({ x: target.x, y: target.y })),
                            createdAt: now,
                            expiresAt: now + LASER_BEAM_DURATION_MS,
                        })
                    } else {
                        const target = enemiesInRange[0]
                        projectiles = [
                            ...projectiles,
                            {
                                id: `projectile-${nextProjectileIdRef.current++}`,
                                towerId: tower.id,
                                towerType: tower.type,
                                x: tower.x,
                                y: tower.y,
                                targetX: target.x,
                                targetY: target.y,
                                targetEnemyId: target.id,
                                speed: PROJECTILE_SPEED,
                                damage,
                            },
                        ]
                    }

                    return { ...tower, lastAttackTime: now }
                })

                if (!towersChanged) towers = towersRef.current
                if (pendingDamage.size > 0) {
                    enemies = enemies.map(enemy => {
                        const taken = pendingDamage.get(enemy.id)
                        return taken ? { ...enemy, hp: enemy.hp - taken } : enemy
                    })
                }
            }

            // 4. 발사체 이동 + 명중
            if (projectiles.length > 0) {
                const survivors: Projectile[] = []

                projectiles.forEach(projectile => {
                    const target = enemies.find(enemy => enemy.id === projectile.targetEnemyId)
                    if (!target || target.hp <= 0) return

                    const tracking = { ...projectile, targetX: target.x, targetY: target.y }
                    const newPos = moveProjectile(tracking, deltaTime)

                    if (getDistance(newPos.x, newPos.y, target.x, target.y) < PROJECTILE_HIT_RADIUS) {
                        newParticles.push(...createHitParticles(target.x, target.y, projectile.towerType))
                        if (projectile.towerType === 'BOMB') requestShake(4, 200)
                        enemies = applyProjectileHit(enemies, target, projectile, now)
                        return
                    }

                    survivors.push({ ...tracking, x: newPos.x, y: newPos.y })
                })

                projectiles = survivors
            }

            // 5. 죽은 적 정리 (보상·연출은 여기서만 한 번)
            enemies = removeDeadEnemies(enemies)

            // 6. 커밋
            enemiesRef.current = enemies
            setEnemies(enemies)
            if (towers !== towersRef.current) {
                towersRef.current = towers
                setTowers(towers)
            }
            if (projectiles !== projectilesRef.current) {
                projectilesRef.current = projectiles
                setProjectiles(projectiles)
            }
            if (newBeams.length > 0 || laserBeamsRef.current.length > 0) {
                const beams = [...laserBeamsRef.current.filter(beam => beam.expiresAt > now), ...newBeams]
                laserBeamsRef.current = beams
                setLaserBeams(beams)
            }
            setParticles(prev => [...updateParticles(prev, deltaTime), ...newParticles].slice(-MAX_PARTICLES))
            if (shake.intensity > 0) {
                triggerShake(shake.intensity, shake.durationMs)
            }

            // 7. 웨이브 종료
            if (isWaveActiveRef.current && enemySpawnQueueRef.current.length === 0 && enemies.length === 0) {
                const clearedWaveNumber = currentWaveRef.current + 1
                setIsWaveActive(false)
                isWaveActiveRef.current = false
                setWaveEnemiesRemaining(0)
                currentWaveRef.current = clearedWaveNumber
                setCurrentWave(clearedWaveNumber)
                setWaveClearToast(clearedWaveNumber)
                playSFX('correct')
                window.setTimeout(() => setWaveClearToast(null), 2500)

                if (clearedWaveNumber >= WAVES.length) {
                    setCurrentView('result')
                }
            }
        }

        const gameLoop = setInterval(tick, 50)
        gameLoopRef.current = gameLoop

        return () => {
            if (gameLoopRef.current) {
                clearInterval(gameLoopRef.current)
            }
        }
    }, [currentView, playSFX, removeDeadEnemies, setCurrentView, triggerShake])

    useEffect(() => {
        if (hp <= 0 && currentView === 'playing') {
            setCurrentView('result')
        }
    }, [currentView, hp, setCurrentView])

    useEffect(() => {
        setSelectedTower(current => {
            if (!current) return current
            return towers.find(tower => tower.id === current.id) || null
        })
    }, [towers])

    const selectedUpgradeCost = selectedTower && selectedTower.level < MAX_TOWER_LEVEL
        ? getTowerUpgradeCost(selectedTower.type, selectedTower.level)
        : null
    const selectedSellValue = selectedTower ? getTowerSellValue(selectedTower) : 0
    const { nextWaveRoster, waveProgress } = getTowerWaveOutlook(currentWave)
    const occupiedSlotCount = towers.length
    const remainingSlots = 999
    // 선생님 화면과 결과 순위에 올라가는 점수. 누적 획득 골드와 같다 (app/tower/page.tsx 의 동기화 효과 참고).
    const score = Math.max(0, Math.floor(totalGoldEarned))
    const itemEntries = items.map((skillId, index) => ({
        index,
        skill: SKILLS[skillId],
        blockReason: getItemBlockReason(skillId),
    }))

    return {
        hp,
        setHp,
        gold,
        setGold,
        score,
        currentWave,
        towers,
        enemies,
        mutateEnemies,
        projectiles,
        laserBeams,
        particles,
        setParticles,
        shakeIntensity,
        setShakeIntensity,
        waveClearToast,
        bossKillToast,
        overclockUntil,
        setOverclockUntil,
        setTotalGoldEarned,
        setTotalEnemiesKilled,
        selectedTowerType,
        setSelectedTowerType,
        selectedTower,
        setSelectedTower,
        isWaveActive,
        waveEnemiesRemaining,
        totalEnemiesKilled,
        totalGoldEarned,
        totalTowersPlaced,
        isQuizAvailable,
        canStartWave,
        recordQuizResult,
        resetGame,
        handlePlaceTower,
        handleUpgradeTower,
        handleSellTower,
        startWave,
        grantQuizGold,
        applyQuizPenalty,
        enrageLeadingEnemy,
        items,
        itemEntries,
        addItem,
        consumeItem,
        getItemBlockReason,
        selectedUpgradeCost,
        selectedSellValue,
        nextWaveRoster,
        waveProgress,
        occupiedSlotCount,
        remainingSlots,
        quizHudValue,
        quizHudDetail,
        quizButtonLabel,
        startWaveButtonLabel,
        currentWaveQuizAnswered: currentWaveQuizProgress.answered,
        currentWaveQuizCorrect: currentWaveQuizProgress.correct,
        isCurrentWaveQuizComplete,
        isCurrentWaveQuizPerfect,
    }
}
