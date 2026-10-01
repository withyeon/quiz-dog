/**
 * 랜딩 '기능 소개' 섹션 카드.
 * 카드는 /features 페이지의 같은 주제 섹션으로 연결된다(앵커가 어긋나지 않게 주의).
 * 게임 모드는 바로 위 '게임 라인업' 섹션에서 이미 보여주므로 여기서는 다루지 않는다.
 *
 * screenshot 은 헤드리스 Chrome(CDP, 1280×800 @2x)으로 실제 화면을 찍어 사이드바(2x 기준 left 512)와
 * 상단 바(top 96)를 잘라내고 1280×800 webp(q82)로 저장한 것. /features 페이지(FeaturesContent.tsx)는 리포트 표 2장만 같은 폴더에서 쓰고
 * 나머지 기능 화면은 짧은 반복 클립(FeatureClip, public/main/mp4/features/)으로 보여 준다.
 *   ai           → /teacher/create ('오늘 배울 내용' 선택)   report          → TeacherPostGameReport 상단(샘플 8명·5문항)
 *   play         → /lobby 캐릭터 선택 단계(샘플 8명)          report-matrix   → 같은 리포트 '문항별 분석' 매트릭스 뷰
 *   library      → /teacher/library 목록(샘플 제목)           report-students → 같은 리포트 '학생별 분석' 표
 * 교사 화면은 로그인이 필요하므로 app/dev/shot/<x>/page.tsx 임시 페이지에서 DashboardLayout 안에
 * 컴포넌트를 샘플 데이터로 렌더해 찍고, 찍은 뒤 폴더를 지운다. 화면이 바뀌면 같은 구도로 다시 찍어 교체한다.
 */
export type FeatureIntroItem = {
  title: string
  description: string
  /** icon 은 칩 앞에 붙는 public 픽셀 이미지 */
  features: { text: string; icon: string }[]
  /** 카드가 이동할 기능 소개 페이지 위치 */
  href: string
  /** 제목 옆 타일에 들어가는 public 픽셀 이미지 */
  icon: string
  /** 아이콘 타일·호버 테두리에 쓰는 강조색 */
  accent: string
  /** 실제 화면 캡처(16:10). public/main/features/ 아래, 캡처 방법은 파일 상단 주석 참고 */
  screenshot: string
}

export const FEATURE_INTRO_ITEMS: FeatureIntroItem[] = [
  {
    title: 'AI 문제 생성',
    description: '수업자료를 올리기만 하면 됩니다',
    features: [
      { text: '유튜브 영상에서', icon: '/icons/flip.webp' },
      { text: '학습지·PDF에서', icon: '/zombie/log.webp' },
      { text: '시험지 스캔에서', icon: '/icons/scan.webp' },
    ],
    href: '/features#ai',
    screenshot: '/main/features/ai.webp',
    icon: '/icons/rare.webp',
    accent: '#0EA5E9',
  },
  {
    title: '학생 참여',
    description: '코드 하나로 전원 입장',
    features: [
      { text: '가입도 설치도 없이', icon: '/icons/rocket.webp' },
      { text: '닉네임 + 강아지 캐릭터', icon: '/assets/icons/mascot-pome-64.png' },
      { text: '비속어 자동 차단', icon: '/icons/shield.webp' },
    ],
    href: '/features#play',
    screenshot: '/main/features/play.webp',
    icon: '/icons/ticket.webp',
    accent: '#F43F5E',
  },
  {
    title: '결과 리포트',
    description: '수업과 평가를 한 번에',
    features: [
      { text: '문항별 정답률', icon: '/icons/correct.webp' },
      { text: '학생별 상세 기록', icon: '/icons/people.webp' },
      { text: '지난 게임 기록 보관', icon: '/zombie/timer.webp' },
    ],
    href: '/features#report',
    screenshot: '/main/features/report.webp',
    icon: '/trophy.webp',
    accent: '#10B981',
  },
  {
    title: '자료실',
    description: '다양한 학년별, 과목별 문제',
    features: [
      { text: '다양한 문제', icon: '/gold-quest/treasure-chest.webp' },
      { text: '수정도 가능', icon: '/icons/lucky.webp' },
      { text: '간단한 수업준비', icon: '/icons/waiting.webp' },
    ],
    href: '/features#library',
    screenshot: '/main/features/library.webp',
    icon: '/zombie/quiz.webp',
    accent: '#14B8A6',
  },
]
