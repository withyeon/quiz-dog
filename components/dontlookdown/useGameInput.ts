'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { PHYSICS } from '@/lib/game/dontlookdown'

export type GameKey = 'left' | 'right' | 'jump' | 'down' | 'shift' | 'q' | 'e' | 'r'

type GameInputOptions = {
    /** 지금 눌려 있는 키 집합. 게임 루프가 매 프레임 읽는다. */
    keysRef: MutableRefObject<Set<string>>
    /** 점프 버퍼(초). 점프 키를 누른 직후 잠깐 바닥에 닿으면 점프가 나가게 한다. */
    jumpBufferRef: MutableRefObject<number>
    /** Q 키 */
    onQuizKey: () => void
    /** E(0번)·R(1번) 키. 슬롯이 비어 있는지는 호출부가 판단한다. */
    onPowerUpKey: (slotIndex: number) => void
}

function getGameKey(e: KeyboardEvent): GameKey | null {
    const key = e.key.toLowerCase()
    const code = e.code?.toLowerCase()
    if (key === 'arrowleft' || code === 'arrowleft' || key === 'a') return 'left'
    if (key === 'arrowright' || code === 'arrowright' || key === 'd') return 'right'
    if (key === 'arrowup' || code === 'arrowup' || key === 'w' || key === ' ') return 'jump'
    if (key === 'arrowdown' || code === 'arrowdown') return 'down'
    if (key === 'shift') return 'shift'
    if (key === 'q') return 'q'
    if (key === 'e') return 'e'
    if (key === 'r') return 'r'
    return null
}

/**
 * 점프점프 입력. 키보드와 화면 버튼이 같은 keysRef 를 채우므로 게임 루프는 입력 장치를 구분하지 않는다.
 * 키보드 리스너는 마운트 때 한 번만 달고, 콜백은 ref로 최신 것을 쓴다.
 */
export function useGameInput({ keysRef, jumpBufferRef, onQuizKey, onPowerUpKey }: GameInputOptions) {
    const [isTouch, setIsTouch] = useState(false)
    const onQuizKeyRef = useRef(onQuizKey)
    const onPowerUpKeyRef = useRef(onPowerUpKey)
    onQuizKeyRef.current = onQuizKey
    onPowerUpKeyRef.current = onPowerUpKey

    // 터치 기기 감지 (태블릿/모바일에는 물리 키보드가 없으므로 화면 조작 버튼 제공)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const coarse = window.matchMedia?.('(pointer: coarse)').matches
        const forced = new URLSearchParams(window.location.search).get('touch') === '1'
        setIsTouch(forced || Boolean(coarse) || (navigator.maxTouchPoints ?? 0) > 0)
    }, [])

    // 키보드 핸들러 (마운트 시 한 번)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const gameKey = getGameKey(e)
            if (!gameKey) return
            e.preventDefault()
            e.stopPropagation()

            keysRef.current.add(gameKey)

            // OS 키 반복은 한 번만 처리 (점프 버퍼/액션은 edge-triggered)
            if (e.repeat) return

            if (gameKey === 'jump') {
                jumpBufferRef.current = PHYSICS.JUMP_BUFFER_TIME
            }
            if (gameKey === 'q') {
                onQuizKeyRef.current()
            }
            if (gameKey === 'e') {
                onPowerUpKeyRef.current(0)
            }
            if (gameKey === 'r') {
                onPowerUpKeyRef.current(1)
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            const gameKey = getGameKey(e)
            if (!gameKey) return
            e.preventDefault()
            e.stopPropagation()
            keysRef.current.delete(gameKey)
        }

        const handleBlur = () => keysRef.current.clear()

        window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false })
        window.addEventListener('keyup', handleKeyUp, { capture: true, passive: false })
        window.addEventListener('blur', handleBlur)

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true })
            window.removeEventListener('keyup', handleKeyUp, { capture: true })
            window.removeEventListener('blur', handleBlur)
        }
    }, [jumpBufferRef, keysRef])

    // 화면 버튼 → 키보드와 동일한 입력 모델(keysRef) 사용
    const pressGameKey = (key: GameKey) => {
        keysRef.current.add(key)
        if (key === 'jump') jumpBufferRef.current = PHYSICS.JUMP_BUFFER_TIME
    }
    const releaseGameKey = (key: GameKey) => {
        keysRef.current.delete(key)
    }

    return { isTouch, pressGameKey, releaseGameKey }
}
