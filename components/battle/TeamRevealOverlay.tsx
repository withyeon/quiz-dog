'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TEAM_INFO, type Team } from '@/lib/game/battleRoyale'

interface PlayerSeed {
  id: string
  nickname: string
  team: Team
}

interface TeamRevealOverlayProps {
  players: PlayerSeed[]
  currentPlayerId: string | null
  onComplete: () => void
}

type Phase = 'shuffle' | 'flipping' | 'showdown' | 'done'

const SHUFFLE_MS = 1800
const FLIP_INTERVAL_MS = 220
const SHOWDOWN_MS = 2200

export default function TeamRevealOverlay({
  players,
  currentPlayerId,
  onComplete,
}: TeamRevealOverlayProps) {
  const [phase, setPhase] = useState<Phase>('shuffle')
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (phase !== 'shuffle') return
    const timer = setTimeout(() => setPhase('flipping'), SHUFFLE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'flipping') return
    let i = 0
    const interval = setInterval(() => {
      const player = players[i]
      if (!player) {
        clearInterval(interval)
        setPhase('showdown')
        return
      }
      setRevealedIds((prev) => {
        const next = new Set(prev)
        next.add(player.id)
        return next
      })
      i += 1
    }, FLIP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [phase, players])

  useEffect(() => {
    if (phase !== 'showdown') return
    const timer = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, SHOWDOWN_MS)
    return () => clearTimeout(timer)
  }, [phase, onComplete])

  if (phase === 'done') return null

  const redTeam = players.filter((p) => p.team === 'red')
  const blueTeam = players.filter((p) => p.team === 'blue')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white"
    >
      <AnimatePresence mode="wait">
        {phase === 'shuffle' && (
          <motion.div
            key="shuffle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 0.45, repeat: Infinity }}
              className="mb-6 text-7xl"
            >
              🎲
            </motion.div>
            <h2 className="mb-2 text-4xl font-black sm:text-5xl">팀 배정 중...</h2>
            <p className="text-base font-bold text-slate-300 sm:text-lg">
              두근두근, 어느 팀일까?
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 px-4">
              {players.map((p, idx) => (
                <motion.div
                  key={p.id}
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, -3, 3, 0],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: (idx % 6) * 0.06,
                  }}
                  className="flex h-20 w-16 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10 text-2xl backdrop-blur"
                >
                  ?
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {(phase === 'flipping' || phase === 'showdown') && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex w-full max-w-6xl flex-col items-center px-5"
          >
            <motion.h2
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 text-3xl font-black sm:text-5xl"
            >
              {phase === 'showdown' ? '⚔️ 결투 준비!' : '팀 공개!'}
            </motion.h2>

            <div className="grid w-full gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6">
              <TeamColumn
                team="red"
                players={redTeam}
                revealedIds={revealedIds}
                currentPlayerId={currentPlayerId}
              />

              <motion.div
                initial={{ scale: 0 }}
                animate={{
                  scale: phase === 'showdown' ? [1, 1.4, 1] : 1,
                  rotate: phase === 'showdown' ? [0, -10, 10, 0] : 0,
                }}
                transition={{ duration: 0.6 }}
                className="my-2 text-center text-5xl font-black text-amber-300 sm:my-0 sm:text-6xl"
              >
                VS
              </motion.div>

              <TeamColumn
                team="blue"
                players={blueTeam}
                revealedIds={revealedIds}
                currentPlayerId={currentPlayerId}
              />
            </div>

            {phase === 'showdown' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 text-center"
              >
                <p className="text-lg font-black text-amber-200 sm:text-xl">
                  잠시 후 전투가 시작됩니다!
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TeamColumn({
  team,
  players,
  revealedIds,
  currentPlayerId,
}: {
  team: Team
  players: PlayerSeed[]
  revealedIds: Set<string>
  currentPlayerId: string | null
}) {
  const info = TEAM_INFO[team]
  const isRed = team === 'red'
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border-2 p-4 sm:p-5 ${
        isRed
          ? 'border-rose-300/50 bg-rose-500/10'
          : 'border-sky-300/50 bg-sky-500/10'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-4xl">{info.emoji}</span>
        <span
          className={`text-2xl font-black sm:text-3xl ${
            isRed ? 'text-rose-200' : 'text-sky-200'
          }`}
        >
          {info.name}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {players.map((p) => {
          const revealed = revealedIds.has(p.id)
          const isMe = p.id === currentPlayerId
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                opacity: 1,
                scale: revealed ? 1 : 0.95,
                rotateY: revealed ? 0 : 180,
              }}
              transition={{ duration: 0.4, type: 'spring' }}
              className={`flex min-h-[64px] min-w-[90px] flex-col items-center justify-center rounded-lg border-2 px-3 py-2 text-center text-sm font-black transition-colors ${
                revealed
                  ? isRed
                    ? 'border-rose-300 bg-rose-500/40 text-white'
                    : 'border-sky-300 bg-sky-500/40 text-white'
                  : 'border-white/30 bg-white/10 text-white/60'
              } ${isMe ? 'ring-2 ring-amber-300' : ''}`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {revealed ? (
                <>
                  <span className="text-xl">{info.emoji}</span>
                  <span className="mt-0.5 max-w-[90px] truncate">
                    {p.nickname}
                    {isMe && ' (나)'}
                  </span>
                </>
              ) : (
                <span className="text-2xl">?</span>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
