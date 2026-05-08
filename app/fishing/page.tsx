'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, Clock, Flame, Star, Trophy, Zap } from 'lucide-react'
import QuizView from '@/components/QuizView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import FishingMachine from '@/components/FishingMachine'
import { useGameBase } from '@/hooks/useGameBase'
import { useFishingGame } from '@/hooks/useFishingGame'
import {
  getAimGradeLabel,
  getAnswerSpeedGrade,
  getAnswerSpeedLabel,
  getMachineRankName,
  getMachineRankProgress,
  getTierBorderColor,
  getTierColor,
  type Doll,
} from '@/lib/game/fishing'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  caught_dolls?: Doll[]
  claw_points?: number
}

const ITEM_ICONS: Record<string, string> = {
  DOUBLE_SCORE: '⚡',
  LUCKY_BOOST: '⭐',
  COIN_RAIN: '🪙',
  EXTRA_PULL: '🎰',
  SHIELD: '🍀',
}

const ITEM_LABELS: Record<string, string> = {
  DOUBLE_SCORE: '2배 점수',
  LUCKY_BOOST: '행운 부스트',
  COIN_RAIN: '보너스 코인',
  EXTRA_PULL: '복습 티켓',
  SHIELD: '꽝 방지',
}

function getPlayerDolls(player: Player) {
  return Array.isArray(player.caught_dolls) ? (player.caught_dolls as Doll[]) : []
}

