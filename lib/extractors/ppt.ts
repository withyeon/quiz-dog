import JSZip from 'jszip'

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractTextFromPPTX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aIndex = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0)
      const bIndex = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0)
      return aIndex - bIndex
    })

  const slides: string[] = []

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('string')
    const texts = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map((match) => decodeXmlEntities(match[1]))
      .map((text) => text.trim())
      .filter(Boolean)

    if (texts.length > 0) {
      const slideNumber = slidePath.match(/slide(\d+)\.xml$/)?.[1]
      slides.push(`[슬라이드 ${slideNumber}]\n${texts.join('\n')}`)
    }
  }

  return normalizeText(slides.join('\n\n'))
}

export async function extractTextFromPPT(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const candidates = [
    buffer.toString('utf16le'),
    buffer.toString('latin1'),
    buffer.toString('utf8'),
  ]

  const snippets = new Set<string>()

  for (const candidate of candidates) {
    const matches = candidate.match(/[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ .,!?()[\]{}:;'"%+\-_/\\\n]{3,}/g) || []
    for (const match of matches) {
      const text = normalizeText(match)
      if (text.length >= 3 && /[A-Za-z가-힣0-9]/.test(text)) {
        snippets.add(text)
      }
    }
  }

  return normalizeText(Array.from(snippets).join('\n'))
}
