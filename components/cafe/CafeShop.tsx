'use client'

import { ShopMenuCard, ShopUpgradeCard } from '@/components/cafe/ShopCards'
import PixelIcon from '@/components/ui/PixelIcon'
import { TrendingUp } from 'lucide-react'
import { MENU_ITEMS, UPGRADES, canBuyMenu, canBuyUpgrade } from '@/lib/game/cafe'
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
              <ShopMenuCard key={menu.id} menu={menu} canBuy={canBuy} onBuy={() => purchaseMenu(menu.id)} />
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
              <ShopUpgradeCard key={upgrade.id} upgrade={upgrade} canBuy={canBuy} onBuy={() => purchaseUpgrade(upgrade.id)} />
            )
          })}
        </div>
      </div>
    </div>
  )
}
