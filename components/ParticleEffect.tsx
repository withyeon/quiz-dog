'use client'

import { useEffect, useRef } from 'react'

interface ParticleEffectProps {
  type: 'confetti' | 'sparkle' | 'fireworks'
  duration?: number
  onComplete?: () => void
}

export default function ParticleEffect({ type, duration = 3000, onComplete }: ParticleEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      color: string
      size: number
      life: number
    }> = []

    // 파티클 생성
    const createParticles = () => {
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
      const count = type === 'confetti' ? 100 : type === 'sparkle' ? 50 : 200

      for (let i = 0; i < count; i++) {
        particles.push({
          x: canvas.width / 2,
          y: canvas.height / 2,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10 - 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 5 + 2,
          life: 1,
        })
      }
    }

    createParticles()

    let animationFrame: number
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > duration) {
        if (onComplete) {
          onComplete()
        }
        return
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle, index) => {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.2 // 중력
        particle.life -= 0.01

        if (particle.life > 0) {
          ctx.save()
          ctx.globalAlpha = particle.life
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else {
          particles.splice(index, 1)
        }
      })

      if (particles.length > 0) {
        animationFrame = requestAnimationFrame(animate)
      } else if (onComplete) {
        // 파티클이 모두 사라졌을 때도 onComplete 호출
        onComplete()
      }
    }

    animate()

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [type, duration, onComplete])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ background: 'transparent' }}
    />
  )
}
