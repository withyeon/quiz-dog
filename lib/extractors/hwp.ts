import JSZip from 'jszip'
import { parse as parseHwp } from 'hwp.js'

/**
 * 한글 문서에서 본문 글을 뽑는다.
 * - .hwp  : HWP 5.0 바이너리(CFB). hwp.js 로 문단·표(중첩 포함)를 순서대로 읽는다.
 * - .hwpx : zip 안의 Contents/section*.xml. 태그만 걷어 내고 문단·표 칸을 줄·탭으로 잇는다.
 * 그림·수식·도형 안의 글은 다루지 않는다(시험지 글만 있으면 문제 만들기에 충분).
 */

type HwpChar = { type: number; value: number | string }
type HwpParagraph = { content: HwpChar[]; controls?: unknown[] }
type HwpParagraphList = { items: HwpParagraph[] }
type HwpTableControl = { id: number; content?: HwpParagraphList[][] }

// hwp.js CharType: 0 = 글자, 1 = 인라인 제어(10 이 줄바꿈), 2 = 확장 제어(표·그림 자리)
const CHAR = 0
const INLINE = 1
const LINE_BREAK = 10
// 컨트롤 id 는 4바이트 태그를 빅엔디언으로 담은 값. 표는 'tbl '.
const TABLE_ID = 0x74626c20

function paragraphText(p: HwpParagraph): string {
  let line = ''
  for (const c of p.content) {
    if (c.type === CHAR) line += typeof c.value === 'string' ? c.value : String.fromCharCode(c.value)
    else if (c.type === INLINE && c.value === LINE_BREAK) line += '\n'
  }
  return line
}

function collectParagraphs(paragraphs: HwpParagraph[], out: string[]): void {
  for (const p of paragraphs) {
    const text = paragraphText(p).replace(/\s+$/g, '')
    if (text) out.push(text)
    for (const ctrl of p.controls ?? []) {
      const table = ctrl as HwpTableControl
      if (table.id !== TABLE_ID || !Array.isArray(table.content)) continue
      for (const row of table.content) {
        const cells: string[] = []
        for (const cell of row) {
          const inner: string[] = []
          collectParagraphs(cell.items ?? [], inner)
          cells.push(inner.join(' ').trim())
        }
        const line = cells.filter(Boolean).join('\t')
        if (line) out.push(line)
      }
    }
  }
}

export function extractTextFromHWPBuffer(buffer: Buffer): string {
  const doc = parseHwp(buffer, { type: 'buffer' })
  const out: string[] = []
  for (const section of doc.sections) collectParagraphs(section.content as HwpParagraph[], out)
  return out.join('\n')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

export function extractTextFromHWPXSectionXml(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<hp:tab[^>]*\/>/g, '\t')
      .replace(/<hp:lineBreak[^>]*\/>/g, '\n')
      .replace(/<\/hp:tc>/g, '\t')
      .replace(/<\/hp:tr>/g, '\n')
      .replace(/<\/hp:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/\t+/g, '\t').trim())
    .filter(Boolean)
    .join('\n')
}

export async function extractTextFromHWPXBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const sections = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0))
  const parts: string[] = []
  for (const name of sections) {
    const xml = await zip.file(name)!.async('string')
    parts.push(extractTextFromHWPXSectionXml(xml))
  }
  return parts.join('\n')
}

export async function extractTextFromHWP(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  // 확장자가 .hwp 여도 실제로는 hwpx(zip, 'PK') 인 파일이 가끔 있어 내용으로 가른다
  const isZip = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b
  let text: string
  try {
    text = isZip ? await extractTextFromHWPXBuffer(buffer) : extractTextFromHWPBuffer(buffer)
  } catch (error) {
    console.error('HWP parse failed:', error)
    throw new Error('한글 파일을 읽지 못했어요. 배포용 문서(DRM)이거나 오래된 형식이면 PDF 로 저장해서 올려 주세요.')
  }
  if (!text || text.trim().length === 0) {
    throw new Error('한글 파일에서 글을 찾지 못했어요. 그림으로만 된 문서라면 PDF 나 이미지로 올려 주세요.')
  }
  return text
}
