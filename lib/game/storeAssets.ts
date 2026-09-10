import type { ProductCategory } from '@/lib/game/convenienceStore'

export const STORE_BRAND_ICON = '/store/store.webp'

export const STORE_CATEGORY_ICON: Record<ProductCategory, string> = {
  음료: '/store/water.webp',
  식품: '/store/kimbap.webp',
  간식: '/store/lollipop.webp',
  프리미엄: '/store/ice_cream.webp',
}

/** baseId → 이미지 로드 실패 시 이모지 폴백 */
export const STORE_PRODUCT_EMOJI_FALLBACK: Record<string, string> = {
  p1: '💧',
  p2: '🍙',
  p3: '🍭',
  p4: '🍫',
  p5: '🍌',
  p6: '🍜',
  p7: '🍱',
  p8: '🥤',
  p9: '🍦',
  p10: '🍗',
  p11: '🍫',
  p12: '🍞',
  p13: '🍢',
}

export function getCategoryImage(category: ProductCategory): string {
  return STORE_CATEGORY_ICON[category]
}
