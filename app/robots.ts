import type { MetadataRoute } from 'next'
import { NO_INDEX_PATHS, SITE_URL } from '@/lib/seo/site'

/** /robots.txt 를 만들어 준다. 네이버(Yeti)·구글(Googlebot) 모두 이 파일을 먼저 본다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: NO_INDEX_PATHS,
      },
      // 네이버 검색로봇. 기본 규칙으로도 통과하지만, 명시해 두면 진단 도구에서 확인이 쉽다.
      {
        userAgent: 'Yeti',
        allow: '/',
        disallow: NO_INDEX_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
