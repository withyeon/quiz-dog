'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import QuizView from '@/components/QuizView'
import TowerDefenseMap from '@/components/TowerDefenseMap'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import GameResult from '@/components/GameResult'
import SkillChoiceModal from '@/components/SkillChoiceModal'
import TowerBattleHeader from '@/components/tower/TowerBattleHeader'
import SelectedTowerPanel from '@/components/tower/SelectedTowerPanel'
import TowerLobbyPanel from '@/components/tower/TowerLobbyPanel'
import TowerPlacementPanel from '@/components/tower/TowerPlacementPanel'
import TowerWavePanel from '@/components/tower/TowerWavePanel'
import { useGameBase } from '@/hooks/useGameBase'
import { TOWER_QUIZZES_PER_WAVE, useTowerDefenseGame } from '@/hooks/useTowerDefenseGame'
import {
    ENEMY_TYPES,
    PATH_POINTS,
    PLAYER_START_HP,
    calculateQuizGoldReward,
    getDistance,
    QUIZ_HP_PENALTY,
} from '@/lib/game/tower'
import { createHitParticles } from '@/lib/game/particles'
import { getSkillChoices, SKILLS, type Skill, type SkillId } from '@/lib/game/skills'

export default function TowerPage() {
    const router = useRouter()
    const {
        roomCode,
        playerId,
        currentView,
        setCurrentView,
        setCurrentQuestionIndex,
        players,
        roomLoading,
        playersLoading,
        room,
        currentQuestion,
        questionsLoading,
        questionsError,
        preStartQuizQuestion,
        preStartSubmittedCount,
        preStartQuizTotal,
        shouldShowPreStartQuiz,
        consecutiveCorrect,
        playBGM,
        playSFX,
        handlePreStartQuizAnswer,
        checkAnswer,
        goToNextQuestion,
        getElapsedSeconds,
        questionStartTime,
        showCountdown,
        setShowCountdown,
        commitPlayerPatch,
    } = useGameBase({ expectedGameMode: 'tower' })
    const isPaused = room?.status === 'paused'

    const quizReturnTimerRef = useRef<NodeJS.Timeout | null>(null)
    const quizTransitionHandledRef = useRef(false)
    const [showSkillModal, setShowSkillModal] = useState(false)
    const [skillChoices, setSkillChoices] = useState<Skill[]>([])
    const [pendingGoldReward, setPendingGoldReward] = useState(0)
    const [pendingComboCount, setPendingComboCount] = useState(0)
    const [skillToast, setSkillToast] = useState<string | null>(null)

    const clearQuizReturnTimer = useCallback(() => {
        if (quizReturnTimerRef.current) {
            clearTimeout(quizReturnTimerRef.current)
            quizReturnTimerRef.current = null
        }
    }, [])

    const {
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
        selectedUpgradeCost,
        selectedSellValue,
        nextWaveRoster,
        waveProgress,
        occupiedSlotCount,
        quizHudValue,
        quizHudDetail,
        quizButtonLabel,
        startWaveButtonLabel,
        currentWaveQuizAnswered,
        currentWaveQuizCorrect,
    } = useTowerDefenseGame({
        roomCode,
        roomStatus: room?.status,
        currentView,
        currentQuestionAvailable: Boolean(currentQuestion),
        setCurrentView,
        setCurrentQuestionIndex,
        setShowCountdown,
        playSFX,
    })

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
        resetGame()
    }, [clearQuizReturnTimer, resetGame])

    // 퀴즈 답변 제출
    const handleAnswer = async (answer: string) => {
        const timeElapsed = getElapsedSeconds()
        const correct = await checkAnswer(answer)
        const quizProgress = recordQuizResult(currentWave, correct)

        if (correct) {
            playSFX('correct')
            const goldReward = calculateQuizGoldReward(timeElapsed, 30)
            const nextCombo = quizProgress.correct
            setGold(prev => prev + goldReward)
            setTotalGoldEarned(prev => prev + goldReward)
            setPendingGoldReward(goldReward)
            setPendingComboCount(nextCombo)

            if (quizProgress.completed && quizProgress.allCorrect) {
                setSkillChoices(getSkillChoices(nextCombo))
                setShowSkillModal(true)
            } else {
                scheduleReturnToPlaying(900)
                if (quizProgress.completed && !quizProgress.allCorrect) {
                    setSkillToast('3문제 완료! 모두 정답이어야 아이템을 뽑을 수 있어요.')
                    window.setTimeout(() => setSkillToast(null), 1800)
                }
            }
        } else {
            playSFX('incorrect')
            setHp(prev => Math.max(0, prev - QUIZ_HP_PENALTY))
            setEnemies(prev => {
                const sorted = [...prev].sort((a, b) => b.currentPathIndex - a.currentPathIndex)
                if (sorted.length === 0) return prev

                return prev.map(enemy => (
                    enemy.id === sorted[0].id
                        ? {
                            ...enemy,
                            buffedUntil: Date.now() + 5000,
                            buffType: 'ENRAGE' as const,
                            hp: Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.3),
                        }
                        : enemy
                ))
            })
            if (quizProgress.completed) {
                setSkillToast('3문제 완료! 모두 정답이어야 아이템을 뽑을 수 있어요.')
                window.setTimeout(() => setSkillToast(null), 1800)
            }
            scheduleReturnToPlaying(2000)
        }
        return correct
    }

    const handleSkillSelect = useCallback((skillId: SkillId) => {
        const selectedSkill = SKILLS[skillId]
        setShowSkillModal(false)
        setSkillToast(`${selectedSkill.name} 발동!`)
        window.setTimeout(() => setSkillToast(null), 1600)
        scheduleReturnToPlaying(300)

        switch (skillId) {
            case 'THUNDER': {
                setEnemies(prev => {
                    const target = [...prev].sort((a, b) => b.hp - a.hp)[0]
                    if (!target) return prev

                    setParticles(particles => [
                        ...particles,
                        ...createHitParticles(target.x, target.y, 'BOSS_DIE'),
                    ].slice(-240))
                    setShakeIntensity(8)
                    window.setTimeout(() => setShakeIntensity(0), 400)

                    const goldReward = ENEMY_TYPES[target.type].goldReward
                    setGold(current => current + goldReward)
                    setTotalGoldEarned(current => current + goldReward)
                    setTotalEnemiesKilled(current => current + 1)
                    return prev.filter(enemy => enemy.id !== target.id)
                })
                break
            }
            case 'BLIZZARD': {
                const until = Date.now() + 4000
                setEnemies(prev => prev.map(enemy => ({
                    ...enemy,
                    frozenUntil: until,
                    slowedUntil: until,
                })))
                setParticles(prev => [
                    ...prev,
                    ...Array.from({ length: 5 }, (_, index) => (
                        createHitParticles(100 + index * 150, 150 + Math.random() * 300, 'SLOW')
                    )).flat(),
                ].slice(-240))
                break
            }
            case 'OVERCLOCK': {
                setOverclockUntil(Date.now() + 8000)
                setParticles(prev => [
                    ...prev,
                    ...createHitParticles(400, 300, 'MAGIC'),
                ].slice(-240))
                break
            }
            case 'AIRSTRIKE': {
                const midPoint = PATH_POINTS[Math.floor(PATH_POINTS.length / 2)]
                setEnemies(prev => {
                    const damaged = prev.map(enemy => (
                        getDistance(enemy.x, enemy.y, midPoint.x, midPoint.y) <= 100
                            ? { ...enemy, hp: enemy.hp - 150 }
                            : enemy
                    ))
                    const deadEnemies = damaged.filter(enemy => enemy.hp <= 0)
                    if (deadEnemies.length > 0) {
                        const goldReward = deadEnemies.reduce((sum, enemy) => sum + ENEMY_TYPES[enemy.type].goldReward, 0)
                        setGold(current => current + goldReward)
                        setTotalGoldEarned(current => current + goldReward)
                        setTotalEnemiesKilled(current => current + deadEnemies.length)
                        setParticles(prevParticles => [
                            ...prevParticles,
                            ...deadEnemies.flatMap(enemy => createHitParticles(enemy.x, enemy.y, enemy.type === 'BOSS' ? 'BOSS_DIE' : 'ENEMY_DIE')),
                        ].slice(-240))
                    }
                    return damaged.filter(enemy => enemy.hp > 0)
                })
                setParticles(prev => [
                    ...prev,
                    ...createHitParticles(midPoint.x, midPoint.y, 'BOMB'),
                ].slice(-240))
                setShakeIntensity(10)
                window.setTimeout(() => setShakeIntensity(0), 500)
                break
            }
            case 'HEAL': {
                setHp(prev => Math.min(PLAYER_START_HP, prev + 20))
                setParticles(prev => [
                    ...prev,
                    ...createHitParticles(400, 300, 'HEAL'),
                ].slice(-240))
                break
            }
            case 'GOLD_RUSH': {
                setGold(prev => prev + 200)
                setTotalGoldEarned(prev => prev + 200)
                setParticles(prev => [
                    ...prev,
                    ...createHitParticles(400, 300, 'GOLD'),
                ].slice(-240))
                break
            }
        }
    }, [
        scheduleReturnToPlaying,
        setEnemies,
        setGold,
        setHp,
        setOverclockUntil,
        setParticles,
        setShakeIntensity,
        setTotalEnemiesKilled,
        setTotalGoldEarned,
    ])

    // 퀴즈 버튼 클릭
    const handleQuizClick = () => {
        if (isQuizAvailable) {
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

    useEffect(() => {
        if (!playerId || (currentView !== 'playing' && currentView !== 'result')) return

        const score = Math.max(0, Math.floor(totalGoldEarned))
        const timer = window.setTimeout(() => {
            void commitPlayerPatch(playerId, {
                score,
                gold: Math.max(0, Math.floor(gold)),
            }, 'tower_score_sync')
        }, 350)

        return () => window.clearTimeout(timer)
    }, [commitPlayerPatch, currentView, gold, playerId, totalGoldEarned])

    useEffect(() => {
        return () => {
            clearQuizReturnTimer()
        }
    }, [clearQuizReturnTimer])

    const isDangerous = hp <= 30

    if (!roomCode || !playerId) {
        return (
            <div className="tower-command-screen flex min-h-dvh items-center justify-center p-6">
                <div className="relative z-10 rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-xl">
                    <p className="font-bold text-slate-800">방 코드와 플레이어 ID가 필요합니다.</p>
                </div>
            </div>
        )
    }

    if (roomLoading || playersLoading) {
        return (
            <div className="tower-command-screen flex min-h-dvh items-center justify-center p-6">
                <div className="relative z-10 rounded-lg border border-slate-200 bg-white px-6 py-5 text-xl font-black text-slate-800 shadow-xl">
                    작전실 불러오는 중...
                </div>
            </div>
        )
    }

    return (
        <main className="tower-command-screen min-h-dvh overflow-x-hidden font-bitbit text-slate-900">
            <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col px-4 py-5 sm:px-6 lg:px-8">
                {shouldShowPreStartQuiz && (
                    <PreStartQuizGate
                        question={preStartQuizQuestion}
                        submittedCount={preStartSubmittedCount}
                        total={preStartQuizTotal}
                        onAnswer={handlePreStartQuizAnswer}
                        questionsLoading={questionsLoading}
                        questionsError={questionsError}
                    />
                )}

                {currentView === 'lobby' && (
                    <TowerLobbyPanel roomCode={roomCode} />
                )}

                {showCountdown && <Countdown onComplete={handleTowerCountdownComplete} />}

                {currentView === 'playing' && (
                    <div className="flex min-h-[calc(100dvh-40px)] flex-col">
                        <TowerBattleHeader
                            roomCode={roomCode}
                            selectedTowerType={selectedTowerType}
                            hp={hp}
                            gold={gold}
                            totalGoldEarned={totalGoldEarned}
                            currentWave={currentWave}
                            isWaveActive={isWaveActive}
                            waveEnemiesRemaining={waveEnemiesRemaining}
                            waveProgress={waveProgress}
                            occupiedSlotCount={occupiedSlotCount}
                            quizHudValue={quizHudValue}
                            quizHudDetail={quizHudDetail}
                            quizButtonLabel={quizButtonLabel}
                            consecutiveCorrect={consecutiveCorrect}
                            isQuizAvailable={isQuizAvailable}
                            canStartWave={canStartWave}
                            startWaveButtonLabel={startWaveButtonLabel}
                            onQuizClick={handleQuizClick}
                            onStartWave={startWave}
                        />

                        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                            <section className="min-w-0">
                                <TowerWavePanel
                                    currentWave={currentWave}
                                    isWaveActive={isWaveActive}
                                    nextWaveRoster={nextWaveRoster}
                                    waveProgress={waveProgress}
                                />

                                <div className={`tower-map-frame relative transition-all duration-300 ${
                                    isDangerous ? 'animate-pulse ring-4 ring-red-500 ring-offset-2' : ''
                                }`}>
                                    <AnimatePresence>
                                        {waveClearToast && (
                                            <motion.div
                                                key={waveClearToast}
                                                initial={{ opacity: 0, scale: 0.7, y: -30 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -40, scale: 0.9 }}
                                                className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center"
                                            >
                                                <div className="flex items-center gap-3 rounded-full bg-emerald-500 px-8 py-4 shadow-2xl shadow-emerald-300">
                                                    <span className="text-3xl">⚔️</span>
                                                    <span className="text-xl font-black text-white">웨이브 {waveClearToast} 클리어!</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <AnimatePresence>
                                        {bossKillToast && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 1.3 }}
                                                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                                            >
                                                <div className="rounded-lg bg-rose-600 px-10 py-6 text-center shadow-2xl shadow-rose-400">
                                                    <div className="mb-2 text-5xl">💀</div>
                                                    <div className="text-2xl font-black text-white">보스 처치!</div>
                                                    <div className="mt-1 text-sm font-bold text-rose-200">골드 대량 획득</div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <TowerDefenseMap
                                        towers={towers}
                                        enemies={enemies}
                                        projectiles={projectiles}
                                        particles={particles}
                                        shakeIntensity={shakeIntensity}
                                        selectedTowerType={selectedTowerType}
                                        onPlaceTower={handlePlaceTower}
                                        onSelectTower={setSelectedTower}
                                        selectedTower={selectedTower}
                                    />
                                </div>
                            </section>

                            <aside className="space-y-4">
                                <TowerPlacementPanel
                                    gold={gold}
                                    selectedTowerType={selectedTowerType}
                                    onSelectTowerType={(towerType) => {
                                        setSelectedTower(null)
                                        setSelectedTowerType(towerType)
                                    }}
                                />

                                <SelectedTowerPanel
                                    selectedTower={selectedTower}
                                    gold={gold}
                                    selectedUpgradeCost={selectedUpgradeCost}
                                    selectedSellValue={selectedSellValue}
                                    totalTowersPlaced={totalTowersPlaced}
                                    totalEnemiesKilled={totalEnemiesKilled}
                                    onUpgradeTower={handleUpgradeTower}
                                    onSellTower={handleSellTower}
                                />
                            </aside>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {currentView === 'quiz' && currentQuestion && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ type: 'spring', damping: 20 }}
                            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-md"
                        >
                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="absolute left-1/2 top-8 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-5 py-2 text-base font-black text-white shadow-xl"
                            >
                                웨이브 퀴즈 {Math.min(currentWaveQuizAnswered + 1, TOWER_QUIZZES_PER_WAVE)}/{TOWER_QUIZZES_PER_WAVE} · 정답 {currentWaveQuizCorrect}/{TOWER_QUIZZES_PER_WAVE}
                            </motion.div>
                            {consecutiveCorrect >= 2 && (
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="absolute left-1/2 top-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-base font-black text-white shadow-xl"
                                >
                                    🔥 {consecutiveCorrect}연속 정답! 스킬 보너스 대기 중
                                </motion.div>
                            )}
                            <QuizView
                                question={currentQuestion}
                                onAnswer={handleAnswer}
                                onCorrectClick={returnToPlaying}
                                timeLimit={30}
                                paused={isPaused}
                                variant="glass"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showSkillModal && (
                        <SkillChoiceModal
                            skills={skillChoices}
                            goldReward={pendingGoldReward}
                            isBonus={pendingComboCount >= 2}
                            comboCount={pendingComboCount}
                            onSelect={handleSkillSelect}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {skillToast && (
                        <motion.div
                            initial={{ opacity: 0, y: -18, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -18, scale: 0.96 }}
                            className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl"
                        >
                            {skillToast}
                        </motion.div>
                    )}
                </AnimatePresence>

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
                {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
                        <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
                            선생님이 잠깐 멈췄어요
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
