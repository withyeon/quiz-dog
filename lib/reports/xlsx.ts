import JSZip from 'jszip'

/**
 * 최소 기능 xlsx 작성기.
 *
 * 왜 직접 만드나:
 * xlsx 는 XML 몇 개를 zip 으로 묶은 것뿐이고, 우리는 "읽기"는 필요 없고 표 한두 장을
 * 내보내기만 하면 된다. SheetJS·exceljs 는 수백 KB짜리라 선생님 화면 번들에 얹기엔
 * 과하고, jszip 은 이미 이 프로젝트 의존성이라 새로 받을 것도 없다.
 *
 * sharedStrings 대신 inlineStr 을 쓴다. 파일이 조금 커지지만 문자열 테이블을
 * 따로 관리하지 않아 틀릴 여지가 없다.
 */

export type CellValue = string | number | null | undefined

export type Sheet = {
  name: string
  /** 첫 줄을 머리글로 굵게 처리한다 */
  rows: CellValue[][]
  /** 열 너비(문자 수). 생략하면 내용에서 추정한다. */
  columnWidths?: number[]
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // 엑셀은 XML 1.0 제어문자를 허용하지 않는다. 학생 닉네임에 섞여 들어올 수 있어 지운다.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/** 0 → A, 25 → Z, 26 → AA */
function columnName(index: number): string {
  let name = ''
  let n = index
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

/** 엑셀 시트 이름 제약: 31자 이하, : \ / ? * [ ] 금지 */
function safeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31)
  return cleaned || fallback
}

function estimateWidth(rows: CellValue[][], columnIndex: number): number {
  let widest = 8
  for (const row of rows) {
    const cell = row[columnIndex]
    if (cell === null || cell === undefined) continue
    // 한글은 영문보다 넓게 잡아야 잘리지 않는다.
    const text = String(cell)
    const width = [...text].reduce((sum, ch) => sum + (/[ㄱ-힝]/.test(ch) ? 2 : 1), 0)
    if (width > widest) widest = width
  }
  return Math.min(widest + 2, 60)
}

function sheetXml(sheet: Sheet): string {
  const columnCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const widths = sheet.columnWidths
    ?? Array.from({ length: columnCount }, (_, i) => estimateWidth(sheet.rows, i))

  const cols = widths.length > 0
    ? `<cols>${widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''

  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`
      // 머리글(첫 줄)은 style 1 = 굵게
      const style = rowIndex === 0 ? ' s="1"' : ''
      if (value === null || value === undefined || value === '') {
        return `<c r="${ref}"${style}/>`
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"${style}><v>${value}</v></c>`
      }
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `${cols}<sheetData>${rows}</sheetData>`
    + (sheet.rows.length > 0 ? `<autoFilter ref="A1:${columnName(Math.max(columnCount - 1, 0))}1"/>` : '')
    + `</worksheet>`
}

/** 머리글 굵게 하나만 있는 최소 스타일 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>`
  + `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
  + `<fills count="2"><fill><patternFill patternType="none"/></fill>`
  + `<fill><patternFill patternType="gray125"/></fill></fills>`
  + `<borders count="1"><border/></borders>`
  + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  + `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
  + `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>`
  // 기본 스타일 선언이 없으면 일부 뷰어가 "기본 스타일 없음" 경고를 낸다.
  + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`
  + `</styleSheet>`

export async function buildXlsx(sheets: Sheet[]): Promise<Blob> {
  if (sheets.length === 0) throw new Error('시트가 없습니다.')

  const named = sheets.map((sheet, i) => ({
    ...sheet,
    name: safeSheetName(sheet.name, `Sheet${i + 1}`),
  }))

  const zip = new JSZip()

  zip.file('[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
    + named.map((_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      ).join('')
    + `</Types>`)

  zip.file('_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
    + `</Relationships>`)

  zip.file('xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`
    + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
    + named.map((sheet, i) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      ).join('')
    + `</sheets></workbook>`)

  zip.file('xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + named.map((_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      ).join('')
    // 스타일은 시트 뒤 번호를 받는다
    + `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + `</Relationships>`)

  zip.file('xl/styles.xml', STYLES_XML)
  named.forEach((sheet, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet)))

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  })
}

/** 브라우저에서 파일로 저장 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
