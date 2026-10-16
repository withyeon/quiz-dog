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

/**
 * 보스 무대 뒤 배경. 병사들은 성문 앞마당, 마지막 황제는 왕좌의 방에서 싸운다.
 * 둘 다 1200×800 픽셀아트라 무대에서는 어둡게 눌러 쓴다(BossStage 의 StageBackdrop).
 */
export const RAID_ARENA_SRC: Record<RaidBossSprite, string> = {
  guard: '/raid/arena-gate.webp',
  knight: '/raid/arena-gate.webp',
  general: '/raid/arena-gate.webp',
  emperor: '/raid/arena.webp',
}

export const RAID_EFFECT_SRC = {
  /** 정답 타격 때 펭귄 위에서 터지는 얼음 파편 */
  hit: '/raid/hit.webp',
  /** 얼음 방패가 올라와 있는 동안 펭귄을 감싸는 고리 (가운데가 비어 있다) */
  iceShield: '/raid/ice-shield.webp',
  /** 보스 무대 뒤 왕좌의 방 (RAID_ARENA_SRC.emperor 와 같은 그림) */
  arena: '/raid/arena.webp',
  /** 전부 쓰러뜨린 뒤 무대 뒤로 깔리는 노을 진 왕좌의 방 */
  victory: '/raid/victory.webp',
} as const
