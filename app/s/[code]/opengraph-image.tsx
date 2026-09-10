import { ImageResponse } from 'next/og'
import { getSharedSetByCode } from '@/lib/services/sharing'

export const runtime = 'nodejs'
export const alt = '퀴즈독 문제집'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * 공유 링크를 인디스쿨·카톡·메신저에 붙였을 때 뜨는 미리보기 카드.
 *
 * 링크 공유가 주 유입 경로이므로, 모든 문제집이 같은 기본 이미지로 뜨면
 * 클릭할 이유가 없어진다. 제목·학년·과목·문항수를 카드에 박아
 * "무슨 문제집인지"를 열기 전에 알 수 있게 한다.
 *
 * 폰트는 따로 싣지 않는다. next/og 기본 폰트로도 한글이 렌더되며,
 * 웹폰트를 읽어오면 카드 생성이 느려지고 실패 지점이 하나 늘어난다.
 */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const set = await getSharedSetByCode(code)

  const title = set?.title ?? '퀴즈독 문제집'
  const meta = set
    ? [set.grade, set.subject, `${set.questionCount}문항`].filter(Boolean).join(' · ')
    : '수업을 게임처럼'
  const byline = set?.ownerName ? `${set.ownerName} 선생님` : '퀴즈독'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #E0F2FE 0%, #F0F9FF 45%, #FFFFFF 100%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#0284C7' }}>
            공유받은 문제집
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontSize: title.length > 22 ? 68 : 84,
              fontWeight: 900,
              color: '#0F172A',
              lineHeight: 1.15,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 36, fontWeight: 700, color: '#475569' }}>
            {meta}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#64748B' }}>
            {byline}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: '#0EA5E9',
              color: '#FFFFFF',
              padding: '18px 34px',
              borderRadius: 999,
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            퀴즈독에서 바로 수업하기
          </div>
        </div>
      </div>
    ),
    size,
  )
}
