/**
 * 기능 소개 카드 아이콘.
 * 비워두면 fallbackEmoji를 그대로 사용한다(요청을 아예 보내지 않음).
 * PNG를 준비했다면 여기에 경로만 넣으면 이미지로 바뀐다.
 *
 * 주의: 존재하지 않는 경로를 넣으면 방문자마다 /_next/image 400 요청이 발생하고
 * 이모지로 폴백되기까지 아이콘이 깜빡인다.
 */
export const FEATURE_ICON_AI = ''
export const FEATURE_ICON_GAME = ''
export const FEATURE_ICON_REPORT = ''

export type FeatureIntroItem = {
  title: string
  description: string
  features: string[]
  buttonLabel: string
  /** 카드 버튼이 이동할 기능 소개 페이지 위치 */
  href: string
  iconSrc?: string
  fallbackEmoji: string
}

export function getFeatureIntroItems(gameModeCount: number): FeatureIntroItem[] {
  return [
    {
      title: 'AI 문제 생성',
      description: '문서만 올리면 퀴즈 완성!',
      features: ['유튜브 자막 추출', 'PDF 문서 분석', '다양한 문제 유형'],
      buttonLabel: '기능 보기 →',
      href: '/features#ai',
      iconSrc: FEATURE_ICON_AI,
      fallbackEmoji: '🤖',
    },
    {
      title: `${gameModeCount}가지 게임 모드`,
      description: '퀴즈가 바로 게임이 돼요!',
      features: ['실시간 대결', '팀 플레이', '개인 미션'],
      buttonLabel: '게임 보기 →',
      href: '/features#games',
      iconSrc: FEATURE_ICON_GAME,
      fallbackEmoji: '🎮',
    },
    {
      title: '상세 리포트',
      description: '학습 결과를 한눈에 확인!',
      features: ['실시간 통계', '엑셀 다운로드', '개인별 분석'],
      buttonLabel: '리포트 보기 →',
      href: '/features#report',
      iconSrc: FEATURE_ICON_REPORT,
      fallbackEmoji: '📊',
    },
  ]
}
