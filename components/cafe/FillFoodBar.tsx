'use client'

import { Button } from '@/components/ui/button'
import PixelIcon from '@/components/ui/PixelIcon'

/** 화면 아래 "음식 채우기" 버튼과 안내 문구. 버튼(또는 스페이스바)을 누르면 퀴즈가 열린다. */
export default function FillFoodBar({ onFill }: { onFill: () => void }) {
  return (
    <>
      {/* 음식 채우기 버튼 및 안내 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 [@media(max-height:500px)]:pb-1">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-3 [@media(max-height:500px)]:gap-0">
          <Button
            variant="outline"
            onClick={onFill}
            className="h-auto min-h-0 min-w-[300px] items-center justify-between gap-3 border-2 border-[#3A9BDC] bg-[#88D1E7] px-10 py-1.5 text-sm font-bold text-[#1a5f8f] shadow-[0_3px_0_#3A9BDC] hover:border-[#3A9BDC] hover:bg-[#7ec8e0] hover:text-[#1a5f8f] hover:shadow-[0_2px_0_#3A9BDC] active:translate-y-0.5 active:shadow-none"
            style={{
              backgroundImage: 'linear-gradient(180deg, #D9F2F9 0%, #88D1E7 52%, #7ec5e8 100%)',
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <PixelIcon name="dish" size={22} alt="" />
              음식 채우기
            </span>
            <span className="mr-3 text-xs font-semibold text-[#1a5f8f]/85">스페이스바</span>
          </Button>
          <div className="mt-3 text-center text-xs sm:text-sm font-bold text-slate-700 drop-shadow-sm [@media(max-height:500px)]:hidden">
            손님을 클릭하여 주문한 메뉴를 서빙하세요! 재고가 없으면 음식 채우기 버튼을 눌러주세요.
          </div>
        </div>
      </div>
    </>
  )
}
