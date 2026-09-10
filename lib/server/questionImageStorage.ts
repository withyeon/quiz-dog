import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { QUESTION_IMAGE_BUCKET } from '@/lib/quiz/questionImage'

/**
 * 문제 그림 Storage 쓰기 (서버 전용 — 서비스 키 클라이언트만 넘길 것).
 * 업로드 API와 시험지 그림 자동 첨부가 같이 쓴다.
 */

// 버킷은 마이그레이션 SQL이 만들지만, 혹시 빠졌으면 첫 업로드 때 만든다 (프로세스당 한 번 확인).
let bucketChecked = false

export async function ensureQuestionImageBucket(admin: SupabaseClient<Database>): Promise<void> {
  if (bucketChecked) return
  const { data } = await admin.storage.getBucket(QUESTION_IMAGE_BUCKET)
  if (!data) {
    const { error } = await admin.storage.createBucket(QUESTION_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg', 'image/gif'],
    })
    // 동시에 두 요청이 만들려 하면 하나는 "이미 있음"으로 실패한다 — 정상.
    if (error && !/already exists|duplicate/i.test(error.message)) throw error
  }
  bucketChecked = true
}

/** webp 버퍼를 올리고 공개 URL을 돌려준다. 경로는 <선생님 id>/<이름>-<난수>.webp */
export async function uploadQuestionImageBuffer(
  admin: SupabaseClient<Database>,
  userId: string,
  webp: Buffer,
  baseName: string,
): Promise<string> {
  await ensureQuestionImageBucket(admin)
  const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'image'
  const path = `${userId}/${safeName}-${Math.random().toString(36).slice(2, 8)}.webp`
  const { error } = await admin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (error) throw error
  return admin.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
