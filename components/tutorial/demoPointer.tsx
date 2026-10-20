'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { motion } from 'framer-motion'
import { TapPointer } from '@/components/tutorial/TutorialDemoFrame'

/**
 * 데모 무대 안의 실제 버튼 위로 포인터를 옮긴다 (라면가게·붕어빵 데모 공용).
 * find 가 돌려준 요소의 오른쪽 아래 근처에 포인터를 둔다. box 는 zoom 이 걸린 래퍼의 "바깥"에 있어야 한다 —
 * 조상 zoom 때문에 화면 px 과 box 의 px 이 다르면 비율로 되돌린다(GlassQuizStep 과 같은 방식).
 */
export function useElementPointer(
  boxRef: RefObject<HTMLElement | null>,
  find: ((box: HTMLElement) => Element | null | undefined) | null,
  key: string | number,
): { left: number; top: number } | null {
  const [pointer, setPointer] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!find) {
      setPointer(null)
      return
    }
    const measure = () => {
      const box = boxRef.current
      const target = box ? find(box) : null
      if (!box || !target) return
      const boxRect = box.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      const scale = box.offsetWidth > 0 ? boxRect.width / box.offsetWidth : 1
      setPointer({
        left: (rect.left + rect.width * 0.62 - boxRect.left) / scale - 12,
        top: (rect.top + rect.height * 0.55 - boxRect.top) / scale - 12,
      })
    }
    // 장면이 막 붙은 직후엔 등장 모션 중이라 한 번 더 잰다
    measure()
    const timer = setTimeout(measure, 320)
    return () => clearTimeout(timer)
    // find 는 장면마다 새 함수라 key 로만 다시 잰다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, boxRef])

  return find ? pointer : null
}

const useLayoutEffectSafe = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function MovingPointer({ pointer }: { pointer: { left: number; top: number } | null }) {
  if (!pointer) return null
  return (
    <motion.div
      className="pointer-events-none absolute z-30"
      initial={false}
      animate={{ left: pointer.left, top: pointer.top }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    >
      <TapPointer className="left-0 top-0" />
    </motion.div>
  )
}

/**
 * 실제 게임 화면을 baseWidth 폭으로 그린 뒤 튜토리얼 프레임 무대에 맞게 통째로 줄일 zoom 값.
 * 무대 높이 = 프레임 높이 − reserved(헤더·캡션 몫), 내용 높이는 content 의 offsetHeight(zoom 전 px)로 잰다.
 * 폰·낮은 창에서도 냄비·버튼이 헤더나 캡션을 덮지 않게 한다.
 */
export function useFrameFitZoom(
  contentRef: RefObject<HTMLElement | null>,
  baseWidth: number,
  reserved = 200,
): number {
  const [zoom, setZoom] = useState(0.6)
  useLayoutEffectSafe(() => {
    const content = contentRef.current
    const frame = content?.closest('[data-tutorial-frame]')
    if (!content || !(frame instanceof HTMLElement)) return
    const measure = () => {
      const width = frame.clientWidth - 24
      const height = frame.clientHeight - reserved
      const natural = content.offsetHeight || 1
      const next = Math.max(0.35, Math.min(1, width / baseWidth, height / natural))
      setZoom((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(content)
    return () => observer.disconnect()
  }, [contentRef, baseWidth, reserved])
  return zoom
}

/**
 * 프레임 전체를 덮는 fixed 결과 카드·알림(BakeResultCard·RoundResultCard·NoticeModal)을 감싸는 zoom.
 * 카드는 fixed 라 래퍼 높이로는 잴 수 없어, 카드의 대략 높이(naturalHeight, zoom 전 px)로 프레임 높이에 맞춘다.
 */
export function FitOverlay({ naturalHeight, max = 0.8, children }: { naturalHeight: number; max?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(max)
  useLayoutEffectSafe(() => {
    const frame = ref.current?.closest('[data-tutorial-frame]')
    if (!(frame instanceof HTMLElement)) return
    const measure = () => {
      const next = Math.max(0.35, Math.min(max, (frame.clientHeight - 24) / naturalHeight, (frame.clientWidth - 16) / 460))
      setZoom((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [naturalHeight, max])
  return <div ref={ref} style={{ zoom }}>{children}</div>
}
