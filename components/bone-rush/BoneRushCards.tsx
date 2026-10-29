'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BONE_RUSH, CARD_INFO, describeCard, type Card } from '@/lib/game/boneRush'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

type BoneRushCardsProps = {
  cards: Card[]
  fences: number
  choosingTarget: boolean
  targets: Player[]
  onPick: (index: number) => void
  onSendCat: (playerId: string) => void
  onCancelTarget: () => void
}

const EMOJI: Record<Card['kind'], string> = { sack: '👜', cat: '😼', fence: '🛡️', magnet: '🧲' }

function CardIcon({ kind, className = '' }: { kind: Card['kind']; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className={`flex items-center justify-center text-[2.6em] leading-none ${className}`}>{EMOJI[kind]}</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={CARD_INFO[kind].icon} alt="" draggable={false} onError={() => setFailed(true)} className={`object-contain [image-rendering:pixelated] ${className}`} />
  )
}

/**
 * 정답 보상: 카드 3장 중 하나 고르기 (1·2·3 키로도 고를 수 있다).
 * 도둑 고양이 카드를 고르면 보낼 친구를 고른다 — 뼈다귀가 많은 친구가 위에 온다(블루킷식 "누굴 노릴까").
 */
export default function BoneRushCards({ cards, fences, choosingTarget, targets, onPick, onSendCat, onCancelTarget }: BoneRushCardsProps) {
  useEffect(() => {
    if (choosingTarget) return
    const onKey = (event: KeyboardEvent) => {
      const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code)
      if (index >= 0 && index < cards.length) onPick(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards.length, choosingTarget, onPick])

  if (choosingTarget) {
    const sorted = [...targets].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return (
      <div className="mx-auto w-full max-w-3xl rounded-2xl border-4 border-slate-900 bg-white/95 p-5 shadow-2xl sm:p-7">
        <div className="flex items-center gap-3">
          <CardIcon kind="cat" className="h-16 w-16" />
          <div>
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">누구 마당에 보낼까요?</h2>
            <p className="text-sm font-bold text-slate-500 break-keep">고양이가 {Math.round(BONE_RUSH.CAT_CHASE_MS / 1000)}초 동안 친구를 쫓아요. 닿을 때마다 뼈다귀 {BONE_RUSH.CAT_BITE}개씩, 최대 {BONE_RUSH.CAT_MAX_BITES}번! 물어 온 뼈다귀는 내 거예요.</p>
          </div>
        </div>
        <div className="mt-5 grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {sorted.map((player, index) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSendCat(player.id)}
              className="flex items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-3 text-left text-base font-black text-slate-800 shadow-[0_4px_0_#cbd5e1] transition hover:-translate-y-0.5 hover:border-slate-800 active:translate-y-0.5 active:shadow-none"
            >
              <span className="truncate">{index === 0 && (player.score ?? 0) > 0 ? '👑 ' : ''}{player.nickname}</span>
              <span className="shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-xs tabular-nums text-slate-900">🦴 {(player.score ?? 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancelTarget} className="mt-4 text-sm font-bold text-slate-500 underline underline-offset-2">
          다른 카드 고르기
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-1 text-center text-3xl font-black text-white [text-shadow:0_3px_0_#0f172a] sm:text-4xl">정답! 하나를 골라요</h2>
      <p className="mb-4 text-center text-sm font-bold text-white/85 sm:text-base">모을까, 훔칠까, 지킬까?</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card, index) => {
          const info = CARD_INFO[card.kind]
          const toneClass = info.tone === 'attack' ? 'bg-slate-800 text-white' : info.tone === 'guard' ? 'bg-amber-50 text-slate-900' : 'bg-white text-slate-900'
          const badgeClass = info.tone === 'attack' ? 'bg-rose-500 text-white' : info.tone === 'guard' ? 'bg-amber-400 text-slate-900' : 'bg-lime-400 text-slate-900'
          const gold = card.kind === 'sack' && card.gold
          return (
            <motion.button
              key={`${card.kind}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 320, damping: 22 }}
              onClick={() => onPick(index)}
              className={`group relative flex items-center gap-3 rounded-2xl border-4 p-3 text-left shadow-[0_6px_0_#0f172a] transition hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#0f172a] sm:flex-col sm:p-5 sm:text-center ${toneClass} ${gold ? 'border-yellow-400' : 'border-slate-900'}`}
            >
              <span className={`absolute left-2 top-2 hidden rounded-md px-1.5 text-xs font-black sm:block ${info.tone === 'attack' ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
              <span className={`absolute -top-3 right-3 rounded-full px-2.5 py-0.5 text-xs font-black shadow ${badgeClass}`}>{gold ? '황금!' : info.badge}</span>
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl p-1.5 sm:h-24 sm:w-24 ${info.tone === 'attack' ? 'bg-slate-700' : gold ? 'bg-yellow-100' : 'bg-amber-100'}`}>
                <CardIcon kind={card.kind} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black sm:text-xl">{gold ? '황금 보따리' : info.label}</div>
                <div className={`mt-1 text-sm font-bold break-keep ${info.tone === 'attack' ? 'text-slate-300' : 'text-slate-600'}`}>{describeCard(card, fences + (card.kind === 'fence' ? 1 : 0))}</div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
