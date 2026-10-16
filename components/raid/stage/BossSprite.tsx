'use client'

import { useEffect, useRef } from 'react'
import { motion, useAnimationControls } from 'framer-motion'

type BossSpriteProps = {
  idleSrc: string
  hurtSrc: string
  name: string
  width: number
  height: number
  /** 방금 맞아서 아픈 표정을 보여 주는 중 */
  hurt: boolean
  /** 타격마다 1씩 늘어나는 숫자 — 바뀔 때 한 번 흔든다 */
  shakeKey: number
  /** 필살기가 끊겨 기절한 상태: 아픈 표정 + 기울어져 흔들림 */
  groggy: boolean
  enraged: boolean
  isFinal: boolean
  reduceMotion: boolean
}

/** 서 있는 펭귄 — 둥실거림, 맞았을 때 흔들림, 맞은 표정 겹쳐 두기, 기절·분노 테두리 빛 */
export default function BossSprite({
  idleSrc,
  hurtSrc,
  name,
  width,
  height,
  hurt,
  shakeKey,
  groggy,
  enraged,
  isFinal,
  reduceMotion,
}: BossSpriteProps) {
  // 타격마다 새로 만들지 않고 같은 그림 위에서 흔든다 (그림을 다시 그리느라 깜박이지 않게)
  // 새 펭귄이 등장하는 순간(이미 쌓인 shakeKey 로 마운트)에는 흔들지 않고, 마운트 뒤에 바뀐 타격만 흔든다
  const shake = useAnimationControls()
  const lastShakeRef = useRef(shakeKey)
  useEffect(() => {
    if (shakeKey === lastShakeRef.current) return
    lastShakeRef.current = shakeKey
    if (reduceMotion) return
    shake.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.38 } })
  }, [shake, shakeKey, reduceMotion])

  const showHurt = hurt || groggy
  const glow = enraged
    ? 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.8))'
    : groggy
      ? 'drop-shadow(0 0 16px rgba(251, 191, 36, 0.75))'
      : isFinal && !hurt
        ? 'drop-shadow(0 0 18px rgba(255, 210, 63, 0.55))'
        : undefined

  const idleMotion = groggy
    ? reduceMotion
      ? { rotate: -4, y: 0 }
      : { rotate: [-6, 6, -6], y: 0 }
    : reduceMotion
      ? { rotate: 0, y: 0 }
      : { rotate: 0, y: [0, -6, 0] }
  const idleTransition = groggy
    ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }
    : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' as const }

  return (
    <motion.div animate={shake}>
      {/*
        맞은 표정은 처음부터 겹쳐 그려 두고 투명도만 바꾼다. src 를 바꾸면 첫 타격 때
        아직 안 받은 그림(장당 50~70KB)을 기다리느라 펭귄이 잠깐 사라진다.
      */}
      <motion.div
        className="relative select-none"
        style={{ width, height, filter: glow, transformOrigin: '50% 100%' }}
        animate={idleMotion}
        transition={idleTransition}
      >
        <img
          src={idleSrc}
          alt={name}
          width={width}
          height={height}
          draggable={false}
          className={`absolute inset-0 h-full w-full ${showHurt ? 'opacity-0' : 'opacity-100'}`}
          style={{ imageRendering: 'pixelated' }}
        />
        <img
          src={hurtSrc}
          alt=""
          aria-hidden
          width={width}
          height={height}
          draggable={false}
          className={`absolute inset-0 h-full w-full ${showHurt ? 'opacity-100' : 'opacity-0'} ${hurt ? 'brightness-125' : ''}`}
          style={{ imageRendering: 'pixelated' }}
        />
      </motion.div>
    </motion.div>
  )
}
