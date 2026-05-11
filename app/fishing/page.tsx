'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, Clock, Coins, Gamepad2, Gift, PackageCheck, Settings, ShieldCheck, Star, Target, Ticket, Trophy, XCircle, Zap } from 'lucide-react'
import QuizView from '@/components/QuizView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import FishingMachine from '@/components/FishingMachine'
import { useGameBase } from '@/hooks/useGameBase'
import { useFishingGame } from '@/hooks/useFishingGame'
import {
  getAimGradeLabel,
  getAnswerSpeedGrade,
  getAnswerSpeedLabel,
  getMachineRankName,
  getMachineRankProgress,
  type Doll,
  type SpecialItemType,
} from '@/lib/game/fishing'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  caught_dolls?: Doll[]
  claw_points?: number
}

const ITEM_LABELS: Record<SpecialItemType, string> = {
  DOUBLE_SCORE: '2배 점수',
  LUCKY_BOOST: '행운 부스트',
  COIN_RAIN: '보너스 코인',
  EXTRA_PULL: '복습 티켓',
  SHIELD: '꽝 방지',
}

const COLLECTION_TIER_STYLE: Record<string, string> = {
  일반: 'border-slate-200 bg-white',
  희귀: 'border-sky-200 bg-sky-50',
  영웅: 'border-violet-200 bg-violet-50',
  전설: 'border-amber-200 bg-amber-50',
  꽝: 'border-slate-200 bg-slate-50',
}

function getPlayerDolls(player: Player) {
  return Array.isArray(player.caught_dolls) ? (player.caught_dolls as Doll[]) : []
}

function SpecialItemIcon({ type, size = 14, className = '' }: { type: SpecialItemType; size?: number; className?: string }) {
  if (type === 'DOUBLE_SCORE') return <Zap size={size} className={className} />
  if (type === 'LUCKY_BOOST') return <Star size={size} className={className} />
  if (type === 'COIN_RAIN') return <Coins size={size} className={className} />
  if (type === 'EXTRA_PULL') return <Ticket size={size} className={className} />
  if (type === 'SHIELD') return <ShieldCheck size={size} className={className} />
  return <Gift size={size} className={className} />
}

