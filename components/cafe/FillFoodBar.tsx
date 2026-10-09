'use client'

import FillFoodButton, { FILL_FOOD_HINT } from '@/components/cafe/FillFoodButton'

/** 화면 아래 "음식 채우기" 버튼과 안내 문구. 버튼(또는 스페이스바)을 누르면 퀴즈가 열린다. */
export default function FillFoodBar({ onFill }: { onFill: () => void }) {
  return (
    <>
      {/* 음식 채우기 버튼 및 안내 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 [@media(max-height:500px)]:pb-1">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-3 [@media(max-height:500px)]:gap-0">
          <FillFoodButton onClick={onFill} />
          <div className="mt-3 text-center text-xs sm:text-sm font-bold text-slate-700 drop-shadow-sm [@media(max-height:500px)]:hidden">
            {FILL_FOOD_HINT}
          </div>
        </div>
      </div>
    </>
  )
}
