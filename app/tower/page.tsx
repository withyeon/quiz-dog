'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useAudioContext } from '@/components/AudioProvider'
import QuizView from '@/components/QuizView'
import TowerDefenseMap from '@/components/TowerDefenseMap'
import TowerCard from '@/components/TowerCard'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import GameResult from '@/components/GameResult'
import {
    Tower,
    Enemy,
    Projectile,
    TowerTypeId,
    EnemyTypeId,
    TOWER_TYPES,
    ENEMY_TYPES,
    WAVES,
    PLAYER_START_HP,
    PLAYER_START_GOLD,
    PATH_POINTS,
    calculateGoldReward,
    canPlaceTower,
    getTowerDamage,
    getTowerRange,
    getTowerUpgradeCost,
    getDistance,
    getNextPosition,
    hasReachedEnd,
    moveProjectile,
} from '@/lib/game/tower'
import { useGameBase, type Question, type AnswerRecord } from '@/hooks/useGameBase'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

type TowerView = 'lobby' | 'countdown' | 'playing' | 'quiz' | 'result'

export default function TowerPage() {
    const {
        roomCode,
        playerId,
        currentView,
        setCurrentView,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        questions,
        players,
        room,
        roomLoading,
        playersLoading,
        currentPlayer,
        currentQuestion,
        playBGM,
        playSFX,
        checkAnswer,
        handleWrongAnswer,
        goToNextQuestion,
        consecutiveCorrect,
        getElapsedSeconds,
        showCountdown,
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

    // 카운트다운 완료 후 게임 시작
    const handleCountdownComplete = () => {
        setCurrentView('quiz')
        playBGM('game')
    }

    // 타워 배치
    const handlePlaceTower = useCallback((x: number, y: number) => {
        if (!selectedTowerType) return

        const towerType = TOWER_TYPES[selectedTowerType]
        if (gold < towerType.cost) {
            playSFX('incorrect')
            return
        }

        if (!canPlaceTower(x, y, towers)) {
            playSFX('incorrect')
            return
        }

        const newTower: Tower = {
            id: `tower-${nextTowerIdRef.current++}`,
            type: selectedTowerType,
            x,
            y,
            level: 1,
            lastAttackTime: 0,
        }

        setTowers(prev => [...prev, newTower])
        setGold(prev => prev - towerType.cost)
        setTotalTowersPlaced(prev => prev + 1)
        setSelectedTowerType(null)
        playSFX('click')
    }, [selectedTowerType, gold, towers, playSFX])

    // 정답 후 플레이 화면으로 (클릭 시 즉시 이동)
    const goToPlaying = () => {
        setCurrentView('playing')
        goToNextQuestion()
    }

    // 퀴즈 답변 제출
    const handleAnswer = async (answer: string) => {
        const timeElapsed = getElapsedSeconds()
        const correct = await checkAnswer(answer)

        if (correct) {
            playSFX('correct')
            const goldReward = calculateGoldReward(timeElapsed, 30, consecutiveCorrect)
            setGold(prev => prev + goldReward)
            setTotalGoldEarned(prev => prev + goldReward)

            // 골드 획득 애니메이션 후 1.5초 자동 또는 정답 클릭 시 즉시
            setTimeout(goToPlaying, 1500)
        } else {
            playSFX('incorrect')
            handleWrongAnswer()

            // 오답 패널티: HP 감소
            setHp(prev => Math.max(0, prev - 5))

            setTimeout(goToPlaying, 2000)
        }
        return correct
    }

    // 퀴즈 버튼 클릭
    const handleQuizClick = () => {
        if (currentQuestion) {
            setCurrentView('quiz')
        }
    }

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
                    setHp(h => Math.max(0, h - arrived.length * 10))
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
                                setEnemies(prev => {
                                    let updated = [...prev]
                                    // 관통 공격 - 범위 내 모든 적에게 데미지
                                    updated = updated.map(e => {
                                        if (getDistance(tower.x, tower.y, e.x, e.y) <= range) {
                                            return { ...e, hp: e.hp - damage }
                                        }
                                        return e
                                    })
                                    return updated
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
                                            return { ...e, hp: e.hp - projectile.damage }
                                        }
                                        return e
                                    })
                                } else if (towerType.special === 'explosion') {
                                    // 폭발 공격
                                    updated = updated.map(e => {
                                        if (getDistance(target.x, target.y, e.x, e.y) <= 70) {
                                            return { ...e, hp: e.hp - projectile.damage }
                                        }
                                        return e
                                    })
                                } else if (towerType.special === 'slow') {
                                    // 둔화 효과
                                    updated = updated.map(e => {
                                        if (e.id === target.id) {
                                            return {
                                                ...e,
                                                hp: e.hp - projectile.damage,
                                                speed: e.speed * 0.5,
                                                slowedUntil: now + 1000
                                            }
                                        }
                                        return e
                                    })
                                } else {
                                    // 단일 대상 공격
                                    updated = updated.map(e => {
                                        if (e.id === target.id) {
                                            return { ...e, hp: e.hp - projectile.damage }
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

    if (!roomCode || !playerId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <p className="text-gray-800">방 코드와 플레이어 ID가 필요합니다.</p>
                </div>
            </div>
        )
    }

    if (roomLoading || playersLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-2xl font-bold text-gray-800">로딩 중...</div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden font-suhgung">
            <AnimatedBackground />

            <div className="relative z-10 p-4">
                {/* 로비 */}
                {currentView === 'lobby' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="min-h-screen flex items-center justify-center"
                    >
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-2xl max-w-3xl border-4 border-purple-500">
                            <div className="text-center mb-6">
                                <div className="text-6xl mb-4">🏰</div>
                                <h1 className="text-4xl font-bold text-gray-900 mb-2">타워 디펜스</h1>
                                <p className="text-gray-600">퀴즈를 풀어 골드를 모으고, 타워를 설치하여 적들을 막아내세요!</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                                    <h3 className="font-bold text-lg mb-2">🎯 게임 방법</h3>
                                    <ul className="text-sm space-y-1 text-gray-700">
                                        <li>• 퀴즈 정답으로 골드 획득</li>
                                        <li>• 타워를 배치해 적 공격</li>
                                        <li>• 10 웨이브 클리어</li>
                                        <li>• HP가 0이 되면 게임 오버</li>
                                    </ul>
                                </div>

                                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                                    <h3 className="font-bold text-lg mb-2">🏹 타워 종류</h3>
                                    <div className="text-sm space-y-1 text-gray-700">
                                        <div>🏹 기본 - 단일 대상</div>
                                        <div>🔮 마법 - 범위 공격</div>
                                        <div>💣 폭발 - 광역 데미지</div>
                                        <div>⚡ 레이저 - 빠른 연사</div>
                                        <div>❄️ 둔화 - 적 느리게</div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-center text-sm text-gray-500">선생님이 게임을 시작할 때까지 기다려주세요.</p>
                        </div>
                    </motion.div>
                )}

                {/* 카운트다운 */}
                {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

                {/* 게임 플레이 */}
                {currentView === 'playing' && (
                    <div className="max-w-7xl mx-auto">
                        {/* 상단 HUD */}
                        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-xl p-4 mb-4 shadow-2xl border-4 border-purple-500">
                            <div className="flex items-center justify-between text-white">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <div className="text-xs text-gray-400">HP</div>
                                        <div className="text-2xl font-bold text-red-400">❤️ {hp}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400">골드</div>
                                        <div className="text-2xl font-bold text-yellow-400">💰 {gold}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400">웨이브</div>
                                        <div className="text-2xl font-bold text-purple-400">{currentWave + 1} / {WAVES.length}</div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleQuizClick}
                                        className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 rounded-lg font-bold shadow-lg border-2 border-white/50"
                                    >
                                        📝 퀴즈 풀기
                                    </motion.button>

                                    {!isWaveActive && currentWave < WAVES.length && (
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={startWave}
                                            className="bg-gradient-to-r from-red-500 to-orange-600 px-6 py-3 rounded-lg font-bold shadow-lg border-2 border-white/50"
                                        >
                                            ⚔️ 웨이브 {currentWave + 1} 시작
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_300px] gap-4">
                            {/* 맵 */}
                            <div className="relative border-4 border-gray-700 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
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

                            {/* 타워 선택 패널 */}
                            <div className="space-y-4">
                                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-xl border-4 border-gray-300">
                                    <h3 className="font-bold text-lg mb-3 text-gray-900">타워 선택</h3>
                                    <div className="space-y-3">
                                        {Object.values(TOWER_TYPES).map(tower => (
                                            <TowerCard
                                                key={tower.id}
                                                tower={tower}
                                                isSelected={selectedTowerType === tower.id}
                                                canAfford={gold >= tower.cost}
                                                onSelect={() => setSelectedTowerType(tower.id)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {selectedTower && (
                                    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-xl border-4 border-blue-500">
                                        <h3 className="font-bold text-lg mb-2 text-gray-900">타워 정보</h3>
                                        <div className="text-sm space-y-1">
                                            <div>레벨: {selectedTower.level}</div>
                                            <div>데미지: {getTowerDamage(selectedTower.type, selectedTower.level)}</div>
                                            <div>범위: {getTowerRange(selectedTower.type, selectedTower.level)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 퀴즈 */}
                {currentView === 'quiz' && currentQuestion && (
                    <div className="min-h-screen flex items-center justify-center">
                        <QuizView
                            question={currentQuestion}
                            onAnswer={handleAnswer}
                            onCorrectClick={goToPlaying}
                            timeLimit={30}
                        />
                    </div>
                )}

                {/* 결과 */}
                {currentView === 'result' && (
                    <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/80 backdrop-blur-md">
                        <GameResult
                            players={players}
                            currentPlayerId={playerId}
                            gameMode="tower"
                            onRestart={() => window.location.reload()}
                            onExit={() => window.location.href = '/'}
                        />
                    </div>
                )}
            </div>
        </main>
    )
}
