'use client'

import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

type AnimatedNumberProps = {
  value: number
  className?: string
  /** true 면 처음에도 0부터 올라간다(결과 화면 연출). false 면 처음엔 바로 값을 보여 주고 바뀔 때만 올라간다 */
  fromZero?: boolean
  durationMs?: number
}

/**
 * 숫자가 바뀔 때 부드럽게 올라가는 표시. MotionValue 를 글자로 바로 꽂아서
 * 값이 자주 바뀌어도 React 리렌더 없이 글자만 갈아 끼운다.
 */
export default function AnimatedNumber({ value, className, fromZero = false, durationMs = 900 }: AnimatedNumberProps) {
  const motionValue = useMotionValue(fromZero ? 0 : value)
  const text = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString())
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: durationMs / 1000, ease: 'easeOut' })
    return () => controls.stop()
  }, [durationMs, motionValue, reduceMotion, value])

  return <motion.span className={className}>{text}</motion.span>
}
