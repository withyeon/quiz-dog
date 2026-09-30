'use client'

import { motion } from 'framer-motion'
import PixelIcon, { type PixelIconName } from '@/components/ui/PixelIcon'
import type { SafeVault } from '@/lib/game/mafia'

export type VaultDisplay = { pixel: PixelIconName; text: string }

/**
 * 금고 칸에 보여줄 아이콘과 글자.
 * 안 연 금고는 잠긴 금고 그림만(글자 없음), 연 금고는 내용물 픽셀 아이콘과 글자.
 * 실제 게임(MafiaView)과 튜토리얼 데모가 같이 쓴다.
 */
export function getVaultDisplay(vault: SafeVault, isRevealed: boolean): VaultDisplay {
  if (!isRevealed) return { pixel: 'vaultLocked', text: '' }
  if (vault.reward === 'cash') return { pixel: 'gold', text: `$${vault.amount}` }
  if (vault.reward === 'diamond') return { pixel: 'diamond', text: `${vault.amount}개` }
  if (vault.reward === 'multiplier_1.5') return { pixel: 'boost', text: 'x1.5' }
  if (vault.reward === 'multiplier_2') return { pixel: 'boost2x', text: 'x2' }
  return { pixel: 'vaultEmpty', text: '빈 금고' }
}

// 금고 속 내용물 아이콘.
export default function VaultIcon({
  display,
  size,
  className = '',
}: {
  display: VaultDisplay
  size: number
  className?: string
}) {
  return <PixelIcon name={display.pixel} size={size} alt="" className={`inline-block ${className}`} />
}

// 빈 금고 그림(public/icons/vault-empty.webp)에서 입구(금테 안쪽)의 가운데, 그림 크기 대비 비율.
const VAULT_MOUTH = { x: 0.404, y: 0.494 }

/**
 * 금고를 연 결과 그림: 열린 금고 안에서 내용물이 튀어나온다. 빈 금고면 금고만 보인다.
 * 크기는 className 의 너비로 정한다 (정사각형).
 */
export function VaultReveal({ vault, className = '' }: { vault: SafeVault; className?: string }) {
  const display = getVaultDisplay(vault, true)
  return (
    <div className={`relative aspect-square ${className}`}>
      <PixelIcon name="vaultEmpty" size={208} alt="" className="h-full w-full" />
      {display.pixel !== 'vaultEmpty' && (
        // 위치는 일반 div 로 잡고 움직임은 안쪽 motion 에만 준다 (motion 의 transform 이 translate 클래스를 덮어쓰지 않게)
        <div
          className="absolute h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${VAULT_MOUTH.x * 100}%`, top: `${VAULT_MOUTH.y * 100}%` }}
        >
          <motion.div
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.3, y: '35%' }}
            animate={{ opacity: 1, scale: 1, y: '-12%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          >
            <PixelIcon name={display.pixel} size={104} alt="" className="h-full w-full" />
          </motion.div>
        </div>
      )}
    </div>
  )
}
