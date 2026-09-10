import { supabase } from '@/lib/supabase/client'
import {
  QUESTION_IMAGE_MAX_UPLOAD_BYTES,
  isAcceptedQuestionImageType,
} from '@/lib/quiz/questionImage'

/** 로그인한 선생님의 access token (서버 API에 Authorization 헤더로 넘긴다). 비로그인이면 null */
export async function getTeacherAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * 문제 그림을 올리고 공개 URL을 돌려준다.
 * 실제 저장은 app/api/question-image 가 한다 (선생님 로그인 필요).
 */
export async function uploadQuestionImage(file: File): Promise<string> {
  if (!isAcceptedQuestionImageType(file.type)) {
    throw new Error('PNG, JPG, WEBP, GIF 이미지만 올릴 수 있어요.')
  }
  if (file.size > QUESTION_IMAGE_MAX_UPLOAD_BYTES) {
    throw new Error('8MB 이하 이미지만 올릴 수 있어요.')
  }

  const token = await getTeacherAccessToken()
  if (!token) {
    throw new Error('그림을 올리려면 선생님 로그인이 필요해요.')
  }

  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/question-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !body.url) {
    throw new Error(body.error || '그림 업로드에 실패했어요.')
  }
  return body.url
}
