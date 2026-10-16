'use client'

import { Check, Lock } from 'lucide-react'
import type { RaidBossState } from '@/lib/game/raid'
import PipRow from './PipRow'
import RaidWidget from './RaidWidget'

type ShieldPanelProps = {
  /** 지금 싸우는 보스. null 이면 전부 쓰러뜨린 상태 */
  boss: RaidBossState | null
}

/**
 * 얼음 방패 패널. 방패는 서로 다른 친구가 함께 깨는 문이라 칸 수만 익명으로 보여 준다.
 */
export default function ShieldPanel({ boss }: ShieldPanelProps) {
  const shield = boss?.shield
  const active = Boolean(shield?.active)

  return (
    <RaidWidget
      title="얼음 방패"
      icon={Lock}
      tone={active ? 'ice' : 'neutral'}
      aside={active && shield ? <span className="tabular-nums text-cyan-100">{shield.points} / {shield.required}</span> : undefined}
    >
      {active && shield ? (
        <>
          <PipRow filled={shield.points} total={shield.required} tone="cyan" />
          <p className="mt-2.5 break-keep text-sm font-bold text-cyan-50">친구 {shield.remaining}명이 더 맞히면 깨져요!</p>
        </>
      ) : shield?.broken ? (
        <p className="flex items-center gap-2 text-base font-black text-emerald-200">
          <Check className="h-5 w-5" strokeWidth={3} /> 이번 펭귄의 방패는 깨졌어요
        </p>
      ) : shield ? (
        <>
          <PipRow filled={0} total={shield.required} tone="cyan" dim />
          <p className="mt-2.5 break-keep text-sm font-bold text-white/60">체력이 절반 아래로 떨어지면 올라와요</p>
        </>
      ) : (
        <p className="text-sm font-bold text-white/60">펭귄 군단을 모두 물리쳤어요</p>
      )}
    </RaidWidget>
  )
}
