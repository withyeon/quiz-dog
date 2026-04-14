export async function extractTextFromFile(file: File): Promise<string> {
  const text = await file.text()

  if (!text || text.trim().length === 0) {
    throw new Error('파일에서 텍스트를 추출할 수 없습니다.')
  }

  return text
}
