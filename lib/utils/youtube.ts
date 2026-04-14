const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ANDROID_USER_AGENT = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'

export function extractVideoId(url: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url

  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
}

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  // 1차: innertube API (Android client) — 봇 차단을 우회
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_USER_AGENT },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (Array.isArray(tracks) && tracks.length > 0) return tracks
    }
  } catch {}

  // 2차: 웹페이지 스크래핑
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  const html = await pageRes.text()

  if (html.includes('class="g-recaptcha"')) {
    throw new Error('YouTube가 이 IP에서 너무 많은 요청을 감지했습니다. 잠시 후 다시 시도해주세요.')
  }

  const match = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/)
    || html.match(/"captions":\s*(\{.+?\}),\s*"videoDetails"/)
  if (!match) throw new Error('영상 정보를 불러올 수 없습니다.')

  try {
    let playerData: any
    if (match[0].startsWith('var ')) {
      // ytInitialPlayerResponse 전체 파싱 — 중괄호 매칭으로 정확히 잘라냄
      const startIdx = html.indexOf('var ytInitialPlayerResponse') + 'var ytInitialPlayerResponse = '.length
      let depth = 0
      let endIdx = startIdx
      for (let i = startIdx; i < html.length; i++) {
        if (html[i] === '{') depth++
        else if (html[i] === '}') {
          depth--
          if (depth === 0) { endIdx = i + 1; break }
        }
      }
      playerData = JSON.parse(html.slice(startIdx, endIdx))
    } else {
      playerData = { captions: JSON.parse(match[1]) }
    }

    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (Array.isArray(tracks) && tracks.length > 0) return tracks
  } catch {}

  throw new Error('이 영상에서 자막을 찾을 수 없습니다.')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function parseTranscriptXml(xml: string): string[] {
  const segments: string[] = []

  // 새 형식: <p t="offset" d="duration"><s>text</s></p>
  const pRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = pRegex.exec(xml)) !== null) {
    const inner = m[1]
    let text = ''
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g
    let sm: RegExpExecArray | null
    while ((sm = sRegex.exec(inner)) !== null) text += sm[1]
    if (!text) text = inner.replace(/<[^>]+>/g, '')
    text = decodeEntities(text).trim()
    if (text) segments.push(text)
  }

  if (segments.length > 0) return segments

  // 구 형식: <text start="..." dur="...">text</text>
  const textRegex = /<text start="[^"]*" dur="[^"]*">([^<]*)<\/text>/g
  while ((m = textRegex.exec(xml)) !== null) {
    const text = decodeEntities(m[1]).trim()
    if (text) segments.push(text)
  }

  return segments
}

export async function getYouTubeTranscript(videoUrl: string): Promise<string> {
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('유효하지 않은 YouTube URL입니다.')

  const tracks = await getCaptionTracks(videoId)

  // 한국어 우선 → 영어 → 첫 번째 트랙
  const preferred = ['ko', 'en']
  let selectedTrack = tracks[0]
  for (const lang of preferred) {
    const found = tracks.find((t) => t.languageCode === lang)
    if (found) { selectedTrack = found; break }
  }

  const trackUrl = selectedTrack.baseUrl
  // baseUrl이 youtube.com 도메인인지 확인
  try {
    if (!new URL(trackUrl).hostname.endsWith('.youtube.com')) {
      throw new Error('자막 URL이 유효하지 않습니다.')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('자막')) throw e
    throw new Error('자막 URL이 유효하지 않습니다.')
  }

  const res = await fetch(trackUrl, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error('자막을 다운로드할 수 없습니다.')

  const xml = await res.text()
  const segments = parseTranscriptXml(xml)

  if (segments.length === 0) {
    throw new Error('자막 데이터가 비어있습니다.')
  }

  return segments.join(' ')
}
