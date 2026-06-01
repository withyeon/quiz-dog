'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useAudioContext } from '@/components/AudioProvider'

export default function TeacherBgmControl() {
  const {
    isMuted,
    volume,
    toggleMute,
    setVolumeLevel,
  } = useAudioContext()

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={toggleMute}
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        aria-label={isMuted ? 'BGM 음소거 해제' : 'BGM 음소거'}
        title={isMuted ? '음소거 해제' : '음소거'}
      >
        {isMuted || volume <= 0 ? (
          <VolumeX className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Volume2 className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(volume * 100)}
        onChange={(event) => setVolumeLevel(Number(event.target.value) / 100)}
        className="h-2 w-36 accent-indigo-600"
        aria-label="BGM 볼륨"
      />
    </div>
  )
}
