'use client'

import { useEffect, useState } from 'react'

/** Tailwind lg(1024px) 이상인지 — 퍼즐 판을 가운데(넓은 화면) 둘지 위(폰 세로) 둘지 정할 때 쓴다 */
export function useIsWideLayout(): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}
