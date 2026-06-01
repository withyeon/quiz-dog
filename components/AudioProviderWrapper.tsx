'use client'

import { usePathname } from 'next/navigation'
import { AudioProvider } from './AudioProvider'

export function AudioProviderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isTeacherAudioEnabled = pathname?.startsWith('/teacher') ?? false

  return (
    <AudioProvider enabled={isTeacherAudioEnabled} initialMuted={!isTeacherAudioEnabled}>
      {children}
    </AudioProvider>
  )
}
