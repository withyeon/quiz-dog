/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['framer-motion'],
  devIndicators: false,
  // pdf-parse / mammoth는 CommonJS·동적 require를 쓰므로 서버 번들에 포함하면
  // 서버리스(Vercel)에서 모듈 해석이 깨진다. 외부 패키지로 빼서 런타임에 로드.
  serverExternalPackages: ['pdf-parse', 'mammoth'],

  // www.quizdog.kr 로 들어온 요청을 대표 주소(quizdog.kr)로 넘긴다.
  // 같은 사이트가 주소 두 개로 잡히면 검색엔진이 평가를 나눠 갖게 되므로 하나로 모은다.
  // (Vercel 대시보드의 도메인 리다이렉트 설정과 같은 효과이며, 여기 두면 배포마다 항상 적용된다.)
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.quizdog.kr' }],
        destination: 'https://quizdog.kr/:path*',
        permanent: true,
      },
      // 게임 시작 화면 주소를 /teacher/dashboard → /teacher/play 로 정리했다.
      // 예전 주소를 북마크해 둔 선생님이 있을 수 있어 리다이렉트로 살려둔다.
      {
        source: '/teacher/dashboard',
        destination: '/teacher/play',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

