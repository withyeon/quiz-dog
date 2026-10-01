'use client'

import { TARGET_GRADE_OPTIONS } from '@/lib/constants/grades'
import SubjectSelect from '@/components/teacher/SubjectSelect'

interface AudienceFieldsProps {
  grade: string
  onGradeChange: (grade: string) => void
  subject: string
  onSubjectChange: (subject: string) => void
  disabled?: boolean
  /** 검수 화면처럼 좁은 곳에서는 학년도 드롭다운으로 */
  compact?: boolean
}

export const selectClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50'

/**
 * 2단계 — 누구에게 낼 문제인지. 학년은 AI 난이도의 가장 큰 손잡이라 드롭다운 대신 한 번에 보이는 칩으로 둔다.
 * 저장할 때도 필요한 값이라 여기서 미리 받아 두면 마지막에 "과목을 선택하세요" 오류를 만나지 않는다.
 */
export default function AudienceFields({
  grade,
  onGradeChange,
  subject,
  onSubjectChange,
  disabled = false,
  compact = false,
}: AudienceFieldsProps) {
  if (compact) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="audience-grade" className="mb-1.5 block text-sm font-bold text-slate-700">학년</label>
          <select
            id="audience-grade"
            value={grade}
            onChange={(e) => onGradeChange(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            <option value="">학년 선택</option>
            {TARGET_GRADE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audience-subject" className="mb-1.5 block text-sm font-bold text-slate-700">과목</label>
          <SubjectSelect
            id="audience-subject"
            value={subject}
            onChange={onSubjectChange}
            grade={grade}
            placeholder="과목 선택"
            className={selectClass}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-bold text-slate-700">학년</span>
          {!grade && <span className="text-xs font-semibold text-amber-600">골라 주세요</span>}
        </div>
        <div role="radiogroup" aria-label="대상 학년" className="flex flex-wrap gap-1.5">
          {TARGET_GRADE_OPTIONS.map((option) => {
            const active = grade === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onGradeChange(option)}
                className={`h-10 rounded-xl border px-3.5 text-sm font-black transition ${
                  active
                    ? 'border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {option}
              </button>
            )
          })}
        </div>
        <p className="mt-2 break-keep text-xs font-medium leading-5 text-slate-500">
          학년에 맞춰 낱말과 문장 길이, 난이도를 조절해요. 학년과 상관없는 퀴즈는 <span className="font-bold text-slate-700">전체</span>를 고르세요.
        </p>
      </div>
      <div>
        <label htmlFor="audience-subject" className="mb-2 block text-sm font-bold text-slate-700">과목</label>
        <SubjectSelect
          id="audience-subject"
          value={subject}
          onChange={onSubjectChange}
          grade={grade}
          placeholder="과목 선택"
          className={selectClass}
        />
        <p className="mt-2 text-xs font-medium leading-5 text-slate-500">자료실에서 찾을 때 쓰는 분류예요.</p>
      </div>
    </div>
  )
}
