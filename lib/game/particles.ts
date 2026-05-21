export interface Particle {
    id: string
    x: number
    y: number
    vx: number
    vy: number
    life: number
    color: string
    size: number
    type: 'spark' | 'explosion' | 'ice' | 'magic' | 'gold'
    _decayRate: number
}

type ParticleConfig = {
    count: number
    colors: string[]
    durationMs: number
    type: Particle['type']
    speed: [number, number]
    size: [number, number]
    upward?: boolean
}

const PARTICLE_CONFIGS: Record<string, ParticleConfig> = {
    BASIC: {
        count: 6,
        colors: ['#facc15', '#f59e0b', '#fde68a'],
        durationMs: 320,
        type: 'spark',
        speed: [80, 190],
        size: [3, 7],
    },
    MAGIC: {
        count: 9,
        colors: ['#a855f7', '#c084fc', '#f0abfc'],
        durationMs: 400,
        type: 'magic',
        speed: [90, 220],
        size: [4, 9],
    },
    BOMB: {
        count: 18,
        colors: ['#fb923c', '#f97316', '#facc15', '#ef4444'],
        durationMs: 550,
        type: 'explosion',
        speed: [140, 330],
        size: [6, 14],
    },
    LASER: {
        count: 5,
        colors: ['#38bdf8', '#7dd3fc', '#e0f2fe'],
        durationMs: 260,
        type: 'spark',
        speed: [120, 260],
        size: [3, 6],
    },
    SLOW: {
        count: 8,
        colors: ['#06b6d4', '#67e8f9', '#cffafe'],
        durationMs: 380,
        type: 'ice',
        speed: [70, 180],
        size: [5, 10],
    },
    ENEMY_DIE: {
        count: 12,
        colors: ['#ef4444', '#f87171', '#fb7185'],
        durationMs: 480,
        type: 'explosion',
        speed: [120, 280],
        size: [5, 11],
    },
    BOSS_DIE: {
        count: 30,
        colors: ['#ef4444', '#f97316', '#fb923c', '#fecaca'],
        durationMs: 800,
        type: 'explosion',
        speed: [150, 380],
        size: [7, 16],
    },
    GOLD: {
        count: 10,
        colors: ['#facc15', '#fbbf24', '#fef08a'],
        durationMs: 500,
        type: 'gold',
        speed: [110, 260],
        size: [4, 9],
        upward: true,
    },
    HEAL: {
        count: 12,
        colors: ['#22c55e', '#86efac', '#bbf7d0'],
        durationMs: 600,
        type: 'spark',
        speed: [100, 240],
        size: [4, 10],
        upward: true,
    },
}

let nextParticleId = 0

function randomBetween(min: number, max: number) {
    return min + Math.random() * (max - min)
}

export function createHitParticles(x: number, y: number, kind: string): Particle[] {
    const config = PARTICLE_CONFIGS[kind] ?? PARTICLE_CONFIGS.BASIC
    const decayRate = 1 / (config.durationMs / 1000)

    return Array.from({ length: config.count }, () => {
        const angle = config.upward
            ? randomBetween(-Math.PI * 0.88, -Math.PI * 0.12)
            : randomBetween(0, Math.PI * 2)
        const speed = randomBetween(config.speed[0], config.speed[1])

        return {
            id: `particle-${Date.now()}-${nextParticleId++}`,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            size: randomBetween(config.size[0], config.size[1]),
            type: config.type,
            _decayRate: decayRate,
        }
    })
}

export function updateParticles(particles: Particle[], deltaTime: number): Particle[] {
    const gravity = 240
    const drag = Math.max(0, 1 - deltaTime * 2.4)

    return particles
        .map((particle) => ({
            ...particle,
            x: particle.x + particle.vx * deltaTime,
            y: particle.y + particle.vy * deltaTime,
            vx: particle.vx * drag,
            vy: (particle.vy + gravity * deltaTime) * drag,
            life: particle.life - particle._decayRate * deltaTime,
        }))
        .filter((particle) => particle.life > 0)
}
