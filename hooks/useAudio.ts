import { useCallback, useEffect, useRef, useState } from 'react'

export type AudioType = 'lobby' | 'game' | 'result'
export type SFXType = 'correct' | 'incorrect' | 'item' | 'click'

export type BGMTrack = {
  id: string
  title: string
  src: string
}

interface UseAudioOptions {
  enabled?: boolean
  initialMuted?: boolean
  initialVolume?: number
  storageKey?: string
}

type DesiredPlayback = 'playing' | 'paused' | 'stopped'

const DEFAULT_STORAGE_KEY = 'quizdog_teacher_bgm'

function readStoredAudioState(storageKey: string, fallbackMuted: boolean, fallbackVolume: number) {
  if (typeof window === 'undefined') {
    return { isMuted: fallbackMuted, volume: fallbackVolume }
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return { isMuted: fallbackMuted, volume: fallbackVolume }
    }

    const parsed = JSON.parse(raw) as { isMuted?: unknown; volume?: unknown }
    const storedVolume = typeof parsed.volume === 'number' ? parsed.volume : fallbackVolume
    return {
      isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : fallbackMuted,
      volume: Math.max(0, Math.min(1, storedVolume)),
    }
  } catch {
    return { isMuted: fallbackMuted, volume: fallbackVolume }
  }
}

export function useAudio({
  enabled = false,
  initialMuted = true,
  initialVolume = 0.5,
  storageKey = DEFAULT_STORAGE_KEY,
}: UseAudioOptions = {}) {
  const [isMuted, setIsMuted] = useState(() => readStoredAudioState(storageKey, initialMuted, initialVolume).isMuted)
  const [volume, setVolume] = useState(() => readStoredAudioState(storageKey, initialMuted, initialVolume).volume)
  const [currentBGM, setCurrentBGM] = useState<AudioType | null>(null)
  const [currentTrack, setCurrentTrack] = useState<BGMTrack | null>(null)
  const [isBGMPlaying, setIsBGMPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const desiredPlaybackRef = useRef<DesiredPlayback>('stopped')
  const wasEnabledRef = useRef(enabled)

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setIsBGMPlaying(false)
  }, [])

  const playAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !enabled || desiredPlaybackRef.current !== 'playing') return
    if (isMuted || volume <= 0) {
      pauseAudio()
      return
    }

    audio.muted = false
    audio.volume = volume
    void audio.play()
      .then(() => setIsBGMPlaying(true))
      .catch(() => setIsBGMPlaying(false))
  }, [enabled, isMuted, pauseAudio, volume])

  const ensureAudio = useCallback((track: BGMTrack) => {
    if (typeof window === 'undefined') return null

    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = volume
    audio.muted = isMuted || volume <= 0

    const nextSrc = new URL(track.src, window.location.origin).href
    if (audio.src !== nextSrc) {
      audio.src = track.src
      audio.currentTime = 0
      audio.load()
    }

    return audio
  }, [isMuted, volume])

  const playBGM = useCallback((type: AudioType, track?: BGMTrack) => {
    if (!enabled || !track?.src) return

    desiredPlaybackRef.current = 'playing'
    setCurrentBGM(type)
    setCurrentTrack(track)
    ensureAudio(track)
    playAudio()
  }, [enabled, ensureAudio, playAudio])

  const pauseBGM = useCallback(() => {
    desiredPlaybackRef.current = 'paused'
    pauseAudio()
  }, [pauseAudio])

  const stopBGM = useCallback(() => {
    desiredPlaybackRef.current = 'stopped'
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setCurrentBGM(null)
    setCurrentTrack(null)
    setIsBGMPlaying(false)
  }, [])

  const playSFX = useCallback((_type: SFXType) => {}, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  const setVolumeLevel = useCallback((newVolume: number) => {
    setVolume(Math.max(0, Math.min(1, newVolume)))
  }, [])

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      const storedState = readStoredAudioState(storageKey, initialMuted, initialVolume)
      setIsMuted(storedState.isMuted)
      setVolume(storedState.volume)
    }
    wasEnabledRef.current = enabled
  }, [enabled, initialMuted, initialVolume, storageKey])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ isMuted, volume }))
    } catch {
      // localStorage can be unavailable in private or embedded browser contexts.
    }
  }, [enabled, isMuted, storageKey, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = volume
    audio.muted = isMuted || volume <= 0

    if (desiredPlaybackRef.current === 'playing') {
      playAudio()
    }
  }, [isMuted, playAudio, volume])

  useEffect(() => {
    if (enabled) return
    stopBGM()
  }, [enabled, stopBGM])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      audio.src = ''
    }
  }, [])

  return {
    isMuted,
    volume,
    currentBGM,
    currentTrack,
    isBGMPlaying,
    playBGM,
    pauseBGM,
    stopBGM,
    playSFX,
    toggleMute,
    setVolumeLevel,
  }
}
