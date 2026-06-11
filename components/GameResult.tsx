'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Trophy, Medal, Award, BarChart3, Target, Clock } from 'lucide-react'
import AnimatedBackground from './AnimatedBackground'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { Database } from '@/types/database.types'
import type { GameModeId } from '@/lib/game/modes'
import { displayBlankText } from '@/lib/quiz/blankText'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { checkWinningTeam, TEAM_INFO, type Team } from '@/lib/game/battleRoyale'
import { getScoreDisplay, getScoreDisplayLabel } from '@/lib/game/scoreDisplay'

type Player = Database['public']['Tables']['players']['Row']

interface AnswerRecord {
  questionIndex: number
  isCorrect: boolean
}

interface QuestionInfo {
  id: string
  question_text: string
  answer: string
}

interface GameResultProps {
  players: Player[]
  currentPlayerId: string | null
  onRestart?: () => void
  onExit?: () => void
  gameMode?: GameModeId
  answerHistory?: AnswerRecord[]
  questions?: QuestionInfo[]
  /**
   * 'student'(기본): 본인 결과만 표시. Top3 공개·전체 순위·학급 오답 분석 등 집계 정보는 숨김.
   * 'teacher': 교사 통제 화면 전용. Top3·전체 순위·차트 등 전체 결과 표시.
   * 초등 교실 운영 원칙상 학생 화면은 본인 결과 중심으로 제한하고, 집계/공개는 선생님 화면에서만 한다.
   */
  audience?: 'student' | 'teacher'
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

export default function GameResult({
  players,
  currentPlayerId,
  onRestart,
  onExit,
  gameMode = 'gold_quest',
  answerHistory = [],
  questions = [],
  audience = 'student',
}: GameResultProps) {
  const showFullResults = audience === 'teacher'
  // Battle Royale 모드일 경우 체력 기반 정렬, 그 외에는 점수 기반
  const sortedPlayers = gameMode === 'battle_royale'
    ? [...players].sort((a, b) => {
      const healthA = (a as any).health || 0
      const healthB = (b as any).health || 0
      return healthB - healthA // 체력 높은 순
    })
    : gameMode === 'gold_quest'
      ? [...players].sort((a, b) =>
        ((b.gold ?? 0) - (a.gold ?? 0)) || ((b.score ?? 0) - (a.score ?? 0))
      )
      : [...players].sort((a, b) => b.score - a.score)
  const isGoldQuest = gameMode === 'gold_quest'
  const isDontLookDown = gameMode === 'dontlookdown'
  const top3 = sortedPlayers.slice(0, 3)
  const currentPlayer = players.find((p) => p.id === currentPlayerId)
  const currentPlayerRank = sortedPlayers.findIndex((p) => p.id === currentPlayerId) + 1

  // 배틀로얄 팀전 승리 팀
  const winningTeam: Team | null =
    gameMode === 'battle_royale' ? checkWinningTeam(players as any[]) : null
  const winningTeamRoster = winningTeam
    ? players.filter((p) => (p as any).team === winningTeam)
    : []
  const myTeamIsWinner =
    winningTeam !== null && (currentPlayer as any)?.team === winningTeam

  // 양 팀 동시 전멸 무승부 (폭설 등으로 모두 0°)
  const isTeamBattle =
    gameMode === 'battle_royale' &&
    players.some((p) => (p as any).team === 'red' || (p as any).team === 'blue')
  const battleAliveCount =
    gameMode === 'battle_royale'
      ? players.filter((p) => ((p as any).health ?? 100) > 0).length
      : 0
  const isBattleDraw = isTeamBattle && winningTeam === null && battleAliveCount === 0

  // 점수 분포 데이터
  const scoreDistribution = [
    { range: '0-100', count: players.filter((p) => p.score >= 0 && p.score <= 100).length },
    { range: '101-200', count: players.filter((p) => p.score > 100 && p.score <= 200).length },
    { range: '201-300', count: players.filter((p) => p.score > 200 && p.score <= 300).length },
    { range: '300+', count: players.filter((p) => p.score > 300).length },
  ]

  // 게임별 Top 5 데이터
  const rankChartData = sortedPlayers.slice(0, 5).map((p) => ({
    name: p.nickname,
    value: getScoreDisplay(p, gameMode).value,
  }))
  const rankChartLabel = `${getScoreDisplayLabel(gameMode)} Top 5`

  // 내 퀴즈 결과 통계
  const totalAnswered = answerHistory.length
  const correctCount = answerHistory.filter((a) => a.isCorrect).length
  const wrongCount = totalAnswered - correctCount
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0

  return (
    <div className={`min-h-dvh p-4 sm:p-8 relative overflow-hidden ${isGoldQuest ? 'gold-quest-ambient' : 'bg-gray-50'}`}>
      {!isGoldQuest && <AnimatedBackground />}
      <div className="max-w-6xl mx-auto relative z-10">
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center mb-8 ${isGoldQuest ? 'text-white' : ''}`}
        >
          <motion.h1
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`gold-quest-title text-4xl sm:text-6xl font-black mb-2 ${isGoldQuest ? 'text-white' : 'text-gray-900'}`}
          >
            {gameMode === 'battle_royale' ? '⚔️ 배틀 종료!' : '게임 종료!'}
          </motion.h1>
          <p className={`text-xl font-semibold ${isGoldQuest ? 'text-amber-100' : 'text-gray-700'}`}>
            {gameMode === 'battle_royale' ? '최종 생존자를 확인하세요' : '최종 결과를 확인하세요'}
          </p>
        </motion.div>

        {/* 학생 화면: 본인 결과 요약만 (Top3 공개·전체 순위는 선생님 화면 전용) */}
        {!showFullResults && currentPlayer && (
          <div className={`mb-8 rounded-2xl border p-6 text-center shadow-sm ${isGoldQuest ? 'border-amber-200/70 bg-white/85 text-[#17262a]' : 'border-sky-200 bg-white text-slate-900'}`}>
            <div className="text-sm font-black text-slate-500">내 결과</div>
            <div className="mt-2 text-4xl font-black">
              {currentPlayerRank}등 · {getScoreDisplay(currentPlayer ?? {}, gameMode).text}
            </div>
            <p className="mt-3 text-sm font-bold text-slate-500">전체 순위와 다른 친구들의 결과는 선생님 화면에서 함께 확인해요.</p>
          </div>
        )}

        {/* 아래 집계·공개 결과(승리 명단·Top3·전체 순위·차트)는 교사 통제 화면에서만 표시 */}
        {showFullResults && (<>
        {/* 팀전 승리 배너 */}
        {winningTeam && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className={`mb-8 overflow-hidden rounded-2xl border-4 p-6 text-center shadow-xl ${
              winningTeam === 'red'
                ? 'border-rose-300 bg-gradient-to-br from-rose-500 to-rose-600'
                : 'border-sky-300 bg-gradient-to-br from-sky-500 to-sky-600'
            }`}
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0], y: [0, -6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="mb-3 text-6xl sm:text-7xl"
            >
              {TEAM_INFO[winningTeam].emoji}
            </motion.div>
            <h2 className="mb-2 text-3xl font-black text-white sm:text-4xl">
              {TEAM_INFO[winningTeam].name} 승리!
            </h2>
            {myTeamIsWinner && (
              <p className="mb-3 text-lg font-black text-amber-100">🎉 우리팀이 이겼어요!</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {winningTeamRoster.map((p) => (
                <span
                  key={p.id}
                  className={`rounded-full px-3 py-1.5 text-sm font-black ${
                    p.id === currentPlayerId
                      ? 'bg-amber-300 text-amber-950 ring-2 ring-white'
                      : 'bg-white/25 text-white'
                  }`}
                >
                  {p.nickname}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* 무승부 배너 — 양 팀 동시 전멸 */}
        {isBattleDraw && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="mb-8 overflow-hidden rounded-2xl border-4 border-slate-300 bg-gradient-to-br from-slate-500 to-slate-600 p-6 text-center shadow-xl"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="mb-3 text-6xl sm:text-7xl"
            >
              ⛄
            </motion.div>
            <h2 className="mb-2 text-3xl font-black text-white sm:text-4xl">무승부!</h2>
            <p className="text-lg font-black text-slate-100">양 팀 모두 폭설에 얼어붙었어요</p>
          </motion.div>
        )}

        {/* Top 3 Podium */}
        <div
          className="relative mb-10 overflow-hidden rounded-3xl"
          style={{ background: 'linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #1a1040 100%)', padding: '2rem 1rem 0' }}
        >
          {/* 별 파티클 */}
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white pointer-events-none"
              style={{
                width: i % 4 === 0 ? 3 : 2,
                height: i % 4 === 0 ? 3 : 2,
                top: `${(i * 41) % 85}%`,
                left: `${(i * 59) % 100}%`,
              }}
              animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.6, 1] }}
              transition={{ duration: 1.8 + (i % 4) * 0.5, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}

          <div className="relative z-10 text-center mb-6">
            <motion.p
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-black tracking-widest text-amber-300 mb-1"
              style={{ fontFamily: "'DNFBitBitv2', sans-serif", letterSpacing: '0.2em', textShadow: '-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9)' }}
            >
              FINAL RANKING
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', bounce: 0.4 }}
              className="text-3xl sm:text-4xl font-black text-white"
              style={{ fontFamily: "'DNFBitBitv2', sans-serif", textShadow: '-2px -2px 0 rgba(0,0,0,0.9), 2px -2px 0 rgba(0,0,0,0.9), -2px 2px 0 rgba(0,0,0,0.9), 2px 2px 0 rgba(0,0,0,0.9), 0 0 30px rgba(255,215,0,0.6)' }}
            >
              🏆 최종 순위
            </motion.h2>
          </div>

          {/* 시상대: 2등 - 1등 - 3등 순서 */}
          <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-4">
            {([top3[1], top3[0], top3[2]] as (Player | undefined)[]).map((player, displayIdx) => {
              if (!player) return <div key={displayIdx} className="flex-1 max-w-[110px]" />
              const rank = ([2, 1, 3] as const)[displayIdx]
              const isFirst = rank === 1
              const isCurrentPlayer = player.id === currentPlayerId
              const scoreDisplay = getScoreDisplay(player, gameMode)

              const podiumH = isFirst ? 180 : rank === 2 ? 130 : 100
              const podiumGrad = isFirst
                ? 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)'
                : rank === 2
                  ? 'linear-gradient(180deg, #D4D4D4 0%, #808080 100%)'
                  : 'linear-gradient(180deg, #CD7F32 0%, #8B4513 100%)'
              const glowColor = isFirst ? 'rgba(255,215,0,0.5)' : rank === 2 ? 'rgba(200,200,200,0.3)' : 'rgba(205,127,50,0.3)'
              const medalEmoji = isFirst ? '🥇' : rank === 2 ? '🥈' : '🥉'
              const avatarSize = isFirst ? 88 : 68
              const entryDelay = [0.35, 0.15, 0.55][displayIdx]

              return (
                <motion.div
                  key={player.id}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 80 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: entryDelay, type: 'spring', bounce: 0.35, duration: 0.7 }}
                  style={{ zIndex: isFirst ? 10 : 5, minWidth: isFirst ? 110 : 90 }}
                >
                  {/* 왕관 (1등만) */}
                  {isFirst && (
                    <motion.div
                      animate={{ y: [0, -6, 0], rotate: [-5, 5, -5] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                      className="text-4xl mb-1 select-none"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.8))' }}
                    >
                      👑
                    </motion.div>
                  )}

                  {/* 아바타 */}
                  <div className="relative mb-1">
                    <motion.div
                      animate={isFirst ? { scale: [1, 1.06, 1] } : {}}
                      transition={{ duration: 2.4, repeat: Infinity }}
                      className="overflow-hidden"
                      style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: 14,
                        border: `3px solid ${isFirst ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'}`,
                        boxShadow: `0 0 ${isFirst ? 20 : 10}px ${glowColor}, 0 4px 12px rgba(0,0,0,0.5)`,
                      }}
                    >
                      <PlayerAvatarDisplay
                        avatar={player.avatar}
                        nickname={player.nickname}
                        fallback="🐶"
                        className="w-full h-full object-contain bg-white"
                        sizes={`${avatarSize}px`}
                      />
                    </motion.div>
                    {isCurrentPlayer && (
                      <div
                        className="absolute -top-2 -right-2 rounded-full font-black text-white flex items-center justify-center"
                        style={{ background: '#6366f1', width: 22, height: 22, fontSize: 10, fontFamily: "'DNFBitBitv2', sans-serif", boxShadow: '0 2px 6px rgba(99,102,241,0.6)' }}
                      >
                        나
                      </div>
                    )}
                  </div>

                  {/* 닉네임 + 점수 */}
                  <div className="text-center mb-2 px-1">
                    <div
                      className="font-black text-white truncate"
                      style={{
                        fontFamily: "'DNFBitBitv2', sans-serif",
                        fontSize: isFirst ? '0.95rem' : '0.8rem',
                        maxWidth: isFirst ? 110 : 90,
                        textShadow: '-1.5px -1.5px 0 rgba(0,0,0,0.9), 1.5px -1.5px 0 rgba(0,0,0,0.9), -1.5px 1.5px 0 rgba(0,0,0,0.9), 1.5px 1.5px 0 rgba(0,0,0,0.9)',
                      }}
                    >
                      {player.nickname}
                    </div>
                    <div
                      className="font-black"
                      style={{
                        fontFamily: "'DNFBitBitv2', sans-serif",
                        fontSize: isFirst ? '1rem' : '0.82rem',
                        color: isFirst ? '#FFD700' : rank === 2 ? '#D4D4D4' : '#CD7F32',
                        textShadow: `-1.5px -1.5px 0 rgba(0,0,0,0.9), 1.5px -1.5px 0 rgba(0,0,0,0.9), -1.5px 1.5px 0 rgba(0,0,0,0.9), 1.5px 1.5px 0 rgba(0,0,0,0.9), 0 0 12px ${glowColor}`,
                      }}
                    >
                      {gameMode === 'battle_royale'
                        ? `${(player as any).health || 0} HP`
                        : isDontLookDown
                          ? `${player.score}m`
                          : scoreDisplay.text}
                    </div>
                  </div>

                  {/* 시상대 블록 */}
                  <motion.div
                    className="w-full flex flex-col items-center justify-start pt-3 font-black"
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: entryDelay + 0.1, duration: 0.5, ease: 'easeOut' }}
                    style={{
                      height: podiumH,
                      minWidth: isFirst ? 110 : 90,
                      background: podiumGrad,
                      borderRadius: '10px 10px 0 0',
                      boxShadow: `0 -6px 24px ${glowColor}, inset 0 2px 0 rgba(255,255,255,0.3)`,
                    }}
                  >
                    <span className="text-2xl sm:text-3xl select-none" style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.4))` }}>
                      {medalEmoji}
                    </span>
                    <span
                      className="text-white font-black opacity-80 mt-1"
                      style={{ fontFamily: "'DNFBitBitv2', sans-serif", fontSize: isFirst ? '1.1rem' : '0.9rem', textShadow: '-1px -1px 0 rgba(0,0,0,0.8), 1px -1px 0 rgba(0,0,0,0.8), -1px 1px 0 rgba(0,0,0,0.8), 1px 1px 0 rgba(0,0,0,0.8)' }}
                    >
                      {rank}위
                    </span>
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 전체 순위 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                전체 순위
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedPlayers.map((player, index) => {
                  const isCurrentPlayer = player.id === currentPlayerId
                  const scoreDisplay = getScoreDisplay(player, gameMode)
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-3 rounded-lg ${isCurrentPlayer
                        ? 'bg-primary-50 border-2 border-primary-500'
                        : 'bg-gray-50 border border-gray-200'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-center font-bold text-gray-600">
                          #{index + 1}
                        </div>
                        <PlayerAvatarDisplay
                          avatar={player.avatar}
                          nickname={player.nickname}
                          fallback="🎮"
                          className="relative h-9 w-9 overflow-hidden rounded-lg bg-white text-2xl ring-1 ring-gray-200"
                          sizes="36px"
                        />
                        <div>
                          <div className="font-semibold text-gray-800">{player.nickname}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {gameMode === 'battle_royale' ? (
                          <div className="font-bold text-gray-800">{(player as any).health || 0} HP</div>
                        ) : isDontLookDown ? (
                          <>
                            <div className="font-bold text-gray-800">{player.score}m</div>
                            <div className="text-sm text-yellow-600 flex items-center gap-1">
                              <span>⚡</span>
                              {player.gold.toLocaleString()} 에너지
                            </div>
                          </>
                        ) : (
                          <div className="font-bold text-gray-800">
                            {scoreDisplay.text}
                            {scoreDisplay.icon && (
                              <Image src={scoreDisplay.icon} alt="" width={16} height={16} className="ml-1 inline-block h-4 w-4 object-contain align-middle" />
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                게임 통계
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">총 참가자</div>
                    <div className="text-3xl font-bold text-blue-600">{players.length}명</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">내 순위</div>
                    <div className="text-3xl font-bold text-green-600">
                      {currentPlayerRank}/{players.length}
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">내 {getScoreDisplayLabel(gameMode)}</div>
                    <div className="text-3xl font-bold text-purple-600">
                      {getScoreDisplay(currentPlayer ?? {}, gameMode).text}
                    </div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">{isDontLookDown ? '내 에너지' : '정답 보상'}</div>
                    <div className="text-3xl font-bold text-yellow-600 flex items-center gap-2">
                      {isDontLookDown ? (
                        <>
                          <span>⚡</span>
                          {(currentPlayer?.gold || 0).toLocaleString()}
                          <span className="text-lg">에너지</span>
                        </>
                      ) : (
                        <span className="text-lg">게임별 점수에 반영됨</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 점수 분포 차트 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">점수 분포</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </>)}

        {/* 내 퀴즈 결과 (답안 기록이 있을 때만 표시) — 본인 결과라 학생도 표시 */}
        {totalAnswered > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                내 퀴즈 결과
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">✅ 맞은 문제</div>
                  <div className="text-3xl font-bold text-green-600">{correctCount}개</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">❌ 틀린 문제</div>
                  <div className="text-3xl font-bold text-red-600">{wrongCount}개</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">정답률</div>
                  <div className="text-3xl font-bold text-blue-600">{accuracy}%</div>
                </div>
              </div>

              {/* 문제별 정답/오답 목록 */}
              {questions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">문제별 결과</h3>
                  {answerHistory.map((record, idx) => {
                    const q = questions[record.questionIndex]
                    if (!q) return null
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${record.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                          }`}
                      >
                        <span className="text-lg">{record.isCorrect ? '✅' : '❌'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {record.questionIndex + 1}. {displayBlankText(q.question_text)}
                          </div>
                          {!record.isCorrect && (
                            <div className="text-xs text-gray-500 mt-1">
                              정답: {q.answer}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 게임별 Top 5 차트 (교사 화면 전용) */}
        {showFullResults && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {rankChartLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rankChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}

        {/* 액션 버튼 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-4 justify-center"
        >
          {onRestart && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" onClick={onRestart} className="glow-box">
                다시 하기
              </Button>
            </motion.div>
          )}
          {onExit && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" onClick={onExit}>
                나가기
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
