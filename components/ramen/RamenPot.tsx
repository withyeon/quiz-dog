'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { POT_GAUGE_ZONES, getPotPhase, getPotProgress, type Pot, type PotPhase } from '@/lib/game/ramen'

type RamenPotProps = {
  pot: Pot
  selected: boolean
  onSelect: () => void
  onServe: () => void
  /** 선생님이 멈춘 동안은 버튼을 막는다 */
  disabled?: boolean
  /** 작게(미리보기·튜토리얼) */
  compact?: boolean
}

/** public/ramen/pot-*.webp — Codex 로 빈 냄비를 만들고 편집해 속만 바꾼 스프라이트라 캔버스가 같다 */
type PotSprite = 'empty' | 'water' | 'water-noodle' | 'broth' | 'broth-noodle' | 'burnt'

/** 냄비 입구 위에 겹치는 고명·재료 스프라이트. 위치는 냄비 캔버스 기준 % (입구는 x 23~80 · y 30~46). squash 는 위에서 본 원근감 */
function Overlay({ src, left, top, width, squash = 1 }: { src: string; left: number; top: number; width: number; squash?: number }) {
  return (
    <Image
      src={src}
      alt=""
      width={256}
      height={256}
      unoptimized
      draggable={false}
      className="pointer-events-none absolute select-none object-contain"
      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: 'auto', imageRendering: 'pixelated', transform: `scaleY(${squash})`, transformOrigin: 'top center' }}
    />
  )
}

const PHASE_LABEL: Record<PotPhase, string> = {
  empty: '빈 냄비',
  cold: '물을 부어요',
  heating: '데우는 중…',
  boiling: '끓는다! 지금!',
  overcooking: '많이 익어요!',
  burnt: '탔다…',
}

/**
 * 냄비 하나: 위에서 본 냄비(SVG)에 들어간 재료가 보이고, 물을 부으면 아래 불이 붙고 조리 게이지가 찬다.
 * 끓으면 거품·김이 나고 흔들린다. 탄 냄비는 까맣게 되고 연기가 난다.
 * 카드 자체를 누르면 선택(재료가 들어갈 냄비), 아래 보라색 버튼이 「쟁반에 올리기」.
 */
