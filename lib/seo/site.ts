/**
 * 사이트 기본 정보 — 검색엔진 노출(robots·sitemap·메타데이터)에서 한 곳만 보고 쓴다.
 * 도메인이 바뀌면 NEXT_PUBLIC_SITE_URL 환경변수만 바꾸면 된다.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://quizdog.kr').replace(/\/$/, '')

/**
 * 네이버 서치어드바이저 소유확인 코드.
 * 공개되는 값이라 코드에 둬도 안전하다(재발급 시 이 값만 교체).
 */
export const NAVER_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || '40a205a72d7e7baea1c6ecc8f4ee87e2f55c38a6'

/** 구글 서치콘솔 소유확인 코드 — HTML 태그 방식으로 받으면 여기에 넣는다. */
export const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || ''

export const SITE_NAME = '퀴즈독'

export const SITE_TITLE = '퀴즈독 - 교실을 게임으로 바꾸는 수업 퀴즈 플랫폼'

export const SITE_DESCRIPTION =
  '퀴즈독은 수업 자료만 올리면 AI가 문제를 만들고, 학생들은 코드 하나로 들어와 게임으로 푸는 학습 퀴즈 플랫폼입니다. 학생은 가입 없이 참여하고, 선생님은 무료 플랜으로 바로 시작할 수 있어요.'

/** 검색 노출에 쓰는 대표 키워드 */
export const SITE_KEYWORDS = [
  '퀴즈독',
  'quizdog',
  '수업 퀴즈',
  '교실 퀴즈 게임',
  '학급 퀴즈',
  'AI 문제 생성',
  '형성평가',
  '초등 퀴즈 게임',
  '수업 게임',
  '퀴즈 플랫폼',
]

/**
 * 검색엔진이 색인하면 안 되는 경로.
 * - 방 코드가 있어야 열리는 게임 화면(색인해도 빈 페이지만 잡힘)
 * - 로그인이 필요한 선생님·관리자 영역
 */
export const NO_INDEX_PATHS = [
  '/api/',
  '/admin',
  '/teacher',
  '/dev',
  '/auth/',
  '/game',
  '/battle',
  '/fishing',
  '/factory',
  '/cafe',
  '/mafia',
  '/tower',
  '/zombie',
  '/dontlookdown',
  '/gansik-run',
  '/puppy-chaos',
  '/play',
  '/student',
  '/teach',
]

/** sitemap.xml에 넣는 공개 페이지 */
export const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/features', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/lobby', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
]
