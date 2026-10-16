'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

/** 무대 연출 조각 모음 — 눈발·스포트라이트·그림자·분노 오라·예고 테두리·눈보라·기절 별·승리 색종이 */

/** 가만히 있어도 살아 있는 느낌을 주는 느린 눈발 */
export function SnowField({ isLarge, reduceMotion }: { isLarge: boolean; reduceMotion: boolean }) {
  const count = isLarge ? 20 : 10
  return (
    <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: i % 3 === 0 ? 4 : 2,
            height: i % 3 === 0 ? 4 : 2,
            left: `${(i * 47) % 100}%`,
            top: `${(i * 29) % 90}%`,
            opacity: 0.5,
          }}
          animate={reduceMotion ? undefined : { y: [0, 14, 0], opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 2.4 + (i % 4) * 0.6, repeat: Infinity, delay: i * 0.17 }}
        />
      ))}
    </div>
  )
}

type SpotlightTone = 'calm' | 'enraged' | 'groggy'

const SPOTLIGHT_BG: Record<SpotlightTone, string> = {
  calm: 'radial-gradient(ellipse at 50% 50%, rgba(186, 230, 253, 0.36) 0%, rgba(125, 211, 252, 0.14) 42%, transparent 70%)',
  enraged: 'radial-gradient(ellipse at 50% 50%, rgba(254, 202, 202, 0.3) 0%, rgba(248, 113, 113, 0.14) 42%, transparent 70%)',
  groggy: 'radial-gradient(ellipse at 50% 50%, rgba(253, 230, 138, 0.38) 0%, rgba(251, 191, 36, 0.16) 42%, transparent 70%)',
}

type SpriteBox = {
  spriteWidth: number
  spriteHeight: number
  /** 스프라이트 발끝이 무대 바닥에서 떠 있는 높이 */
  groundPad: number
}

/**
 * 펭귄 뒤 스포트라이트 + 발밑 그림자.
 * 배경이 복잡해도 펭귄 둘레만 살짝 밝고 발밑이 어두우면 윤곽이 또렷해진다.
 */
export function SpotlightShadow({ spriteWidth, spriteHeight, groundPad, tone }: SpriteBox & { tone: SpotlightTone }) {
  const shadowHeight = spriteWidth * 0.17
  return (
    <>
      <div
        className="pointer-events-none absolute left-1/2"
        style={{
          width: spriteWidth * 2,
          height: spriteHeight * 1.05,
          marginLeft: -spriteWidth,
          bottom: groundPad - spriteHeight * 0.04,
          background: SPOTLIGHT_BG[tone],
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2"
        style={{
          width: spriteWidth * 0.95,
          height: shadowHeight,
          marginLeft: -spriteWidth * 0.475,
          bottom: groundPad - shadowHeight / 2 + 1,
          background: 'radial-gradient(ellipse at center, rgba(2, 8, 20, 0.72) 0%, rgba(2, 8, 20, 0.36) 55%, transparent 76%)',
        }}
        aria-hidden
      />
    </>
  )
}

/** 분노한 황제 뒤에서 맥박처럼 뛰는 붉은 오라 */
export function EnrageAura({ spriteWidth, spriteHeight, groundPad, reduceMotion }: SpriteBox & { reduceMotion: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2"
      style={{
        width: spriteWidth * 1.75,
        height: spriteHeight * 1.2,
        marginLeft: -spriteWidth * 0.875,
        bottom: groundPad - 4,
        background: 'radial-gradient(ellipse at 50% 55%, rgba(248, 113, 113, 0.7) 0%, rgba(220, 38, 38, 0.38) 38%, transparent 70%)',
      }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={reduceMotion ? { opacity: 0.85, scale: 1 } : { opacity: [0.65, 1, 0.65], scale: [0.96, 1.1, 0.96] }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0.3 } : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    />
  )
}

/** 필살기를 모으는 동안 무대 가장자리가 붉게 맥박친다. 끝이 가까워지면(urgent) 더 빠르게 */
export function ChargeVignette({ urgent, reduceMotion }: { urgent: boolean; reduceMotion: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
      style={{ boxShadow: 'inset 0 0 40px 6px rgba(239, 68, 68, 0.7)' }}
      initial={{ opacity: 0 }}
      animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.3, 1, 0.3] }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0.3 } : { duration: urgent ? 0.5 : 0.95, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    />
  )
}

/** 눈보라: 서리 낀 흰 막 + 옆으로 쓸고 가는 눈발. 4초 동안만 지나가는 연출이다 */
export function BlizzardOverlay({ isLarge, reduceMotion }: { isLarge: boolean; reduceMotion: boolean }) {
  const count = isLarge ? 34 : 22
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      transition={{ duration: 0.35 }}
      aria-hidden
    >
      <div
        className="absolute inset-0 backdrop-blur-[1.5px]"
        style={{
          background: 'linear-gradient(180deg, rgba(240, 249, 255, 0.58) 0%, rgba(186, 230, 253, 0.36) 50%, rgba(240, 249, 255, 0.62) 100%)',
          boxShadow: 'inset 0 0 56px rgba(255, 255, 255, 0.85)',
        }}
      />
      {Array.from({ length: count }).map((_, i) => {
        const dot = i % 3 === 0
        return (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
            style={{
              top: `${(i * 37) % 94}%`,
              left: reduceMotion ? `${(i * 53) % 100}%` : '105%',
              width: dot ? 5 : 16 + ((i * 13) % 34),
              height: dot ? 5 : 2,
            }}
            animate={reduceMotion ? undefined : { left: ['105%', '-25%'], y: [0, 16] }}
            transition={{ duration: 0.55 + (i % 5) * 0.17, repeat: Infinity, ease: 'linear', delay: (i * 0.11) % 0.9 }}
          />
        )
      })}
    </motion.div>
  )
}

