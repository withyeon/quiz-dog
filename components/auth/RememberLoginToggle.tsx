'use client'

interface RememberLoginToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** 로그인 폼의 "자동 로그인" 체크박스 */
export default function RememberLoginToggle({ checked, onChange, disabled }: RememberLoginToggleProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-black"
      />
      <span className="flex flex-col">
        <span className="text-sm font-black text-black">자동 로그인</span>
        <span className="text-xs font-medium text-slate-400">
          {checked
            ? '브라우저를 닫아도 로그인이 유지돼요. 공용 컴퓨터에서는 꺼 주세요.'
            : '브라우저를 닫으면 로그아웃돼요.'}
        </span>
      </span>
    </label>
  )
}
