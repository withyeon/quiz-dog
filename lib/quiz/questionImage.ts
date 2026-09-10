// 문제 그림 공통 상수 (브라우저·서버 양쪽에서 import 한다 — 순수 상수만 둘 것)

/** Supabase Storage 버킷 이름 */
export const QUESTION_IMAGE_BUCKET = 'question-images'

/** 브라우저에서 받는 원본 상한. 서버가 1280px webp로 줄이므로 원본은 넉넉히 받는다. */
export const QUESTION_IMAGE_MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/** 저장 시 긴 변 최대 픽셀. 프로젝터·태블릿 어디서나 충분하고 용량은 100KB 안팎. */
export const QUESTION_IMAGE_MAX_EDGE = 1280

/** <input type="file" accept> 값 */
export const QUESTION_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

export function isAcceptedQuestionImageType(mimeType: string): boolean {
  return QUESTION_IMAGE_ACCEPT.split(',').includes(mimeType)
}
