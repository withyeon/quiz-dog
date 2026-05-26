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
    PATH_POINTS,
    calculateQuizGoldReward,
    canPlaceTowerAtPoint,
    getEffectiveDamage,
    getEnemyLeakDamage,
    getLaserPierceCount,
    getTowerDamage,
    getTowerSellValue,
    getTowerRange,
    getTowerUpgradeCost,
    getDistance,
    getNextPosition,
    hasReachedEnd,
    moveProjectile,
    type Tower,
    type Enemy,
    type Projectile,
    type BuildSlot,
    type TowerTypeId,
    type EnemyTypeId,
} from '@/lib/game/tower'
import {
    createHitParticles,
    updateParticles,
    type Particle,
} from '@/lib/game/particles'
import type { SFXType } from '@/hooks/useAudio'

export const TOWER_QUIZZES_PER_WAVE = 3

type WaveQuizProgress = {
    answered: number
    correct: number
}

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

    const gameLoopRef = useRef<NodeJS.Timeout>()
    const enemiesRef = useRef<Enemy[]>([])
    const towersRef = useRef<Tower[]>([])
    const projectilesRef = useRef<Projectile[]>([])
    const isWaveActiveRef = useRef(false)
    const currentWaveRef = useRef(0)
    const enemySpawnQueueRef = useRef<{ type: EnemyTypeId; spawnTime: number }[]>([])
    const lastUpdateRef = useRef<number>(Date.now())
    const nextEnemyIdRef = useRef(0)
    const nextTowerIdRef = useRef(0)
    const nextProjectileIdRef = useRef(0)
    const overclockUntilRef = useRef(0)
    const quizProgressByWaveRef = useRef<Record<number, WaveQuizProgress>>({})
    const quizStorageKey = roomCode ? `tower_quiz_progress_${roomCode}` : null
    const currentWaveQuizProgress = quizProgressByWave[currentWave] ?? { answered: 0, correct: 0 }
    const isCurrentWaveQuizComplete = currentWaveQuizProgress.answered >= TOWER_QUIZZES_PER_WAVE
    const isCurrentWaveQuizPerfect = (
        isCurrentWaveQuizComplete
        && currentWaveQuizProgress.correct >= TOWER_QUIZZES_PER_WAVE
    )
    const isQuizAvailable = Boolean(
        currentQuestionAvailable
        && !isWaveActive
        && currentWave < WAVES.length
        && !isCurrentWaveQuizComplete
    )
    const canStartWave = Boolean(
        !isWaveActive
        && currentWave < WAVES.length
        && isCurrentWaveQuizComplete
    )

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

        setParticles(prev => [
            ...prev,
            ...deadEnemies.flatMap(enemy => (
                createHitParticles(enemy.x, enemy.y, enemy.type === 'BOSS' ? 'BOSS_DIE' : 'ENEMY_DIE')
            )),
        ])

        if (deadEnemies.some(enemy => enemy.type === 'BOSS')) {
            setBossKillToast(true)
            triggerShake(12, 600)
            window.setTimeout(() => setBossKillToast(false), 600)
        }
    }, [triggerShake])

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
        enemiesRef.current = enemies
    }, [enemies])

    useEffect(() => {
        towersRef.current = towers
    }, [towers])

    useEffect(() => {
        projectilesRef.current = projectiles
    }, [projectiles])

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

        enemySpawnQueueRef.current = []
        lastUpdateRef.current = Date.now()
        nextEnemyIdRef.current = 0
        nextTowerIdRef.current = 0
        nextProjectileIdRef.current = 0
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

        const latestTowers = towersRef.current
        if (!canPlaceTowerAtPoint(slot.x, slot.y, latestTowers)) {
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

        towersRef.current = [...latestTowers, newTower]
        setTowers(towersRef.current)
        setGold(prev => prev - towerType.cost)
        setTotalTowersPlaced(prev => prev + 1)
        setSelectedTowerType(null)
        playSFX('click')
    }, [gold, playSFX, selectedTowerType, towers])

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
        setTowers(prev => prev.map(tower => (
            tower.id === selectedTower.id
                ? { ...tower, level: tower.level + 1 }
                : tower
        )))
        playSFX('click')
    }, [gold, playSFX, selectedTower])

    const handleSellTower = useCallback(() => {
        if (!selectedTower) return

        const refund = getTowerSellValue(selectedTower)
        setTowers(prev => prev.filter(tower => tower.id !== selectedTower.id))
        setGold(prev => prev + refund)
        setSelectedTower(null)
        playSFX('click')
    }, [playSFX, selectedTower])

    const startWave = useCallback(() => {
        if (currentWave >= WAVES.length) return
        const progress = quizProgressByWaveRef.current[currentWave] ?? { answered: 0, correct: 0 }
        if (progress.answered < TOWER_QUIZZES_PER_WAVE) {
            playSFX('incorrect')
            return
        }

        const wave = WAVES[currentWave]
        setIsWaveActive(true)
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

    const grantQuizGold = useCallback((timeElapsed: number, timeLimit = 30) => {
        const goldReward = calculateQuizGoldReward(timeElapsed, timeLimit)
        setGold(prev => prev + goldReward)
        setTotalGoldEarned(prev => prev + goldReward)
        return goldReward
    }, [])

    const applyQuizPenalty = useCallback(() => {
        setHp(prev => Math.max(0, prev - QUIZ_HP_PENALTY))
    }, [])

    useEffect(() => {
        if (currentView !== 'playing') return

        const gameLoop = setInterval(() => {
            const now = Date.now()
            const deltaTime = (now - lastUpdateRef.current) / 1000
            lastUpdateRef.current = now
            setParticles(prev => updateParticles(prev, deltaTime).slice(-240))

            if (isWaveActiveRef.current && enemySpawnQueueRef.current.length > 0) {
                const toSpawn = enemySpawnQueueRef.current.filter(enemy => enemy.spawnTime <= now)
                if (toSpawn.length > 0) {
                    setEnemies(prev => {
                        const next = [
                        ...prev,
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
                        })
                        ]
                        enemiesRef.current = next
                        return next
                    })
                    enemySpawnQueueRef.current = enemySpawnQueueRef.current.filter(enemy => enemy.spawnTime > now)
                    setWaveEnemiesRemaining(enemySpawnQueueRef.current.length)
                }
            }

            setEnemies(prev => {
                const updated = prev.map(enemy => {
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

                const arrived = updated.filter(enemy => hasReachedEnd(enemy))
                if (arrived.length > 0) {
                    const leakDamage = arrived.reduce((sum, enemy) => sum + getEnemyLeakDamage(enemy.type), 0)
                    setHp(current => Math.max(0, current - leakDamage))
                    triggerShake(6, 300)
                }

                const nextEnemies = updated.filter(enemy => !hasReachedEnd(enemy))
                enemiesRef.current = nextEnemies
                return nextEnemies
            })

            setTowers(prevTowers => {
                return prevTowers.map(tower => {
                    const towerType = TOWER_TYPES[tower.type]
                    const attackInterval = (1000 / towerType.attackSpeed) / (overclockUntilRef.current > now ? 2 : 1)

                    if (now - tower.lastAttackTime >= attackInterval) {
                        const range = getTowerRange(tower.type, tower.level)
                        const damage = getTowerDamage(tower.type, tower.level)

                        const enemiesInRange = enemiesRef.current
                            .filter(enemy => getDistance(tower.x, tower.y, enemy.x, enemy.y) <= range)
                            .sort((a, b) => b.currentPathIndex - a.currentPathIndex)

                        if (enemiesInRange.length > 0) {
                            const target = enemiesInRange[0]

                            if (tower.type === 'LASER') {
                                const laserTargetIds = new Set(
                                    enemiesInRange
                                        .slice(0, getLaserPierceCount(tower.level))
                                        .map(enemy => enemy.id)
                                )

                                setEnemies(prev => {
                                    const updated = prev.map(enemy => {
                                        if (laserTargetIds.has(enemy.id)) {
                                            return { ...enemy, hp: enemy.hp - getEffectiveDamage(enemy.type, damage) }
                                        }
                                        return enemy
                                    })

                                    const deadEnemies = updated.filter(enemy => enemy.hp <= 0)
                                    applyEnemyRewards(deadEnemies)
                                    applyDeadEnemyEffects(deadEnemies)

                                    const nextEnemies = updated.filter(enemy => enemy.hp > 0)
                                    enemiesRef.current = nextEnemies
                                    return nextEnemies
                                })
                            } else {
                                const projectile: Projectile = {
                                    id: `projectile-${nextProjectileIdRef.current++}`,
                                    towerId: tower.id,
                                    towerType: tower.type,
                                    x: tower.x,
                                    y: tower.y,
                                    targetX: target.x,
                                    targetY: target.y,
                                    targetEnemyId: target.id,
                                    speed: 400,
                                    damage,
                                }
                                setProjectiles(prev => {
                                    const nextProjectiles = [...prev, projectile]
                                    projectilesRef.current = nextProjectiles
                                    return nextProjectiles
                                })
                            }

                            return { ...tower, lastAttackTime: now }
                        }
                    }
                    return tower
                })
            })

            setProjectiles(prevProjectiles => {
                const currentEnemies = enemiesRef.current
                const updatedProjectiles: Projectile[] = []
                const projectilesToRemove: string[] = []

                prevProjectiles.forEach(projectile => {
                    const targetEnemy = currentEnemies.find(enemy => enemy.id === projectile.targetEnemyId)

                    if (!targetEnemy) {
                        projectilesToRemove.push(projectile.id)
                        return
                    }

                    const updatedProjectile = {
                        ...projectile,
                        targetX: targetEnemy.x,
                        targetY: targetEnemy.y,
                    }

                    const newPos = moveProjectile(updatedProjectile, deltaTime)
                    const distanceToTarget = getDistance(newPos.x, newPos.y, targetEnemy.x, targetEnemy.y)

                    if (distanceToTarget < 15) {
                        setParticles(prev => [
                            ...prev,
                            ...createHitParticles(targetEnemy.x, targetEnemy.y, projectile.towerType),
                        ].slice(-240))

                        if (projectile.towerType === 'BOMB') {
                            triggerShake(4, 200)
                        }

                        setEnemies(prev => {
                            let updated = [...prev]
                            const target = updated.find(enemy => enemy.id === projectile.targetEnemyId)

                            if (target) {
                                const towerType = TOWER_TYPES[projectile.towerType]

                                if (towerType.special === 'splash') {
                                    updated = updated.map(enemy => {
                                        if (getDistance(target.x, target.y, enemy.x, enemy.y) <= 50) {
                                            return { ...enemy, hp: enemy.hp - getEffectiveDamage(enemy.type, projectile.damage) }
                                        }
                                        return enemy
                                    })
                                } else if (towerType.special === 'explosion') {
                                    updated = updated.map(enemy => {
                                        if (getDistance(target.x, target.y, enemy.x, enemy.y) <= 70) {
                                            return { ...enemy, hp: enemy.hp - getEffectiveDamage(enemy.type, projectile.damage) }
                                        }
                                        return enemy
                                    })
                                } else if (towerType.special === 'slow') {
                                    updated = updated.map(enemy => {
                                        if (enemy.id === target.id) {
                                            return {
                                                ...enemy,
                                                hp: enemy.hp - getEffectiveDamage(enemy.type, projectile.damage),
                                                slowedUntil: now + 1600,
                                            }
                                        }
                                        return enemy
                                    })
                                } else {
                                    updated = updated.map(enemy => {
                                        if (enemy.id === target.id) {
                                            return { ...enemy, hp: enemy.hp - getEffectiveDamage(enemy.type, projectile.damage) }
                                        }
                                        return enemy
                                    })
                                }
                            }

                            const deadEnemies = updated.filter(enemy => enemy.hp <= 0)
                            applyEnemyRewards(deadEnemies)
                            applyDeadEnemyEffects(deadEnemies)

                            const nextEnemies = updated.filter(enemy => enemy.hp > 0)
                            enemiesRef.current = nextEnemies
                            return nextEnemies
                        })

                        projectilesToRemove.push(projectile.id)
                    } else {
                        updatedProjectiles.push({
                            ...updatedProjectile,
                            x: newPos.x,
                            y: newPos.y,
                        })
                    }
                })

                const nextProjectiles = updatedProjectiles.filter(projectile => !projectilesToRemove.includes(projectile.id))
                projectilesRef.current = nextProjectiles
                return nextProjectiles
            })

            if (isWaveActiveRef.current && enemySpawnQueueRef.current.length === 0 && enemiesRef.current.length === 0) {
                const clearedWaveNumber = currentWaveRef.current + 1
                setIsWaveActive(false)
                isWaveActiveRef.current = false
                setWaveEnemiesRemaining(0)
                setCurrentWave(prev => {
                    const nextWave = prev + 1
                    currentWaveRef.current = nextWave
                    return nextWave
                })
                setWaveClearToast(clearedWaveNumber)
                playSFX('correct')
                window.setTimeout(() => setWaveClearToast(null), 2500)

                if (clearedWaveNumber >= WAVES.length) {
                    setCurrentView('result')
                }
            }
        }, 50)

        gameLoopRef.current = gameLoop

        return () => {
            if (gameLoopRef.current) {
                clearInterval(gameLoopRef.current)
            }
        }
    }, [applyDeadEnemyEffects, applyEnemyRewards, currentView, playSFX, setCurrentView, triggerShake])

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
    const nextWave = currentWave < WAVES.length ? WAVES[currentWave] : null
    const nextWaveRoster = nextWave
        ? nextWave.enemies.map(enemy => `${ENEMY_TYPES[enemy.type].name} ${enemy.count}`).join(' · ')
        : '모든 웨이브 완료'
    const waveProgress = Math.min(100, Math.round((currentWave / WAVES.length) * 100))
    const occupiedSlotCount = towers.length
    const remainingSlots = 999
    const quizHudValue = isWaveActive
        ? '전투중'
        : currentWave >= WAVES.length
            ? '완료'
            : `${currentWaveQuizProgress.answered}/${TOWER_QUIZZES_PER_WAVE}`
    const quizHudDetail = isWaveActive
        ? `${waveEnemiesRemaining}마리 남음`
        : currentWave >= WAVES.length
            ? '모든 웨이브 완료'
            : `정답 ${currentWaveQuizProgress.correct}/${TOWER_QUIZZES_PER_WAVE}`
    const quizButtonLabel = !currentQuestionAvailable
        ? '문항 없음'
        : isWaveActive
            ? '전투 중'
            : isCurrentWaveQuizComplete
                ? isCurrentWaveQuizPerfect ? '아이템 획득 완료' : '퀴즈 완료'
                : `퀴즈 ${currentWaveQuizProgress.answered + 1}/${TOWER_QUIZZES_PER_WAVE}`
    const startWaveButtonLabel = !isCurrentWaveQuizComplete
        ? `퀴즈 ${TOWER_QUIZZES_PER_WAVE}문제 먼저`
        : `웨이브 ${currentWave + 1}`

    return {
        hp,
        setHp,
        gold,
        setGold,
        currentWave,
        towers,
        enemies,
        setEnemies,
        projectiles,
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
