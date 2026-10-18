'use client'

/**
 * 선생님이 일시정지했을 때 학생 화면 전체를 덮는 안내.
 * 해적왕·카페·눈싸움 등은 각자 비슷한 덮개를 그리고 있었지만 마피아·좀비·점프점프·간식런은 아무 표시가 없어서
 * (마피아는 화면이 아예 비었다) 학생이 멈춘 줄 모르고 계속 눌렀다 — 2026-10-18 25명 검수에서 발견.
 */
export default function PausedOverlay({ show, dark = false }: { show: boolean; dark?: boolean }) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div
        className={dark
          ? 'rounded-2xl border-4 border-yellow-500 bg-black/90 px-8 py-6 text-center shadow-2xl'
          : 'rounded-2xl bg-white px-8 py-6 text-center shadow-2xl'}
      >
        <div className={`text-3xl font-black break-keep ${dark ? 'text-yellow-300' : 'text-slate-900'}`}>선생님이 잠깐 멈췄어요</div>
        <div className={`mt-2 text-base font-bold ${dark ? 'text-gray-300' : 'text-slate-500'}`}>다시 시작하면 이어서 할 수 있어요</div>
      </div>
    </div>
  )
}
