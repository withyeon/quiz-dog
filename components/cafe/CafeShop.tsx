'use client'

import CafeImage from '@/components/cafe/CafeImage'
import PixelIcon from '@/components/ui/PixelIcon'
import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MENU_ITEMS, UPGRADES, canBuyMenu, canBuyUpgrade, formatCafeMoney } from '@/lib/game/cafe'
import { useCafeStore } from '@/store/cafeStore'

export default function CafeShop() {
  const store = useCafeStore()
  const { unlockedMenus, purchaseMenu, purchaseUpgrade } = store
  const lockedMenus = MENU_ITEMS.filter((menu) => !unlockedMenus.includes(menu.id))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <PixelIcon name="dish" size={28} alt="" /> 메뉴 잠금 해제
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {lockedMenus.map((menu) => {
            const canBuy = canBuyMenu(store, menu.id)
            return (
              <Card
                key={menu.id}
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
                  <CardTitle className="text-center text-lg">{menu.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-2">
                    <div className="text-base sm:text-xl font-bold text-amber-600 whitespace-nowrap">{formatCafeMoney(menu.cost)}</div>
                    <Button
                      onClick={() => purchaseMenu(menu.id)}
                      disabled={!canBuy}
                      className={`w-full whitespace-nowrap px-2 text-xs sm:text-sm ${canBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                      {canBuy ? '잠금 해제!' : '돈 부족'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          업그레이드
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UPGRADES.map((upgrade) => {
            const canBuy = canBuyUpgrade(store, upgrade.id)
            return (
              <Card
                key={upgrade.id}
                className={`border-4 ${canBuy ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
              >
                <CardHeader>
                  <CardTitle>{upgrade.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">{upgrade.description}</div>
                    <div className="text-base sm:text-xl font-bold text-blue-600 whitespace-nowrap">{formatCafeMoney(upgrade.cost)}</div>
                    <Button
                      onClick={() => purchaseUpgrade(upgrade.id)}
                      disabled={!canBuy}
                      className={`w-full ${canBuy ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                      {canBuy ? '구매' : '돈 부족'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
