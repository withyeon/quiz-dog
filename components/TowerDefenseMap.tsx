'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
    Tower,
    Enemy,
    Projectile,
    BuildSlot,
    MAP_WIDTH,
    MAP_HEIGHT,
    TOWER_TYPES,
    ENEMY_TYPES,
    TowerTypeId,
    getTowerRange,
    canPlaceTowerAtPoint,
    getDistance,
    PATH_POINTS,
    PATH_BUILD_BLOCK_RADIUS,
    TOWER_COLLISION_RADIUS,
} from '@/lib/game/tower'
import type { Particle } from '@/lib/game/particles'

interface TowerDefenseMapProps {
    towers: Tower[]
    enemies: Enemy[]
    projectiles: Projectile[]
    particles: Particle[]
    shakeIntensity: number
    selectedTowerType: TowerTypeId | null
    onPlaceTower: (slot: BuildSlot) => void
    onSelectTower: (tower: Tower | null) => void
    selectedTower: Tower | null
}

const towerImagePaths: Record<TowerTypeId, string> = {
    BASIC: '/tower/basic.svg',
    MAGIC: '/tower/magic.svg',
    BOMB: '/tower/bomb.svg',
    LASER: '/tower/laser.svg',
    SLOW: '/tower/slow.svg',
}

const enemyImagePaths: Record<string, string> = {
    NORMAL: '/tower/enemy/normal.svg',
    FAST: '/tower/enemy/fast.svg',
    STRONG: '/tower/enemy/strong.svg',
    BOSS: '/tower/enemy/boss.svg',
}

const projectileImagePaths: Record<TowerTypeId, string> = {
    BASIC: '/tower/projectile/arrow.svg',
    MAGIC: '/tower/projectile/magic_orb.svg',
    BOMB: '/tower/projectile/bomb.svg',
    LASER: '/tower/projectile/laser_beam.svg',
    SLOW: '/tower/projectile/ice_shard.svg',
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: MouseEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = MAP_WIDTH / rect.width
    const scaleY = MAP_HEIGHT / rect.height

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    }
}

function traceEnemyPath(ctx: CanvasRenderingContext2D) {
    ctx.beginPath()
    PATH_POINTS.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
    })
}