function CollectionGrid({ dolls }: { dolls: Doll[] }) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
      {dolls.length === 0 ? (
        <div className="col-span-5 sm:col-span-7 lg:col-span-9 rounded-lg border border-dashed border-sky-200 bg-white/70 py-8 text-center text-sm text-slate-500">
          아직 획득한 인형이 없어요.
        </div>
      ) : (
        dolls.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            title={`${item.name} (+${item.score}점)`}
            className={`group relative flex aspect-square cursor-default items-center justify-center rounded-lg border ${COLLECTION_TIER_STYLE[item.tier] ?? COLLECTION_TIER_STYLE['일반']} shadow-sm`}
          >
            {item.image ? (
              <Image src={item.image} alt={item.name} width={36} height={36} unoptimized className="h-9 w-9 object-contain drop-shadow" />
            ) : (
              <Gift size={24} className="text-slate-400" />
            )}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-sky-100 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-xl group-hover:block">
              {item.name}
              <span className="block text-center text-amber-500">+{item.score}점</span>
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
    <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg shadow-slate-200/50">
      <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-800">
        <Trophy size={16} /> 순위
      </h3>
      <div className="space-y-2">
        {sorted.slice(0, 5).map((player, index) => {
          const typedPlayer = player as Player
          const isMe = player.id === playerId
          const pts = typedPlayer.claw_points || 0
          const dolls = getPlayerDolls(typedPlayer)
          const rankColors = ['text-amber-500', 'text-slate-500', 'text-orange-500']
          return (
            <div key={player.id} className={`rounded-lg border p-2.5 ${isMe ? 'border-amber-300 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white/80'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`w-6 text-sm font-black ${rankColors[index] ?? 'text-slate-400'}`}>#{index + 1}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-black text-slate-600">
                    {player.avatar || player.nickname?.slice(0, 1) || 'P'}
                  </span>
                  <span className="truncate text-sm font-bold text-slate-800">{player.nickname}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-black text-slate-900">{pts.toLocaleString()}점</div>
                  <div className="text-xs text-slate-500">{dolls.length}개</div>
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
    일반: '획득 완료',
    희귀: '희귀 인형',
    영웅: '영웅 인형',
    전설: '전설 인형',
  }

  const tierCardStyle: Record<string, string> = {
    일반: 'from-amber-100 via-white to-orange-100 border-amber-300',
    희귀: 'from-sky-100 via-white to-cyan-100 border-sky-300',
    영웅: 'from-violet-100 via-white to-fuchsia-100 border-violet-300',
    전설: 'from-yellow-100 via-white to-amber-200 border-yellow-300',
  }

  const cardStyle = tierCardStyle[doll.tier] ?? tierCardStyle['일반']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-sky-100/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -6, y: 40 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className={`relative w-full max-w-sm overflow-hidden rounded-xl border bg-gradient-to-b ${cardStyle} p-6 text-left shadow-xl shadow-slate-200/60`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 반짝이 효과 */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
          animate={{ x: ['-120%', '120%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />

        {/* 등급 레이블 */}
        <p className="mb-1 text-center text-sm font-extrabold text-slate-500">
          {tierLabel[doll.tier] ?? '획득 완료'}
        </p>

        {/* 인형 이름 */}
        <h2 className="mb-4 text-center text-2xl font-extrabold text-slate-900">{doll.name}</h2>

        {/* 인형 이미지 */}
        <div className="mb-5 flex justify-center">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-36 w-36 items-center justify-center rounded-xl border border-white bg-white/70 shadow-inner"
          >
            {doll.image ? (
              <Image src={doll.image} alt={doll.name} width={120} height={120} unoptimized className="h-28 w-28 object-contain drop-shadow-2xl" />
            ) : (
              <Gift size={76} className="text-slate-400" />
            )}
          </motion.div>
        </div>

        {/* 점수 분석 */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-white bg-white/70 px-2 py-3">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <Star size={10} /> 점수
            </div>
            <div className="text-xl font-black text-slate-900">{doll.score.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white bg-white/70 px-2 py-3">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <Clock size={10} /> 속도
            </div>
            <div className="text-sm font-black text-slate-900 leading-tight">
              {getAnswerSpeedLabel(fishingResult.speedGrade)}
            </div>
          </div>
          <div className="rounded-lg border border-white bg-white/70 px-2 py-3">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <Target size={10} /> 조준
            </div>
            <div className="text-sm font-black text-slate-900 leading-tight">
              {getAimGradeLabel(fishingResult.aimGrade)}
            </div>
          </div>
        </div>

        {/* 보너스 점수 */}
        {fishingResult.bonusPoints > 0 && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-100 px-3 py-2 text-center text-sm font-extrabold text-yellow-800">
            보너스 +{fishingResult.bonusPoints.toLocaleString()}점
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-lg bg-sky-500 py-3.5 text-center text-base font-extrabold text-white transition-transform hover:bg-sky-400 active:scale-95"
        >
          계속하기
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
      className={`relative min-h-screen overflow-hidden font-sans text-slate-900 transition-colors duration-700 ${isFrenzyEvent ? 'bg-[#fffaf2]' : 'bg-[#f8fbff]'}`}
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(240,249,255,0.92)_0%,rgba(255,255,255,0.98)_44%,rgba(248,250,252,1)_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-80 bg-[linear-gradient(135deg,rgba(224,242,254,0.78),rgba(255,255,255,0.68)_48%,rgba(254,249,195,0.42))]" />

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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg shadow-slate-200">
                  <Gamepad2 size={24} />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-extrabold tracking-normal text-slate-900 sm:text-3xl">두근두근 인형뽑기</h1>
                  <p className="text-xs font-bold text-slate-500">방 코드: {roomCode}</p>
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
                    {(currentPlayer as Player)?.nickname || '플레이어'}
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
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* 왼쪽: 퀴즈 + 컬렉션 */}
              <div className="space-y-4">
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  timeLimit={30}
                  onCorrectClick={handleOpenClaw}
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
                <LeaderboardPanel players={players as Player[]} playerId={playerId} />

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
                      <span className="text-yellow-700 font-black">PERFECT</span>
                      <span className="text-slate-600 text-xs">전설 확률 증가</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                      <span className="text-violet-700 font-black">GREAT</span>
                      <span className="text-slate-600 text-xs">영웅 확률 증가</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                      <span className="text-sky-700 font-black">GOOD</span>
                      <span className="text-slate-600 text-xs">희귀 확률 증가</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                      <span className="text-green-700 font-black">SAFE</span>
                      <span className="text-slate-600 text-xs">일반 인형 위주</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
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

                <LeaderboardPanel players={players as Player[]} playerId={playerId} />
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
    </main>
  )
}
