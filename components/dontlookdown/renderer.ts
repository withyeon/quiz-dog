import {
  CLIMB_START_X,
  PLAYER_SIZE,
  type Platform,
  POWERUP_EFFECTS,
  POWERUP_SIZE,
  type Obstacle,
  type PowerUp,
  SUMMITS,
  WORLD,
  type DLDPlayer,
  type GameSettings,
  type PowerUpType,
} from '@/lib/game/dontlookdown'
import type {
  BackgroundCloud,
  BackgroundStar,
  GameParticle,
  TrailPoint,
} from '@/components/dontlookdown/types'
import { isAvatarPath } from '@/lib/utils/playerDisplay'

type DrawCharacterOptions = {
  player: DLDPlayer
  avatar: string
  avatarImage?: HTMLImageElement
  isLocal: boolean
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  { player, avatar, avatarImage, isLocal }: DrawCharacterOptions,
) {
  const cx = player.x + PLAYER_SIZE.WIDTH / 2
  const cy = player.y + PLAYER_SIZE.HEIGHT / 2

  if (player.hasShield) {
    ctx.save()
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, PLAYER_SIZE.WIDTH / 2 + 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const ghostActive = !!(player.activePowerUps && player.activePowerUps.has?.('ghost'))

  ctx.save()
  if (ghostActive) ctx.globalAlpha = 0.55

  if (avatarImage?.complete && avatarImage.naturalWidth > 0) {
    const drawHeight = 50
    const drawWidth = drawHeight * (avatarImage.naturalWidth / avatarImage.naturalHeight || 1)
    ctx.translate(cx, cy)
    if (!player.facingRight) ctx.scale(-1, 1)
    ctx.drawImage(avatarImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  } else {
    const fallbackAvatar = isAvatarPath(avatar) ? '🐕' : avatar || '🐕'
    ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (!player.facingRight) {
      ctx.translate(cx, cy)
      ctx.scale(-1, 1)
      ctx.fillText(fallbackAvatar, 0, 0)
    } else {
      ctx.fillText(fallbackAvatar, cx, cy)
    }
  }
  ctx.restore()

  if (!isLocal) {
    ctx.save()
    ctx.font = 'bold 11px DNFBitBitv2, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const metrics = ctx.measureText(player.nickname)
    const padX = 5
    const height = 14
    const nameY = player.y - 12
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(cx - metrics.width / 2 - padX, nameY - height / 2, metrics.width + padX * 2, height)
    ctx.fillStyle = '#fff'
    ctx.fillText(player.nickname, cx, nameY)
    ctx.restore()
  }
}

type DrawBackdropOptions = {
  player: DLDPlayer
  camX: number
  camY: number
  settings: GameSettings
  clouds: BackgroundCloud[]
  stars: BackgroundStar[]
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  { player, camX, camY, settings, clouds, stars }: DrawBackdropOptions,
) {
  const heightRatio = Math.min(1, player.height / settings.summitGoal)
  const summit = SUMMITS.find((item) => player.currentSummit === item.id)
  const topColor = summit?.color || '#87CEEB'
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.VIEW_HEIGHT)
  gradient.addColorStop(0, topColor)
  gradient.addColorStop(0.55, heightRatio > 0.72 ? '#7c83c5' : '#bfdbfe')
  gradient.addColorStop(1, heightRatio > 0.55 ? '#f8fafc' : '#e0f6ff')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WORLD.VIEW_WIDTH, WORLD.VIEW_HEIGHT)

  if (heightRatio > 0.6) {
    for (const star of stars) {
      const starX = (star.x - camX * 0.08) % WORLD.VIEW_WIDTH
      const starY = star.y - camY * 0.18
      if (starY < -20 || starY > WORLD.VIEW_HEIGHT + 20) continue
      ctx.globalAlpha = star.alpha * Math.min(1, (heightRatio - 0.55) * 3)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect((starX + WORLD.VIEW_WIDTH) % WORLD.VIEW_WIDTH, starY, star.size, star.size)
    }
    ctx.globalAlpha = 1
  }

  for (let layer = 0; layer < 3; layer += 1) {
    const parallax = 0.08 + layer * 0.07
    const baseY = 470 - layer * 58 + camY * parallax
    const step = 260 - layer * 35
    ctx.fillStyle = layer === 0
      ? 'rgba(15,23,42,0.16)'
      : layer === 1
        ? 'rgba(30,64,175,0.13)'
        : 'rgba(255,255,255,0.26)'
    ctx.beginPath()
    ctx.moveTo(-80, WORLD.VIEW_HEIGHT)
    for (let x = -120; x <= WORLD.VIEW_WIDTH + 160; x += step) {
      const peakX = x - (camX * parallax) % step
      ctx.lineTo(peakX, baseY - 70 - layer * 18)
      ctx.lineTo(peakX + step / 2, WORLD.VIEW_HEIGHT)
    }
    ctx.closePath()
    ctx.fill()
  }

  for (const cloud of clouds) {
    const cloudX = ((cloud.x - camX * cloud.speed) % (WORLD.VIEW_WIDTH + 220)) - 110
    const cloudY = cloud.y - camY * (0.16 + cloud.speed * 0.25)
    if (cloudY < -80 || cloudY > WORLD.VIEW_HEIGHT + 80) continue
    ctx.globalAlpha = cloud.alpha
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(cloudX, cloudY, cloud.w * 0.35, 22, 0, 0, Math.PI * 2)
    ctx.ellipse(cloudX + cloud.w * 0.25, cloudY - 8, cloud.w * 0.28, 26, 0, 0, Math.PI * 2)
    ctx.ellipse(cloudX + cloud.w * 0.5, cloudY, cloud.w * 0.34, 20, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const wallOffset = camY * 0.16
  for (const side of ['left', 'right'] as const) {
    const wallX = side === 'left'
      ? -40 - camX * 0.08
      : WORLD.VIEW_WIDTH - 150 - camX * 0.08
    const wallWidth = 190
    const wallGradient = ctx.createLinearGradient(wallX, 0, wallX + wallWidth, 0)
    if (side === 'left') {
      wallGradient.addColorStop(0, 'rgba(51,65,85,0.72)')
      wallGradient.addColorStop(1, 'rgba(51,65,85,0.10)')
    } else {
      wallGradient.addColorStop(0, 'rgba(51,65,85,0.10)')
      wallGradient.addColorStop(1, 'rgba(51,65,85,0.72)')
    }
    ctx.fillStyle = wallGradient
    ctx.fillRect(wallX, 0, wallWidth, WORLD.VIEW_HEIGHT)

    ctx.strokeStyle = 'rgba(15,23,42,0.22)'
    ctx.lineWidth = 2
    for (let i = -1; i < 11; i += 1) {
      const crackY = ((i * 83 + wallOffset) % (WORLD.VIEW_HEIGHT + 120)) - 60
      ctx.beginPath()
      ctx.moveTo(wallX + (side === 'left' ? 42 : 120), crackY)
      ctx.lineTo(wallX + (side === 'left' ? 80 : 82), crackY + 42)
      ctx.lineTo(wallX + (side === 'left' ? 58 : 132), crackY + 88)
      ctx.stroke()
    }
  }

  const danger = Math.min(1, Math.max(0, (player.vy - 350) / 850))
  const fog = ctx.createLinearGradient(0, WORLD.VIEW_HEIGHT * 0.58, 0, WORLD.VIEW_HEIGHT)
  fog.addColorStop(0, 'rgba(15,23,42,0)')
  fog.addColorStop(1, `rgba(15,23,42,${0.24 + danger * 0.24})`)
  ctx.fillStyle = fog
  ctx.fillRect(0, 0, WORLD.VIEW_WIDTH, WORLD.VIEW_HEIGHT)
}

export function drawAltitudeMarkers(
  ctx: CanvasRenderingContext2D,
  summitGoal: number,
) {
  ctx.save()
  ctx.font = 'bold 12px DNFBitBitv2, sans-serif'
  ctx.textAlign = 'left'
  for (let meters = 0; meters <= summitGoal; meters += 10) {
    const y = 600 - meters / 0.1
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WORLD.WIDTH, y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.fillText(`${meters}m`, 18, y - 6)
  }
  ctx.restore()
}

export function drawRoutePath(
  ctx: CanvasRenderingContext2D,
  platforms: Platform[],
) {
  const routePlatforms = platforms
    .filter((platform) =>
      platform.isVisible
      && (platform.routeRole === 'start'
        || platform.routeRole === 'main'
        || platform.routeRole === 'checkpoint'
        || platform.routeRole === 'peak')
    )
    .sort((a, b) => b.y - a.y)

  if (routePlatforms.length <= 1) return

  ctx.save()
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  routePlatforms.forEach((platform, index) => {
    const x = platform.x + platform.width / 2
    const y = platform.y + platform.height / 2
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.strokeStyle = 'rgba(253, 230, 138, 0.75)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 10])
  ctx.stroke()
  ctx.setLineDash([])

  for (const platform of routePlatforms) {
    ctx.fillStyle = 'rgba(120,53,15,0.8)'
    ctx.beginPath()
    ctx.arc(platform.x + platform.width / 2, platform.y + platform.height / 2, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawClimbAxis(
  ctx: CanvasRenderingContext2D,
  summitGoal: number,
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 16])
  ctx.beginPath()
  ctx.moveTo(CLIMB_START_X + 80, 700)
  ctx.lineTo(WORLD.WIDTH - 640, -summitGoal / 0.1)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

type DrawPlatformsOptions = {
  platforms: Platform[]
  platformImages: Record<number, HTMLImageElement>
}

export function drawPlatforms(
  ctx: CanvasRenderingContext2D,
  { platforms, platformImages }: DrawPlatformsOptions,
) {
  for (const platform of platforms) {
    if (!platform.isVisible) continue

    const img = platform.imageId ? platformImages[platform.imageId] : null

    if (platform.type === 'disappearing' && platform.disappearTime) {
      const timeLeft = platform.disappearTime - Date.now()
      ctx.globalAlpha = Math.max(0.3, timeLeft / 2000)
    } else {
      ctx.globalAlpha = 1
    }

    const platformGlow =
      platform.type === 'moving' ? '#38bdf8'
        : platform.type === 'ice' ? '#e0f2fe'
          : platform.type === 'disappearing' ? '#f97316'
            : platform.type === 'spike' ? '#ef4444'
              : null

    if (platformGlow) {
      ctx.save()
      ctx.shadowColor = platformGlow
      ctx.shadowBlur = platform.type === 'spike' ? 16 : 10
      ctx.fillStyle = platformGlow
      ctx.globalAlpha = platform.type === 'disappearing' ? 0.16 : 0.22
      ctx.fillRect(platform.x - 3, platform.y - 3, platform.width + 6, platform.height + 6)
      ctx.restore()
    }

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(
        img,
        0, 0, img.naturalWidth, img.naturalHeight,
        platform.x, platform.y, platform.width, platform.height,
      )
    } else {
      const styleColors: Record<string, string> = {
        stone: '#8B8682',
        wood: '#8B6914',
        chair: '#A0522D',
        barrel: '#654321',
        table: '#DEB887',
        brick: '#8B4513',
      }
      let platformColor = styleColors[platform.style || 'stone'] ?? '#808080'
      if (platform.type === 'peak') platformColor = '#FFD700'
      else if (platform.type === 'start') platformColor = '#654321'
      else if (platform.type === 'checkpoint') platformColor = '#2E8B57'
      else if (platform.type === 'disappearing') platformColor = '#FFA500'
      else if (platform.type === 'spike') platformColor = '#A52A2A'
      else if (platform.type === 'moving') platformColor = '#0EA5E9'
      else if (platform.type === 'ice') platformColor = '#BAE6FD'
      ctx.fillStyle = platformColor
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
    }

    if (platform.type === 'checkpoint') {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 14px DNFBitBitv2, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('💾', platform.x + platform.width / 2, platform.y + platform.height / 2 + 4)
    }
    if (platform.type === 'spike') {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 12px DNFBitBitv2, sans-serif'
      ctx.textAlign = 'center'
      for (let i = 0; i < platform.width / 15; i++) {
        ctx.fillText('▲', platform.x + 10 + i * 15, platform.y + 5)
      }
    }
    if (platform.type === 'moving') {
      ctx.fillStyle = '#E0F2FE'
      ctx.font = 'bold 12px DNFBitBitv2, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('⇆', platform.x + platform.width / 2, platform.y + platform.height / 2 + 4)
    }
    if (platform.type === 'ice') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(platform.x + 8, platform.y + 6)
      ctx.lineTo(platform.x + platform.width - 10, platform.y + platform.height - 6)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
  }
}

export function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  now: number,
) {
  for (const obstacle of obstacles) {
    if (!obstacle.active) continue
    if (obstacle.type === 'laser') {
      const pulse = Math.sin(now / 90) * 0.25 + 0.75
      ctx.fillStyle = `rgba(255,0,0,${pulse})`
      ctx.shadowColor = '#FF0000'
      ctx.shadowBlur = 18
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(obstacle.x, obstacle.y + obstacle.height / 2 - 1, obstacle.width, 2)
      ctx.shadowBlur = 0
    } else if (obstacle.type === 'wind') {
      const offset = (now / 28) % 36
      ctx.fillStyle = 'rgba(200, 220, 255, 0.14)'
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
      ctx.fillStyle = 'rgba(240, 249, 255, 0.55)'
      ctx.font = 'bold 20px DNFBitBitv2, sans-serif'
      ctx.textAlign = 'center'
      const symbol = obstacle.direction === 'left' ? '←' : '→'
      for (let i = 0; i < 5; i++) {
        const drift = obstacle.direction === 'left' ? -offset : offset
        ctx.fillText(symbol, obstacle.x + obstacle.width / 2 + drift, obstacle.y + 18 + i * 20)
      }
    }
  }
}

export function drawPowerUps(
  ctx: CanvasRenderingContext2D,
  powerUps: PowerUp[],
  powerUpImages: Partial<Record<PowerUpType, HTMLImageElement>>,
  now: number,
) {
  const pulse = Math.sin(now / 200) * 0.2 + 0.8
  const drawSize = 40

  for (const powerUp of powerUps) {
    if (!powerUp.active) continue
    const cx = powerUp.x + POWERUP_SIZE.WIDTH / 2
    const cy = powerUp.y + POWERUP_SIZE.HEIGHT / 2
    const img = powerUpImages[powerUp.type]
    const icon = POWERUP_EFFECTS[powerUp.type].icon

    ctx.globalAlpha = pulse

    if (img?.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize)
    } else {
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.arc(cx, cy, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.font = 'bold 20px DNFBitBitv2, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(icon, cx, cy + 7)
    }

    ctx.globalAlpha = 1
  }
}

export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: TrailPoint[],
) {
  for (const point of trail) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, point.life / 0.35) * 0.38
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(
      point.x + PLAYER_SIZE.WIDTH / 2,
      point.y + PLAYER_SIZE.HEIGHT / 2,
      16,
      20,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()
  }
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: GameParticle[],
) {
  for (const particle of particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size * (1.15 - alpha * 0.15), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  player: DLDPlayer,
  now: number,
) {
  const speed = Math.abs(player.vx) + Math.max(0, player.vy) * 0.9
  if (speed <= 760) return

  const alpha = Math.min(0.35, (speed - 760) / 1300)
  ctx.save()
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`
  ctx.lineWidth = 2
  for (let i = 0; i < 12; i += 1) {
    const x = (i * 73 + now / 4) % WORLD.VIEW_WIDTH
    const y = (i * 47 + now / 7) % WORLD.VIEW_HEIGHT
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - Math.sign(player.vx || 1) * 38, y + 24)
    ctx.stroke()
  }
  ctx.restore()
}
