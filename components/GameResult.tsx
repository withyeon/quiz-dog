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

type Player = Database['public']['Tables']['players']['Row']

interface GameResultProps {
  players: Player[]
  currentPlayerId: string | null
  onRestart?: () => void
  onExit?: () => void
  gameMode?: 'gold_quest' | 'racing' | 'battle_royale' | 'fishing' | 'factory'
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

export default function GameResult({
  players,
  currentPlayerId,
  onRestart,
  onExit,
  gameMode = 'gold_quest',
}: GameResultProps) {
  // Battle Royale 모드일 경우 체력 기반 정렬, 그 외에는 점수 기반
  const sortedPlayers = gameMode === 'battle_royale'
    ? [...players].sort((a, b) => {
        const healthA = (a as any).health || 0
        const healthB = (b as any).health || 0
        return healthB - healthA // 체력 높은 순
      })
    : [...players].sort((a, b) => b.score - a.score)
  const top3 = sortedPlayers.slice(0, 3)
  const currentPlayer = players.find((p) => p.id === currentPlayerId)
  const currentPlayerRank = sortedPlayers.findIndex((p) => p.id === currentPlayerId) + 1

  // 점수 분포 데이터
  const scoreDistribution = [
    { range: '0-100', count: players.filter((p) => p.score >= 0 && p.score <= 100).length },
    { range: '101-200', count: players.filter((p) => p.score > 100 && p.score <= 200).length },
    { range: '201-300', count: players.filter((p) => p.score > 200 && p.score <= 300).length },
    { range: '300+', count: players.filter((p) => p.score > 300).length },
  ]

  // Gold 분포 데이터
  const goldData = sortedPlayers.slice(0, 5).map((p) => ({
    name: p.nickname,
    gold: p.gold,
  }))

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative overflow-hidden">
      <AnimatedBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.h1
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl font-bold text-gray-900 mb-2"
          >
            {gameMode === 'battle_royale' ? '⚔️ 배틀 종료!' : '게임 종료!'}
          </motion.h1>
          <p className="text-xl text-gray-700 font-semibold">
            {gameMode === 'battle_royale' ? '최종 생존자를 확인하세요' : '최종 결과를 확인하세요'}
          </p>
        </motion.div>

        {/* Top 3 */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {top3.map((player, index) => {
            const rank = index + 1
            const isCurrentPlayer = player.id === currentPlayerId
            const icons = [Trophy, Medal, Award]
            const Icon = icons[index]
            const colors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`h-full relative overflow-hidden ${
                    isCurrentPlayer
                      ? 'ring-4 ring-primary-500 shadow-xl scale-105 glow-box'
                      : 'hover:shadow-lg'
                  }`}
                >
                  {isCurrentPlayer && (
                    <div className="absolute inset-0 shimmer pointer-events-none" />
                  )}
                  <CardHeader className="text-center">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                      className="flex justify-center mb-4"
                    >
                      <Icon className={`h-20 w-20 ${colors[index]} drop-shadow-lg`} />
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-5xl font-bold text-gray-900 mb-2"
                    >
                      #{rank}
                    </motion.div>
                    <CardTitle className="text-2xl font-bold">{player.nickname}</CardTitle>
                    {isCurrentPlayer && (
                      <span className="inline-block mt-2 text-sm bg-primary-100 text-primary-800 px-3 py-1 rounded-full">
                        나
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="text-center">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="space-y-2"
                    >
                      {gameMode === 'battle_royale' ? (
                        <>
                          <div className="text-4xl font-bold text-gray-900">
                            {(player as any).health || 0} HP
                          </div>
                          {rank === 1 && (
                            <div className="text-xl text-red-600 font-bold">🏆 승리!</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-bold text-gray-900">
                            {player.score}점
                          </div>
                          <div className="text-xl text-yellow-600 font-bold flex items-center gap-1.5">
                            {gameMode === 'gold_quest' ? (
                              <Image src="/gold-quest/gold-stack.svg" alt="골드" width={24} height={24} className="w-6 h-6" />
                            ) : (
                              <span>💰</span>
                            )}
                            {player.gold} Gold
                          </div>
                        </>
                      )}
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
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
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isCurrentPlayer
                          ? 'bg-primary-50 border-2 border-primary-500'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-center font-bold text-gray-600">
                          #{index + 1}
                        </div>
                        <span className="text-2xl">{player.avatar || '🎮'}</span>
                        <div>
                          <div className="font-semibold text-gray-800">{player.nickname}</div>
                          <div className="text-sm text-gray-500">
                            {player.is_online ? '🟢' : '🔴'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {gameMode === 'battle_royale' ? (
                          <div className="font-bold text-gray-800">{(player as any).health || 0} HP</div>
                        ) : (
                          <>
                            <div className="font-bold text-gray-800">{player.score}점</div>
                            <div className="text-sm text-yellow-600 flex items-center gap-1">
                              {gameMode === 'gold_quest' ? (
                                <Image src="/gold-quest/gold-stack.svg" alt="골드" width={16} height={16} className="w-4 h-4" />
                              ) : (
                                <span>💰</span>
                              )}
                              {player.gold}
                            </div>
                          </>
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
                    <div className="text-sm text-gray-600 mb-1">내 점수</div>
                    <div className="text-3xl font-bold text-purple-600">
                      {currentPlayer?.score || 0}점
                    </div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">내 Gold</div>
                    <div className="text-3xl font-bold text-yellow-600 flex items-center gap-2">
                      {gameMode === 'gold_quest' ? (
                        <Image src="/gold-quest/gold-stack.svg" alt="골드" width={28} height={28} className="w-7 h-7" />
                      ) : (
                        <span>💰</span>
                      )}
                      {currentPlayer?.gold || 0}
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

        {/* Gold Top 5 차트 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Gold Top 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={goldData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="gold" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
