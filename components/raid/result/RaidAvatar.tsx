'use client'

import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'

export type RaidAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<RaidAvatarSize, { box: string; sizes: string }> = {
  xs: { box: 'h-7 w-7 text-sm', sizes: '28px' },
  sm: { box: 'h-9 w-9 text-base', sizes: '36px' },
  md: { box: 'h-11 w-11 text-xl 2xl:h-12 2xl:w-12', sizes: '48px' },
  lg: { box: 'h-14 w-14 text-2xl', sizes: '56px' },
  xl: { box: 'h-[72px] w-[72px] text-4xl', sizes: '72px' },
}

type RaidAvatarProps = {
  avatar?: string | null
  nickname: string
  size?: RaidAvatarSize
  /** 테두리·빛 등 바깥에서 얹는 클래스 */
  className?: string
}

/**
 * 레이드 화면 공용 아바타. 캐릭터 이미지가 없거나 이모지면 그대로, 아무것도 없으면 닉네임 첫 글자.
 * (이미지 경로 해석·축소본 선택은 PlayerAvatarDisplay 가 한다)
 */
export default function RaidAvatar({ avatar, nickname, size = 'md', className = '' }: RaidAvatarProps) {
  const initial = Array.from(nickname.trim())[0] ?? '?'
  const hasAvatar = Boolean(avatar && avatar.trim())
  return (
    <PlayerAvatarDisplay
      avatar={hasAvatar ? avatar : null}
      nickname={nickname}
      fallback={initial}
      className={`relative shrink-0 overflow-hidden rounded-full bg-white font-black text-sky-900 ${SIZE[size].box} ${className}`}
      imageClassName="object-contain scale-125"
      sizes={SIZE[size].sizes}
    />
  )
}
