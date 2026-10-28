'use client'

import { useState } from 'react'
import { SKILLS, type SkillId } from '@/lib/game/survivor'

/** 그림이 아직 없을 때 대신 보여 줄 이모지 */
const EMOJI: Record<SkillId, string> = {
  bone: '🦴', ball: '🎾', bark: '📢', lightning: '⚡', frisbee: '🥏', bomb: '🍪',
  heart: '❤️', shoe: '👟', magnet: '🧲', clock: '⏳', shield: '🛡️',
}

/** 스킬 그림 (public/survivor/*.webp). 파일이 없으면 이모지로 */
export default function SkillIcon({ id, className = '' }: { id: SkillId | 'snack'; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (id === 'snack') return <span className={`flex items-center justify-center text-2xl ${className}`}>🍪</span>
  if (failed) return <span className={`flex items-center justify-center text-[1.6em] leading-none ${className}`}>{EMOJI[id]}</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SKILLS[id].icon} alt="" draggable={false} onError={() => setFailed(true)} className={`object-contain [image-rendering:pixelated] ${className}`} />
  )
}