const STAR_COUNT = 3
const ORBIT_STEPS = 12

/** 타원 궤도 한 바퀴를 키프레임 배열로 만든다. 앞(아래)으로 올 때 크고 뒤로 갈 때 작게 */
function orbitKeyframes(phase: number, rx: number, ry: number) {
  const xs: number[] = []
  const ys: number[] = []
  const scales: number[] = []
  for (let k = 0; k <= ORBIT_STEPS; k += 1) {
    const t = phase + (k / ORBIT_STEPS) * Math.PI * 2
    xs.push(Math.cos(t) * rx)
    ys.push(Math.sin(t) * ry)
    scales.push(0.85 + 0.3 * Math.sin(t))
  }
  return { xs, ys, scales }
}

/** 기절한 펭귄 머리 위를 도는 별 */
export function GroggyStars({ spriteWidth, spriteHeight, groundPad, isLarge, reduceMotion }: SpriteBox & { isLarge: boolean; reduceMotion: boolean }) {
  const rx = spriteWidth * 0.34
  const ry = spriteWidth * 0.08
  const size = isLarge ? 26 : 16
  const orbits = useMemo(
    () => Array.from({ length: STAR_COUNT }, (_, i) => orbitKeyframes((i / STAR_COUNT) * Math.PI * 2, rx, ry)),
    [rx, ry],
  )
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 z-20"
      style={{ bottom: groundPad + spriteHeight * 0.73, width: 0, height: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      aria-hidden
    >
      {orbits.map((orbit, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: -size / 2, top: -size / 2 }}
          animate={
            reduceMotion
              ? { x: orbit.xs[0], y: orbit.ys[0], scale: 1 }
              : { x: orbit.xs, y: orbit.ys, scale: orbit.scales }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Star
            width={size}
            height={size}
            className="fill-yellow-300 text-yellow-100 drop-shadow-[0_0_6px_rgba(253,224,71,0.95)]"
            strokeWidth={2.2}
          />
        </motion.span>
      ))}
    </motion.div>
  )
}

const CONFETTI_COLORS = ['#fbbf24', '#f472b6', '#67e8f9', '#ffffff', '#86efac', '#c4b5fd']

/** 승리 화면의 색종이 점. 위에서 천천히 떨어지며 돈다 */
export function Confetti({ isLarge, reduceMotion }: { isLarge: boolean; reduceMotion: boolean }) {
  const count = isLarge ? 36 : 22
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const w = 4 + (i % 3) * 2
        return (
          <motion.span
            key={i}
            className="absolute"
            style={{
              left: `${(i * 37 + 7) % 100}%`,
              top: reduceMotion ? `${(i * 23) % 90}%` : '-8%',
              width: w,
              height: i % 2 === 0 ? w : w * 1.7,
              borderRadius: i % 2 === 0 ? '50%' : 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              opacity: reduceMotion ? 0.8 : 1,
            }}
            animate={
              reduceMotion
                ? undefined
                : { top: ['-8%', '108%'], x: [0, (i % 2 ? 14 : -14), 0], rotate: [0, (i % 2 ? 360 : -360)] }
            }
            transition={{ duration: 3 + (i % 5) * 0.5, repeat: Infinity, ease: 'linear', delay: (i * 0.19) % 3 }}
          />
        )
      })}
    </div>
  )
}
