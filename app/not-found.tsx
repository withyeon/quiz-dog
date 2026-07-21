import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center p-6 font-bitbit bg-[#d9eef5]"
    >
      <div className="w-full max-w-md rounded-2xl border-4 border-[#0c3b42]/15 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot_pome.png"
          alt=""
          width={120}
          height={120}
          className="mx-auto mb-5 h-28 w-28 object-contain drop-shadow-lg"
        />
        <div className="mb-2 text-5xl font-black text-[#0c3b42]">404</div>
        <h1 className="mb-3 text-2xl font-black text-[#17262a]">길을 잃었어요</h1>
        <p className="mb-7 text-base font-bold leading-relaxed text-slate-600">
          찾으시는 페이지가 없어요.
          <br />
          주소를 다시 확인하거나 처음으로 돌아가 주세요.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-[#0c3b42] px-7 py-3 text-lg font-black text-white shadow-lg transition-colors hover:bg-[#0a2f35]"
        >
          처음으로
        </Link>
      </div>
    </div>
  )
}