function CollectionGrid({ dolls }: { dolls: Doll[] }) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
      {dolls.length === 0 ? (
        <div className="col-span-5 sm:col-span-7 lg:col-span-9 rounded-lg border border-dashed border-slate-600 py-8 text-center text-sm text-slate-500">
          아직 획득한 인형이 없어요.
        </div>
      ) : (
        dolls.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            title={`${item.name} (+${item.score}점)`}
            className={`group relative flex aspect-square items-center justify-center rounded-lg border-2 ${getTierColor(item.tier)} ${getTierBorderColor(item.tier)} shadow-md cursor-default`}
          >
            {item.image ? (
              <Image src={item.image} alt={item.name} width={36} height={36} unoptimized className="h-9 w-9 object-contain drop-shadow" />
            ) : (
              <span className="text-2xl">{item.emoji}</span>
            )}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-bold text-white shadow-xl group-hover:block">
              {item.name}
              <span className="block text-center text-amber-300">+{item.score}점</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function LeaderboardPanel({ players, playerId }: { players: Player[]; playerId: string }) {
  const sorted = [...players].sort((a, b) => ((b as Player).claw_points || 0) - ((a as Player).claw_points || 0))
  return (
    <div className="rounded-lg border-2 border-slate-700 bg-slate-900 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-200">
        <Trophy size={16} /> 순위
      </h3>
      <div className="space-y-2">
        {sorted.slice(0, 5).map((player, index) => {
          const typedPlayer = player as Player
          const isMe = player.id === playerId
          const pts = typedPlayer.claw_points || 0
          const dolls = getPlayerDolls(typedPlayer)
          const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600']
          return (
            <div key={player.id} className={`rounded-lg border p-2.5 ${isMe ? 'border-yellow-400 bg-yellow-400/10' : 'border-slate-700 bg-slate-800'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`w-6 text-sm font-black ${rankColors[index] ?? 'text-slate-400'}`}>#{index + 1}</span>
                  <span className="text-xl">{player.avatar || '🎮'}</span>
                  <span className="truncate text-sm font-bold text-white">{player.nickname}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-black text-white">{pts.toLocaleString()}점</div>
                  <div className="text-xs text-slate-400">{dolls.length}개</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 결과 카드 (claw view에서 획득 후 표시)
function ResultCard({
  fishingResult,
  onClose,
}: {
  fishingResult: NonNullable<ReturnType<typeof useFishingGame>['fishingResult']>
  onClose: () => void
}) {
  const doll = fishingResult.doll
  if (!doll) return null

  const tierLabel: Record<string, string> = {
    일반: 'Nice!',
    희귀: 'Rare!',
    영웅: 'Epic!!',
    전설: 'LEGENDARY!!!',
  }

  const tierCardStyle: Record<string, string> = {
    일반: 'from-amber-700 via-amber-600 to-amber-700 border-amber-400',
    희귀: 'from-sky-700 via-sky-600 to-sky-700 border-sky-400',
    영웅: 'from-violet-700 via-violet-600 to-violet-700 border-violet-400',
    전설: 'from-yellow-600 via-amber-500 to-yellow-600 border-yellow-300',
  }

  const cardStyle = tierCardStyle[doll.tier] ?? tierCardStyle['일반']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -6, y: 40 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className={`relative w-full max-w-sm overflow-hidden rounded-2xl border-4 bg-gradient-to-b ${cardStyle} p-7 text-left shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 반짝이 효과 */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          animate={{ x: ['-120%', '120%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />

        {/* 등급 레이블 */}
        <p className="mb-1 text-center text-lg font-black text-white/80">
          {tierLabel[doll.tier] ?? 'Nice!'}
        </p>

        {/* 인형 이름 */}
        <h2 className="mb-4 text-center text-3xl font-black text-white drop-shadow-lg">{doll.name}</h2>

        {/* 인형 이미지 */}
        <div className="mb-5 flex justify-center">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-white/30 bg-black/20"
          >
            {doll.image ? (
              <Image src={doll.image} alt={doll.name} width={120} height={120} unoptimized className="h-28 w-28 object-contain drop-shadow-2xl" />
            ) : (
              <span className="text-8xl">{doll.emoji}</span>
            )}
          </motion.div>
        </div>

        {/* 점수 분석 */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/30 px-2 py-3">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-white/70">
              <Star size={10} /> 점수
            </div>
            <div className="text-xl font-black text-white">{doll.score.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-black/30 px-2 py-3">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-white/70">
              <Clock size={10} /> 속도
            </div>
            <div className="text-sm font-black text-white leading-tight">
              {getAnswerSpeedLabel(fishingResult.speedGrade)}
            </div>
          </div>
          <div className="rounded-xl bg-black/30 px-2 py-3">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-white/70">
              🎯 조준
            </div>
            <div className="text-sm font-black text-white leading-tight">
              {getAimGradeLabel(fishingResult.aimGrade)}
            </div>
          </div>
        </div>

        {/* 보너스 점수 */}
        {fishingResult.bonusPoints > 0 && (
          <div className="mb-4 rounded-xl border border-yellow-300/50 bg-yellow-400/20 px-3 py-2 text-center text-sm font-black text-yellow-100">
            보너스 +{fishingResult.bonusPoints.toLocaleString()}점 추가!
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-xl bg-white/20 py-3.5 text-center text-lg font-black text-white hover:bg-white/30 active:scale-95 transition-transform"
        >
          계속하기 →
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function FishingPage() {
  const gameBase = useGameBase({ expectedGameMode: 'fishing' })
  const {
    roomCode, playerId, currentView, setCurrentView,
    showCountdown, players, roomLoading, playersLoading,
    currentPlayer, currentQuestion, playSFX,
    checkAnswer, handleWrongAnswer, handleCountdownComplete,
    goToNextQuestion, getElapsedSeconds,
  } = gameBase

  const fishing = useFishingGame({
    playerId,
    currentPlayer: currentPlayer as Player | null | undefined,
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

  if (!roomCode || !playerId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="rounded-lg bg-white p-6 text-gray-800 shadow-lg">방 코드와 플레이어 ID가 필요합니다.</p>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-2xl font-bold text-gray-800">로딩 중...</p>
      </div>
    )
  }

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-slate-950 transition-colors duration-700 ${isFrenzyEvent ? 'bg-gradient-to-b from-[#39154f] via-[#46205d] to-[#042f3d]' : ''}`}
      style={{ fontFamily: 'OkDanDan, sans-serif' }}
    >
      <AnimatedBackground />

      {/* 프렌지 오버레이 */}
      {isFrenzyEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: 'linear-gradient(45deg, #facc15, #ec4899, #22d3ee, #a78bfa)',
            backgroundSize: '400% 400%',
            animation: 'fishingGradient 3s ease infinite',
          }}
        />
      )}

      <div className="relative z-30 p-3 sm:p-4">
        {/* ── 상단 헤더 ── */}
        <div className="mx-auto mb-4 max-w-7xl">
          <div className="rounded-xl border-b-4 border-pink-500 bg-slate-900 px-4 py-3 shadow-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* 타이틀 */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-3xl">🕹️</div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black text-white sm:text-3xl">두근두근 인형뽑기</h1>
                  <p className="text-xs text-cyan-200">방 코드: {roomCode}</p>
                </div>
              </div>

              {/* 스탯 패널 */}
              <div className="flex flex-wrap gap-2">
                {/* 기계 랭크 */}
                <div className="rounded-xl border-2 border-cyan-600 bg-black/40 px-3 py-2 min-w-[110px]">
                  <div className="text-[10px] font-bold text-cyan-300 mb-0.5">기계 등급</div>
                  <div className="text-sm font-black text-white truncate">{getMachineRankName(machineRank)}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <motion.div
                      className="h-full rounded-full bg-cyan-400"
                      animate={{ width: `${rankProgress.progress}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>

                {/* 내 점수 */}
                <div className="rounded-xl border-2 border-pink-600 bg-black/40 px-3 py-2">
                  <div className="text-[10px] font-bold text-pink-300 mb-0.5">
                    {(currentPlayer as Player)?.nickname || '플레이어'}
                  </div>
                  <div className="text-xl font-black text-white">{totalPoints.toLocaleString()}점</div>
                </div>

                {/* 컬렉션 */}
                <div className="rounded-xl border-2 border-amber-600 bg-black/40 px-3 py-2">
                  <div className="text-[10px] font-bold text-amber-300 mb-0.5">컬렉션</div>
                  <div className="text-xl font-black text-white">{caughtDolls.length}개</div>
                </div>

                {/* 콤보 */}
                {consecutiveCorrect >= 2 && (
                  <motion.div
                    key={consecutiveCorrect}
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="rounded-xl border-2 border-orange-400 bg-orange-500/25 px-3 py-2"
                  >
                    <div className="text-[10px] font-bold text-orange-300 mb-0.5 flex items-center gap-1">
                      <Flame size={10} /> 콤보
                    </div>
                    <div className="text-xl font-black text-orange-200">{consecutiveCorrect}연속</div>
                  </motion.div>
                )}

                {/* 정답 보상 상태 */}
                <div className={`rounded-xl border-2 px-3 py-2 transition-colors ${pendingPull ? 'border-green-400 bg-green-500/20' : 'border-slate-700 bg-black/40'}`}>
                  <div className="text-[10px] font-bold text-slate-300 mb-0.5">뽑기 전력</div>
                  <div className={`text-xl font-black ${pendingPull ? 'text-green-300' : 'text-slate-500'} flex items-center gap-1`}>
                    {pendingPull ? (
                      <>충전 <Zap size={16} className="text-green-300" /></>
                    ) : '대기'}
                    {isFrenzyEvent && <Zap size={14} className="text-yellow-300 ml-1" />}
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
                  <div key={`${type}-${i}`} className="rounded-lg border border-indigo-300/50 bg-indigo-500/20 px-2 py-1 text-xs font-black text-indigo-100">
                    {ITEM_ICONS[type] ?? '🎁'} {ITEM_LABELS[type] ?? type}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 메인 컨텐츠 ── */}
        <div className="mx-auto max-w-7xl">
          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {/* 대기 로비 */}
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border-4 border-pink-500 bg-slate-900 p-10 text-center shadow-2xl"
            >
              <div className="mb-4 text-6xl">🕹️</div>
              <h2 className="mb-3 text-4xl font-black text-white">인형뽑기 준비 중...</h2>
              <p className="text-lg text-slate-300">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 뷰 */}
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* 왼쪽: 퀴즈 + 컬렉션 */}
              <div className="space-y-4">
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  timeLimit={30}
                  onCorrectClick={handleOpenClaw}
                  className="mx-auto max-w-3xl rounded-xl border-2 border-cyan-100 bg-white p-6 shadow-2xl"
                />

                {/* 콤보 배지 */}
                <AnimatePresence>
                  {comboState.label && (
                    <motion.div
                      key={comboState.count}
                      initial={{ opacity: 0, scale: 0.7, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="mx-auto max-w-3xl rounded-xl border-2 border-orange-400 bg-orange-500/15 px-4 py-3 text-center"
                    >
                      <span className="text-xl font-black text-orange-200">{comboState.label}</span>
                      {comboState.multiplier > 1 && (
                        <span className="ml-2 text-sm font-bold text-orange-300">
                          점수 {comboState.multiplier}×
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 학습 보상 패널 */}
                <div className="mx-auto max-w-3xl rounded-xl border-2 border-slate-700 bg-slate-900 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-200">
                    <Award size={16} /> 이번 뽑기 예상 보상
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800 p-3">
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                        <Clock size={12} /> 정답 속도
                      </div>
                      <div className="text-base font-black text-cyan-200">{getAnswerSpeedLabel(speedGrade)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-800 p-3">
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                        <Zap size={12} /> 뽑기 전력
                      </div>
                      <div className={`text-base font-black ${pendingPull ? 'text-green-300' : 'text-slate-500'}`}>
                        {pendingPull ? '준비됨 ✓' : '없음'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-800 p-3">
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                        <Star size={12} /> 다음 랭크
                      </div>
                      <div className="text-base font-black text-amber-200">
                        {rankProgress.next === null ? '최고' : `${rankProgress.remaining}문제`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 컬렉션 */}
                {caughtDolls.length > 0 && (
                  <div className="mx-auto max-w-3xl rounded-xl border-2 border-slate-700 bg-slate-900 p-4">
                    <h3 className="mb-3 text-base font-bold text-slate-200">🧸 획득한 인형 ({caughtDolls.length}개)</h3>
                    <CollectionGrid dolls={caughtDolls} />
                  </div>
                )}
              </div>

              {/* 오른쪽: 순위 */}
              <aside className="space-y-4">
                <LeaderboardPanel players={players as Player[]} playerId={playerId} />

                {/* 기계 랭크 상세 */}
                <div className="rounded-xl border-2 border-slate-700 bg-slate-900 p-4 text-white">
                  <h3 className="mb-3 text-base font-bold text-slate-200">⚙️ 기계 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                      <span className="text-slate-400">현재 등급</span>
                      <span className="font-black text-cyan-200">Rank {machineRank} — {getMachineRankName(machineRank)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                      <span className="text-slate-400">정답 수</span>
                      <span className="font-black text-white">{correctAnswers}문제</span>
                    </div>
                    {rankProgress.next !== null && (
                      <div className="rounded-lg bg-slate-800 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-slate-400">다음 등급까지</span>
                          <span className="font-bold text-amber-300">{rankProgress.remaining}문제</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                          <motion.div
                            className="h-full rounded-full bg-amber-400"
                            animate={{ width: `${rankProgress.progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 leading-relaxed">
                      💡 등급이 높을수록 희귀 인형이 더 많이 나와요. 빠르게 정답을 맞추면 점수 보너스!
                    </p>
                  </div>
                </div>
              </aside>
            </div>
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
                    ? '🎯 조준 중! SPACE 또는 내리기 버튼을 누르세요'
                    : fishingState === 'down'
                    ? '⬇️ 집게가 내려갑니다...'
                    : fishingState === 'grab'
                    ? '✊ 잡았다!'
                    : fishingState === 'up'
                    ? '⬆️ 끌어올리는 중...'
                    : fishingState === 'return'
                    ? '🏠 기계로 복귀 중...'
                    : fishingState === 'release'
                    ? '🎉 획득!'
                    : '대기 중...'
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
                <div className="rounded-xl border-2 border-slate-700 bg-slate-900 p-4 text-white">
                  <h3 className="mb-3 text-sm font-bold text-slate-300">🎯 조준 가이드</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 rounded-lg bg-yellow-500/15 px-3 py-2">
                      <span className="text-yellow-400 font-black">PERFECT</span>
                      <span className="text-slate-300 text-xs">정중앙 → 전설 확률 ↑↑</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-purple-500/15 px-3 py-2">
                      <span className="text-purple-300 font-black">GREAT</span>
                      <span className="text-slate-300 text-xs">좋은 조준 → 영웅 확률 ↑</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-sky-500/15 px-3 py-2">
                      <span className="text-sky-300 font-black">GOOD</span>
                      <span className="text-slate-300 text-xs">안정 조준 → 희귀 확률 ↑</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2">
                      <span className="text-green-400 font-black">SAFE</span>
                      <span className="text-slate-300 text-xs">아슬아슬 → 일반 인형</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    💡 Rank {machineRank}에서는 집게가 {machineRank >= 4 ? '빠르게' : machineRank >= 3 ? '적당히' : '천천히'} 움직여요!
                  </p>
                </div>

                {/* 콤보 상태 */}
                {consecutiveCorrect >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border-2 border-orange-500 bg-orange-500/15 p-4 text-center"
                  >
                    <div className="mb-1 flex items-center justify-center gap-2 text-orange-300">
                      <Flame size={16} /> <span className="text-sm font-bold">콤보 보너스</span>
                    </div>
                    <div className="text-3xl font-black text-orange-200">{consecutiveCorrect}연속</div>
                    <div className="text-sm font-bold text-orange-300">점수 {comboState.multiplier}×</div>
                  </motion.div>
                )}

                {/* 기계 정보 */}
                <div className="rounded-xl border-2 border-slate-700 bg-slate-900 p-4 text-white">
                  <div className="mb-2 text-sm font-bold text-slate-300">⚙️ 기계 등급</div>
                  <div className="text-base font-black text-cyan-200">{getMachineRankName(machineRank)}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${rankProgress.progress}%` }} />
                  </div>
                  {rankProgress.next !== null && (
                    <p className="mt-1.5 text-xs text-slate-500">{rankProgress.remaining}문제 더 맞추면 업그레이드!</p>
                  )}
                </div>

                <LeaderboardPanel players={players as Player[]} playerId={playerId} />
              </aside>
            </div>
          )}

          {/* 오답 뷰 */}
          {currentView === 'wrong' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border-4 border-red-500 bg-slate-900 p-10 text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="mb-4 text-7xl"
              >
                ❌
              </motion.div>
              <h2 className="mb-2 text-4xl font-black text-white">틀렸습니다!</h2>
              <p className="text-xl text-slate-300">콤보가 끊겼어요. 다음 문제에서 다시 도전!</p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={handleItemModalClose}
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-full max-w-sm rounded-2xl border-4 border-purple-300 bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 p-8 text-center shadow-2xl shadow-purple-500/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`mb-4 inline-block rounded-full px-3 py-1 text-sm font-bold ${
                pendingItem.rarity === '전설' ? 'bg-yellow-400 text-yellow-950'
                  : pendingItem.rarity === '희귀' ? 'bg-blue-500 text-white'
                  : 'bg-slate-500 text-white'
              }`}>
                {pendingItem.rarity} 보너스 획득!
              </div>
              <motion.div
                animate={{ y: [0, -10, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="mb-4 text-8xl"
              >
                {pendingItem.emoji}
              </motion.div>
              <h2 className="mb-2 text-3xl font-black text-white">{pendingItem.name}</h2>
              <p className="mb-6 text-base text-purple-100">{pendingItem.description}</p>
              <button
                type="button"
                onClick={handleItemModalClose}
                className="w-full rounded-xl border-2 border-white/30 bg-pink-500 py-4 text-xl font-black text-white shadow-xl hover:bg-pink-400 active:scale-95 transition-transform"
              >
                좋아! 뽑으러 가자
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
    </main>
  )
}
