import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSharedSetByCode, bumpShareView } from '@/lib/services/sharing'
import { SITE_NAME, SITE_URL } from '@/lib/seo/site'
import SharedSetView from '@/components/share/SharedSetView'

// 공유 링크는 원작자가 문제를 고치면 바로 반영돼야 한다.
// 다만 인디스쿨 글 하나에서 트래픽이 몰리는 형태라 매 요청마다 DB를 치는 건 낭비다.
// 60초 캐시면 "고쳤는데 안 바뀌네" 체감 없이 몰림을 흡수한다.
export const revalidate = 60

type PageProps = {
  params: Promise<{ code: string }>
}

function describe(set: { subject: string | null; grade: string | null; questionCount: number }): string {
  return [set.grade, set.subject, `${set.questionCount}문항`]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const set = await getSharedSetByCode(code)

  if (!set) {
    return {
      title: '찾을 수 없는 문제집',
      robots: { index: false, follow: false },
    }
  }

  const summary = describe(set)
  const byline = set.ownerName ? `${set.ownerName} 선생님` : SITE_NAME
  const description = set.description?.trim()
    || `${summary} · ${byline}이(가) 만든 문제집입니다. 게임 모드를 골라 바로 수업에 쓰세요.`

  return {
    title: set.title,
    description,
    alternates: { canonical: `/s/${code}` },
    openGraph: {
      type: 'article',
      title: `${set.title} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/s/${code}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${set.title} | ${SITE_NAME}`,
      description,
    },
  }
}

export default async function SharedSetPage({ params }: PageProps) {
  const { code } = await params
  const set = await getSharedSetByCode(code)

  if (!set) notFound()

  // 조회수는 부가 정보라 실패해도 페이지 렌더를 막지 않는다.
  void bumpShareView(code)

  return <SharedSetView set={set} />
}
