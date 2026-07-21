/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['framer-motion'],
  devIndicators: false,
  // pdf-parse / mammoth는 CommonJS·동적 require를 쓰므로 서버 번들에 포함하면
  // 서버리스(Vercel)에서 모듈 해석이 깨진다. 외부 패키지로 빼서 런타임에 로드.
  serverExternalPackages: ['pdf-parse', 'mammoth'],
}

module.exports = nextConfig

