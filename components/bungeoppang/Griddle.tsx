'use client'

import { motion } from 'framer-motion'
import { BUNGEO } from '@/lib/game/bungeoppang'
import BungeoSprite, { type BungeoSpriteState } from '@/components/bungeoppang/BungeoSprite'

type GriddleProps = {
  /** 지금 판에 채운 칸 수 (0 ~ TRAY_SIZE-1) */
  filled: number
  /** 지금 굽는 중인 붕어빵 모습 (없으면 빈 틀) */
  cooking?: BungeoSpriteState | null
  size?: 'sm' | 'lg'
  /** 불꽃을 보여 줄지 (굽는 중엔 더 세게) */
  flames?: 'off' | 'low' | 'high'
}

/**
 * 6칸 붕어빵 철판. 채운 칸엔 구운 붕어빵, 다음 칸엔 굽는 중인 붕어빵(또는 빈 틀), 아래엔 살랑이는 불꽃.
 * 크기는 'sm'(퀴즈 화면 아래 진행 표시)과 'lg'(굽기 화면 메인) 두 가지.
 */
export default function Griddle({ filled, cooking = null, size = 'lg', flames = 'low' }: GriddleProps) {
  const slots = Array.from({ length: BUNGEO.TRAY_SIZE }, (_, index) => index)
  const spriteWidth = size === 'lg' ? 104 : 56
  const isLarge = size === 'lg'

  return (
    <div className={`relative mx-auto w-full ${isLarge ? 'max-w-md' : 'max-w-xs'}`}>
      {/* 철판 */}
      <div
        className={`relative rounded-[22px] border-[3px] border-[#1f1a17] bg-[#3b3330] shadow-[inset_0_6px_14px_rgba(0,0,0,0.55),0_10px_24px_rgba(0,0,0,0.45)] ${isLarge ? 'p-4 sm:p-5' : 'p-2'}`}
      >
        <div className={`grid grid-cols-3 ${isLarge ? 'gap-3 sm:gap-4' : 'gap-1.5'}`}>
          {slots.map((index) => {
            const isFilled = index < filled
            const isCooking = index === filled && cooking !== null
            return (
              <div
                key={index}
                className={`relative flex items-center justify-center rounded-[48%] border-2 border-[#15110f] bg-[#241f1c] shadow-[inset_0_4px_10px_rgba(0,0,0,0.7)] ${isLarge ? 'h-[76px] sm:h-[88px]' : 'h-10'}`}
              >
                {isFilled && (
                  <BungeoSprite state="baked" width={spriteWidth} className="drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]" />
                )}
                {isCooking && cooking && (
                  <motion.div
                    key={cooking}
                    initial={{ scale: 0.92, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="relative"
                  >
                    <BungeoSprite state={cooking} width={spriteWidth} className="drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]" />
                    {/* 김 */}
                    {isLarge && (cooking === 'baked' || cooking === 'crispy') && (
                      <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-base opacity-80 bungeo-steam">♨</span>
                    )}
                  </motion.div>
                )}
                {!isFilled && !isCooking && (
                  <span className={`rounded-[48%] bg-[#1b1715] ${isLarge ? 'h-9 w-20' : 'h-4 w-10'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 불꽃 */}
      {flames !== 'off' && (
        <div className={`pointer-events-none relative mx-auto flex justify-center gap-2 ${isLarge ? '-mt-1 h-7' : '-mt-0.5 h-3 gap-1'}`} aria-hidden>
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className="bungeo-flame block rounded-t-full rounded-b-[40%] bg-gradient-to-t from-[#f97316] via-[#fbbf24] to-[#fde68a]"
              style={{
                width: isLarge ? 14 : 6,
                height: isLarge ? (flames === 'high' ? 28 : 18) : (flames === 'high' ? 12 : 8),
                animationDelay: `${index * 0.13}s`,
                animationDuration: flames === 'high' ? '0.45s' : '0.8s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
