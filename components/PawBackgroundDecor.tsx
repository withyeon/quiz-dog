'use client'

import { PAW2_SRC, PAW_SRC, PAW_PRINTS } from '@/components/pawBackgroundConfig'

export default function PawBackgroundDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 min-h-full overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {PAW_PRINTS.map((paw, index) => {
        const src = paw.variant === 'paw' ? PAW_SRC : PAW2_SRC

        return (
          <img
            key={`${paw.variant}-${index}`}
            src={src}
            alt=""
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
