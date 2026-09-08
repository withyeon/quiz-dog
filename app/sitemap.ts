import type { MetadataRoute } from 'next'
import { PUBLIC_PATHS, SITE_URL } from '@/lib/seo/site'

/** /sitemap.xml — 구글 서치콘솔·네이버 서치어드바이저에 이 주소를 제출한다. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PUBLIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
