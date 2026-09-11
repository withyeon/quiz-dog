'use client'

import { useMemo } from 'react'
import { getSubjectsForLevel, schoolLevelFromGrade } from '@/lib/constants/subjects'

type SubjectSelectProps = {
  value: string
  onChange: (value: string) => void
  /** 선택된 학년. 학교급에 맞는 과목만 보여주는 데 쓴다. */
  grade?: string
  /** 아무것도 고르지 않았을 때의 문구 */
  placeholder?: string
  className?: string
  id?: string
}

/**
 * 과목 드롭다운 — 문제집 만들기·검수·수정 화면이 같은 목록을 쓰도록 한 곳에 모았다.
 *
 * 학년을 고르면 그 학교급 과목만 남는다(초등에 '한국사'가 뜨지 않게).
 * 이미 저장돼 있던 과목이 목록에 없더라도 선택지로 남겨 둔다.
 * 그러지 않으면 칸이 빈 채로 보이고, 저장할 때 과목이 지워진다.
 */
export default function SubjectSelect({
  value,
  onChange,
  grade,
  placeholder = '전체/해당없음',
  className,
  id,
}: SubjectSelectProps) {
  const options = useMemo(() => {
    const levelOptions = getSubjectsForLevel(schoolLevelFromGrade(grade))
    const names = levelOptions.map((item) => item.name)

    // 지금 값이 목록에 없으면(예전 '기타', 학교급이 다른 과목) 맨 뒤에 붙여 준다.
    return value && !names.includes(value) ? [...names, value] : names
  }, [grade, value])

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">{placeholder}</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}
