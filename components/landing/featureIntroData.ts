import { Sparkles, KeyRound, BarChart3, Library, type LucideIcon } from 'lucide-react'

/**
 * 랜딩 '기능 소개' 섹션 카드.
 * 카드는 /features 페이지의 같은 주제 섹션으로 연결된다(앵커가 어긋나지 않게 주의).
 * 게임 모드는 바로 위 '게임 라인업' 섹션에서 이미 보여주므로 여기서는 다루지 않는다.
 */
export type FeatureIntroItem = {
  title: string
  description: string
  features: string[]
  /** 카드가 이동할 기능 소개 페이지 위치 */
  href: string
  icon: LucideIcon
  /** 아이콘 타일·체크·호버 테두리에 쓰는 강조색 */
  accent: string
}

export const FEATURE_INTRO_ITEMS: FeatureIntroItem[] = [
  {
    title: 'AI 문제 생성',
    description: '자료만 올리면 문제집이 됩니다',
    features: ['유튜브 영상에서', '학습지·PDF에서', '시험지 스캔에서'],
    href: '/features#ai',
    icon: Sparkles,
    accent: '#0EA5E9',
  },
  {
    title: '학생 참여',
    description: '코드 하나로 전원 입장',
    features: ['가입도 설치도 없이', '닉네임 + 강아지 캐릭터', '비속어 자동 차단'],
    href: '/features#play',
    icon: KeyRound,
    accent: '#F43F5E',
  },
  {
    title: '결과 리포트',
    description: '게임 한 판이 형성평가로',
    features: ['문항별 정답률', '학생별 상세 기록', '지난 게임 기록 보관'],
    href: '/features#report',
    icon: BarChart3,
    accent: '#10B981',
  },
  {
    title: '자료실',
    description: '다른 선생님 문제집을 그대로',
    features: ['공개 문제집 가져오기', '우리 반에 맞게 수정', '처음부터 안 만들어도 돼요'],
    href: '/features#library',
    icon: Library,
    accent: '#14B8A6',
  },
]
