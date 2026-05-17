'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Copy,
  FileQuestion,
  Library,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import {
  deleteQuestionSet,
  duplicateQuestionSet,
  listQuestionSetsWithCounts,
  type QuestionSetSummary,
} from '@/lib/services/questionSets'

type QuestionSet = QuestionSetSummary

type SourceType = 'topic' | 'youtube' | 'text' | 'pdf'

function TeacherPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const createType = searchParams?.get('create') as SourceType | null

  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!createType) {
      loadQuestionSets()
    }
  }, [createType])

  const loadQuestionSets = async () => {
    try {
      setLoading(true)
      const sets = await listQuestionSetsWithCounts()
      setQuestionSets(sets)
    } catch (error) {
      console.error('Error loading question sets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartGame = (setId: string) => {
    // 게임 모드 선택 화면(대시보드)으로 이동
    router.push(`/teacher/dashboard?set=${encodeURIComponent(setId)}`)
  }

  const handleDuplicate = async (set: QuestionSet) => {
    try {
      await duplicateQuestionSet(set.id, `${set.title} (복사본)`)
      alert('문제집이 복제되었습니다!')
      loadQuestionSets()
    } catch (error) {
      console.error('Error duplicating question set:', error)
      alert('복제에 실패했습니다.')
    }
  }

  const handleDelete = async (setId: string) => {
    if (!confirm('정말 이 문제집을 삭제하시겠습니까?')) return

    try {
      await deleteQuestionSet(setId)
      alert('문제집이 삭제되었습니다.')
      loadQuestionSets()
    } catch (error) {
      console.error('Error deleting question set:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  const totalQuestions = questionSets.reduce((sum, set) => sum + set.question_count, 0)
  const recentSets = [...questionSets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-7xl">
      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
        </div>
      ) : questionSets.length === 0 ? (
        <div className="space-y-8">
          <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
            <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
              <div className="flex flex-col justify-center">
                <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600">
                  <Sparkles className="h-4 w-4" />
                  QuizDog Teacher
                </span>
                <h1 className="text-4xl font-black leading-tight tracking-normal text-slate-950 md:text-5xl">
                  수업 퀴즈를 빠르게 만들고 바로 시작하세요
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-500">
                  문제집을 만들거나 샘플을 가져오면 게임 진행과 결과 분석까지 한 흐름으로 이어집니다.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/teacher/create"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Plus className="h-5 w-5" />
                    퀴즈 만들기
                  </Link>
                  <Link
                    href="/teacher/library"
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-black text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    <Library className="h-5 w-5" />
                    라이브러리 보기
                  </Link>
                </div>
              </div>
              <div className="rounded-lg bg-[#f7f8fa] p-5">
                <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-500">시작 준비</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">0개</span>
                  </div>
                  <div className="mt-8 space-y-3">
                    {[
                      { icon: Wand2, label: 'AI 생성', href: '/teacher/create' },
                      { icon: Pencil, label: '직접 작성', href: '/teacher/create' },
                      { icon: Library, label: '샘플 가져오기', href: '/teacher/library' },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-slate-900 transition hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-3 font-black">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <item.icon className="h-5 w-5" />
                          </span>
                          {item.label}
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-7">
          <section className="rounded-lg bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                  Teacher Home
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-normal text-slate-950 md:text-5xl">내 문제집</h1>
                <p className="mt-3 text-base font-medium text-slate-500">
                  {questionSets.length}개 문제집 · {totalQuestions}개 문항이 준비되어 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/teacher/create"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 font-black text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Plus className="h-5 w-5" />
                  퀴즈 만들기
                </Link>
                <Link
                  href="/teacher/library"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-black text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <Library className="h-5 w-5" />
                  라이브러리
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { icon: BookOpen, label: '내 문제집', value: questionSets.length.toLocaleString(), tone: 'bg-slate-100 text-slate-700' },
              { icon: FileQuestion, label: '총 문제 수', value: totalQuestions.toLocaleString(), tone: 'bg-slate-100 text-slate-700' },
              { icon: Play, label: '최근 문제집', value: recentSets.length.toLocaleString(), tone: 'bg-slate-100 text-slate-700' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">{item.label}</span>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 text-3xl font-black tracking-normal text-slate-950">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-normal text-slate-950">문제집 목록</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">바로 게임을 시작하거나 문항을 수정할 수 있습니다.</p>
                </div>
                <Link
                  href="/teacher/create"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  새 문제집
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {questionSets.map((set) => (
                  <div key={set.id} className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-slate-950">{set.title}</h3>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm font-medium text-slate-500">
                          <span>{set.question_count}문제</span>
                          <span>·</span>
                          <span>{new Date(set.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        onClick={() => handleStartGame(set.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        게임 시작
                      </button>
                      <button
                        onClick={() => router.push(`/teacher/sets/${encodeURIComponent(set.id)}/edit`)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                        aria-label={`${set.title} 수정`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(set)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                        aria-label={`${set.title} 복제`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(set.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        aria-label={`${set.title} 삭제`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-black text-slate-950">최근 문제집</h2>
                <div className="mt-4 space-y-3">
                  {recentSets.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => handleStartGame(set.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-slate-900">{set.title}</span>
                        <span className="mt-1 block text-xs font-bold text-slate-400">{set.question_count}문제</span>
                      </span>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
              <Link
                href="/teacher/create"
                className="flex min-h-44 flex-col justify-between rounded-lg border border-dashed border-slate-300 bg-white p-5 transition hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Plus className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-lg font-black text-slate-950">새 문제집 만들기</span>
                  <span className="mt-1 block text-sm font-bold text-slate-500">수업 전에 바로 준비하기</span>
                </span>
              </Link>
            </aside>
          </section>
        </div>
      )}
    </div>
  )
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <TeacherPageContent />
    </Suspense>
  )
}
