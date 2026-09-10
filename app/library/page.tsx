import type { Metadata } from 'next'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { listPublicSets } from '@/lib/services/sharing'
import { SITE_NAME } from '@/lib/seo/site'

// 자료실은 문제집이 추가되면 반영돼야 하지만 실시간일 필요는 없다.
// 5분 캐시면 검색엔진에도 잡히고 목록 트래픽도 DB를 거의 안 친다.
export const revalidate = 300

export const metadata: Metadata = {
  title: '자료실',
  description:
    '선생님들이 공유한 문제집을 로그인 없이 둘러보세요. 마음에 드는 문제집은 게임 모드를 골라 바로 수업에 쓸 수 있어요.',
  alternates: { canonical: '/library' },
  openGraph: {
    title: `자료실 | ${SITE_NAME}`,
    description: '선생님들이 공유한 문제집을 로그인 없이 둘러보세요.',
  },
}

export default async function PublicLibraryPage() {
  const sets = await listPublicSets()

  return (
    <div className="min-h-dvh bg-sky-50/60">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-32 sm:px-6">
        <header className="text-center">
          <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">자료실</h1>
          <p className="mx-auto mt-3 max-w-xl text-base font-medium leading-relaxed text-slate-600">
            선생님들이 공유한 문제집이에요. 로그인 없이 문제를 미리 볼 수 있고,
            수업에 쓸 때만 로그인하면 돼요.
          </p>
        </header>

        {sets.length === 0 ? (
          <div className="mt-12 rounded-3xl border-2 border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-700">아직 공유된 문제집이 없어요</p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              첫 문제집을 만들어 공유해 보세요.
            </p>
            <Link
              href="/teacher/create"
              className="mt-6 inline-flex rounded-xl bg-sky-500 px-5 py-3 font-black text-white transition hover:bg-sky-600"
            >
              문제집 만들기
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((set) => {
              const summary = [set.grade, set.subject, `${set.questionCount}문항`]
                .filter(Boolean)
                .join(' · ')

              const card = (
                <div className="flex h-full flex-col justify-between rounded-2xl border-2 border-sky-100 bg-white p-5 transition group-hover:border-sky-300 group-hover:shadow-sm">
                  <div>
                    <h2 className="line-clamp-2 text-lg font-black leading-snug text-slate-900">
                      {set.title}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">{summary}</p>
                    {set.description && (
                      <p className="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
                        {set.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm font-bold">
                    <span className="text-slate-400">
                      {set.ownerName ? `${set.ownerName} 선생님` : SITE_NAME}
                    </span>
                    {set.likeCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-rose-500">
                        <Heart className="h-4 w-4 fill-current" />
                        {set.likeCount}
                      </span>
                    )}
                  </div>
                </div>
              )

              // 공유 코드가 없는 문제집은 열 주소가 없다. 마이그레이션이 코드를 채우므로
              // 정상적으로는 안 생기지만, 목록에서 빼는 대신 눌리지 않게만 둔다.
              return set.shareCode ? (
                <Link key={set.id} href={`/s/${set.shareCode}`} className="group block">
                  {card}
                </Link>
              ) : (
                <div key={set.id} className="group block opacity-60">{card}</div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
