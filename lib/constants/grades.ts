export const TARGET_GRADE_OPTIONS = [
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
  if ((TARGET_GRADE_OPTIONS as readonly string[]).includes(grade)) {
    return grade
  }

  const [level, number] = grade.split('-')
  if (level === 'elementary' && number) return `초${number}`
  if (level === 'middle' && number) return `중${number}`
  if (level === 'high' && number) return `고${number}`

  return grade
}
