'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Dir } from '@/lib/game/raidArena'

export type ArenaKey = Dir | 'balloon' | 'quiz'

type ArenaInputOptions = {
  /** 지금 눌려 있는 방향 (나중에 누른 것이 앞). 게임 루프가 매 프레임 읽는다 */
  dirStackRef: MutableRefObject<Dir[]>
  /** 물풍선 키를 눌렀는지. 루프가 읽고 비운다 (edge-triggered) */
  placeRef: MutableRefObject<boolean>
  onQuizKey: () => void
}

function toArenaKey(e: KeyboardEvent): ArenaKey | null {
  const key = e.key.toLowerCase()
  const code = e.code?.toLowerCase()
  if (key === 'arrowleft' || code === 'arrowleft' || key === 'a') return 'left'
  if (key === 'arrowright' || code === 'arrowright' || key === 'd') return 'right'
  if (key === 'arrowup' || code === 'arrowup' || key === 'w') return 'up'
  if (key === 'arrowdown' || code === 'arrowdown' || key === 's') return 'down'
  if (key === ' ' || code === 'space' || key === 'z' || key === 'enter' || key === 'shift') return 'balloon'
  if (key === 'q') return 'quiz'
  return null
}

/**
 * 아레나 입력. 키보드와 화면 버튼이 같은 ref(dirStackRef·placeRef)를 채우므로 게임 루프는 입력 장치를 구분하지 않는다.
 * 방향은 "마지막에 누른 키"가 이긴다 (스택 맨 앞). 퀴즈가 열려 있는 동안엔 호출부가 무시한다.
 */
export function useArenaInput({ dirStackRef, placeRef, onQuizKey }: ArenaInputOptions) {
  const [isTouch, setIsTouch] = useState(false)
  const onQuizKeyRef = useRef(onQuizKey)
  onQuizKeyRef.current = onQuizKey

  useEffect(() => {
    if (typeof window === 'undefined') return
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const forced = new URLSearchParams(window.location.search).get('touch') === '1'
    setIsTouch(forced || Boolean(coarse) || (navigator.maxTouchPoints ?? 0) > 0)
  }, [])

  const press = useCallback((key: ArenaKey) => {
    if (key === 'balloon') {
      placeRef.current = true
      return
    }
    if (key === 'quiz') {
      onQuizKeyRef.current()
      return
    }
    const stack = dirStackRef.current.filter((d) => d !== key)
    stack.unshift(key)
    dirStackRef.current = stack
  }, [dirStackRef, placeRef])

  const release = useCallback((key: ArenaKey) => {
    if (key === 'balloon' || key === 'quiz') return
    dirStackRef.current = dirStackRef.current.filter((d) => d !== key)
  }, [dirStackRef])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 퀴즈 입력란에 글자를 치는 중이면 게임 키를 가로채지 않는다
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const key = toArenaKey(e)
      if (!key) return
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      press(key)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = toArenaKey(e)
      if (!key) return
      release(key)
    }
    const handleBlur = () => {
      dirStackRef.current = []
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('blur', handleBlur)
    }
  }, [dirStackRef, press, release])

  return { isTouch, press, release }
}
