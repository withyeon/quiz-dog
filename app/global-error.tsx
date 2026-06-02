'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('치명적 오류:', error)
  }, [error])

  // 루트 레이아웃을 대체하므로 globals.css가 로드되지 않을 수 있어 인라인 스타일을 사용한다.
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#d9eef5',
          fontFamily:
            "'Noto Sans KR', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            borderRadius: '16px',
            border: '4px solid rgba(12,59,66,0.15)',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(15,23,42,0.18)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot_pome.png"
            alt=""
            width={112}
            height={112}
            style={{ width: '112px', height: '112px', objectFit: 'contain', marginBottom: '20px' }}
          />
          <h1 style={{ margin: '0 0 12px', fontSize: '28px', fontWeight: 900, color: '#17262a' }}>
            앗, 문제가 생겼어요
          </h1>
          <p
            style={{
              margin: '0 0 28px',
              fontSize: '16px',
              fontWeight: 700,
              lineHeight: 1.6,
              color: '#475569',
            }}
          >
            앱에 예상치 못한 오류가 발생했어요.
            <br />
            다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: '12px',
              backgroundColor: '#0c3b42',
              padding: '12px 28px',
              fontSize: '18px',
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: '0 10px 20px rgba(12,59,66,0.25)',
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
