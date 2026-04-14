import { useState, useCallback } from 'react'

export type AudioType = 'lobby' | 'game' | 'result'
export type SFXType = 'correct' | 'incorrect' | 'item' | 'click'

interface UseAudioOptions {
  initialMuted?: boolean
  initialVolume?: number
}

/** 배경음·효과음 비활성화(외부 MP3 재생 없음). API는 호환용으로 유지. */
export function useAudio({ initialMuted = true, initialVolume = 0.5 }: UseAudioOptions = {}) {
  const [isMuted, setIsMuted] = useState(initialMuted)
  const [volume, setVolume] = useState(initialVolume)

  const playBGM = useCallback((_type: AudioType) => {}, [])
  const stopBGM = useCallback(() => {}, [])
  const playSFX = useCallback((_type: SFXType) => {}, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  const setVolumeLevel = useCallback((newVolume: number) => {
    setVolume(Math.max(0, Math.min(1, newVolume)))
  }, [])

  return {
    isMuted,
    volume,
    currentBGM: null as AudioType | null,
    playBGM,
    stopBGM,
    playSFX,
    toggleMute,
    setVolumeLevel,
  }
}
