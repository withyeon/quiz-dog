'use client'

import CafeImage from '@/components/cafe/CafeImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCafeMoney, formatCafeMoneyDelta, type MenuItem, type Upgrade } from '@/lib/game/cafe'

/** 상점의 메뉴 잠금 해제 카드. 실제 상점(CafeShop)과 카페 튜토리얼 데모가 같이 쓴다. */
export function ShopMenuCard({ menu, canBuy, onBuy }: { menu: MenuItem; canBuy: boolean; onBuy?: () => void }) {
  return (
    <Card
      className={`border-4 ${canBuy ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
    >
      <CardHeader>
        <div className="flex justify-center mb-2">
          <CafeImage
            src={menu.image}
            alt={menu.name}
            width={64}
            height={64}
            className="h-16 w-16 object-contain"
            fallbackEmoji={menu.emoji}
            fallbackClassName="h-16 w-16 text-4xl"
          />
        </div>
        <CardTitle className="text-center text-lg text-gray-900">{menu.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-2">
          <div className="text-base sm:text-xl font-bold text-amber-600 whitespace-nowrap">{formatCafeMoney(menu.cost)}</div>
          {/* 왜 사야 하는지 바로 보이게 — 이 메뉴 하나를 팔면 얼마 버는지 */}
          <div className="text-xs font-bold text-green-600 whitespace-nowrap">팔면 {formatCafeMoneyDelta(menu.sellPrice)}</div>
          <Button
            onClick={onBuy}
            disabled={!canBuy}
            className={`w-full whitespace-nowrap px-2 text-xs sm:text-sm ${canBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            {canBuy ? '잠금 해제!' : '돈 부족'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** 상점의 업그레이드 카드. 실제 상점(CafeShop)과 카페 튜토리얼 데모가 같이 쓴다. */
export function ShopUpgradeCard({ upgrade, canBuy, onBuy }: { upgrade: Upgrade; canBuy: boolean; onBuy?: () => void }) {
  return (
    <Card
      className={`border-4 ${canBuy ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
    >
      <CardHeader>
        <CardTitle className="text-gray-900">{upgrade.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">{upgrade.description}</div>
          <div className="text-base sm:text-xl font-bold text-blue-600 whitespace-nowrap">{formatCafeMoney(upgrade.cost)}</div>
          <Button
            onClick={onBuy}
            disabled={!canBuy}
            className={`w-full ${canBuy ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            {canBuy ? '구매' : '돈 부족'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
