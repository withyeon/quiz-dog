import type { RaidBossSprite, RaidRole } from '@/lib/game/raid'

/** 펭귄 보스 그림 — 기본·맞은 표정·쓰러진 모습. 모두 512×640(4:5), 발끝 기준선이 같다. 원본은 raw-assets/raid-original/ */
export const RAID_SPRITE_SRC: Record<RaidBossSprite, { idle: string; hurt: string; down: string }> = {
  guard: { idle: '/raid/penguin-guard.webp', hurt: '/raid/penguin-guard-hurt.webp', down: '/raid/penguin-guard-down.webp' },
  knight: { idle: '/raid/penguin-knight.webp', hurt: '/raid/penguin-knight-hurt.webp', down: '/raid/penguin-knight-down.webp' },
  general: { idle: '/raid/penguin-general.webp', hurt: '/raid/penguin-general-hurt.webp', down: '/raid/penguin-general-down.webp' },
  emperor: { idle: '/raid/penguin-emperor.webp', hurt: '/raid/penguin-emperor-hurt.webp', down: '/raid/penguin-emperor-down.webp' },
}

/** 역할 아이콘 (얼음 검 · 오로라 지팡이 · 얼음 결정 방패) */
export const RAID_ROLE_ICON_SRC: Record<RaidRole, string> = {
  warrior: '/raid/role-warrior.webp',
  mage: '/raid/role-mage.webp',
  guardian: '/raid/role-guardian.webp',
}

export const RAID_EFFECT_SRC = {
  /** 정답 타격 때 펭귄 위에서 터지는 얼음 파편 */
  hit: '/raid/hit.webp',
  /** 얼음 방패가 올라와 있는 동안 펭귄을 감싸는 고리 (가운데가 비어 있다) */
  iceShield: '/raid/ice-shield.webp',
  /** 보스 무대 뒤 왕좌의 방 */
  arena: '/raid/arena.webp',
} as const
