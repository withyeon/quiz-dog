'use client'

import { useEffect, useRef, useState } from 'react'
import { ITEM_INFO, QUIZPANG, formatPlayTime, type LineDir } from '@/lib/game/quizpang'
import type { QuizpangHud as HudData, Targeting } from '@/hooks/useQuizpangGame'
import ItemIcon from '@/components/quizpang/ItemIcon'

type QuizpangHudProps = {
  hud: HudData
  nickname: string
  rank: number | null
  total: number
  targeting: Targeting | null
  onUseItem: (index: number) => void
  onCancelTargeting: () => void
  onSetLineDir: (dir: LineDir) => void
  /** 폰 세로 화면에서는 위 막대 + 아래 보관함으로, 넓은 화면에서는 옆 칸으로 */
  layout: 'stack' | 'side'
  /** stack 일 때 어느 부분을 그릴지 (보드 위 = stats, 보드 아래 = items) */
  part?: 'stats' | 'items' | 'all'
}

/** 점수가 오를 때 숫자가 굴러가게 */
function useRolling(value: number): number {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const diff = value - shownRef.current
      if (Math.abs(diff) < 1) {
        shownRef.current = value
        setShown(value)
        return
      }
      shownRef.current += diff * 0.25
      setShown(Math.round(shownRef.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return shown
}

/**
 * 퍼즐 화면의 숫자판: 점수·순위·다음 문제까지·2배 시간, 그리고 아이템 보관함.
 * 가운데 위는 GameTimeBadge(남은 시간) 자리라 비워 둔다.
 */
export default function QuizpangHud({ hud, nickname, rank, total, targeting, onUseItem, onCancelTargeting, onSetLineDir, layout, part = 'all' }: QuizpangHudProps) {
  const score = useRolling(hud.score)
  const quizRatio = Math.max(0, Math.min(1, 1 - hud.quizInMs / QUIZPANG.QUESTION_INTERVAL_MS))
  const quizSoon = hud.quizInMs <= 5000
  const slots = Array.from({ length: QUIZPANG.INVENTORY_SLOTS }, (_, i) => hud.inventory[i] ?? null)

  const scoreCard = (
    <div className="rounded-2xl border-4 border-slate-900 bg-white px-3 py-2 shadow-[0_4px_0_#0f172a]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-black text-slate-500">점수</span>
        {rank !== null && total > 1 && <span className="text-[11px] font-black text-amber-600 tabular-nums">🏅 {rank}/{total}등</span>}
      </div>
      <div className="tabular-nums text-2xl font-black leading-none text-slate-900 sm:text-3xl">{score.toLocaleString()}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-bold text-slate-500">
        <span className="max-w-[9rem] truncate">{nickname}</span>
        <span className="tabular-nums">⏱ {formatPlayTime(hud.playMs)}</span>
        {hud.maxChain >= 2 && <span className="text-rose-500">🔥 최고 {hud.maxChain}콤보</span>}
      </div>
    </div>
  )

  const quizCard = (
    <div className={`rounded-2xl border-4 border-slate-900 px-3 py-2 shadow-[0_4px_0_#0f172a] transition-colors ${quizSoon ? 'bg-sky-200' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-600">
        <span>📝 다음 문제까지</span>
        <span className={`tabular-nums ${quizSoon ? 'animate-pulse text-sky-700' : ''}`}>{Math.ceil(hud.quizInMs / 1000)}초</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-[width] duration-200" style={{ width: `${quizRatio * 100}%` }} />
      </div>
      <div className="mt-1 text-[10px] font-bold text-slate-500">맞힌 문제 {hud.correct}/{hud.questions}</div>
    </div>
  )

  const doubleCard = hud.doubleMsLeft > 0 ? (
    <div className="animate-pulse rounded-2xl border-4 border-amber-500 bg-amber-100 px-3 py-2 text-center shadow-[0_4px_0_#b45309]">
      <div className="text-sm font-black text-amber-800">🍖 점수 2배!</div>
      <div className="tabular-nums text-xl font-black text-amber-700">{(hud.doubleMsLeft / 1000).toFixed(1)}초</div>
    </div>
  ) : null

  const inventory = (
    <div className="rounded-2xl border-4 border-slate-900 bg-white p-2 shadow-[0_4px_0_#0f172a]">
      <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-black text-slate-500">
        <span>🎒 아이템 보관함</span>
        <span>문제를 맞히면 받아요</span>
      </div>
      <div className={`grid gap-1.5 ${layout === 'side' ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {slots.map((item, index) => {
          const active = targeting?.index === index
          if (!item) {
            return (
              <div key={index} className="flex h-14 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-300 sm:h-16">
                비어 있음
              </div>
            )
          }
          const info = ITEM_INFO[item]
          return (
            <button
              key={index}
              type="button"
              onClick={() => onUseItem(index)}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border-2 text-center transition active:scale-95 sm:h-16 ${
                active ? 'border-rose-500 bg-rose-100 ring-2 ring-rose-300' : 'border-slate-900 bg-amber-50 hover:bg-amber-100'
              }`}
              title={info.describe}
            >
              <ItemIcon id={item} className="h-8 w-8 text-2xl leading-none sm:h-9 sm:w-9" />
              <span className="mt-0.5 text-[10px] font-black leading-tight text-slate-800">{info.short}</span>
            </button>
          )
        })}
      </div>
      {targeting && (
        <div className="mt-2 rounded-xl bg-rose-500 px-2 py-1.5 text-center text-xs font-black text-white break-keep">
          {targeting.item === 'bomb' ? '💣 터뜨릴 자리를 보드에서 눌러요' : '🦴 지울 줄을 보드에서 눌러요 (끌면 방향이 정해져요)'}
          <div className="mt-1.5 flex justify-center gap-1.5">
            {targeting.item === 'line' && (
              <>
                <button type="button" onClick={() => onSetLineDir('row')} className={`rounded-md px-2 py-0.5 ${targeting.dir === 'row' ? 'bg-white text-rose-600' : 'bg-rose-700/60 text-white'}`}>↔ 가로</button>
                <button type="button" onClick={() => onSetLineDir('col')} className={`rounded-md px-2 py-0.5 ${targeting.dir === 'col' ? 'bg-white text-rose-600' : 'bg-rose-700/60 text-white'}`}>↕ 세로</button>
              </>
            )}
            <button type="button" onClick={onCancelTargeting} className="rounded-md bg-slate-900 px-2 py-0.5 text-white">취소</button>
          </div>
        </div>
      )}
    </div>
  )

  if (layout === 'side') {
    return (
      <div className="flex w-full flex-col gap-2 font-bitbit">
        {scoreCard}
        {quizCard}
        {doubleCard}
        {inventory}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 font-bitbit">
      {part !== 'items' && (
        <div className="grid grid-cols-2 gap-2">
          {scoreCard}
          {doubleCard ?? quizCard}
        </div>
      )}
      {part !== 'stats' && inventory}
    </div>
  )
}