export default function RamenPot({ pot, selected, onSelect, onServe, disabled = false, compact = false }: RamenPotProps) {
  const phase = getPotPhase(pot)
  const progress = getPotProgress(pot)
  const isBoiling = phase === 'boiling' || phase === 'overcooking'
  const isBurnt = phase === 'burnt'
  const done = pot.result !== null
  const potSprite: PotSprite = isBurnt
    ? 'burnt'
    : !pot.water
      ? 'empty'
      : pot.soup
        ? (pot.noodle ? 'broth-noodle' : 'broth')
        : (pot.noodle ? 'water-noodle' : 'water')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }}
      className={`relative flex flex-col items-center rounded-2xl border-4 px-2 pb-2 pt-3 transition-colors sm:px-3 ${
        done
          ? 'border-slate-300 bg-slate-100/90'
          : selected
            ? 'border-amber-400 bg-amber-50/95 shadow-[0_0_0_4px_rgba(251,191,36,0.35)]'
            : 'border-stone-300 bg-white/90 hover:border-amber-300'
      }`}
    >
      {/* 번호 */}
      <div className={`absolute -top-3 left-2 rounded-full border-2 px-2 py-0.5 text-xs font-black ${selected && !done ? 'border-amber-500 bg-amber-400 text-white' : 'border-stone-400 bg-white text-stone-700'}`}>
        {pot.index + 1}번
      </div>

      {/* 냄비 */}
      <motion.div
        animate={isBoiling && !done ? { x: [0, -1.5, 1.5, -1.5, 0] } : { x: 0 }}
        transition={{ duration: 0.25, repeat: isBoiling && !done ? Infinity : 0 }}
        className="relative"
        style={{ width: compact ? 124 : 156 }}
      >
        {/* 김 */}
        {isBoiling && !done && (
          <div className="pointer-events-none absolute top-0 left-1/2 flex -translate-x-1/2 gap-2 text-slate-500" aria-hidden>
            {[0, 1, 2].map((index) => (
              <span key={index} className="ramen-steam text-lg" style={{ animationDelay: `${index * 0.45}s` }}>♨</span>
            ))}
          </div>
        )}
        {isBurnt && (
          <div className="pointer-events-none absolute top-0 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden>
            {[0, 1, 2].map((index) => (
              <span key={index} className="ramen-smoke block h-4 w-4 rounded-full bg-slate-700/70" style={{ animationDelay: `${index * 0.5}s` }} />
            ))}
          </div>
        )}

        {/* 냄비 스프라이트(public/ramen/pot-*.webp, 모두 같은 캔버스) + 입구 위에 고명 스프라이트를 겹친다 */}
        <div className="relative aspect-square w-full">
          <Image
            src={`/ramen/pot-${potSprite}.webp`}
            alt=""
            fill
            unoptimized
            draggable={false}
            sizes="140px"
            className="select-none object-contain drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]"
            style={{ imageRendering: 'pixelated' }}
          />
          {!isBurnt && (
            <>
              {/* 마른 면·스프 가루 (물이 없을 때) */}
              {pot.noodle && !pot.water && <Overlay src="/ramen/icon-noodle.webp" left={36} top={26} width={30} squash={0.6} />}
              {pot.soup && !pot.water && <Overlay src="/ramen/topping-soup.webp" left={27} top={31} width={18} squash={0.7} />}
              {/* 파·계란 */}
              {pot.leek !== 'none' && <Overlay src="/ramen/topping-leek.webp" left={26} top={29} width={26} squash={0.7} />}
              {pot.egg !== 'none' && <Overlay src="/ramen/topping-egg.webp" left={52} top={28} width={24} squash={0.7} />}
              {/* 거품 */}
              {isBoiling && !done && (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  {[28, 40, 52, 64, 75].map((left, index) => (
                    <span
                      key={left}
                      className="ramen-bubble absolute rounded-full bg-white/85"
                      style={{ left: `${left}%`, top: `${index % 2 === 0 ? 40 : 35}%`, width: index % 2 === 0 ? '5%' : '3.5%', aspectRatio: '1', animationDelay: `${index * 0.17}s` }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 불 */}
        {pot.water && !done && !isBurnt && (
          <div className="pointer-events-none relative -mt-2 flex h-6 justify-center gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                className="ramen-flame block rounded-t-full rounded-b-[40%] bg-gradient-to-t from-[#f97316] via-[#fbbf24] to-[#fde68a]"
                style={{ width: 10, height: isBoiling ? 22 : 16, animationDelay: `${index * 0.12}s`, animationDuration: isBoiling ? '0.4s' : '0.7s' }}
              />
            ))}
          </div>
        )}
        {(!pot.water || done || isBurnt) && <div className="h-6" />}
      </motion.div>

      {/* 상태 */}
      <div className={`mt-0.5 h-5 w-full truncate text-center text-xs font-black sm:text-sm ${
        done ? 'text-slate-500' : phase === 'boiling' ? 'text-orange-600 ramen-blink' : phase === 'overcooking' ? 'text-red-600 ramen-blink' : isBurnt ? 'text-stone-700' : 'text-slate-600'
      }`}>
        {done ? pot.result!.title : PHASE_LABEL[phase]}
      </div>

      {/* 조리 게이지 */}
      <div className="mt-1 w-full">
        <div className="relative">
          <div className="flex h-3.5 w-full overflow-hidden rounded-full border-2 border-[#1f1a17]">
            {POT_GAUGE_ZONES.map((zone) => (
              <div key={zone.id} style={{ width: `${zone.width}%`, backgroundColor: zone.color }} />
            ))}
          </div>
          <div className="pointer-events-none absolute -top-1 bottom-[-4px] w-0" style={{ left: `${progress}%` }}>
            <div className="absolute left-1/2 top-0 h-full w-[4px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_#1f1a17]" />
          </div>
        </div>
        <div className="mt-0.5 flex justify-between text-[9px] font-bold text-slate-500 sm:text-[10px]">
          <span>물</span><span className="text-orange-600">끓음</span><span>탄다</span>
        </div>
      </div>

      {/* 쟁반 */}
      {done ? (
        <div className={`mt-2 w-full rounded-xl py-2 text-center text-sm font-black ${pot.result!.money > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
          {pot.result!.money > 0 ? `+${pot.result!.money.toLocaleString()}원` : '0원'}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => { event.stopPropagation(); onServe() }}
          className={`mt-2 w-full rounded-xl border-2 border-[#3b0764] py-2 text-sm font-black text-white shadow-[0_4px_0_#3b0764] transition-transform active:translate-y-0.5 active:shadow-none disabled:opacity-50 sm:text-base ${
            isBoiling ? 'bg-fuchsia-600 hover:bg-fuchsia-500 ramen-pulse' : 'bg-violet-600 hover:bg-violet-500'
          }`}
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            <Image src="/ramen/icon-tray.webp" alt="" width={64} height={64} unoptimized draggable={false} className="h-6 w-6 object-contain" style={{ imageRendering: 'pixelated' }} />
            <span className="sm:hidden">쟁반에!</span>
            <span className="hidden sm:inline">쟁반에 올리기</span>
          </span>
        </button>
      )}
    </div>
  )
}
