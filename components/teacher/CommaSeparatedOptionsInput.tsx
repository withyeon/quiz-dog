'use client'

import { useState } from 'react'
import type { Json } from '@/types/database.types'

/**
 * 객관식 보기를 "보기1, 보기2, 보기3"처럼 한 줄로 받는 칸(세트 편집 화면).
 *
 * 예전에는 칠 때마다 글자를 보기 배열로 바꾼 뒤 그 배열을 다시 이어 붙여 보여줬다. 그러면 막 친 쉼표 뒤가
 * 빈 보기로 걸러져 쉼표가 바로 사라져서, 다음 보기를 손으로 칠 수 없었다(붙여 넣기만 됐다).
 * 그래서 입력하는 동안에는 친 글자를 그대로 들고 있고, 보기 배열은 매번 따로 만들어 올린다.
 * 저장 형식(빈 칸을 뺀 문자열 배열)은 그대로다. 칸을 벗어나면 "보기1, 보기2" 모양으로 정리돼 보인다.
 */
export default function CommaSeparatedOptionsInput({
  options,
  onChange,
  className,
  placeholder,
}: {
  options: Json | undefined
  onChange: (options: string[]) => void
  className?: string
  placeholder?: string
}) {
  const joined = Array.isArray(options) ? options.join(', ') : ''
  // null 이면 입력 중이 아니다 → 저장된 보기 배열을 이어 붙여 보여준다
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      type="text"
      value={draft ?? joined}
      onFocus={() => setDraft(joined)}
      onChange={(e) => {
        setDraft(e.target.value)
        onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
      }}
      onBlur={() => setDraft(null)}
      className={className}
      placeholder={placeholder}
    />
  )
}
