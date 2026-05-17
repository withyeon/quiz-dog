/** 기능 소개 카드 아이콘 — PNG 교체 시 경로만 수정 */
export const FEATURE_ICON_AI = '/images/feature-ai-quiz.png'
export const FEATURE_ICON_GAME = '/images/feature-game-mode.png'
export const FEATURE_ICON_REPORT = '/images/feature-report.png'

export type FeatureIntroItem = {
  title: string
  description: string
  features: string[]
  buttonLabel: string
  iconSrc: string
  fallbackEmoji: string
}

export function getFeatureIntroItems(gameModeCount: number): FeatureIntroItem[] {
  return [
    {
      title: 'AI 문제 생성',
      description: '문서만 올리면 퀴즈 완성!',
      features: ['유튜브 자막 추출', 'PDF 문서 분석', '다양한 문제 유형'],
      buttonLabel: '기능 보기 →',
      iconSrc: FEATURE_ICON_AI,
      fallbackEmoji: '🤖',
    },
    {
      title: `${gameModeCount}가지 게임 모드`,
      description: '퀴즈가 바로 게임이 돼요!',
      features: ['실시간 대결', '팀 플레이', '개인 미션'],
      buttonLabel: '게임 보기 →',
      iconSrc: FEATURE_ICON_GAME,
      fallbackEmoji: '🎮',
    },
    {
      title: '상세 리포트',
      description: '학습 결과를 한눈에 확인!',
      features: ['실시간 통계', '엑셀 다운로드', '개인별 분석'],
      buttonLabel: '리포트 보기 →',
      iconSrc: FEATURE_ICON_REPORT,
      fallbackEmoji: '📊',
    },
  ]
}
