'use client'

import { motion } from 'framer-motion'
import { BadgeCheck } from 'lucide-react'
import SnowBattlefield from '@/components/battle/SnowBattlefield'
import type { BattlePlayer } from '@/hooks/useSnowBattleGame'

/** 선생님이 시작하기 전 대기실. 팀 규칙 안내와 아직 조준할 수 없는 전장 미리보기. */
export default function BattleLobbyPanel({ players }: { players: BattlePlayer[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="battle-frost-panel grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.85fr_1.15fr]"
    >
      <div className="flex flex-col justify-center">
        <div className="battle-chip mb-4 inline-flex w-fit items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600">
          <BadgeCheck className="h-3.5 w-3.5 text-teal-600" />
          대기실
        </div>
        <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">
          경기장 준비 중
        </h2>
        <p className="mt-3 max-w-md text-base font-semibold leading-relaxed text-slate-500">
          선생님이 게임을 시작하면 <strong className="text-slate-900">6명 이상이면 홍팀·청팀으로 자동 배정</strong>되고,
          장비 선택 후 아레나에 입장합니다.
          <br />
          <span className="text-sm text-slate-400">6명 미만이면 팀 없이 끝까지 살아남는 개인 생존전으로 진행돼요.</span>
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-2xl">🐕</span>
          <span className="text-lg font-black text-amber-900">VS</span>
          <span className="text-2xl">🐺</span>
          <span className="ml-2 text-sm font-bold text-amber-800">
            홍팀 vs 청팀 — 상대팀 전원 탈락 시 승리!
          </span>
        </div>
      </div>
      <SnowBattlefield
        players={players}
        currentPlayerId={null}
        showTicker={false}
        className="h-[clamp(240px,36dvh,360px)]"
      />
    </motion.section>
  )
}
