'use client'

const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_Dvhbn'

/**
 * 화면 오른쪽 아래에 떠 있는 카카오톡 채널 상담 버튼.
 * 노란 원 안에 말풍선 두 개, 왼쪽에 "실시간 상담" 말풍선 라벨.
 */
export default function KakaoChannelButton() {
  return (
    <a
      href={KAKAO_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="카카오톡 채널로 실시간 상담"
      className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 sm:bottom-7 sm:right-7"
      style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}
    >
      {/* 라벨 말풍선 */}
      <span className="relative flex items-center">
        <span
          className="rounded-xl px-4 py-2 text-base font-black text-white"
          style={{ background: '#3C2A21', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}
        >
          실시간 상담
        </span>
        <span
          aria-hidden
          className="absolute -right-2 top-1/2 h-0 w-0 -translate-y-1/2"
          style={{ borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '9px solid #3C2A21' }}
        />
      </span>

      {/* 노란 원 + 말풍선 아이콘 */}
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
        style={{ background: '#FEE500', boxShadow: '0 6px 20px rgba(254,229,0,0.55), 0 2px 6px rgba(0,0,0,0.12)' }}
      >
        <svg viewBox="0 0 40 40" className="h-9 w-9" fill="#3C1E1E" aria-hidden>
          {/* 큰 말풍선 (왼쪽 위) */}
          <path d="M16 6C8.8 6 3 10.6 3 16.3c0 3.6 2.3 6.7 5.8 8.5l-1.3 4.9c-.1.4.3.7.7.5l5.7-3.8c.7.1 1.4.2 2.1.2 7.2 0 13-4.6 13-10.3S23.2 6 16 6z" />
          {/* 작은 말풍선 (오른쪽 아래) */}
          <path d="M28.5 19c-4.7 0-8.5 3-8.5 6.8 0 3.7 3.8 6.8 8.5 6.8.5 0 1 0 1.4-.1l3.7 2.5c.4.2.8-.1.7-.5l-.9-3.2c2.3-1.2 3.6-3.3 3.6-5.5 0-3.8-3.8-6.8-8.5-6.8z" />
        </svg>
      </span>
    </a>
  )
}
