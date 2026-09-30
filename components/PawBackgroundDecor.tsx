'use client'

import Image from 'next/image'
import { PAW2_SRC, PAW_SRC, PAW_PRINTS } from '@/components/pawBackgroundConfig'

export default function PawBackgroundDecor({ edgesOnly = false }: { edgesOnly?: boolean } = {}) {
  const prints = edgesOnly ? PAW_PRINTS.filter((paw) => !paw.middle) : PAW_PRINTS

  return (
    <div
      className="pointer-events-none absolute inset-0 min-h-full overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {prints.map((paw, index) => {
        const src = paw.variant === 'paw' ? PAW_SRC : PAW2_SRC

        return (
          <Image
            key={`${paw.variant}-${index}`}
            src={src}
            alt=""
            width={160}
            height={160}
            sizes={`${paw.size}px`}
            draggable={false}
            className={`absolute object-contain select-none ${paw.visibility ?? ''}`}
            style={{
              top: paw.top,
              left: paw.left,
              right: paw.right,
              bottom: paw.bottom,
              width: paw.size,
              height: paw.size,
              opacity: paw.opacity,
              transform: paw.centerX
                ? `translateX(-50%) rotate(${paw.rotate}deg)`
                : `rotate(${paw.rotate}deg)`,
            }}
          />
        )
      })}
    </div>
  )
}
