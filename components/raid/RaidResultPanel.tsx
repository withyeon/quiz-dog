'use client'

import { motion } from 'framer-motion'
import { Trophy, Users } from 'lucide-react'
import { RAID_ROLES, type RaidRole, type RaidState } from '@/lib/game/raid'
import { RAID_SPRITE_SRC } from '@/components/raid/raidAssets'

type RaidResultPanelProps = {
  raidState: RaidState
  role: RaidRole | null
  myDamage: number
  myHits: number
  onShowResult: () => void
}

/**
 * 학생 결과 화면. 협동 게임이라 "반 전체가 어디까지 갔는지"를 먼저 보여주고 내 기여는 그 아래에 둔다.
 * 다른 친구의 데미지·순위는 여기 없다 — 집계는 선생님 화면에서만 공개한다.
 */
export default function RaidResultPanel({ raidState, role, myDamage, myHits, onShowResult }: RaidResultPanelProps) {
  const victory = raidState.allDefeated
  const lastBoss = raidState.current
  const roleInfo = role ? RAID_ROLES[role] : null

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="battle-frost-panel mx-auto max-w-3xl p-6 text-center sm:p-8"
    >
      <div className="mb-4 flex justify-center">
        {victory ? (
          // 승리: 쓰러진 황제 펭귄 위로 트로피 (마지막 보스는 항상 황제)
          <div className="relative">
            <img
              src={RAID_SPRITE_SRC.emperor.down}
              alt="쓰러진 황제 펭귄"
              width={128}
              height={160}
              draggable={false}
              style={{ width: 128, height: 160 }}
            />
            <motion.div
              className="absolute left-1/2 top-2 -translate-x-1/2"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              <Trophy className="h-12 w-12 text-amber-400 drop-shadow" />
            </motion.div>
          </div>
        ) : lastBoss ? (
          <img
            src={RAID_SPRITE_SRC[lastBoss.def.sprite].idle}
            alt={lastBoss.def.name}
            width={88}
            height={110}
            draggable={false}
            style={{ width: 88, height: 110 }}
          />
        ) : null}
      </div>

      <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">
        {victory ? '승리! 펭귄 군단을 모두 물리쳤어요' : '시간 종료! 잘 싸웠어요'}
      </h2>
      <p className="mt-2 text-base font-semibold text-slate-500">
        {victory
          ? '반 전체가 힘을 합쳐 황제 펭귄까지 쓰러뜨렸어요.'
          : lastBoss
            ? `${lastBoss.def.name}의 체력이 ${Math.max(1, Math.round(lastBoss.hpRatio * 100))}% 남았어요. 다음엔 꼭 쓰러뜨려요!`
            : '다음엔 꼭 쓰러뜨려요!'}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        {/* 폰(3열)에서 낱말 중간이 끊기지 않게 break-keep */}
        <div className="rounded-[8px] border border-sky-200 bg-sky-50 p-3">
          <div className="break-keep text-xs font-bold text-sky-700">쓰러뜨린 펭귄</div>
          <div className="mt-1 text-2xl font-black text-sky-900">{raidState.defeatedCount}/{raidState.roster.length}</div>
        </div>
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-3">
          <div className="break-keep text-xs font-bold text-emerald-700">반 전체 데미지</div>
          <div className="mt-1 text-2xl font-black text-emerald-900">{raidState.totalDamage.toLocaleString()}</div>
        </div>
        <div className="rounded-[8px] border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-center gap-1 break-keep text-xs font-bold text-slate-500">
            <Users className="h-3.5 w-3.5 shrink-0" />함께한 친구
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">{raidState.activePlayerCount}명</div>
        </div>
      </div>

      <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-left">
        <div className="text-xs font-black text-amber-700">내 기여</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-2xl font-black text-amber-900">{myDamage.toLocaleString()} 데미지</span>
          <span className="text-sm font-bold text-amber-800">명중 {myHits}번</span>
          {roleInfo && <span className="text-sm font-bold text-amber-800">{roleInfo.name}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={onShowResult}
        className="mt-6 w-full rounded-[8px] bg-slate-900 px-6 py-4 text-lg font-black text-white transition hover:bg-slate-800"
      >
        내 정답 결과 보기
      </button>
    </motion.section>
  )
}
