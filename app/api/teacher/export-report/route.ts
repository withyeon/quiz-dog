import { NextResponse, type NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { resolveTeacherUserId } from '@/lib/server/teacherAuth'
import { getTeacherPlan } from '@/lib/server/teacherPlan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 화면(TeacherAnalytics)이 이미 계산해 둔 리포트를 그대로 받는다 — 서버는 요금제 확인과 엑셀 조립만. */
type ExportPayload = {
  title: string
  questions: Array<{ index: number; text: string; type: string; answer: string; correctCount: number; incorrectCount: number; accuracy: number; topWrongAnswer: string | null }>
  students: Array<{ rank: number; nickname: string; score: number; correctAnswers: number; totalAnswered: number; accuracy: number; answers: Array<{ questionIndex: number; isCorrect: boolean; selectedAnswer: string | null }> }>
}

const MAX_ROWS = 2000

function isPayload(value: unknown): value is ExportPayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<ExportPayload>
  return typeof v.title === 'string' && Array.isArray(v.questions) && Array.isArray(v.students)
    && v.questions.length <= MAX_ROWS && v.students.length <= MAX_ROWS
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0ECFF' } }

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1)
  row.font = { bold: true }
  row.fill = HEADER_FILL
  row.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function POST(request: NextRequest) {
  const userId = await resolveTeacherUserId(request)
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { plan } = await getTeacherPlan(userId)
  if (plan !== 'pro') return NextResponse.json({ error: '엑셀 내보내기는 Pro 요금제에서 쓸 수 있어요.', code: 'PRO_REQUIRED' }, { status: 402 })

  const body = await request.json().catch(() => null)
  if (!isPayload(body)) return NextResponse.json({ error: '내보낼 내용이 올바르지 않습니다.' }, { status: 400 })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'QuizDog'
  wb.created = new Date()

  // 1) 학생별
  const students = wb.addWorksheet('학생별')
  students.columns = [
    { header: '순위', key: 'rank', width: 6 },
    { header: '이름', key: 'nickname', width: 16 },
    { header: '점수', key: 'score', width: 10 },
    { header: '정답 수', key: 'correct', width: 9 },
    { header: '푼 문제 수', key: 'total', width: 11 },
    { header: '정답률(%)', key: 'accuracy', width: 11 },
  ]
  for (const s of body.students) {
    students.addRow({ rank: s.rank, nickname: s.nickname, score: s.score, correct: s.correctAnswers, total: s.totalAnswered, accuracy: s.accuracy })
  }
  styleHeader(students)

  // 2) 문항별
  const questions = wb.addWorksheet('문항별')
  questions.columns = [
    { header: '번호', key: 'index', width: 6 },
    { header: '문제', key: 'text', width: 60 },
    { header: '유형', key: 'type', width: 8 },
    { header: '정답', key: 'answer', width: 20 },
    { header: '정답 수', key: 'correct', width: 9 },
    { header: '오답 수', key: 'incorrect', width: 9 },
    { header: '정답률(%)', key: 'accuracy', width: 11 },
    { header: '가장 많이 고른 오답', key: 'topWrong', width: 24 },
  ]
  for (const q of body.questions) {
    questions.addRow({ index: q.index + 1, text: q.text, type: q.type, answer: q.answer, correct: q.correctCount, incorrect: q.incorrectCount, accuracy: q.accuracy, topWrong: q.topWrongAnswer ?? '' })
  }
  questions.getColumn('text').alignment = { wrapText: true, vertical: 'top' }
  styleHeader(questions)

  // 3) 응답 상세: 학생 × 문항, O/X 와 고른 답
  const detail = wb.addWorksheet('응답 상세')
  detail.columns = [
    { header: '이름', key: 'nickname', width: 16 },
    ...body.questions.map((q) => ({ header: `${q.index + 1}번`, key: `q${q.index}`, width: 14 })),
  ]
  for (const s of body.students) {
    const row: Record<string, string> = { nickname: s.nickname }
    for (const a of s.answers) {
      const picked = a.selectedAnswer ? ` (${a.selectedAnswer})` : ''
      row[`q${a.questionIndex}`] = `${a.isCorrect ? 'O' : 'X'}${picked}`
    }
    detail.addRow(row)
  }
  styleHeader(detail)
  detail.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `${body.title.replace(/[\\/:*?"<>|]/g, ' ').trim() || '퀴즈 결과'}.xlsx`
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
