import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSharedSetByCode } from '@/lib/services/sharing'
import { SITE_NAME, SITE_URL } from '@/lib/seo/site'
import { cardsFromQuestions } from '@/lib/vocab/cards'
import VocabStudyApp from '@/components/vocab/study/VocabStudyApp'

// 공유 페이지(/s/[code])와 같은 이유로 60초 캐시 — 선생님이 카드를 고치면 곧 반영된다.
export const revalidate = 60

type PageProps = {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const set = await getSharedSetByCode(code)
  if (!set || !set.isVocab) {
    return { title: '찾을 수 없는 단어장', robots: { index: false, follow: false } }
  }
  const description = `카드 ${set.questionCount}장 · 카드 뒤집기, 익히기, 쓰기, 시험 보기로 혼자 공부해요.`
  return {
    title: `${set.title} · 단어장`,
    description,
    alternates: { canonical: `/cards/${code}` },
    openGraph: {
      type: 'article',
      title: `${set.title} · 단어장 | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/cards/${code}`,
    },
  }
}

export default async function VocabStudyPage({ params }: PageProps) {
  const { code } = await params
  const set = await getSharedSetByCode(code)

  if (!set) notFound()
  // 보통 문제집 링크로 들어오면 문제집 공유 페이지로 보낸다
  if (!set.isVocab) redirect(`/s/${code}`)

  return (
    <VocabStudyApp
      set={{
        id: set.id,
        title: set.title,
        subject: set.subject,
        grade: set.grade,
        ownerName: set.ownerName,
        cards: cardsFromQuestions(set.questions),
      }}
    />
  )
}
