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
    color: string
}

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
        description: '경로 중앙에 강력한 광역 폭발을 호출합니다.',
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
        description: '즉시 200G를 획득합니다.',
        emoji: '💰',
        color: 'bg-amber-500',
    },
}

const COMMON_SKILLS: SkillId[] = ['BLIZZARD', 'OVERCLOCK', 'HEAL', 'GOLD_RUSH']
const RARE_SKILLS: SkillId[] = ['THUNDER', 'AIRSTRIKE']

function shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5)
}

export function getSkillChoices(consecutiveCorrect: number): Skill[] {
    const choices = shuffle(COMMON_SKILLS).slice(0, 3)

    if (consecutiveCorrect >= 3) {
        choices[Math.floor(Math.random() * choices.length)] = shuffle(RARE_SKILLS)[0]
    }

    return shuffle(choices).map((id) => SKILLS[id])
}
