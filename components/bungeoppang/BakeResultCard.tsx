'use client'

import { motion } from 'framer-motion'
import { BUNGEO, getPerfectComboLabel, type BakeOutcome } from '@/lib/game/bungeoppang'
import BungeoSprite, { gradeToSprite } from '@/components/bungeoppang/BungeoSprite'

type BakeResultCardProps = {
  outcome: BakeOutcome
  onClose: () => void
}

/**
 * 뒤집은 뒤 결과 카드: 등급 → 속 공개 → 점수 줄 → 합계. 황금이면 화면이 번쩍인다.
 * 카드는 한 번만 닫히고(훅의 outcomeClosedRef) 닫으면 다음 문제로 간다.
 */
export default function BakeResultCard({ outcome, onClose }: BakeResultCardProps) {
  const isGolden = outcome.filling.id === 'golden'
  const isPerfect = outcome.grade.id === 'perfect'
  const isBurnt = outcome.grade.id === 'burnt'
  const comboLabel = getPerfectComboLabel(outcome.perfectStreak)
  const sprite = isGolden ? 'golden' : gradeToSprite(outcome.grade.id)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      onClick={onClose}
    >
      {/* 황금 번쩍 */}
      {isGolden && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 0.2, 0.9, 0] }}
          transition={{ duration: 1.1, times: [0, 0.3, 0.5, 1] }}
          className="pointer-events-none absolute inset-0 bg-[#fff3b0]"
        />
      )}
      <motion.div
        initial={{ scale: 0.6, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className={`relative w-full max-w-sm rounded-2xl border-4 bg-white p-6 text-center shadow-2xl ${
          isGolden ? 'border-amber-400' : isPerfect ? 'border-orange-400' : isBurnt ? 'border-stone-500' : 'border-amber-200'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {isGolden && (
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="mb-2 text-2xl font-black text-amber-600"
          >
            ✨ 황금 붕어빵!! ✨
          </motion.div>
        )}

        <div className={`text-5xl font-black ${isPerfect ? 'text-orange-600' : isBurnt ? 'text-stone-700' : 'text-amber-700'}`}>
          {outcome.grade.emoji} {outcome.grade.label}
        </div>

        <motion.div
          initial={{ rotateY: 90 }}
          animate={{ rotateY: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="my-4 flex justify-center"
        >
          <div className="flex items-center gap-1">
            <BungeoSprite state={sprite} width={outcome.filling.count === 2 ? 110 : 150} className="drop-shadow-[0_4px_0_rgba(0,0,0,0.2)]" />
            {outcome.filling.count === 2 && (
              <BungeoSprite state={sprite} width={110} className="drop-shadow-[0_4px_0_rgba(0,0,0,0.2)]" />
            )}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="text-xl font-black text-slate-900"
        >
          속은… {outcome.filling.emoji} {outcome.filling.label}!
        </motion.p>
        <p className="mt-1 text-sm font-bold text-slate-500 break-keep">{outcome.filling.description}</p>

        <div className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-left text-sm font-bold text-slate-700">
          {outcome.lines.map((line, index) => (
            <div key={`${line.label}-${index}`} className="flex items-center justify-between gap-2">
              <span className="truncate">{line.label}</span>
              <span className="shrink-0 text-amber-800">{line.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 text-3xl font-black text-orange-600">+{outcome.points.toLocaleString()}점</div>

        {(comboLabel || outcome.fireModeTriggered || outcome.traysCompleted > 0) && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {comboLabel && <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-700">{comboLabel}</span>}
            {outcome.fireModeTriggered && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-black text-red-700">🔥 불맛 모드! 다음 붕어빵 {BUNGEO.FIRE_MODE_MULTIPLIER}배</span>
            )}
            {outcome.traysCompleted > 0 && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">🍳 한 판 완성! +{outcome.trayBonus}</span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-orange-500 py-4 text-lg font-black text-white shadow-lg transition-transform hover:bg-orange-400 active:scale-95"
        >
          다음 문제 →
        </button>
      </motion.div>
    </motion.div>
  )
}
