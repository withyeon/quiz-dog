'use client'

import { usePathname } from 'next/navigation'
import { AudioProvider } from './AudioProvider'

export function AudioProviderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // /play 경로는 학생 페이지 (기본 Mute)
  // 그 외는 선생님 페이지 (기본 Unmute)
  const initialMuted = pathname?.includes('/play') ?? true

  return (
    <AudioProvider initialMuted={initialMuted}>
      {children}
    </AudioProvider>
  )
}
