'use client'

import { AnimatePresence, motion } from 'framer-motion'

type StageBackdropProps = {
  /** 배경 그림 (보스별 / 승리) */
  src: string
  /** 승리 장면은 밝은 노을 그림이라 덜 누르고 따뜻한 톤을 얹는다 */
  victory: boolean
  /** 분노한 황제: 배경을 붉게 물들인다 */
  enraged: boolean
  reduceMotion: boolean
}

/** 병사 앞마당·왕좌의 방은 복잡한 픽셀아트라 채도를 낮추고 어둡게 눌러야 펭귄이 묻히지 않는다 */
const ARENA_FILTER = 'saturate(0.5) brightness(0.55) contrast(1.05)'
const VICTORY_FILTER = 'saturate(0.95) brightness(0.8)'

/** 위쪽 이름표와 아래쪽 체력 바 글씨가 읽히게 위아래를 더 어둡게, 가운데(펭귄 자리)는 얕게 */
const ARENA_SCRIM = 'linear-gradient(180deg, rgba(5, 16, 34, 0.82) 0%, rgba(5, 16, 34, 0.3) 34%, rgba(5, 16, 34, 0.38) 66%, rgba(5, 16, 34, 0.9) 100%)'
const VICTORY_SCRIM = 'linear-gradient(180deg, rgba(58, 28, 10, 0.62) 0%, rgba(58, 28, 10, 0.08) 38%, rgba(58, 28, 10, 0.16) 64%, rgba(58, 28, 10, 0.8) 100%)'

/**
 * 보스 무대 뒤 배경 — 그림(어둡게) + 위아래 어둠 + 가장자리 비네트 + 분노 붉은 기운.
 * 보스가 바뀌어 그림이 달라지면 겹쳐서 천천히 바뀐다(새 그림을 받는 동안 이전 그림이 남아 있다).
 */
export default function StageBackdrop({ src, victory, enraged, reduceMotion }: StageBackdropProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0b2d4d]" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.div
          key={src}
          className="absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url('${src}')`,
            backgroundPosition: 'center 62%',
            filter: victory ? VICTORY_FILTER : ARENA_FILTER,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.7 }}
        />
      </AnimatePresence>

      <div className="absolute inset-0" style={{ background: victory ? VICTORY_SCRIM : ARENA_SCRIM }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 58%, transparent 42%, rgba(0, 0, 0, 0.5) 100%)' }}
      />

      <AnimatePresence>
        {enraged && (
          <motion.div
            key="enrage-tint"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 72%, rgba(239, 68, 68, 0.38), rgba(127, 29, 29, 0.32) 55%, rgba(69, 10, 10, 0.5) 100%)',
            }}
            initial={{ opacity: 0 }}
            animate={reduceMotion ? { opacity: 0.9 } : { opacity: [0.65, 1, 0.65] }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0.4 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
