'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    type LucideIcon,
    ArrowUpCircle,
    BrainCircuit,
    Coins,
    Crosshair,
    Gauge,
    HeartPulse,
    MousePointer2,
    Play,
    ShieldCheck,
    Swords,
    Target,
    Trash2,
    TrendingUp,
    Wrench,
} from 'lucide-react'
import QuizView from '@/components/QuizView'
import TowerDefenseMap from '@/components/TowerDefenseMap'
import TowerCard from '@/components/TowerCard'
import Countdown from '@/components/Countdown'
import GameResult from '@/components/GameResult'
import {
    Tower,
    Enemy,
    Projectile,
    BuildSlot,
    BUILD_SLOTS,
    TowerTypeId,
    EnemyTypeId,
    TOWER_TYPES,
    ENEMY_TYPES,
    WAVES,
    MAX_TOWER_LEVEL,
    PLAYER_START_HP,
    PLAYER_START_GOLD,
    QUIZ_HP_PENALTY,
    PATH_POINTS,
    calculateQuizGoldReward,
    canPlaceTowerOnSlot,
    getEffectiveDamage,
    getEnemyLeakDamage,
    getLaserPierceCount,
    getTowerDamage,
    getTowerRange,
    getTowerUpgradeCost,
    getDistance,
    getNextPosition,
    hasReachedEnd,
    moveProjectile,
} from '@/lib/game/tower'
import { useGameBase } from '@/hooks/useGameBase'

function HudMetric({
    icon: Icon,
    label,
    value,
    detail,
    tone,
}: {
    icon: LucideIcon
    label: string
    value: string | number
    detail?: string
    tone: string
}) {
    return (
        <div className="min-w-[108px] rounded-lg border border-white/70 bg-white/72 px-3 py-2 shadow-sm backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <Icon className={`h-3.5 w-3.5 ${tone}`} />
                {label}
            </div>
            <div className="text-xl font-black leading-none text-slate-950 tabular-nums">{value}</div>
            {detail && <div className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</div>}
        </div>
    )
}

function getTowerInvestment(tower: Tower) {
    let total = TOWER_TYPES[tower.type].cost

    for (let level = 1; level < tower.level; level += 1) {
        total += getTowerUpgradeCost(tower.type, level)
    }

    return total
}

function getTowerSellValue(tower: Tower) {
    return Math.floor(getTowerInvestment(tower) * 0.65)
}

