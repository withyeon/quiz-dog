/**
 * 폰 사진(3~8MB)을 올리기 전에 줄인다. Vercel 함수는 요청 본문이 4.5MB를 넘으면 받지도 못하고,
 * 글자를 읽는 데는 긴 변 2048px 이면 충분하다. 브라우저가 못 여는 형식(크롬의 HEIC 등)이면 원본을 돌려준다.
 */
export async function downscaleImage(file: File, maxSide = 2048, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    // 이미 작고 가벼우면 그대로
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    // 투명 PNG 가 검게 나오지 않도록 흰 바탕
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
