'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAudio, type AudioType, type BGMTrack, type SFXType } from '@/hooks/useAudio'

interface AudioContextType {
  isMuted: boolean
  volume: number
  currentBGM: AudioType | null
  currentTrack: BGMTrack | null
  isBGMPlaying: boolean
  playBGM: (type: AudioType, track?: BGMTrack) => void
  pauseBGM: () => void
  stopBGM: () => void
  playSFX: (type: SFXType) => void
  toggleMute: () => void
  setVolumeLevel: (volume: number) => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

interface AudioProviderProps {
  children: ReactNode
  enabled?: boolean
  initialMuted?: boolean
}

export function AudioProvider({ children, enabled = false, initialMuted = true }: AudioProviderProps) {
  const audio = useAudio({ enabled, initialMuted, initialVolume: 0.5 })

  return <AudioContext.Provider value={audio}>{children}</AudioContext.Provider>
}

export function useAudioContext() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudioContext must be used within AudioProvider')
  }
  return context
}