function drawEnemyPath(ctx: CanvasRenderingContext2D) {
    ctx.save()

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    traceEnemyPath(ctx)
    ctx.strokeStyle = 'rgba(5, 7, 12, 0.76)'
    ctx.lineWidth = 78
    ctx.stroke()

    traceEnemyPath(ctx)
    ctx.strokeStyle = 'rgba(81, 30, 44, 0.72)'
    ctx.lineWidth = 62
    ctx.stroke()

    traceEnemyPath(ctx)
    ctx.strokeStyle = 'rgba(31, 37, 49, 0.94)'
    ctx.lineWidth = 48
    ctx.stroke()

    traceEnemyPath(ctx)
    ctx.strokeStyle = 'rgba(101, 116, 139, 0.34)'
    ctx.lineWidth = 24
    ctx.stroke()

    ctx.setLineDash([18, 18])
    traceEnemyPath(ctx)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
    ctx.lineWidth = 5
    ctx.stroke()
    ctx.setLineDash([])

    ctx.setLineDash([5, 22])
    traceEnemyPath(ctx)
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.42)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])

    const start = PATH_POINTS[0]
    const end = PATH_POINTS[PATH_POINTS.length - 1]

    ctx.font = 'bold 18px DNFBitBitv2, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = 'rgba(8, 13, 24, 0.92)'
    ctx.beginPath()
    ctx.arc(start.x + 28, start.y, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = 'white'
    ctx.fillText('입구', start.x + 28, start.y)

    ctx.fillStyle = 'rgba(8, 13, 24, 0.92)'
    ctx.beginPath()
    ctx.arc(end.x - 30, end.y, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = 'white'
    ctx.fillText('출구', end.x - 30, end.y)

    ctx.restore()
}

export default function TowerDefenseMap({
    towers,
    enemies,
    projectiles,
    particles,
    shakeIntensity,
    selectedTowerType,
    onPlaceTower,
    onSelectTower,
    selectedTower,
}: TowerDefenseMapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredPosition, setHoveredPosition] = useState<{ x: number; y: number } | null>(null)
    const animationFrameRef = useRef<number>()
    const backgroundImageRef = useRef<HTMLImageElement | null>(null)

    const towerImagesRef = useRef<Record<TowerTypeId, HTMLImageElement | null>>({
        BASIC: null,
        MAGIC: null,
        BOMB: null,
        LASER: null,
        SLOW: null,
    })
    const enemyImagesRef = useRef<Record<string, HTMLImageElement | null>>({
        NORMAL: null,
        FAST: null,
        STRONG: null,
        BOSS: null,
    })
    const projectileImagesRef = useRef<Record<TowerTypeId, HTMLImageElement | null>>({
        BASIC: null,
        MAGIC: null,
        BOMB: null,
        LASER: null,
        SLOW: null,
    })

    const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const { x, y } = getCanvasPoint(canvas, event)

        if (selectedTowerType) {
            if (canPlaceTowerAtPoint(x, y, towers)) {
                onPlaceTower({
                    id: `free-${Math.round(x)}-${Math.round(y)}`,
                    x,
                    y,
                    radius: TOWER_COLLISION_RADIUS,
                })
            }
            return
        }

        const clickedTower = towers.find((tower) => getDistance(x, y, tower.x, tower.y) < 40)
        onSelectTower(clickedTower || null)
    }

    const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return

        setHoveredPosition(getCanvasPoint(canvas, event))
    }

    const handleMouseLeave = () => {
        setHoveredPosition(null)
    }

    useEffect(() => {
        let alive = true

        const backgroundImage = new Image()
        backgroundImage.onload = () => {
            if (alive) backgroundImageRef.current = backgroundImage
        }
        backgroundImage.src = '/tower/ui/background.png'

        Object.entries(towerImagePaths).forEach(([type, path]) => {
            const img = new Image()
            img.onload = () => {
                if (alive) towerImagesRef.current[type as TowerTypeId] = img
            }
            img.src = path
        })

        Object.entries(enemyImagePaths).forEach(([type, path]) => {
            const img = new Image()
            img.onload = () => {
                if (alive) enemyImagesRef.current[type] = img
            }
            img.src = path
        })

        Object.entries(projectileImagePaths).forEach(([type, path]) => {
            const img = new Image()
            img.onload = () => {
                if (alive) projectileImagesRef.current[type as TowerTypeId] = img
            }
            img.src = path
        })

        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const animate = () => {
            const now = Date.now()

            ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

            if (shakeIntensity > 0) {
                ctx.save()
                ctx.translate(
                    (Math.random() - 0.5) * shakeIntensity,
                    (Math.random() - 0.5) * shakeIntensity
                )
            }

            if (backgroundImageRef.current) {
                ctx.drawImage(backgroundImageRef.current, 0, 0, MAP_WIDTH, MAP_HEIGHT)
            } else {
                ctx.fillStyle = '#f0f4f8'
                ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
            }

            drawEnemyPath(ctx)

            if (selectedTowerType) {
                ctx.save()
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)'
                ctx.lineWidth = PATH_BUILD_BLOCK_RADIUS * 2
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                traceEnemyPath(ctx)
                ctx.stroke()
                ctx.restore()
            }

            if (selectedTower) {
                const range = getTowerRange(selectedTower.type, selectedTower.level)
                ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(selectedTower.x, selectedTower.y, range, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
            }

            towers.forEach((tower) => {
                const towerType = TOWER_TYPES[tower.type]
                const towerImage = towerImagesRef.current[tower.type]
                const size = 70
                const isSelected = selectedTower?.id === tower.id

                if (isSelected) {
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
                    ctx.beginPath()
                    ctx.arc(tower.x, tower.y, 40, 0, Math.PI * 2)
                    ctx.fill()

                    ctx.strokeStyle = '#60a5fa'
                    ctx.lineWidth = 3
                    ctx.stroke()
                }

                if (towerImage) {
                    ctx.save()
                    ctx.translate(tower.x, tower.y)
                    ctx.drawImage(towerImage, -size / 2, -size / 2, size, size)
                    ctx.restore()
                } else {
                    ctx.font = 'bold 32px DNFBitBitv2, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillStyle = '#1f2937'
                    ctx.fillText(towerType.emoji, tower.x, tower.y)
                }

                if (tower.level > 1) {
                    ctx.fillStyle = '#fbbf24'
                    ctx.beginPath()
                    ctx.arc(tower.x + 25, tower.y - 25, 14, 0, Math.PI * 2)
                    ctx.fill()

                    ctx.fillStyle = 'white'
                    ctx.font = 'bold 12px DNFBitBitv2, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText(`${tower.level}`, tower.x + 25, tower.y - 25)
                }
            })

            enemies.forEach((enemy) => {
                const enemyType = ENEMY_TYPES[enemy.type]
                const enemyImage = enemyImagesRef.current[enemy.type]
                const isEnraged = enemy.buffType === 'ENRAGE' && (enemy.buffedUntil ?? 0) > now
                const size = isEnraged ? 58 : 50
                const isSlowed = Boolean(
                    (enemy.slowedUntil && enemy.slowedUntil > now)
                    || (enemy.frozenUntil && enemy.frozenUntil > now)
                )

                if (isEnraged) {
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    ctx.arc(enemy.x, enemy.y, 38 + Math.sin(now / 100) * 4, 0, Math.PI * 2)
                    ctx.stroke()
                }

                if (enemy.type === 'FAST') {
                    ctx.strokeStyle = 'rgba(14, 165, 233, 0.8)'
                    ctx.lineWidth = 2
                    ctx.setLineDash([3, 6])
                    ctx.beginPath()
                    ctx.arc(enemy.x, enemy.y, 31, 0, Math.PI * 2)
                    ctx.stroke()
                    ctx.setLineDash([])
                }

                if (enemy.type === 'STRONG') {
                    ctx.strokeStyle = 'rgba(245, 158, 11, 0.82)'
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    ctx.arc(enemy.x, enemy.y, 31, 0, Math.PI * 2)
                    ctx.stroke()
                }

                if (isSlowed) {
                    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)'
                    ctx.lineWidth = 3
                    ctx.setLineDash([6, 6])
                    ctx.beginPath()
                    ctx.arc(enemy.x, enemy.y, 32, 0, Math.PI * 2)
                    ctx.stroke()
                    ctx.setLineDash([])
                }

                if (enemyImage) {
                    ctx.save()
                    ctx.translate(enemy.x, enemy.y)
                    if (enemy.hp < enemy.maxHp * 0.3) {
                        ctx.globalAlpha = 0.7
                        ctx.filter = 'hue-rotate(0deg) saturate(1.5)'
                    }
                    ctx.drawImage(enemyImage, -size / 2, -size / 2, size, size)
                    ctx.restore()
                } else {
                    ctx.fillStyle = enemy.hp < enemy.maxHp * 0.3 ? '#ef4444' : '#f97316'
                    ctx.beginPath()
                    ctx.arc(enemy.x, enemy.y, isEnraged ? 29 : 25, 0, Math.PI * 2)
                    ctx.fill()

                    ctx.strokeStyle = '#991b1b'
                    ctx.lineWidth = 2
                    ctx.stroke()

                    ctx.font = 'bold 24px DNFBitBitv2, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillStyle = '#1f2937'
                    ctx.fillText(enemyType.emoji, enemy.x, enemy.y)
                }

                if (enemy.type === 'BOSS') {
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)'
                    ctx.beginPath()
                    ctx.arc(enemy.x + 22, enemy.y - 22, 12, 0, Math.PI * 2)
                    ctx.fill()

                    ctx.fillStyle = '#e0f2fe'
                    ctx.font = 'bold 12px DNFBitBitv2, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText('1/2', enemy.x + 22, enemy.y - 22)
                }

                const hpBarWidth = 40
                const hpBarHeight = 5
                const hpRatio = Math.max(0, enemy.hp / enemy.maxHp)

                ctx.fillStyle = '#1f2937'
                ctx.fillRect(enemy.x - hpBarWidth / 2, enemy.y - 35, hpBarWidth, hpBarHeight)

                ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444'
                ctx.fillRect(enemy.x - hpBarWidth / 2, enemy.y - 35, hpBarWidth * hpRatio, hpBarHeight)
            })

            projectiles.forEach((projectile) => {
                const projectileImage = projectileImagesRef.current[projectile.towerType]
                const size = 20

                if (projectile.towerType === 'LASER') {
                    const tower = towers.find((item) => item.id === projectile.towerId)
                    if (!tower) return

                    ctx.strokeStyle = '#3b82f6'
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    ctx.moveTo(tower.x, tower.y)
                    ctx.lineTo(projectile.x, projectile.y)
                    ctx.stroke()
                    return
                }

                if (projectileImage) {
                    const dx = projectile.targetX - projectile.x
                    const dy = projectile.targetY - projectile.y
                    const angle = Math.atan2(dy, dx)

                    ctx.save()
                    ctx.translate(projectile.x, projectile.y)
                    ctx.rotate(angle)
                    ctx.drawImage(projectileImage, -size / 2, -size / 2, size, size)
                    ctx.restore()
                } else {
                    ctx.fillStyle = projectile.towerType === 'BOMB' ? '#ef4444' :
                        projectile.towerType === 'MAGIC' ? '#8b5cf6' :
                            projectile.towerType === 'SLOW' ? '#06b6d4' : '#fbbf24'
                    ctx.beginPath()
                    ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2)
                    ctx.fill()
                }
            })

            particles.forEach((particle) => {
                ctx.save()
                ctx.globalAlpha = Math.max(0, Math.min(1, particle.life))
                ctx.fillStyle = particle.color
                ctx.strokeStyle = particle.color

                if (particle.type === 'ice') {
                    ctx.translate(particle.x, particle.y)
                    ctx.rotate((1 - particle.life) * Math.PI * 2)
                    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
                } else if (particle.type === 'explosion') {
                    ctx.shadowBlur = 14
                    ctx.shadowColor = particle.color
                    ctx.beginPath()
                    ctx.arc(particle.x, particle.y, particle.size * (0.7 + particle.life), 0, Math.PI * 2)
                    ctx.fill()
                } else if (particle.type === 'magic') {
                    ctx.shadowBlur = 10
                    ctx.shadowColor = particle.color
                    ctx.beginPath()
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.globalAlpha = Math.max(0, particle.life * 0.45)
                    ctx.beginPath()
                    ctx.arc(particle.x, particle.y, particle.size * 1.8, 0, Math.PI * 2)
                    ctx.stroke()
                } else {
                    ctx.beginPath()
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                    ctx.fill()
                }

                ctx.restore()
            })

            if (hoveredPosition && selectedTowerType) {
                const canPlace = canPlaceTowerAtPoint(hoveredPosition.x, hoveredPosition.y, towers)
                const towerType = TOWER_TYPES[selectedTowerType]
                const range = getTowerRange(selectedTowerType, 1)
                const previewX = hoveredPosition.x
                const previewY = hoveredPosition.y

                ctx.fillStyle = canPlace ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                ctx.strokeStyle = canPlace ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(previewX, previewY, range, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()

                const previewImage = towerImagesRef.current[selectedTowerType]
                const size = 70

                if (previewImage) {
                    ctx.save()
                    ctx.globalAlpha = canPlace ? 0.7 : 0.5
                    ctx.translate(previewX, previewY)
                    ctx.drawImage(previewImage, -size / 2, -size / 2, size, size)
                    ctx.restore()
                } else {
                    ctx.fillStyle = canPlace ? 'rgba(31, 41, 55, 0.7)' : 'rgba(239, 68, 68, 0.7)'
                    ctx.beginPath()
                    ctx.arc(previewX, previewY, 35, 0, Math.PI * 2)
                    ctx.fill()

                    ctx.font = 'bold 32px DNFBitBitv2, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText(towerType.emoji, previewX, previewY)
                }
            }

            if (shakeIntensity > 0) {
                ctx.restore()
            }

            animationFrameRef.current = requestAnimationFrame(animate)
        }

        animate()

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [towers, enemies, selectedTowerType, hoveredPosition, selectedTower, projectiles, particles, shakeIntensity])

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className={`block aspect-[4/3] h-auto w-full rounded-lg border-4 border-gray-800 bg-white shadow-2xl ${selectedTowerType ? 'cursor-crosshair' : 'cursor-pointer'}`}
            />

            <div className="absolute right-4 top-4 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm">
                <span className="text-xs font-black text-slate-700">{towers.length}개 설치</span>
            </div>
        </div>
    )
}
