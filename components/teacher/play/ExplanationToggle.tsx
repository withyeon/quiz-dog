'use client'

/**
 * 방 옵션 "틀리면 해설 보여주기" 스위치. 학생이 틀렸을 때 정답 아래에 해설을 보여줄지 정한다.
 * 방을 만들 때 rooms.settings 에 담긴다(lib/quiz/explanationSetting.ts).
 * 쓰는 곳: 선생님 방 만들기(CreateRoomPanel), 개발자 페이지(/dev).
 */
export default function ExplanationToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title="해설이 있는 문제만 보여요. 해설을 읽을 수 있게 오답 화면이 5초 동안 떠 있어요."
      className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-3.5 text-base font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-100 ${
        checked
          ? 'border-sky-400 bg-sky-50 text-sky-800'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
      }`}
    >
      <span>틀리면 해설 보여주기</span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
