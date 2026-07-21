'use client'

import { confirmAsync } from '@/components/ui/ConfirmDialog'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  BookOpen,
  Copy,
  FileQuestion,
  Heart,
  Library,
  Pencil,
  Play,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'
import {
  copyQuestionSetFromQuestionsOnly,
  deleteQuestionSet,
  duplicateQuestionSet,
  listQuestionSetIndexFromQuestions,
  listQuestionSetsWithCounts,
  type QuestionSetIndexItem,
  type QuestionSetSummary,
} from '@/lib/services/questionSets'
import { formatServiceError } from '@/lib/services/errors'
import { getLocalLikedQuestionSetIds, getLibraryClientId } from '@/lib/utils/libraryClientId'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toaster'

type QuestionSet = QuestionSetSummary
type LikedQuestionSet = QuestionSetIndexItem & {
  name: string
}

type SourceType = 'topic' | 'youtube' | 'text' | 'pdf'

function isGeneratedLibraryTitle(title: string, setId: string): boolean {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) return true
  if (normalizedTitle === setId) return true
  if (normalizedTitle === setId.replace(/^set-/, '문제집 ')) return true
  if (/^(library-)?문제집\s+\d{10,}-[a-z0-9]+$/i.test(normalizedTitle)) return true
  if (/^library-문제집\s+\d{10,}-[a-z0-9]+$/i.test(normalizedTitle)) return true

  return false
}

function getLikedQuestionSetName(item: QuestionSetIndexItem, index: number): string {
  const title = item.title?.trim() ?? ''
  return isGeneratedLibraryTitle(title, item.set_id) ? `좋아요한 문제집 ${index + 1}` : title
}

function TeacherPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const createType = searchParams?.get('create') as SourceType | null
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [likedQuestionSets, setLikedQuestionSets] = useState<LikedQuestionSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!createType && userId) {
      loadQuestionSets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createType, userId])

  const loadQuestionSets = async () => {
    if (!userId) return
    try {
      setLoading(true)
      const [sets, likedIndexItems] = await Promise.all([
        listQuestionSetsWithCounts(userId),
        listQuestionSetIndexFromQuestions(getLibraryClientId()),
      ])
      const localLikedSetIds = getLocalLikedQuestionSetIds()
      setQuestionSets(sets)
      setLikedQuestionSets(
        likedIndexItems
          .filter((item) => item.liked_by_client || localLikedSetIds.has(item.set_id))
          .map((item, index) => ({
            ...item,
            liked_by_client: true,
            name: getLikedQuestionSetName(item, index),
          })),
      )
    } catch (error) {
      console.error('Error loading question sets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLikedSet = async (setId: string) => {
    try {
      await copyQuestionSetFromQuestionsOnly(setId)
      toast.success('내 문제집에 담았습니다.')
      void loadQuestionSets()
    } catch (error) {
      console.error('Error copying liked question set:', error)
      toast.error('문제집을 담지 못했습니다: ' + formatServiceError(error))
    }
  }

  const handleStartGame = (setId: string) => {
    // 게임 모드 선택 화면(대시보드)으로 이동
    router.push(`/teacher/dashboard?set=${encodeURIComponent(setId)}`)
  }

  const handleDuplicate = async (set: QuestionSet) => {
    try {
      await duplicateQuestionSet(set.id, `${set.title} (복사본)`)
      toast.success('문제집이 복제되었습니다!')
      loadQuestionSets()
    } catch (error) {
      console.error('Error duplicating question set:', error)
      toast.error('복제에 실패했습니다.')
    }
  }

  const handleDelete = async (setId: string) => {
    const ok = await confirmAsync({
      title: '문제집을 삭제할까요?',
      message: '삭제하면 되돌릴 수 없어요. 이 문제집의 문제도 함께 사라집니다.',
      confirmLabel: '삭제하기',
      destructive: true,
    })
    if (!ok) return

    try {
      await deleteQuestionSet(setId)
      toast.success('문제집이 삭제되었습니다.')
      loadQuestionSets()
    } catch (error) {
      console.error('Error deleting question set:', error)
      toast.error('삭제에 실패했습니다.')
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      ) : questionSets.length === 0 ? (
        <div className="space-y-8">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
                  수업 퀴즈,<br />만들고 바로 시작
                </h1>
                <p className="mt-4 max-w-xl text-base font-medium leading-7 text-slate-500">
                  문제집 만들기 · 자료실에서 가져오기 · 게임까지 한 곳에서.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/teacher/create"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                  >
                    <Plus className="h-5 w-5" />
                    문제집 만들기
                  </Link>
                  <Link
                    href="/teacher/library"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    <Library className="h-5 w-5" />
                    자료실
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-50 p-5">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/mascot_pome.png"
                      alt="퀴즈독"
                      width={48}
                      height={48}
                      className="h-12 w-12 object-contain"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900">시작하기</div>
                      <div className="text-xs font-semibold text-slate-400">세 가지 방법</div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    {[
                      { icon: Wand2, label: 'AI로 만들기', href: '/teacher/create' },
                      { icon: Pencil, label: '직접 작성', href: '/teacher/create' },
                      { icon: Library, label: '자료실에서 가져오기', href: '/teacher/library' },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition hover:border-sky-200 hover:bg-sky-50"
                      >
                        <span className="flex items-center gap-3 font-bold">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
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

          <LikedQuestionSetsPanel
            likedQuestionSets={likedQuestionSets}
            onStartGame={handleStartGame}
            onCopySet={handleCopyLikedSet}
          />
        </div>
      ) : (
        <div className="space-y-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">내 문제집</h1>
                <p className="mt-3 text-base font-medium text-slate-500">
                  문제집 {questionSets.length} · 문항 {totalQuestions}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/teacher/create"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                >
                  <Plus className="h-5 w-5" />
                  문제집 만들기
                </Link>
                <Link
                  href="/teacher/library"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <Library className="h-5 w-5" />
                  자료실
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BookOpen, label: '문제집', value: questionSets.length.toLocaleString(), tone: 'bg-sky-100 text-sky-600' },
              { icon: FileQuestion, label: '총 문항', value: totalQuestions.toLocaleString(), tone: 'bg-sky-100 text-sky-600' },
              { icon: Heart, label: '좋아요', value: likedQuestionSets.length.toLocaleString(), tone: 'bg-rose-50 text-rose-600' },
              { icon: Play, label: '최근', value: recentSets.length.toLocaleString(), tone: 'bg-amber-100 text-amber-600' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">{item.label}</span>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 text-3xl font-black tracking-tight text-slate-900">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900">문제집 목록</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">게임 시작 · 문항 수정</p>
                </div>
                <Link
                  href="/teacher/create"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                >
                  <Plus className="h-4 w-4" />
                  새 문제집
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {questionSets.map((set) => (
                  <div key={set.id} className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-slate-900">{set.title}</h3>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm font-medium text-slate-500">
                          <span>{set.question_count}문항</span>
                          <span>·</span>
                          <span>{new Date(set.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        onClick={() => handleStartGame(set.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        게임 시작
                      </button>
                      <button
                        onClick={() => router.push(`/teacher/sets/${encodeURIComponent(set.id)}/edit`)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-black"
                        aria-label={`${set.title} 수정`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(set)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-black"
                        aria-label={`${set.title} 복제`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(set.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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
              <LikedQuestionSetsPanel
                likedQuestionSets={likedQuestionSets}
                onStartGame={handleStartGame}
                onCopySet={handleCopyLikedSet}
                compact
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold text-slate-900">최근 문제집</h2>
                <div className="mt-4 space-y-3">
                  {recentSets.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => handleStartGame(set.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-sky-200 hover:bg-sky-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{set.title}</span>
                        <span className="mt-1 block text-xs font-semibold text-slate-400">{set.question_count}문항</span>
                      </span>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
              <Link
                href="/teacher/create"
                className="flex min-h-44 flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-white p-5 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-white">
                  <Plus className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-lg font-extrabold text-slate-900">새 문제집 만들기</span>
                  <span className="mt-1 block text-sm font-medium text-slate-500">수업 전 빠르게</span>
                </span>
              </Link>
            </aside>
          </section>
        </div>
      )}
    </div>
  )
}

function LikedQuestionSetsPanel({
  likedQuestionSets,
  onStartGame,
  onCopySet,
  compact = false,
}: {
  likedQuestionSets: LikedQuestionSet[]
  onStartGame: (setId: string) => void
  onCopySet: (setId: string) => Promise<void>
  compact?: boolean
}) {
  const visibleSets = compact ? likedQuestionSets.slice(0, 5) : likedQuestionSets

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">좋아요한 문제집</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            자료실에서 담아둔 문제집
          </p>
        </div>
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <Heart className="h-5 w-5 fill-current" />
        </span>
      </div>

      {likedQuestionSets.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-medium leading-6 text-slate-500">
            아직 없어요
          </p>
          <Link
            href="/teacher/library"
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-sky-600"
          >
            자료실 둘러보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {visibleSets.map((set) => (
            <div
              key={set.set_id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"
            >
              <button
                type="button"
                onClick={() => onStartGame(set.set_id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-bold text-slate-900">{set.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <span>{set.question_count}문항</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-rose-500">
                    <Heart className="h-3 w-3 fill-current" />
                    {set.like_count.toLocaleString()}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void onCopySet(set.set_id)}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 transition hover:bg-sky-500 hover:text-white"
                aria-label={`${set.name} 내 문제집에 담기`}
                title="내 문제집에 담기"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}

          {compact && likedQuestionSets.length > visibleSets.length && (
            <Link
              href="/teacher/library"
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-black"
            >
              전체 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center">로딩 중...</div>}>
      <TeacherPageContent />
    </Suspense>
  )
}
