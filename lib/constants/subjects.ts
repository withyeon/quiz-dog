/**
 * 과목 목록 — 자료실(/teacher/library)에서 쓰던 분류를 한 곳으로 모았다.
 *
 * 문제집을 만들 때와 자료실에서 고를 때 과목이 서로 다르면
 * 자료실 필터에 안 걸리는 문제집이 생긴다. 전부 이 파일만 보고 쓴다.
 *
 * 저장은 화면에 보이는 한글 이름('국어')으로 한다.
 * id('korean')는 자료실 필터와 AI 프롬프트 밖에서는 쓰지 않는다.
 */

export type SchoolLevel = 'elementary' | 'middle' | 'high'

export type SubjectOption = { id: string; name: string }

/** 초·중·고에 공통으로 있는 과목 */
export const BASE_SUBJECTS: SubjectOption[] = [
  { id: 'korean', name: '국어' },
  { id: 'math', name: '수학' },
  { id: 'english', name: '영어' },
  { id: 'social', name: '사회' },
  { id: 'science', name: '과학' },
  { id: 'ethics', name: '도덕' },
  { id: 'pe', name: '체육' },
  { id: 'music', name: '음악' },
  { id: 'art', name: '미술' },
]

/** 학교급마다 실제로 배우는 과목이 다르다 (초등 실과, 중등 역사, 고등 한국사 …) */
export const SUBJECTS_BY_LEVEL: Record<SchoolLevel, SubjectOption[]> = {
  elementary: [
    { id: 'integrated', name: '통합교과' },
    ...BASE_SUBJECTS,
    { id: 'practical_arts', name: '실과' },
    { id: 'creative', name: '창체' },
  ],
  middle: [
    ...BASE_SUBJECTS,
    { id: 'history', name: '역사' },
    { id: 'tech_home', name: '기술·가정' },
    { id: 'information', name: '정보' },
    { id: 'creative', name: '창체' },
  ],
  high: [
    ...BASE_SUBJECTS,
    { id: 'history', name: '한국사' },
    { id: 'tech_home', name: '기술·가정' },
    { id: 'information', name: '정보' },
    { id: 'second_language', name: '제2외국어/한문' },
    { id: 'career', name: '진로와 직업' },
    { id: 'creative', name: '창체' },
  ],
}

/** 학교급을 안 정했을 때 보여주는 전체 목록 */
export const ALL_SUBJECTS: SubjectOption[] = [
  { id: 'integrated', name: '통합교과' },
  ...BASE_SUBJECTS,
  { id: 'practical_arts', name: '실과' },
  { id: 'history', name: '역사/한국사' },
  { id: 'tech_home', name: '기술·가정' },
  { id: 'information', name: '정보' },
  { id: 'second_language', name: '제2외국어/한문' },
  { id: 'career', name: '진로와 직업' },
  { id: 'creative', name: '창체' },
]

/**
 * 예전에 저장된 과목 이름을 id로 되돌리는 표.
 * 목록에서 뺀 이름('기타')이나 학교급마다 다른 이름('역사'/'한국사')도 여기서 흡수한다.
 */
export const SUBJECT_ALIASES: Record<string, string> = {
  통합교과: 'integrated',
  바른생활: 'integrated',
  '바른 생활': 'integrated',
  슬기로운생활: 'integrated',
  '슬기로운 생활': 'integrated',
  즐거운생활: 'integrated',
  '즐거운 생활': 'integrated',
  창체: 'creative',
  창의적체험활동: 'creative',
  '창의적 체험활동': 'creative',
  국어: 'korean',
  수학: 'math',
  사회: 'social',
  과학: 'science',
  영어: 'english',
  도덕: 'ethics',
  체육: 'pe',
  음악: 'music',
  미술: 'art',
  실과: 'practical_arts',
  기술가정: 'tech_home',
  '기술·가정': 'tech_home',
  '기술ㆍ가정': 'tech_home',
  '기술 가정': 'tech_home',
  정보: 'information',
  역사: 'history',
  한국사: 'history',
  '역사/한국사': 'history',
  제2외국어: 'second_language',
  한문: 'second_language',
  '제2외국어/한문': 'second_language',
  '진로와 직업': 'career',
  진로와직업: 'career',
  기타: 'integrated',
}

/** 학교급에 맞는 과목 목록. 학년을 안 골랐으면 전체 목록을 준다. */
export function getSubjectsForLevel(level: SchoolLevel | null | undefined): SubjectOption[] {
  return level ? SUBJECTS_BY_LEVEL[level] : ALL_SUBJECTS
}

/** '초3' · '중학교' · 'elementary-3' 같은 여러 표기에서 학교급만 뽑아낸다. */
export function schoolLevelFromGrade(grade: string | null | undefined): SchoolLevel | null {
  const value = grade?.trim()
  if (!value) return null

  if (value.startsWith('elementary')) return 'elementary'
  if (value.startsWith('middle')) return 'middle'
  if (value.startsWith('high')) return 'high'

  if (value.startsWith('초')) return 'elementary'
  if (value.startsWith('중')) return 'middle'
  if (value.startsWith('고')) return 'high'

  return null
}

/** 저장된 과목 값을 id로 바꾼다. 못 알아보면 fallback. */
export function normalizeSubjectId(
  value: string | null | undefined,
  fallback = 'integrated',
): string {
  const subject = value?.trim()
  if (!subject) return fallback
  if (ALL_SUBJECTS.some((item) => item.id === subject)) return subject
  return SUBJECT_ALIASES[subject] ?? fallback
}

/** id로 전체 목록의 표시 이름을 찾는다. */
export function getSubjectName(subjectId: string): string {
  return ALL_SUBJECTS.find((item) => item.id === subjectId)?.name ?? '통합교과'
}

/**
 * 학교급이 바뀌었을 때 고르고 있던 과목을 그 학교급 이름으로 옮긴다.
 * 중등 '역사'에서 고등으로 바꾸면 '한국사'가 된다.
 * 옮길 데가 없으면(초등 '실과' → 중등) 원래 값을 그대로 둔다.
 */
export function remapSubjectToLevel(
  subjectName: string,
  level: SchoolLevel | null | undefined,
): string {
  if (!subjectName) return subjectName

  const options = getSubjectsForLevel(level)
  if (options.some((item) => item.name === subjectName)) return subjectName

  const id = SUBJECT_ALIASES[subjectName]
  if (!id) return subjectName

  return options.find((item) => item.id === id)?.name ?? subjectName
}