export default function TowerPage() {
    const router = useRouter()
    const {
        roomCode,
        playerId,
        currentView,
        setCurrentView,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        players,
        roomLoading,
        playersLoading,
        room,
        currentQuestion,
        playBGM,
        playSFX,
        checkAnswer,
        goToNextQuestion,
        getElapsedSeconds,
        questionStartTime,
        showCountdown,
        setShowCountdown,
    } = useGameBase({ expectedGameMode: 'tower' })

    // 게임 상태
    const [hp, setHp] = useState(PLAYER_START_HP)
    const [gold, setGold] = useState(PLAYER_START_GOLD)
    const [currentWave, setCurrentWave] = useState(0)
    const [towers, setTowers] = useState<Tower[]>([])
    const [enemies, setEnemies] = useState<Enemy[]>([])
    const [projectiles, setProjectiles] = useState<Projectile[]>([])
    const [selectedTowerType, setSelectedTowerType] = useState<TowerTypeId | null>(null)
    const [selectedTower, setSelectedTower] = useState<Tower | null>(null)

    // 웨이브 관련
    const [isWaveActive, setIsWaveActive] = useState(false)
    const [waveEnemiesRemaining, setWaveEnemiesRemaining] = useState(0)
    const [quizUsedWaves, setQuizUsedWaves] = useState<number[]>([])
    const [totalEnemiesKilled, setTotalEnemiesKilled] = useState(0)
    const [totalGoldEarned, setTotalGoldEarned] = useState(0)
    const [totalTowersPlaced, setTotalTowersPlaced] = useState(0)

    // 게임 루프
    const gameLoopRef = useRef<NodeJS.Timeout>()
    const enemySpawnQueueRef = useRef<{ type: EnemyTypeId; spawnTime: number }[]>([])
    const lastUpdateRef = useRef<number>(Date.now())
    const nextEnemyIdRef = useRef(0)
    const nextTowerIdRef = useRef(0)
    const nextProjectileIdRef = useRef(0)
    const quizReturnTimerRef = useRef<NodeJS.Timeout | null>(null)
    const quizTransitionHandledRef = useRef(false)
    const quizStorageKey = roomCode ? `tower_quiz_used_${roomCode}` : null
    const isCurrentWaveQuizUsed = quizUsedWaves.includes(currentWave)
    const isQuizAvailable = Boolean(
        currentQuestion
        && !isWaveActive
        && currentWave < WAVES.length
        && !isCurrentWaveQuizUsed
    )

    useEffect(() => {
        if (!quizStorageKey || typeof window === 'undefined') return

        try {
            const saved = window.sessionStorage.getItem(quizStorageKey)
            const parsed = saved ? JSON.parse(saved) : []
            setQuizUsedWaves(Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value)) : [])
        } catch {
            setQuizUsedWaves([])
        }
    }, [quizStorageKey])

    useEffect(() => {
        if (room?.status !== 'waiting') return

        setQuizUsedWaves([])
        if (quizStorageKey && typeof window !== 'undefined') {
            window.sessionStorage.removeItem(quizStorageKey)
        }
    }, [quizStorageKey, room?.status])

    const clearQuizReturnTimer = useCallback(() => {
        if (quizReturnTimerRef.current) {
            clearTimeout(quizReturnTimerRef.current)
            quizReturnTimerRef.current = null
        }
    }, [])

    const markQuizUsed = useCallback((wave: number) => {
        setQuizUsedWaves(prev => {
            if (prev.includes(wave)) return prev

            const next = [...prev, wave]
            if (quizStorageKey && typeof window !== 'undefined') {
                window.sessionStorage.setItem(quizStorageKey, JSON.stringify(next))
            }
            return next
        })
    }, [quizStorageKey])

    const returnToPlaying = useCallback(() => {
        if (quizTransitionHandledRef.current) return

        quizTransitionHandledRef.current = true
        clearQuizReturnTimer()
        goToNextQuestion()
        setCurrentView('playing')
    }, [clearQuizReturnTimer, goToNextQuestion, setCurrentView])

    const scheduleReturnToPlaying = useCallback((delayMs: number) => {
        clearQuizReturnTimer()
        quizReturnTimerRef.current = setTimeout(() => {
            returnToPlaying()
        }, delayMs)
    }, [clearQuizReturnTimer, returnToPlaying])

    const handleRestart = useCallback(() => {
        clearQuizReturnTimer()
        quizTransitionHandledRef.current = false
        setHp(PLAYER_START_HP)
        setGold(PLAYER_START_GOLD)
        setCurrentWave(0)
        setTowers([])
        setEnemies([])
        setProjectiles([])
        setSelectedTowerType(null)
        setSelectedTower(null)
        setIsWaveActive(false)
        setWaveEnemiesRemaining(0)
        setQuizUsedWaves([])
        setTotalEnemiesKilled(0)
        setTotalGoldEarned(0)
        setTotalTowersPlaced(0)

        enemySpawnQueueRef.current = []
        lastUpdateRef.current = Date.now()
        nextEnemyIdRef.current = 0
        nextTowerIdRef.current = 0
        nextProjectileIdRef.current = 0

        if (roomCode) {
            sessionStorage.removeItem(`quiz_index_${roomCode}`)
            sessionStorage.removeItem(`tower_quiz_used_${roomCode}`)
        }

        setCurrentQuestionIndex(0)
        setCurrentView('lobby')
        setShowCountdown(true)
    }, [clearQuizReturnTimer, roomCode, setCurrentQuestionIndex, setCurrentView, setShowCountdown])

    // 타워 배치
    const handlePlaceTower = useCallback((slot: BuildSlot) => {
        if (!selectedTowerType) return

        const towerType = TOWER_TYPES[selectedTowerType]
        if (gold < towerType.cost) {
            playSFX('incorrect')
            return
        }

        if (!canPlaceTowerOnSlot(slot.id, towers)) {
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

        setTowers(prev => [...prev, newTower])
        setGold(prev => prev - towerType.cost)
        setTotalTowersPlaced(prev => prev + 1)
        setSelectedTowerType(null)
        playSFX('click')
    }, [selectedTowerType, gold, towers, playSFX])

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

    // 퀴즈 답변 제출
    const handleAnswer = async (answer: string) => {
        const timeElapsed = getElapsedSeconds()
        const correct = await checkAnswer(answer)

        if (correct) {
            playSFX('correct')
            const goldReward = calculateQuizGoldReward(timeElapsed, 30)
            setGold(prev => prev + goldReward)
            setTotalGoldEarned(prev => prev + goldReward)

            // 골드 획득 애니메이션 후 1.5초 자동 또는 정답 클릭 시 즉시 복귀
            scheduleReturnToPlaying(1500)
        } else {
            playSFX('incorrect')

            // 오답 패널티: HP 감소
            setHp(prev => Math.max(0, prev - QUIZ_HP_PENALTY))

            scheduleReturnToPlaying(2000)
        }
        return correct
    }

    // 퀴즈 버튼 클릭
    const handleQuizClick = () => {
        if (isQuizAvailable) {
            markQuizUsed(currentWave)
            quizTransitionHandledRef.current = false
            questionStartTime.current = Date.now()
            setCurrentView('quiz')
        } else {
            playSFX('incorrect')
        }
    }

    const handleTowerCountdownComplete = useCallback(() => {
        setShowCountdown(false)
        setCurrentView('playing')
        playBGM('game')
    }, [playBGM, setCurrentView, setShowCountdown])

    // 웨이브 시작
    const startWave = useCallback(() => {
        if (currentWave >= WAVES.length) return

        const wave = WAVES[currentWave]
        setIsWaveActive(true)
        playSFX('click')

        // 적 생성 큐 준비
        const spawnQueue: { type: EnemyTypeId; spawnTime: number }[] = []
        let currentTime = Date.now() + 1000 // 1초 후부터 시작

        wave.enemies.forEach(enemyGroup => {
            for (let i = 0; i < enemyGroup.count; i++) {
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

    // 게임 루프
    useEffect(() => {
        if (currentView !== 'playing') return

        const gameLoop = setInterval(() => {
            const now = Date.now()
            const deltaTime = (now - lastUpdateRef.current) / 1000
            lastUpdateRef.current = now

            // 적 생성
            if (isWaveActive && enemySpawnQueueRef.current.length > 0) {
                const toSpawn = enemySpawnQueueRef.current.filter(e => e.spawnTime <= now)
                if (toSpawn.length > 0) {
                    setEnemies(prev => [
                        ...prev,
                        ...toSpawn.map(e => {
                            const enemyType = ENEMY_TYPES[e.type]
                            return {
                                id: `enemy-${nextEnemyIdRef.current++}`,
                                type: e.type,
                                hp: enemyType.hp,
                                maxHp: enemyType.hp,
                                speed: enemyType.speed,
                                currentPathIndex: 0,
                                x: PATH_POINTS[0].x,
                                y: PATH_POINTS[0].y,
                            }
                        })
                    ])
                    enemySpawnQueueRef.current = enemySpawnQueueRef.current.filter(e => e.spawnTime > now)
                    setWaveEnemiesRemaining(enemySpawnQueueRef.current.length)
                }
            }

            // 적 이동
            setEnemies(prev => {
                const updated = prev.map(enemy => {
                    const newPos = getNextPosition(enemy, deltaTime)
                    return {
                        ...enemy,
                        x: newPos.x,
                        y: newPos.y,
                        currentPathIndex: newPos.pathIndex,
                    }
                })

                // 도착한 적 처리
                const arrived = updated.filter(e => hasReachedEnd(e))
                if (arrived.length > 0) {
                    const leakDamage = arrived.reduce((sum, enemy) => sum + getEnemyLeakDamage(enemy.type), 0)
                    setHp(h => Math.max(0, h - leakDamage))
                }

                return updated.filter(e => !hasReachedEnd(e))
            })

            // 타워 공격 - 발사체 생성
            setTowers(prevTowers => {
                return prevTowers.map(tower => {
                    const towerType = TOWER_TYPES[tower.type]
                    const attackInterval = 1000 / towerType.attackSpeed

                    if (now - tower.lastAttackTime >= attackInterval) {
                        const range = getTowerRange(tower.type, tower.level)
                        const damage = getTowerDamage(tower.type, tower.level)

                        // 범위 내 적 찾기
                        const enemiesInRange = enemies
                            .filter(e => getDistance(tower.x, tower.y, e.x, e.y) <= range)
                            .sort((a, b) => b.currentPathIndex - a.currentPathIndex)

                        if (enemiesInRange.length > 0) {
                            const target = enemiesInRange[0]

                            // 레이저 타워는 즉시 데미지 적용 (발사체 없음)
                            if (tower.type === 'LASER') {
                                const laserTargetIds = new Set(
                                    enemiesInRange
                                        .slice(0, getLaserPierceCount(tower.level))
                                        .map(enemy => enemy.id)
                                )

                                setEnemies(prev => {
                                    const updated = prev.map(e => {
                                        if (laserTargetIds.has(e.id)) {
                                            return { ...e, hp: e.hp - getEffectiveDamage(e.type, damage) }
                                        }
                                        return e
                                    })

                                    const deadEnemies = updated.filter(e => e.hp <= 0)
                                    if (deadEnemies.length > 0) {
                                        const goldGain = deadEnemies.reduce((sum, e) => sum + ENEMY_TYPES[e.type].goldReward, 0)
                                        setGold(g => g + goldGain)
                                        setTotalGoldEarned(prev => prev + goldGain)
                                        setTotalEnemiesKilled(prev => prev + deadEnemies.length)
                                    }

                                    return updated.filter(e => e.hp > 0)
                                })
                            } else {
                                // 발사체 생성
                                const projectile: Projectile = {
                                    id: `projectile-${nextProjectileIdRef.current++}`,
                                    towerId: tower.id,
                                    towerType: tower.type,
                                    x: tower.x,
                                    y: tower.y,
                                    targetX: target.x,
                                    targetY: target.y,
                                    targetEnemyId: target.id,
                                    speed: 400, // pixels per second
                                    damage: damage,
                                }
                                setProjectiles(prev => [...prev, projectile])
                            }

                            return { ...tower, lastAttackTime: now }
                        }
                    }
                    return tower
                })
            })

            // 발사체 이동 및 충돌 처리
            setProjectiles(prevProjectiles => {
                const updatedProjectiles: Projectile[] = []
                const projectilesToRemove: string[] = []

                prevProjectiles.forEach(projectile => {
                    // 적의 현재 위치 찾기
                    const targetEnemy = enemies.find(e => e.id === projectile.targetEnemyId)

                    // 적이 이미 죽었거나 사라진 경우 발사체 제거
                    if (!targetEnemy) {
                        projectilesToRemove.push(projectile.id)
                        return
                    }

                    // 적의 현재 위치로 타겟 업데이트
                    const updatedProjectile = {
                        ...projectile,
                        targetX: targetEnemy.x,
                        targetY: targetEnemy.y,
                    }

                    const newPos = moveProjectile(updatedProjectile, deltaTime)

                    // 발사체가 목표에 도달했는지 확인
                    const distanceToTarget = getDistance(newPos.x, newPos.y, targetEnemy.x, targetEnemy.y)

                    if (distanceToTarget < 15) {
                        // 발사체가 목표에 도달 - 데미지 적용
                        setEnemies(prev => {
                            let updated = [...prev]
                            const target = updated.find(e => e.id === projectile.targetEnemyId)

                            if (target) {
                                const towerType = TOWER_TYPES[projectile.towerType]

                                if (towerType.special === 'splash') {
                                    // 범위 공격
                                    updated = updated.map(e => {
                                        if (getDistance(target.x, target.y, e.x, e.y) <= 50) {
                                            return { ...e, hp: e.hp - getEffectiveDamage(e.type, projectile.damage) }
                                        }
                                        return e
                                    })
                                } else if (towerType.special === 'explosion') {
                                    // 폭발 공격
                                    updated = updated.map(e => {
                                        if (getDistance(target.x, target.y, e.x, e.y) <= 70) {
                                            return { ...e, hp: e.hp - getEffectiveDamage(e.type, projectile.damage) }
                                        }
                                        return e
                                    })
                                } else if (towerType.special === 'slow') {
                                    // 둔화 효과
                                    updated = updated.map(e => {
                                        if (e.id === target.id) {
                                            return {
                                                ...e,
                                                hp: e.hp - getEffectiveDamage(e.type, projectile.damage),
                                                slowedUntil: now + 1600
                                            }
                                        }
                                        return e
                                    })
                                } else {
                                    // 단일 대상 공격
                                    updated = updated.map(e => {
                                        if (e.id === target.id) {
                                            return { ...e, hp: e.hp - getEffectiveDamage(e.type, projectile.damage) }
                                        }
                                        return e
                                    })
                                }
                            }

                            // 죽은 적 처리
                            const deadEnemies = updated.filter(e => e.hp <= 0)
                            if (deadEnemies.length > 0) {
                                const goldGain = deadEnemies.reduce((sum, e) => sum + ENEMY_TYPES[e.type].goldReward, 0)
                                setGold(g => g + goldGain)
                                setTotalGoldEarned(prev => prev + goldGain)
                                setTotalEnemiesKilled(prev => prev + deadEnemies.length)
                            }

                            return updated.filter(e => e.hp > 0)
                        })

                        projectilesToRemove.push(projectile.id)
                    } else {
                        // 발사체 계속 이동
                        updatedProjectiles.push({
                            ...updatedProjectile,
                            x: newPos.x,
                            y: newPos.y,
                        })
                    }
                })

                return updatedProjectiles.filter(p => !projectilesToRemove.includes(p.id))
            })

            // 웨이브 완료 체크
            if (isWaveActive && enemySpawnQueueRef.current.length === 0 && enemies.length === 0) {
                setIsWaveActive(false)
                setWaveEnemiesRemaining(0)
                setCurrentWave(prev => prev + 1)

                if (currentWave + 1 >= WAVES.length) {
                    // 게임 승리!
                    setCurrentView('result')
                }
            }
        }, 50) // 20 FPS

        gameLoopRef.current = gameLoop

        return () => {
            if (gameLoopRef.current) {
                clearInterval(gameLoopRef.current)
            }
        }
    }, [currentView, isWaveActive, enemies, towers, currentWave, setCurrentView])

    // HP가 0이 되면 게임 오버
    useEffect(() => {
        if (hp <= 0 && currentView === 'playing') {
            setCurrentView('result')
        }
    }, [hp, currentView, setCurrentView])

    useEffect(() => {
        setSelectedTower(current => {
            if (!current) return current
            return towers.find(tower => tower.id === current.id) || null
        })
    }, [towers])

    useEffect(() => {
        return () => {
            clearQuizReturnTimer()
        }
    }, [clearQuizReturnTimer])

    const selectedTowerMeta = selectedTower ? TOWER_TYPES[selectedTower.type] : null
    const selectedUpgradeCost = selectedTower && selectedTower.level < MAX_TOWER_LEVEL
        ? getTowerUpgradeCost(selectedTower.type, selectedTower.level)
        : null
    const selectedSellValue = selectedTower ? getTowerSellValue(selectedTower) : 0
    const nextWave = currentWave < WAVES.length ? WAVES[currentWave] : null
    const nextWaveRoster = nextWave
        ? nextWave.enemies.map(enemy => `${ENEMY_TYPES[enemy.type].name} ${enemy.count}`).join(' · ')
        : '모든 웨이브 완료'
    const waveProgress = Math.min(100, Math.round((currentWave / WAVES.length) * 100))
    const occupiedSlotCount = towers.filter(tower => tower.slotId).length
    const remainingSlots = Math.max(0, BUILD_SLOTS.length - occupiedSlotCount)
    const quizHudValue = isWaveActive ? '전투중' : isQuizAvailable ? '가능' : isCurrentWaveQuizUsed ? '사용됨' : '대기'
    const quizButtonLabel = !currentQuestion
        ? '문항 없음'
        : isWaveActive
            ? '전투 중'
            : isCurrentWaveQuizUsed
                ? '퀴즈 사용됨'
                : '퀴즈 충전'

    if (!roomCode || !playerId) {
        return (
            <div className="tower-command-screen flex min-h-screen items-center justify-center p-6">
                <div className="relative z-10 rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-xl">
                    <p className="font-bold text-slate-800">방 코드와 플레이어 ID가 필요합니다.</p>
                </div>
            </div>
        )
    }

    if (roomLoading || playersLoading) {
        return (
            <div className="tower-command-screen flex min-h-screen items-center justify-center p-6">
                <div className="relative z-10 rounded-lg border border-slate-200 bg-white px-6 py-5 text-xl font-black text-slate-800 shadow-xl">
                    작전실 불러오는 중...
                </div>
            </div>
        )
    }

    return (
        <main className="tower-command-screen min-h-screen overflow-x-hidden text-slate-900">
            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-5 sm:px-6 lg:px-8">
                {currentView === 'lobby' && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex min-h-[calc(100vh-40px)] items-center justify-center"
                    >
                        <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
                            <div className="p-8 sm:p-10">
                                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                                    <ShieldCheck className="h-4 w-4" />
                                    전략 퀴즈 모드
                                </div>
                                <h1 className="text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl">
                                    타워 디펜스
                                </h1>
                                <p className="mt-4 max-w-xl text-base font-semibold leading-relaxed text-slate-600">
                                    정답으로 자원을 확보하고, 방어선을 설계해 마지막 웨이브까지 코어를 지키세요.
                                </p>

                                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <Target className="mb-3 h-5 w-5 text-rose-500" />
                                        <div className="text-2xl font-black text-slate-950">{WAVES.length}</div>
                                        <div className="mt-1 text-xs font-bold text-slate-500">웨이브</div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <Coins className="mb-3 h-5 w-5 text-amber-500" />
                                        <div className="text-2xl font-black text-slate-950">{PLAYER_START_GOLD}</div>
                                        <div className="mt-1 text-xs font-bold text-slate-500">시작 골드</div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <HeartPulse className="mb-3 h-5 w-5 text-red-500" />
                                        <div className="text-2xl font-black text-slate-950">{PLAYER_START_HP}</div>
                                        <div className="mt-1 text-xs font-bold text-slate-500">코어 HP</div>
                                    </div>
                                </div>

                                <p className="mt-8 text-sm font-bold text-slate-500">선생님이 게임을 시작하면 작전이 열립니다.</p>
                            </div>

                            <div className="relative min-h-[360px] overflow-hidden bg-[#172323]">
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
                                <div className="absolute left-8 top-10 h-16 w-16 rounded-lg border border-emerald-300/50 bg-emerald-300/20 shadow-[0_0_40px_rgba(52,211,153,0.18)]" />
                                <div className="absolute right-10 bottom-12 h-20 w-20 rounded-lg border border-rose-300/50 bg-rose-300/20 shadow-[0_0_40px_rgba(251,113,133,0.18)]" />
                                <div className="absolute left-[-30px] top-[128px] h-16 w-[76%] rotate-[18deg] rounded-full bg-[#c8b08b] shadow-2xl" />
                                <div className="absolute right-[-45px] top-[210px] h-16 w-[70%] -rotate-[13deg] rounded-full bg-[#c8b08b] shadow-2xl" />
                                <div className="absolute left-1/2 top-1/2 grid w-[74%] -translate-x-1/2 -translate-y-1/2 grid-cols-3 gap-4">
                                    {Object.values(TOWER_TYPES).slice(0, 3).map(tower => (
                                        <div key={tower.id} className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-2xl backdrop-blur">
                                            <div className="text-xs font-bold text-white/55">{tower.cost}G</div>
                                            <div className="mt-1 text-sm font-black text-white">{tower.name}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-lg border border-white/12 bg-black/24 px-4 py-3 text-xs font-bold text-white/70 backdrop-blur">
                                    <span>ROOM {roomCode}</span>
                                    <span>CORE ONLINE</span>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                )}

                {showCountdown && <Countdown onComplete={handleTowerCountdownComplete} />}

                {currentView === 'playing' && (
                    <div className="flex min-h-[calc(100vh-40px)] flex-col">
                        <header className="mb-4 rounded-lg border border-white/70 bg-white/78 p-3 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-lg">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">ROOM {roomCode}</span>
                                            {selectedTowerType && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                                                    <Crosshair className="h-3.5 w-3.5" />
                                                    {TOWER_TYPES[selectedTowerType].name} 배치 중
                                                </span>
                                            )}
                                        </div>
                                        <h1 className="mt-1 truncate text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                                            타워 디펜스
                                        </h1>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:flex">
                                    <HudMetric icon={HeartPulse} label="Core" value={hp} detail="HP" tone="text-red-500" />
                                    <HudMetric icon={Coins} label="Gold" value={gold.toLocaleString()} detail={`${totalGoldEarned.toLocaleString()} 획득`} tone="text-amber-500" />
                                    <HudMetric icon={Target} label="Wave" value={`${Math.min(currentWave + 1, WAVES.length)} / ${WAVES.length}`} detail={isWaveActive ? `${waveEnemiesRemaining} 대기` : `${waveProgress}% 클리어`} tone="text-indigo-500" />
                                    <HudMetric icon={Crosshair} label="Slot" value={`${remainingSlots} / ${BUILD_SLOTS.length}`} detail={`${occupiedSlotCount} 배치`} tone="text-emerald-500" />
                                    <HudMetric icon={BrainCircuit} label="Quiz" value={quizHudValue} detail="웨이브당 1회" tone="text-sky-500" />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <motion.button
                                        whileHover={isQuizAvailable ? { y: -1 } : {}}
                                        whileTap={isQuizAvailable ? { scale: 0.98 } : {}}
                                        onClick={handleQuizClick}
                                        disabled={!isQuizAvailable}
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                    >
                                        <BrainCircuit className="h-4 w-4" />
                                        {quizButtonLabel}
                                    </motion.button>

                                    {!isWaveActive && currentWave < WAVES.length && (
                                        <motion.button
                                            whileHover={{ y: -1 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={startWave}
                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-black text-white shadow-lg shadow-rose-200 transition-colors hover:bg-rose-600"
                                        >
                                            <Play className="h-4 w-4 fill-current" />
                                            웨이브 {currentWave + 1}
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        </header>

                        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                            <section className="min-w-0">
                                <div className="mb-3 flex flex-col gap-2 rounded-lg border border-white/70 bg-white/68 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                                            <Swords className="h-4 w-4 text-rose-500" />
                                            {isWaveActive ? `웨이브 ${currentWave + 1} 진행 중` : nextWave ? `다음 웨이브 ${currentWave + 1}` : '최종 결과'}
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">{nextWaveRoster}</p>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 lg:w-56">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 transition-all duration-500"
                                            style={{ width: `${waveProgress}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="tower-map-frame">
                                    <TowerDefenseMap
                                        towers={towers}
                                        enemies={enemies}
                                        projectiles={projectiles}
                                        selectedTowerType={selectedTowerType}
                                        onPlaceTower={handlePlaceTower}
                                        onSelectTower={setSelectedTower}
                                        selectedTower={selectedTower}
                                    />
                                </div>
                            </section>

                            <aside className="space-y-4">
                                <section className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-base font-black text-slate-950">
                                                <Wrench className="h-4 w-4 text-indigo-500" />
                                                타워 배치
                                            </div>
                                            <p className="mt-1 text-xs font-bold text-slate-500">남은 슬롯 {remainingSlots}개 · 설치 후 업그레이드가 핵심입니다.</p>
                                        </div>
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                                            <div className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">Gold</div>
                                            <div className="text-lg font-black text-amber-900">{gold.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {Object.values(TOWER_TYPES).map(tower => (
                                            <TowerCard
                                                key={tower.id}
                                                tower={tower}
                                                isSelected={selectedTowerType === tower.id}
                                                canAfford={gold >= tower.cost && remainingSlots > 0}
                                                disabledLabel={remainingSlots <= 0 ? '슬롯 없음' : '골드 부족'}
                                                onSelect={() => {
                                                    setSelectedTower(null)
                                                    setSelectedTowerType(tower.id)
                                                }}
                                            />
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
                                    {selectedTower && selectedTowerMeta ? (
                                        <>
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Selected</div>
                                                    <h2 className="mt-1 text-xl font-black text-slate-950">{selectedTowerMeta.name}</h2>
                                                </div>
                                                <div className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white">
                                                    Lv.{selectedTower.level}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <TrendingUp className="mb-2 h-4 w-4 text-rose-500" />
                                                    <div className="text-lg font-black text-slate-950">{getTowerDamage(selectedTower.type, selectedTower.level)}</div>
                                                    <div className="text-[11px] font-bold text-slate-500">피해</div>
                                                </div>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <Crosshair className="mb-2 h-4 w-4 text-indigo-500" />
                                                    <div className="text-lg font-black text-slate-950">{getTowerRange(selectedTower.type, selectedTower.level)}</div>
                                                    <div className="text-[11px] font-bold text-slate-500">범위</div>
                                                </div>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <Gauge className="mb-2 h-4 w-4 text-emerald-500" />
                                                    <div className="text-lg font-black text-slate-950">{TOWER_TYPES[selectedTower.type].attackSpeed}</div>
                                                    <div className="text-[11px] font-bold text-slate-500">속도</div>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={handleUpgradeTower}
                                                    disabled={!selectedUpgradeCost || gold < selectedUpgradeCost}
                                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-black text-white shadow-lg shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                                >
                                                    <ArrowUpCircle className="h-4 w-4" />
                                                    {selectedUpgradeCost ? `${selectedUpgradeCost}G` : 'MAX'}
                                                </button>
                                                <button
                                                    onClick={handleSellTower}
                                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    {selectedSellValue}G
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex min-h-[170px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                                            <MousePointer2 className="mb-3 h-7 w-7 text-slate-400" />
                                            <div className="text-base font-black text-slate-800">선택된 타워 없음</div>
                                            <div className="mt-1 text-xs font-bold text-slate-500">{totalTowersPlaced}개 배치 · {totalEnemiesKilled} 처치</div>
                                        </div>
                                    )}
                                </section>
                            </aside>
                        </div>
                    </div>
                )}

                {currentView === 'quiz' && currentQuestion && (
                    <div className="flex min-h-screen items-center justify-center py-8">
                        <QuizView
                            question={currentQuestion}
                            onAnswer={handleAnswer}
                            onCorrectClick={returnToPlaying}
                            timeLimit={30}
                        />
                    </div>
                )}

                {currentView === 'result' && (
                    <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/82 backdrop-blur-md">
                        <GameResult
                            players={players}
                            currentPlayerId={playerId}
                            gameMode="tower"
                            onRestart={handleRestart}
                            onExit={() => router.push('/')}
                        />
                    </div>
                )}
            </div>
        </main>
    )
}
