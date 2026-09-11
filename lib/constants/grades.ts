/** 학년과 상관없는 문제집(계기교육·창체 등)에 쓰는 값. */
export const ANY_GRADE = '전체'

export const TARGET_GRADE_OPTIONS = [
  ANY_GRADE,
  '초1',
  '초2',
  '초3',
  '초4',
  '초5',
  '초6',
  '중학교',
  '고등학교',
] as const

export type TargetGrade = (typeof TARGET_GRADE_OPTIONS)[number]

export const ELEMENTARY_GRADE_NUMBERS = ['3', '4', '5', '6'] as const

export function formatGradeLabel(grade: string): string {
  // 자료실은 학년을 'elementary-3' 꼴로 정규화하고, 학년 무관은 'all'로 둔다.
  if (grade === 'all') return ANY_GRADE

  if ((TARGET_GRADE_OPTIONS as readonly string[]).includes(grade)) {
    return grade
  }

  const [level, number] = grade.split('-')
  if (level === 'elementary' && number) return `초${number}`
  if (level === 'middle' && number) return `중${number}`
  if (level === 'high' && number) return `고${number}`

  return grade
}
