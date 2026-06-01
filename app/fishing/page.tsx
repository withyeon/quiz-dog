'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, Clock, Gamepad2, PackageCheck, Settings, Star, Target, XCircle, Zap } from 'lucide-react'
import QuizView from '@/components/QuizView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import FishingMachine from '@/components/FishingMachine'
import {
  CollectionGrid,
  ITEM_LABELS,
  LeaderboardPanel,
  ResultCard,
  SpecialItemIcon,
  type FishingPlayer,
} from '@/components/fishing/FishingPanels'
import { useGameBase } from '@/hooks/useGameBase'
import { useFishingGame } from '@/hooks/useFishingGame'
import {
  getAnswerSpeedGrade,
  getAnswerSpeedLabel,
  getMachineRankName,
  getMachineRankProgress,
} from '@/lib/game/fishing'

export default function FishingPage() {
  const gameBase = useGameBase({ expectedGameMode: 'fishing' })
  const {
    roomCode, playerId, currentView, setCurrentView,
    showCountdown, players, room, roomLoading, playersLoading,
    currentPlayer, currentQuestion, questionsLoading, questionsError,
    preStartQuizQuestion, preStartSubmittedCount, preStartQuizTotal,
    shouldShowPreStartQuiz, isPreStartQuizComplete,
    playSFX, handlePreStartQuizAnswer,
    checkAnswer, handleWrongAnswer, handleCountdownComplete,
    goToNextQuestion, getElapsedSeconds,
  } = gameBase

  const fishing = useFishingGame({
    playerId,
    currentPlayer: currentPlayer as FishingPlayer | null | undefined,
    checkAnswer, handleWrongAnswer, goToNextQuestion,
    getElapsedSeconds, playSFX, setCurrentView,
  })

  const {
    fishingState, caughtItem, fishingResult,
    caughtDolls, correctAnswers, consecutiveCorrect, comboState,
    isFrenzyEvent, frenzyTimeLeft,
    activeItems, pendingItem, showItemModal,
    machineRank, pendingPull, aimPosition, targetPosition,
    savedAnswerTime,
    handleAnswerSubmit, handleOpenClaw,
    handleDropClaw, handleItemModalClose, handleResultCardClick,
  } = fishing

  const rankProgress = getMachineRankProgress(correctAnswers)
  const totalPoints = caughtDolls.reduce((sum, d) => sum + (d.score || 0), 0)
  const speedGrade = getAnswerSpeedGrade(savedAnswerTime)
  const showResultCard = fishingState === 'release' && !!fishingResult?.doll
  const isPaused = room?.status === 'paused'

  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && !showCountdown && isPreStartQuizComplete) {
      setCurrentView('quiz')
    }
  }, [currentView, isPreStartQuizComplete, room?.status, setCurrentView, showCountdown])

  if (!roomCode || !playerId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <p className="rounded-lg bg-white p-6 text-gray-800 shadow-lg">방 코드와 플레이어 ID가 필요합니다.</p>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <p className="text-2xl font-bold text-gray-800">로딩 중...</p>
      </div>
    )
  }

  return (
    <main
      className={`fishing-ambient relative min-h-dvh overflow-hidden font-bitbit text-slate-900 transition-colors duration-700 ${isFrenzyEvent ? 'bg-[#fffaf2]' : 'bg-[#f8fbff]'}`}
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(240,249,255,0.22)_0%,rgba(255,255,255,0.16)_44%,rgba(248,250,252,0.28)_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-80 bg-[linear-gradient(135deg,rgba(224,242,254,0.28),rgba(255,255,255,0.22)_48%,rgba(254,249,195,0.18))]" />

      {/* 프렌지 오버레이 */}
      {isFrenzyEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.18 }}
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            backgroundImage: 'linear-gradient(45deg, #fde68a, #f9a8d4, #67e8f9, #c4b5fd)',
            backgroundSize: '400% 400%',
            animation: 'fishingGradient 3s ease infinite',
          }}
        />
      )}

      <div className="relative z-30 p-3 sm:p-4">
        {/* ── 상단 헤더 ── */}
        <div className="mx-auto mb-4 max-w-7xl">
          <div className="rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* 타이틀 */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <Image
                    src="/title/fishing.svg"
                    alt="인형뽑기"
                    width={360}
                    height={96}
                    className="h-10 w-auto max-w-full object-contain sm:h-12"
                    priority
                  />
                </div>
              </div>

              {/* 스탯 패널 */}
              <div className="flex flex-wrap gap-2">
                {/* 기계 랭크 */}
                <div className="min-w-[110px] rounded-lg border border-slate-200 bg-white/90 px-3 py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">기계 등급</div>
                  <div className="truncate text-sm font-extrabold text-slate-900">{getMachineRankName(machineRank)}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full bg-cyan-400"
                      animate={{ width: `${rankProgress.progress}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>

                {/* 내 점수 */}
                <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">
                    {(currentPlayer as FishingPlayer)?.nickname || '플레이어'}
                  </div>
                  <div className="text-xl font-extrabold text-slate-900">{totalPoints.toLocaleString()}점</div>
                </div>

                {/* 컬렉션 */}
                <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">컬렉션</div>
                  <div className="text-xl font-extrabold text-slate-900">{caughtDolls.length}개</div>
                </div>

                {/* 콤보 */}
                {consecutiveCorrect >= 2 && (
                  <motion.div
                    key={consecutiveCorrect}
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2"
                  >
                    <div className="mb-0.5 text-[10px] font-bold text-orange-600">
                      콤보
                    </div>
                    <div className="text-xl font-extrabold text-orange-700">{consecutiveCorrect}연속</div>
                  </motion.div>
                )}

                {/* 정답 보상 상태 */}
                <div className={`rounded-lg border px-3 py-2 transition-colors ${pendingPull ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white/80'}`}>
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">뽑기 전력</div>
                  <div className={`flex items-center gap-1 text-xl font-extrabold ${pendingPull ? 'text-green-600' : 'text-slate-400'}`}>
                    {pendingPull ? (
                      <>충전 <Zap size={16} className="text-green-500" /></>
                    ) : '대기'}
                    {isFrenzyEvent && <Zap size={14} className="text-yellow-500 ml-1" />}
                  </div>
                </div>
              </div>
            </div>

            {/* 활성 아이템 + 프렌지 */}
            {(activeItems.length > 0 || isFrenzyEvent) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {isFrenzyEvent && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-400 px-3 py-1 text-xs font-black text-yellow-950">
                    <Zap size={12} /> 대성공 이벤트 {frenzyTimeLeft}초
                  </div>
                )}
                {activeItems.map((type, i) => (
                  <div key={`${type}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">
                    <SpecialItemIcon type={type} size={12} />
                    {ITEM_LABELS[type] ?? type}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* ── 메인 컨텐츠 ── */}
        <div className="mx-auto max-w-7xl">
          {shouldShowPreStartQuiz && (
            <PreStartQuizGate
              question={preStartQuizQuestion}
              submittedCount={preStartSubmittedCount}
              total={preStartQuizTotal}
              onAnswer={handlePreStartQuizAnswer}
              questionsLoading={questionsLoading}
              questionsError={questionsError}
              variant="fishing"
            />
          )}

          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {/* 대기 로비 */}
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border-4 border-pink-200 bg-white/90 p-10 text-center shadow-2xl shadow-pink-100/60 backdrop-blur"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                <Gamepad2 size={34} />
              </div>
              <h2 className="mb-3 text-4xl font-black text-slate-900">인형뽑기 준비 중...</h2>
              <p className="text-lg text-slate-600">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 뷰 */}
          {currentView === 'quiz' && !showCountdown && (
            currentQuestion ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* 왼쪽: 퀴즈 + 컬렉션 */}
              <div className="space-y-4">
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  timeLimit={30}
                  onCorrectClick={handleOpenClaw}
                  paused={isPaused}
                  variant="fishing"
                  className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60"
                />

                {/* 콤보 배지 */}
                <AnimatePresence>
                  {comboState.label && (
                    <motion.div
                      key={comboState.count}
                      initial={{ opacity: 0, scale: 0.7, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="mx-auto max-w-3xl rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-center"
                    >
                      <span className="text-xl font-extrabold text-orange-700">{comboState.label}</span>
                      {comboState.multiplier > 1 && (
                        <span className="ml-2 text-sm font-bold text-orange-600">
                          점수 {comboState.multiplier}×
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 학습 보상 패널 */}
                <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg shadow-slate-200/50">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-800">
                    <Award size={16} /> 이번 뽑기 예상 보상
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-3">
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-500">
                        <Clock size={12} /> 정답 속도
                      </div>
                      <div className="text-base font-black text-sky-700">{getAnswerSpeedLabel(speedGrade)}</div>
                    </div>
                    <div className="rounded-lg border border-green-100 bg-green-50/80 p-3">
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-500">
                        <Zap size={12} /> 뽑기 전력
                      </div>
                      <div className={`text-base font-black ${pendingPull ? 'text-green-600' : 'text-slate-400'}`}>
                        {pendingPull ? '준비됨' : '없음'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3">
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-500">
                        <Star size={12} /> 다음 랭크
                      </div>
                      <div className="text-base font-black text-amber-700">
                        {rankProgress.next === null ? '최고' : `${rankProgress.remaining}문제`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 컬렉션 */}
                {caughtDolls.length > 0 && (
                  <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg shadow-slate-200/50">
                    <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-800">
                      <PackageCheck size={16} /> 획득한 인형 ({caughtDolls.length}개)
                    </h3>
                    <CollectionGrid dolls={caughtDolls} />
                  </div>
                )}
              </div>

              {/* 오른쪽: 순위 */}
              <aside className="space-y-4">
                <LeaderboardPanel players={players as FishingPlayer[]} playerId={playerId} />

                {/* 기계 랭크 상세 */}
                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-slate-800 shadow-lg shadow-slate-200/50">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-800">
                    <Settings size={16} /> 기계 정보
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2">
                      <span className="text-slate-500">현재 등급</span>
                      <span className="font-black text-sky-700">Rank {machineRank} — {getMachineRankName(machineRank)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-pink-100 bg-pink-50/80 px-3 py-2">
                      <span className="text-slate-500">정답 수</span>
                      <span className="font-black text-slate-900">{correctAnswers}문제</span>
                    </div>
                    {rankProgress.next !== null && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-slate-500">다음 등급까지</span>
                          <span className="font-bold text-amber-700">{rankProgress.remaining}문제</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                          <motion.div
                            className="h-full rounded-full bg-amber-400"
                            animate={{ width: `${rankProgress.progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 leading-relaxed">
                      등급이 높을수록 희귀 인형 확률이 올라가고, 빠른 정답에는 점수 보너스가 붙습니다.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white/90 p-10 text-center shadow-xl shadow-slate-200/60">
                <h2 className="text-3xl font-black text-slate-900">문제를 불러오는 중...</h2>
                <p className="mt-3 text-base font-bold text-slate-500">잠시 후 퀴즈가 자동으로 표시됩니다.</p>
              </div>
            )
          )}

          {/* 집게 뷰 */}
          {currentView === 'claw' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <FishingMachine
                fishingState={fishingState}
                caughtItem={caughtItem}
                fishingResult={fishingResult}
                message={
                  fishingState === 'aim'
                    ? '조준 중입니다. SPACE 또는 내리기 버튼을 누르세요'
                    : fishingState === 'down'
                    ? '집게가 내려갑니다'
                    : fishingState === 'grab'
                    ? '그립을 닫는 중입니다'
                    : fishingState === 'up'
                    ? '천천히 끌어올리는 중입니다'
                    : fishingState === 'return'
                    ? '배출구로 이동 중입니다'
                    : fishingState === 'release'
                    ? '획득했습니다'
                    : '대기 중입니다'
                }
                onDropClaw={handleDropClaw}
                canDrop={fishingState === 'aim'}
                aimPosition={aimPosition}
                targetPosition={targetPosition}
                machineRank={machineRank}
                activeItems={activeItems}
                recentDolls={caughtDolls}
                isFrenzy={isFrenzyEvent}
              />

              {/* 오른쪽 사이드바 */}
              <aside className="flex flex-col gap-4">
                {/* 조준 가이드 */}
                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-slate-800 shadow-lg shadow-slate-200/50">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-800">
                    <Target size={14} /> 조준 가이드
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2">
                      <span className="text-yellow-700 font-black">전설</span>
                      <span className="text-slate-600 text-xs">노란 구간, 목표선에 가까울수록 최고</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                      <span className="text-violet-700 font-black">영웅</span>
                      <span className="text-slate-600 text-xs">보라 구간 · 높은 점수 확률 증가</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                      <span className="text-sky-700 font-black">희귀</span>
                      <span className="text-slate-600 text-xs">하늘 구간 · 희귀 인형 확률 증가</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                      <span className="text-green-700 font-black">일반</span>
                      <span className="text-slate-600 text-xs">구간 밖 · 일반 인형 위주</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    목표는 매번 다른 위치에 나타납니다. 노란 구간 안의 목표선에 가까울수록 높은 등급입니다.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Rank {machineRank}에서는 집게가 {machineRank >= 4 ? '빠르게' : machineRank >= 3 ? '적당히' : '천천히'} 움직입니다.
                  </p>
                </div>

                {/* 콤보 상태 */}
                {consecutiveCorrect >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center shadow-lg shadow-orange-100/50"
                  >
                    <div className="mb-1 text-sm font-bold text-orange-600">
                      콤보 보너스
                    </div>
                    <div className="text-3xl font-black text-orange-700">{consecutiveCorrect}연속</div>
                    <div className="text-sm font-bold text-orange-600">점수 {comboState.multiplier}×</div>
                  </motion.div>
                )}

                {/* 기계 정보 */}
                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-slate-800 shadow-lg shadow-slate-200/50">
                  <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                    <Settings size={14} /> 기계 등급
                  </div>
                  <div className="text-base font-extrabold text-sky-700">{getMachineRankName(machineRank)}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${rankProgress.progress}%` }} />
                  </div>
                  {rankProgress.next !== null && (
                    <p className="mt-1.5 text-xs text-slate-500">{rankProgress.remaining}문제 더 맞추면 업그레이드</p>
                  )}
                </div>

                <LeaderboardPanel players={players as FishingPlayer[]} playerId={playerId} />
              </aside>
            </div>
          )}

          {/* 오답 뷰 */}
          {currentView === 'wrong' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-red-200 bg-white/90 p-10 text-center shadow-xl shadow-red-100/60 backdrop-blur"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-100"
              >
                <XCircle size={48} />
              </motion.div>
              <h2 className="mb-2 text-4xl font-extrabold text-red-600">틀렸습니다</h2>
              <p className="text-xl text-slate-600">콤보가 끊겼어요. 다음 문제에서 다시 도전</p>
            </motion.div>
          )}

          {/* 게임 결과 */}
          {currentView === 'result' && (
            <GameResult players={players} currentPlayerId={playerId} gameMode="fishing" />
          )}
        </div>
      </div>

      {/* ── 획득 결과 카드 모달 ── */}
      <AnimatePresence>
        {showResultCard && fishingResult && (
          <ResultCard fishingResult={fishingResult} onClose={handleResultCardClick} />
        )}
      </AnimatePresence>

      {/* ── 특별 아이템 모달 ── */}
      <AnimatePresence>
        {showItemModal && pendingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-sky-100/70 p-4 backdrop-blur-sm"
            onClick={handleItemModalClose}
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-full max-w-sm rounded-xl border border-violet-200 bg-white p-8 text-center shadow-xl shadow-violet-100/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`mb-4 inline-block rounded-full px-3 py-1 text-sm font-bold ${
                pendingItem.rarity === '전설' ? 'bg-yellow-400 text-yellow-950'
                  : pendingItem.rarity === '희귀' ? 'bg-sky-400 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {pendingItem.rarity} 보너스 획득
              </div>
              <motion.div
                animate={{ y: [0, -10, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700 shadow-inner"
              >
                <SpecialItemIcon type={pendingItem.type} size={46} />
              </motion.div>
              <h2 className="mb-2 text-3xl font-extrabold text-slate-900">{pendingItem.name}</h2>
              <p className="mb-6 text-base text-violet-700">{pendingItem.description}</p>
              <button
                type="button"
                onClick={handleItemModalClose}
                className="w-full rounded-lg bg-pink-500 py-4 text-lg font-extrabold text-white shadow-lg shadow-pink-100 hover:bg-pink-400 active:scale-95 transition-transform"
              >
                확인하고 진행
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes fishingGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </main>
  )
}
