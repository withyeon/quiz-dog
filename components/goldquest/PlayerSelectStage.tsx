'use client'

import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import PlayerSelector from '@/components/PlayerSelector'
import { BOX_EVENT_IMAGE, GOLD_STEAL_RATE, toPercent, type BoxEvent } from '@/lib/game/goldQuest'
import type { GoldQuestPlayer } from '@/hooks/useGoldQuestGame'

type Props = {
  pendingEvent: BoxEvent
  boxEvent: BoxEvent | null
  isProcessingReward: boolean
  awaitingShieldText: string | null
  players: GoldQuestPlayer[]
  playerId: string
  playerSelectTimeLeft: number
  onSelect: (targetPlayerId: string) => void | Promise<void>
}

/**
 * 왕의 명령서(교환)·엘프의 밀서·마법사의 계약서가 나왔을 때의 상대 선택 화면.
 * 선택 전엔 PlayerSelector, 처리 중엔 스피너, 확정 뒤엔 결과 패널을 보여준다.
 */
export default function PlayerSelectStage({
  pendingEvent,
  boxEvent,
  isProcessingReward,
  awaitingShieldText,
  players,
  playerId,
  playerSelectTimeLeft,
  onSelect,
}: Props) {
  // 선택 완료 후 결과 메시지 (가져오기/교환 적용됨, 방어권으로 막힘, 실패)
  if (boxEvent?.targetPlayerId) {
    return (
      <div className="gold-quest-panel p-8 max-w-3xl mx-auto text-center">
        {boxEvent.itemName === '방어권' ? (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-sky-300/70 bg-sky-50">
            <Image src="/gold-quest/shield.webp" alt="방어권" width={36} height={36} className="h-9 w-9 object-contain" />
          </div>
        ) : boxEvent.itemName === '실패' ? (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-300/70 bg-slate-50 text-3xl">
            {boxEvent.icon}
          </div>
        ) : (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-emerald-300/70 bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-700" />
          </div>
        )}
        <p className="text-xl font-black text-[#17262a] mb-2">{boxEvent.message}</p>
        <p className="text-sm font-semibold text-slate-500">잠시 후 다음 문제로 넘어갑니다.</p>
      </div>
    )
  }

  if (isProcessingReward) {
    return (
      <div className="gold-quest-panel p-8 max-w-3xl mx-auto text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
        <p className="text-xl font-black text-[#17262a]">{awaitingShieldText ?? '처리 중'}</p>
      </div>
    )
  }

  return (
    <PlayerSelector
      players={players.filter((p) => {
        if (p.id === playerId) return false // 자기 자신 제외
        if (pendingEvent.type === 'KING') return true
        return (p.gold ?? 0) > 0 // Elf/Wizard: 골드 있는 상대만
      })}
      currentPlayerId={playerId || ''}
      onSelect={onSelect}
      title={
        pendingEvent.type === 'KING'
          ? '골드 교환'
          : pendingEvent.type === 'ELF'
            ? '엘프의 밀서'
            : '마법사의 계약서'
      }
      description={
        `${pendingEvent.type === 'KING'
          ? '교환할 상대를 선택하세요.'
          : `골드 ${toPercent(
              pendingEvent.type === 'ELF' ? GOLD_STEAL_RATE.ELF : GOLD_STEAL_RATE.WIZARD,
            )}%를 가져올 상대를 선택하세요.`} (${playerSelectTimeLeft}초)`
      }
      icon={pendingEvent.icon || '⚔️'}
      iconImage={BOX_EVENT_IMAGE[pendingEvent.type]}
      emptyMessage={
        pendingEvent.type === 'ELF' || pendingEvent.type === 'WIZARD'
          ? '골드가 있는 상대가 없어요.'
          : undefined
      }
    />
  )
}
