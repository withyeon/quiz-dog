const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'

// 2026-10-16 기준 자막 트랙을 내주는 innertube 클라이언트는 ANDROID·IOS 둘뿐이다(WEB·MWEB·임베드·VR 은 재생 불가/봇 확인).
// 서버(Vercel) IP 에서는 이 둘도 LOGIN_REQUIRED(봇 확인)가 자주 나므로, 그때는 호출한 쪽이 Gemini 영상 직접 입력으로 넘어간다.
const INNERTUBE_CLIENTS = [
  {
    client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'ko' },
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
  },
  {
    client: { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2', hl: 'ko' },
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)',
  },
]

export type YouTubeTranscriptErrorCode =
  /** 유튜브 링크가 아니거나 영상 ID 를 못 찾음 */
  | 'invalid_url'
  /** 유튜브가 이 서버 IP 를 봇으로 보고 막음(자막이 있어도 못 가져옴) */
  | 'blocked'
  /** 영상에 자막 트랙이 없음 */
  | 'no_captions'
  /** 자막 트랙은 찾았지만 내려받기/파싱에 실패 */
  | 'fetch_failed'

export class YouTubeTranscriptError extends Error {
  code: YouTubeTranscriptErrorCode
  constructor(code: YouTubeTranscriptErrorCode, message: string) {
    super(message)
    this.name = 'YouTubeTranscriptError'
    this.code = code
  }
}

export function extractVideoId(url: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url

  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/** Gemini 등에 넘길 표준 watch URL. 영상 ID 를 못 찾으면 null. */
export function normalizeYouTubeUrl(url: string): string | null {
  const id = extractVideoId(url.trim())
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  let sawBotCheck = false
  let sawPlayable = false

  // 1차: innertube API (모바일 앱 클라이언트) — 웹 클라이언트보다 봇 차단이 덜하다
  for (const { client, userAgent } of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch(INNERTUBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent },
        body: JSON.stringify({ context: { client }, videoId, contentCheckOk: true, racyCheckOk: true }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (Array.isArray(tracks) && tracks.length > 0) return tracks
      const status: string | undefined = data?.playabilityStatus?.status
      if (status === 'LOGIN_REQUIRED') sawBotCheck = true
      else if (status === 'OK') sawPlayable = true
    } catch {}
  }

  // 2차: 웹페이지 스크래핑
  let html = ''
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ko`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko,en;q=0.8' },
      signal: AbortSignal.timeout(8000),
    })
    html = await pageRes.text()
  } catch {}

  if (html.includes('class="g-recaptcha"') || html.includes('/sorry/index')) {
    throw new YouTubeTranscriptError('blocked', 'YouTube가 이 서버의 요청을 봇으로 보고 막았습니다.')
  }

  if (html.includes('var ytInitialPlayerResponse')) {
    try {
      // ytInitialPlayerResponse 전체 파싱 — 중괄호 매칭으로 정확히 잘라냄
      const startIdx = html.indexOf('{', html.indexOf('var ytInitialPlayerResponse'))
      let depth = 0
      let endIdx = startIdx
      let inString = false
      for (let i = startIdx; i < html.length; i++) {
        const ch = html[i]
        if (inString) {
          if (ch === '\\') i++
          else if (ch === '"') inString = false
          continue
        }
        if (ch === '"') inString = true
        else if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) { endIdx = i + 1; break }
        }
      }
      const playerData = JSON.parse(html.slice(startIdx, endIdx))
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (Array.isArray(tracks) && tracks.length > 0) return tracks
      const status: string | undefined = playerData?.playabilityStatus?.status
      if (status === 'LOGIN_REQUIRED') sawBotCheck = true
      else if (status === 'OK') sawPlayable = true
    } catch {}
  }

  // 재생 가능한 응답을 하나라도 받았는데 트랙이 없으면 정말 자막이 없는 영상이다.
  if (sawPlayable && !sawBotCheck) {
    throw new YouTubeTranscriptError('no_captions', '이 영상에는 자막이 없습니다.')
  }
  if (sawBotCheck) {
    throw new YouTubeTranscriptError('blocked', 'YouTube가 이 서버의 요청을 봇으로 보고 막았습니다.')
  }
  throw new YouTubeTranscriptError('fetch_failed', '영상 정보를 불러올 수 없습니다.')
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
  const textRegex = /<text start="[^"]*" dur="[^"]*"[^>]*>([^<]*)<\/text>/g
  while ((m = textRegex.exec(xml)) !== null) {
    const text = decodeEntities(m[1]).trim()
    if (text) segments.push(text)
  }

  return segments
}

/**
 * 유튜브 자막을 글로 가져온다. 실패하면 YouTubeTranscriptError 를 던지며, code 로 원인을 구분한다
 * ('invalid_url' 만 사용자 입력 문제이고 나머지는 Gemini 영상 직접 입력으로 넘어갈 수 있다).
 */
export async function getYouTubeTranscript(videoUrl: string): Promise<string> {
  const videoId = extractVideoId(videoUrl.trim())
  if (!videoId) throw new YouTubeTranscriptError('invalid_url', '유효하지 않은 YouTube URL입니다.')

  const tracks = await getCaptionTracks(videoId)

  // 한국어 우선 → 영어 → 첫 번째 트랙. 같은 언어면 사람이 쓴 자막을 자동 자막(asr)보다 우선.
  const preferred = ['ko', 'en']
  let selectedTrack = tracks[0]
  for (const lang of preferred) {
    const found = tracks.filter((t) => t.languageCode === lang || t.languageCode.startsWith(`${lang}-`))
    if (found.length > 0) {
      selectedTrack = found.find((t) => t.kind !== 'asr') ?? found[0]
      break
    }
  }

  const trackUrl = selectedTrack.baseUrl
  // baseUrl이 youtube.com 도메인인지 확인
  let hostname = ''
  try {
    hostname = new URL(trackUrl).hostname
  } catch {}
  if (!hostname.endsWith('.youtube.com')) {
    throw new YouTubeTranscriptError('fetch_failed', '자막 URL이 유효하지 않습니다.')
  }

  const res = await fetch(trackUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new YouTubeTranscriptError('fetch_failed', '자막을 다운로드할 수 없습니다.')

  const xml = await res.text()
  const segments = parseTranscriptXml(xml)

  if (segments.length === 0) {
    throw new YouTubeTranscriptError('fetch_failed', '자막 데이터가 비어있습니다.')
  }

  return segments.join(' ')
}
