import type { PixelIconName } from '@/components/ui/PixelIcon'
import { PLAYER_START_HP } from '@/lib/game/tower'

export type SkillId =
    | 'THUNDER'
    | 'BLIZZARD'
    | 'OVERCLOCK'
    | 'AIRSTRIKE'
    | 'HEAL'
    | 'GOLD_RUSH'

export interface Skill {
    id: SkillId
    name: string
    description: string
    emoji: string
    icon?: PixelIconName // 있으면 화면에서는 이모지 대신 픽셀 아이콘을 그린다 (components/ItemGlyph)
    color: string
}

// 타워 디펜스 아이템은 뽑는 순간 쓰이지 않고 보관했다가 원할 때 쓴다.
// 언제 쓸 수 있는지는 아래 getItemBlockReason 이 정한다.

export const SKILLS: Record<SkillId, Skill> = {
    THUNDER: {
        id: 'THUNDER',
        name: '번개',
        description: '가장 체력이 많은 적을 즉시 처치합니다.',
        emoji: '⚡',
        color: 'bg-yellow-500',
    },
    BLIZZARD: {
        id: 'BLIZZARD',
        name: '빙결',
        description: '모든 적을 4초 동안 완전히 묶습니다.',
        emoji: '❄️',
        color: 'bg-cyan-500',
    },
    OVERCLOCK: {
        id: 'OVERCLOCK',
        name: '과부하',
        description: '8초 동안 모든 타워의 공격 속도가 2배가 됩니다.',
        emoji: '⏱️',
        color: 'bg-violet-500',
    },
    AIRSTRIKE: {
        id: 'AIRSTRIKE',
        name: '공습',
        description: '적이 가장 많이 모인 곳에 강력한 광역 폭발을 떨어뜨립니다.',
        emoji: '🚀',
        color: 'bg-rose-500',
    },
    HEAL: {
        id: 'HEAL',
        name: '긴급 수리',
        description: '코어 HP를 20 회복합니다.',
        emoji: '🛠️',
        color: 'bg-emerald-500',
    },
    GOLD_RUSH: {
        id: 'GOLD_RUSH',
        name: '골드러시',
        description: '200G를 얻습니다.',
        emoji: '💰',
        icon: 'gold',
        color: 'bg-amber-500',
    },
}

const COMMON_SKILLS: SkillId[] = ['BLIZZARD', 'OVERCLOCK', 'HEAL', 'GOLD_RUSH']
const RARE_SKILLS: SkillId[] = ['THUNDER', 'AIRSTRIKE']

function shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5)
}

/** 보관 중인 아이템을 지금 쓸 수 없는 이유. 쓸 수 있으면 null. (게임과 튜토리얼 데모가 같이 쓴다) */
export function getItemBlockReason(
    skillId: SkillId,
    { enemyCount, isWaveActive, hp }: { enemyCount: number; isWaveActive: boolean; hp: number },
): string | null {
    switch (skillId) {
        case 'THUNDER':
        case 'BLIZZARD':
        case 'AIRSTRIKE':
            return enemyCount === 0 ? '적이 있을 때 쓸 수 있어요' : null
        case 'OVERCLOCK':
            return isWaveActive ? null : '웨이브 중에 쓸 수 있어요'
        case 'HEAL':
            return hp >= PLAYER_START_HP ? '체력이 가득 찼어요' : null
        case 'GOLD_RUSH':
            return null
    }
}

export function getSkillChoices(consecutiveCorrect: number): Skill[] {
    const choices = shuffle(COMMON_SKILLS).slice(0, 3)

    if (consecutiveCorrect >= 3) {
        choices[Math.floor(Math.random() * choices.length)] = shuffle(RARE_SKILLS)[0]
    }

    return shuffle(choices).map((id) => SKILLS[id])
}
