'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
    Tower,
    Enemy,
    Projectile,
    BuildSlot,
    BUILD_SLOTS,
    MAP_WIDTH,
    MAP_HEIGHT,
    TOWER_TYPES,
    ENEMY_TYPES,
    TowerTypeId,
    getTowerRange,
    getBuildSlotAtPoint,
    canPlaceTowerOnSlot,
    getDistance,
} from '@/lib/game/tower'

interface TowerDefenseMapProps {
    towers: Tower[]
    enemies: Enemy[]
    projectiles: Projectile[]
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

export default function TowerDefenseMap({
    towers,
    enemies,
    projectiles,
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
            const slot = getBuildSlotAtPoint(x, y)
            if (slot && canPlaceTowerOnSlot(slot.id, towers)) {
                onPlaceTower(slot)
            }
            return
        }

        const clickedSlot = getBuildSlotAtPoint(x, y)
        const clickedTower = clickedSlot
            ? towers.find((tower) => tower.slotId === clickedSlot.id)
            : towers.find((tower) => getDistance(x, y, tower.x, tower.y) < 40)
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
        backgroundImage.src = '/tower/ui/background.svg'

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

            if (backgroundImageRef.current) {
                ctx.drawImage(backgroundImageRef.current, 0, 0, MAP_WIDTH, MAP_HEIGHT)
            } else {
                ctx.fillStyle = '#f0f4f8'
                ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
            }

            const hoveredSlot = hoveredPosition ? getBuildSlotAtPoint(hoveredPosition.x, hoveredPosition.y) : null
            const occupiedSlotIds = new Set(towers.map((tower) => tower.slotId).filter(Boolean))

            BUILD_SLOTS.forEach((slot) => {
                const isOccupied = occupiedSlotIds.has(slot.id)
                const isHovered = hoveredSlot?.id === slot.id
                const canBuildHere = Boolean(selectedTowerType && !isOccupied)

                ctx.save()
                ctx.fillStyle = isOccupied
                    ? 'rgba(15, 23, 42, 0.16)'
                    : canBuildHere
                        ? 'rgba(16, 185, 129, 0.18)'
                        : 'rgba(255, 255, 255, 0.24)'
                ctx.strokeStyle = isHovered && selectedTowerType
                    ? canBuildHere
                        ? 'rgba(34, 197, 94, 0.95)'
                        : 'rgba(239, 68, 68, 0.95)'
                    : isOccupied
                        ? 'rgba(15, 23, 42, 0.38)'
                        : 'rgba(16, 185, 129, 0.58)'
                ctx.lineWidth = isHovered ? 4 : 2
                ctx.beginPath()
                ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()

                ctx.fillStyle = isOccupied ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.82)'
                ctx.beginPath()
                ctx.arc(slot.x, slot.y, 7, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            })

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
                    ctx.font = 'bold 32px system-ui, sans-serif'
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
                    ctx.font = 'bold 12px system-ui, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText(`${tower.level}`, tower.x + 25, tower.y - 25)
                }
            })

            enemies.forEach((enemy) => {
                const enemyType = ENEMY_TYPES[enemy.type]
                const enemyImage = enemyImagesRef.current[enemy.type]
                const size = 50
                const isSlowed = Boolean(enemy.slowedUntil && enemy.slowedUntil > now)

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
                    ctx.arc(enemy.x, enemy.y, 25, 0, Math.PI * 2)
                    ctx.fill()

                    ctx.strokeStyle = '#991b1b'
                    ctx.lineWidth = 2
                    ctx.stroke()

                    ctx.font = 'bold 24px system-ui, sans-serif'
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
                    ctx.font = 'bold 12px system-ui, sans-serif'
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

            if (hoveredPosition && selectedTowerType) {
                const hoveredSlot = getBuildSlotAtPoint(hoveredPosition.x, hoveredPosition.y)
                const canPlace = Boolean(hoveredSlot && canPlaceTowerOnSlot(hoveredSlot.id, towers))
                const towerType = TOWER_TYPES[selectedTowerType]
                const range = getTowerRange(selectedTowerType, 1)
                const previewX = hoveredSlot?.x ?? hoveredPosition.x
                const previewY = hoveredSlot?.y ?? hoveredPosition.y

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

                    ctx.font = 'bold 32px system-ui, sans-serif'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText(towerType.emoji, previewX, previewY)
                }
            }

            animationFrameRef.current = requestAnimationFrame(animate)
        }

        animate()

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [towers, enemies, selectedTowerType, hoveredPosition, selectedTower, projectiles])

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

            <div className="absolute right-4 top-4 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between gap-4 text-xs font-black text-slate-700">
                    <span>건설 슬롯</span>
                    <span>{towers.length}/{BUILD_SLOTS.length}</span>
                </div>
                <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-emerald-500 bg-emerald-100" />
                        <span className="font-semibold text-slate-600">빈 슬롯</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-slate-500 bg-slate-200" />
                        <span className="font-semibold text-slate-600">점유됨</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
