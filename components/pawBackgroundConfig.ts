/** 발자국 이미지 경로 — 파일 교체 시 이 상수만 수정 */
export const PAW_SRC = '/main/images/paw.svg'
export const PAW2_SRC = '/main/images/paw2.svg'

export type PawPrintConfig = {
  variant: 'paw' | 'paw2'
  top?: string
  left?: string
  right?: string
  bottom?: string
  /** 데스크톱 기준 크기 (px) */
  size: number
  /** 모바일 기준 크기 (px) — 생략 시 size의 85% */
  mobileSize?: number
  rotate: number
  opacity: number
  /** left: 50% 기준 가로 중앙 정렬 */
  centerX?: boolean
  /** 예: 'hidden sm:block' — 작은 화면에서 숨김 */
  visibility?: string
}

/** 가장자리 + 가로 중앙에 은은하게 배치 — paw / paw2 번갈아 사용 */
export const PAW_PRINTS: PawPrintConfig[] = [
  { variant: 'paw', top: '4%', left: '3%', size: 32, rotate: -18, opacity: 0.26 },
  { variant: 'paw2', top: '7%', right: '4%', size: 36, rotate: 22, opacity: 0.44 },
  { variant: 'paw', top: '14%', left: '2%', size: 28, rotate: 10, opacity: 0.24, visibility: 'hidden sm:block' },
  { variant: 'paw2', top: '12%', right: '7%', size: 38, rotate: -12, opacity: 0.46, visibility: 'hidden md:block' },
  { variant: 'paw', top: '28%', left: '2%', size: 30, rotate: -24, opacity: 0.28 },
  { variant: 'paw2', top: '32%', right: '3%', size: 34, rotate: 18, opacity: 0.42 },
  { variant: 'paw', top: '48%', left: '4%', size: 28, rotate: 14, opacity: 0.25, visibility: 'hidden lg:block' },
  { variant: 'paw2', top: '52%', right: '5%', size: 36, rotate: -20, opacity: 0.48 },
  { variant: 'paw', top: '66%', left: '3%', size: 30, rotate: 8, opacity: 0.26 },
  { variant: 'paw2', top: '70%', right: '4%', size: 32, rotate: 28, opacity: 0.45 },
  { variant: 'paw', top: '82%', left: '5%', size: 28, rotate: -10, opacity: 0.24 },
  { variant: 'paw2', top: '88%', right: '6%', size: 34, rotate: -16, opacity: 0.44 },
  // 가로 중앙 (작게, 세로는 위·중·아래로 분산)
  { variant: 'paw2', top: '18%', left: '50%', centerX: true, size: 26, rotate: 10, opacity: 0.4, visibility: 'hidden sm:block' },
  { variant: 'paw', top: '36%', left: '46%', size: 24, rotate: -12, opacity: 0.22, visibility: 'hidden md:block' },
  { variant: 'paw2', top: '50%', left: '54%', size: 28, rotate: 16, opacity: 0.42 },
  { variant: 'paw', top: '62%', left: '44%', size: 26, rotate: 8, opacity: 0.24, visibility: 'hidden sm:block' },
  { variant: 'paw2', top: '78%', left: '50%', centerX: true, size: 28, rotate: -18, opacity: 0.44 },
]
