import { Sparkles, KeyRound, BarChart3, Library, type LucideIcon } from 'lucide-react'

/**
 * 랜딩 '기능 소개' 섹션 카드.
 * 카드는 /features 페이지의 같은 주제 섹션으로 연결된다(앵커가 어긋나지 않게 주의).
 * 게임 모드는 바로 위 '게임 라인업' 섹션에서 이미 보여주므로 여기서는 다루지 않는다.
 *
 * screenshot 은 헤드리스 Chrome(CDP, 1280×800 @2x)으로 실제 화면을 찍어 사이드바(2x 기준 left 512)와
 * 상단 바(top 96)를 잘라내고 1280×800 webp(q82)로 저장한 것. /features 페이지(FeaturesContent.tsx)도 같은 폴더를 쓴다.
 *   ai           → /teacher/create ('오늘 배울 내용' 선택)   report          → TeacherPostGameReport 상단(샘플 8명·5문항)
 *   ai-options   → 같은 화면의 '옵션'(문항 구성) 패널          report-matrix   → 같은 리포트 '문항별 분석' 매트릭스 뷰
 *   step-upload  → '수업 자료 넣기' 선택(드롭존)             report-students → 같은 리포트 '학생별 분석' 표
 *   step-review  → QuestionReviewEditor(샘플 4문항)          library         → /teacher/library 목록(샘플 제목)
 *   step-code    → 게임 시작 4단계(RoomCodePanel+대기 6명)    lobby-code      → /lobby 코드 입력(482913)
 *   play         → /lobby 캐릭터 선택 단계(샘플 8명)
 * 교사 화면은 로그인이 필요하므로 app/dev/shot/<x>/page.tsx 임시 페이지에서 DashboardLayout 안에
 * 컴포넌트를 샘플 데이터로 렌더해 찍고, 찍은 뒤 폴더를 지운다. 화면이 바뀌면 같은 구도로 다시 찍어 교체한다.
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
  /** 실제 화면 캡처(16:10). public/main/features/ 아래, 캡처 방법은 파일 상단 주석 참고 */
  screenshot: string
}

export const FEATURE_INTRO_ITEMS: FeatureIntroItem[] = [
  {
    title: 'AI 문제 생성',
    description: '자료만 올리면 문제집이 됩니다',
    features: ['유튜브 영상에서', '학습지·PDF에서', '시험지 스캔에서'],
    href: '/features#ai',
    screenshot: '/main/features/ai.webp',
    icon: Sparkles,
    accent: '#0EA5E9',
  },
  {
    title: '학생 참여',
    description: '코드 하나로 전원 입장',
    features: ['가입도 설치도 없이', '닉네임 + 강아지 캐릭터', '비속어 자동 차단'],
    href: '/features#play',
    screenshot: '/main/features/play.webp',
    icon: KeyRound,
    accent: '#F43F5E',
  },
  {
    title: '결과 리포트',
    description: '게임 한 판이 형성평가로',
    features: ['문항별 정답률', '학생별 상세 기록', '지난 게임 기록 보관'],
    href: '/features#report',
    screenshot: '/main/features/report.webp',
    icon: BarChart3,
    accent: '#10B981',
  },
  {
    title: '자료실',
    description: '다른 선생님 문제집을 그대로',
    features: ['공개 문제집 가져오기', '우리 반에 맞게 수정', '처음부터 안 만들어도 돼요'],
    href: '/features#library',
    screenshot: '/main/features/library.webp',
    icon: Library,
    accent: '#14B8A6',
  },
]
