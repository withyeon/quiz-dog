export async function extractTextFromPDF(file: File | Buffer): Promise<string> {
  // pdf-parse의 index.js는 디버그 모드에서 테스트 파일을 읽으려 하므로
  // lib/pdf-parse.js를 직접 사용
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')

  let buffer: Buffer

  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else {
    buffer = file
  }

  const data = await pdfParse(buffer)

  if (!data.text || data.text.trim().length === 0) {
    return ''
  }

  return data.text
}
