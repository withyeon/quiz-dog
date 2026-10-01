import { PLAYER_SIZE, WORLD, type DLDPlayer } from '@/lib/game/dontlookdown'
import type { BackgroundCloud, BackgroundStar, GameParticle, TrailPoint } from '@/components/dontlookdown/types'

/**
 * 점프점프 화면 효과용 순수 함수 모음. 게임 루프(DontLookDownGame)가 매 프레임 ref에 든
 * 배열을 넘기고 새 배열을 받아 다시 ref에 넣는다. 여기서는 React 상태를 전혀 건드리지 않는다.
 */

const MAX_BURST_PARTICLES = 120
const MAX_EXHAUST_PARTICLES = 180
const MAX_TRAIL_POINTS = 14
const PARTICLE_GRAVITY = 520

/** 구름은 결정적 배치(index 기반)라 모든 학생 화면에서 같은 자리에 뜬다. */
export function createClouds(): BackgroundCloud[] {
    return Array.from({ length: 24 }, (_, index) => ({
        x: (index * 173) % WORLD.WIDTH,
        y: 80 + ((index * 113) % 1700),
        w: 90 + ((index * 37) % 120),
        speed: 0.12 + (index % 5) * 0.04,
        alpha: 0.2 + (index % 4) * 0.08,
    }))
}

export function createStars(): BackgroundStar[] {
    return Array.from({ length: 80 }, (_, index) => ({
        x: (index * 97) % WORLD.WIDTH,
        y: -5200 + ((index * 181) % 3600),
        size: 1 + (index % 3),
        alpha: 0.35 + (index % 5) * 0.12,
    }))
}

/** (x, y)에서 사방으로 터지는 파티클을 더한 새 배열. 최근 120개만 남긴다. */
export function withBurst(
    particles: GameParticle[],
    x: number,
    y: number,
    color: string,
    count = 12,
    speed = 220,
): GameParticle[] {
    const next = particles.slice()
    for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const velocity = speed * (0.35 + Math.random() * 0.75)
        next.push({
            x,
            y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - 80,
            life: 0.45 + Math.random() * 0.35,
            maxLife: 0.8,
            size: 2 + Math.random() * 5,
            color,
        })
    }
    return next.slice(-MAX_BURST_PARTICLES)
}

/** 로켓 파워업 중 발밑에서 뿜는 불꽃. 최근 180개만 남긴다. */
export function withRocketExhaust(particles: GameParticle[], player: DLDPlayer, dt: number): GameParticle[] {
    const next = particles.slice()
    const count = Math.max(3, Math.ceil(dt * 260))
    for (let i = 0; i < count; i += 1) {
        const spread = (Math.random() - 0.5) * PLAYER_SIZE.WIDTH * 1.3
        next.push({
            x: player.x + PLAYER_SIZE.WIDTH / 2 + spread,
            y: player.y + PLAYER_SIZE.HEIGHT - 2,
            vx: (Math.random() - 0.5) * 120,
            vy: 260 + Math.random() * 360,
            life: 0.22 + Math.random() * 0.18,
            maxLife: 0.4,
            size: 4 + Math.random() * 8,
            color: Math.random() > 0.35 ? '#fb923c' : '#fde047',
        })
    }
    return next.slice(-MAX_EXHAUST_PARTICLES)
}

/** 파티클을 dt 초만큼 움직이고(중력 포함) 수명이 다한 것은 버린다. */
export function advanceParticles(particles: GameParticle[], dt: number): GameParticle[] {
    return particles
        .map(particle => ({
            ...particle,
            x: particle.x + particle.vx * dt,
            y: particle.y + particle.vy * dt,
            vy: particle.vy + PARTICLE_GRAVITY * dt,
            life: particle.life - dt,
        }))
        .filter(particle => particle.life > 0)
}

/** 잔상 점을 늙히고 현재 위치를 하나 더한다. 빠를수록 잔상이 오래 남는다. */
export function advanceTrail(trail: TrailPoint[], player: DLDPlayer, dt: number): TrailPoint[] {
    return [
        ...trail
            .map(point => ({ ...point, life: point.life - dt }))
            .filter(point => point.life > 0),
        {
            x: player.x,
            y: player.y,
            life: Math.min(0.35, 0.14 + (Math.abs(player.vx) + Math.abs(player.vy)) / 5200),
        },
    ].slice(-MAX_TRAIL_POINTS)
}
