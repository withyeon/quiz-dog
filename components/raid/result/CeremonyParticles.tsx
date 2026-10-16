'use client'

import { motion, useReducedMotion } from 'framer-motion'

// 서버 렌더와 클라이언트가 같은 모양이어야 하므로 난수 대신 인덱스로 위치를 정한다
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 4 + (i % 4) * 2,
  delay: (i % 9) * 0.75,
  duration: 6 + (i % 5) * 1.2,
  drift: ((i % 7) - 3) * 14,
  color: i % 5,
}))

const CONFETTI = ['bg-amber-300', 'bg-rose-300', 'bg-sky-300', 'bg-emerald-300', 'bg-white']

type CeremonyParticlesProps = {
  /** confetti: 승리의 색종이, snow: 못 잡았을 때도 차분히 내리는 눈 */
  kind: 'confetti' | 'snow'
}

/** 결과 화면 위로 천천히 내리는 입자. 모션을 줄인 환경에서는 그리지 않는다 */
export default function CeremonyParticles({ kind }: CeremonyParticlesProps) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map((particle, index) => (
        <motion.span
          key={index}
          className={`absolute block ${kind === 'confetti' ? `${CONFETTI[particle.color]} rounded-[2px]` : 'rounded-full bg-white/80'}`}
          style={{ left: `${particle.left}%`, top: '-5%', width: particle.size, height: kind === 'confetti' ? particle.size * 1.6 : particle.size }}
          animate={{
            top: ['-5%', '105%'],
            x: [0, particle.drift],
            rotate: kind === 'confetti' ? [0, 260] : 0,
            opacity: [0, 0.9, 0.9, 0],
          }}
          transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  )
}
