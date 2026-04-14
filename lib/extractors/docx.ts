import mammoth from 'mammoth'

export async function extractTextFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const result = await mammoth.extractRawText({ buffer })

  if (!result.value || result.value.trim().length === 0) {
    throw new Error('DOCX 파일에서 텍스트를 추출할 수 없습니다.')
  }

  return result.value
}
