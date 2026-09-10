import sharp from 'sharp'
import type { ExamVisionItem, GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { uploadQuestionImageBuffer } from '@/lib/server/questionImageStorage'
import { QUESTION_IMAGE_MAX_EDGE } from '@/lib/quiz/questionImage'

/**
 * 시험지 스캔에서 AI가 찾아낸 그림 영역(figure_box)을 잘라 Storage에 올리고
 * 해당 문제의 image_url로 붙인다. (서버 전용)
 *
 * - 좌표는 Gemini의 규약대로 [ymin, xmin, ymax, xmax], 0~1000 비율.
 * - 잘라낸 그림이 하나라도 실패해도 문제 생성 자체는 계속된다 (그림만 빠진다).
 * - 선생님 로그인 토큰이 없으면(teacherId null) 그림을 올릴 곳이 없으니 건너뛴다.
 */
export async function attachExamFigures(
  file: File,
  items: ExamVisionItem[],
  teacherId: string | null,
): Promise<{ questions: GeneratedQuestion[]; figureCount: number }> {
  const questions = items.map((item) => item.question)
  const targets = items
    .map((item, index) => ({ index, box: item.figureBox }))
    .filter((item): item is { index: number; box: NonNullable<ExamVisionItem['figureBox']> } => item.box !== null)

  if (!teacherId || targets.length === 0) {
    return { questions, figureCount: 0 }
  }

  let normalized: Buffer
  let width = 0
  let height = 0
  try {
    // EXIF 회전을 먼저 적용해 "보이는 그대로"의 좌표계로 맞춘다.
    normalized = await sharp(await file.arrayBuffer()).rotate().toBuffer()
    const meta = await sharp(normalized).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
  } catch (error) {
    console.error('시험지 이미지를 열 수 없어 그림 첨부를 건너뜁니다:', error)
    return { questions, figureCount: 0 }
  }
  if (width < 32 || height < 32) return { questions, figureCount: 0 }

  const admin = getAdminSupabase()
  const stamp = Date.now()
  let figureCount = 0

  for (const { index, box } of targets) {
    try {
      const [ymin, xmin, ymax, xmax] = box
      // 그림 가장자리가 잘리지 않게 1.5% 여유를 둔다
      const padX = width * 0.015
      const padY = height * 0.015
      const left = clamp(Math.floor((xmin / 1000) * width - padX), 0, width - 1)
      const top = clamp(Math.floor((ymin / 1000) * height - padY), 0, height - 1)
      const right = clamp(Math.ceil((xmax / 1000) * width + padX), left + 1, width)
      const bottom = clamp(Math.ceil((ymax / 1000) * height + padY), top + 1, height)
      const cropWidth = right - left
      const cropHeight = bottom - top
      if (cropWidth < 24 || cropHeight < 24) continue

      const webp = await sharp(normalized)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .resize({
          width: QUESTION_IMAGE_MAX_EDGE,
          height: QUESTION_IMAGE_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer()

      const url = await uploadQuestionImageBuffer(admin, teacherId, webp, `scan-${stamp}-${index + 1}`)
      questions[index] = { ...questions[index], image_url: url }
      figureCount += 1
    } catch (error) {
      console.error(`시험지 그림 자르기 실패 (문제 ${index + 1}):`, error)
    }
  }

  return { questions, figureCount }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
