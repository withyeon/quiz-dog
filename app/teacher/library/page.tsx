'use client'

import { notify } from '@/components/ui/Toast'
import { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  FileQuestion,
  GraduationCap,
  Heart,
  Library,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatServiceError } from '@/lib/services/errors'
import {
  copyQuestionSetFromQuestionsOnly,
  listQuestionSetIndexFromQuestions,
  toggleQuestionSetLike,
} from '@/lib/services/questionSets'
import { ELEMENTARY_GRADE_NUMBERS, formatGradeLabel } from '@/lib/constants/grades'
import {
  getLocalLikedQuestionSetIds,
  getLibraryClientId,
  setLocalQuestionSetLiked,
} from '@/lib/utils/libraryClientId'

type QuestionSet = {
  set_id: string
  name: string
  question_count: number
  created_at: string
  subject: string
  grade: string
  creator: string
  tags: string[]
  like_count: number
  weekly_like_count: number
  monthly_like_count: number
  liked_by_client: boolean
}

const BASE_SUBJECTS = [
  { id: 'korean', name: '국어' },
  { id: 'math', name: '수학' },
  { id: 'english', name: '영어' },
  { id: 'social', name: '사회' },
  { id: 'science', name: '과학' },
  { id: 'ethics', name: '도덕' },
  { id: 'pe', name: '체육' },
  { id: 'music', name: '음악' },
  { id: 'art', name: '미술' },
]

const SUBJECTS_BY_LEVEL = {
  elementary: [
    { id: 'integrated', name: '통합교과' },
    ...BASE_SUBJECTS,
    { id: 'practical_arts', name: '실과' },
    { id: 'creative', name: '창체' },
  ],
  middle: [
    ...BASE_SUBJECTS,
    { id: 'history', name: '역사' },
    { id: 'tech_home', name: '기술·가정' },
    { id: 'information', name: '정보' },
    { id: 'creative', name: '창체' },
  ],
  high: [
    ...BASE_SUBJECTS,
    { id: 'history', name: '한국사' },
    { id: 'tech_home', name: '기술·가정' },
    { id: 'information', name: '정보' },
    { id: 'second_language', name: '제2외국어/한문' },
    { id: 'career', name: '진로와 직업' },
    { id: 'creative', name: '창체' },
  ],
} as const

const SUBJECTS = [
  { id: 'integrated', name: '통합교과' },
  ...BASE_SUBJECTS,
  { id: 'practical_arts', name: '실과' },
  { id: 'history', name: '역사/한국사' },
  { id: 'tech_home', name: '기술·가정' },
  { id: 'information', name: '정보' },
  { id: 'second_language', name: '제2외국어/한문' },
  { id: 'career', name: '진로와 직업' },
  { id: 'creative', name: '창체' },
]

const SUBJECT_ALIASES: Record<string, string> = {
  통합교과: 'integrated',
  바른생활: 'integrated',
  '바른 생활': 'integrated',
  슬기로운생활: 'integrated',
  '슬기로운 생활': 'integrated',
  즐거운생활: 'integrated',
  '즐거운 생활': 'integrated',
  창체: 'creative',
  창의적체험활동: 'creative',
  '창의적 체험활동': 'creative',
  국어: 'korean',
  수학: 'math',
  사회: 'social',
  과학: 'science',
  영어: 'english',
  도덕: 'ethics',
  체육: 'pe',
  음악: 'music',
  미술: 'art',
  실과: 'practical_arts',
  기술가정: 'tech_home',
  '기술·가정': 'tech_home',
  '기술ㆍ가정': 'tech_home',
  정보: 'information',
  한국사: 'history',
  제2외국어: 'second_language',
  한문: 'second_language',
  '진로와 직업': 'career',
  기타: 'integrated',
  역사: 'history',
}

const SCHOOL_LEVELS = [
  { id: 'all', name: '전체' },
  { id: 'elementary', name: '초등' },
  { id: 'middle', name: '중등' },
  { id: 'high', name: '고등' },
]

const GRADE_GROUPS = {
  elementary: [...ELEMENTARY_GRADE_NUMBERS],
  middle: ['1', '2', '3'],
  high: ['1', '2', '3'],
} as const

type SchoolLevel = keyof typeof GRADE_GROUPS
type SortType = 'likes' | 'recent'

const normalizeSubject = (subjectValue: string | null | undefined, setId: string): string => {
  if (subjectValue) {
    if (SUBJECTS.some((item) => item.id === subjectValue)) return subjectValue
    if (SUBJECT_ALIASES[subjectValue]) return SUBJECT_ALIASES[subjectValue]
  }

  const subject = SUBJECTS.find((item) => setId.includes(item.id))
  return subject?.id || 'integrated'
}

const normalizeGrade = (gradeValue: string | null | undefined, setId: string): string => {
  const value = gradeValue?.trim()
  if (value) {
    const gradeMatch = value.match(/(초|중|고)\s*(\d)/)
    if (gradeMatch) {
      const level = gradeMatch[1] === '초' ? 'elementary' : gradeMatch[1] === '중' ? 'middle' : 'high'
      return `${level}-${gradeMatch[2]}`
    }

    if (value === '중학교') return 'middle-1'
    if (value === '고등학교') return 'high-1'
    if (value.includes('-')) return value
  }

  const gradeMatch = setId.match(/(초|중|고)\s*(\d)/)
  if (gradeMatch) {
    const level = gradeMatch[1] === '초' ? 'elementary' : gradeMatch[1] === '중' ? 'middle' : 'high'
    return `${level}-${gradeMatch[2]}`
  }
  return 'elementary-3'
}

const getSubjectName = (subjectId: string) => (
  SUBJECTS.find((item) => item.id === subjectId)?.name ?? '통합교과'
)

const getGradeLabel = (grade: string) => formatGradeLabel(grade)

const isGeneratedLibraryTitle = (title: string, setId: string): boolean => {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) return true
  if (normalizedTitle === setId) return true
  if (normalizedTitle === setId.replace(/^set-/, '문제집 ')) return true
  if (/^(library-)?문제집\s+\d{10,}-[a-z0-9]+$/i.test(normalizedTitle)) return true
  if (/^library-문제집\s+\d{10,}-[a-z0-9]+$/i.test(normalizedTitle)) return true

  return false
}

const normalizeTags = (tags: unknown, grade: string, subject: string): string[] => {
  if (Array.isArray(tags)) {
    const values = tags.map((tag) => String(tag).trim()).filter(Boolean)
    if (values.length > 0) return values
  }

  return [getGradeLabel(grade), getSubjectName(subject)]
}

function LibraryPageContent() {
  const router = useRouter()

  const [allQuestionSets, setAllQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedSchoolLevel, setSelectedSchoolLevel] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortType, setSortType] = useState<SortType>('likes')
  const [previewSetId, setPreviewSetId] = useState<string | null>(null)

  const loadQuestionSets = useCallback(async () => {
    try {
      setLoading(true)
      const clientId = getLibraryClientId()
      const localLikedSetIds = getLocalLikedQuestionSetIds()
      const indexItems = await listQuestionSetIndexFromQuestions(clientId)
      const sets = indexItems.map((item, index) => {
        const subject = normalizeSubject(item.subject, item.set_id)
        const grade = normalizeGrade(item.grade, item.set_id)
        const title = item.title?.trim() ?? ''
        const likedByClient = item.liked_by_client || localLikedSetIds.has(item.set_id)

        return {
          ...item,
          name: isGeneratedLibraryTitle(title, item.set_id) ? `문제집 ${index + 1}` : title,
          subject,
          grade,
          creator: '퀴즈독 자료실',
          tags: normalizeTags(item.tags, grade, subject),
          like_count: item.like_count,
          weekly_like_count: item.weekly_like_count,
          monthly_like_count: item.monthly_like_count,
          liked_by_client: likedByClient,
        }
      })

      setAllQuestionSets(sets)
      setPreviewSetId(sets[0]?.set_id ?? null)
    } catch (error) {
      console.error('Error loading question sets:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQuestionSets()
  }, [loadQuestionSets])

  const filteredSets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = allQuestionSets.filter((set) => {
      const matchesSubject = selectedSubject === 'all' || set.subject === selectedSubject
      const matchesLevel = selectedSchoolLevel === 'all' || set.grade.startsWith(selectedSchoolLevel)
      const matchesGrade = selectedGrade === 'all' || set.grade === selectedGrade
      const matchesQuery = !query
        || set.name.toLowerCase().includes(query)
        || getSubjectName(set.subject).toLowerCase().includes(query)
        || getGradeLabel(set.grade).toLowerCase().includes(query)

      return matchesSubject && matchesLevel && matchesGrade && matchesQuery
    })

    return [...filtered].sort((a, b) => {
      if (sortType === 'likes') {
        const likeDelta = b.like_count - a.like_count
        if (likeDelta !== 0) return likeDelta
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [allQuestionSets, searchQuery, selectedGrade, selectedSchoolLevel, selectedSubject, sortType])

  const currentSubjectOptions = useMemo(() => {
    if (selectedSchoolLevel === 'all') return SUBJECTS
    return SUBJECTS_BY_LEVEL[selectedSchoolLevel as SchoolLevel]
  }, [selectedSchoolLevel])

  const weeklyPopularSets = useMemo(() => (
    [...allQuestionSets]
      .filter((set) => set.weekly_like_count > 0)
      .sort((a, b) => b.weekly_like_count - a.weekly_like_count || b.like_count - a.like_count)
      .slice(0, 5)
  ), [allQuestionSets])

  const monthlyPopularSets = useMemo(() => (
    [...allQuestionSets]
      .filter((set) => set.monthly_like_count > 0)
      .sort((a, b) => b.monthly_like_count - a.monthly_like_count || b.like_count - a.like_count)
      .slice(0, 5)
  ), [allQuestionSets])

  const selectedSet = useMemo(() => {
    return filteredSets.find((set) => set.set_id === previewSetId) ?? filteredSets[0] ?? null
  }, [filteredSets, previewSetId])

  const activeFilterCount = [
    selectedSubject !== 'all',
    selectedSchoolLevel !== 'all',
    selectedGrade !== 'all',
    searchQuery.trim().length > 0,
  ].filter(Boolean).length

  const resetFilters = () => {
    setSelectedSubject('all')
    setSelectedSchoolLevel('all')
    setSelectedGrade('all')
    setSearchQuery('')
    setSortType('likes')
  }

  const handleToggleLike = async (setId: string) => {
    const target = allQuestionSets.find((set) => set.set_id === setId)
    if (!target) return

    const nextLiked = !target.liked_by_client
    const delta = nextLiked ? 1 : -1
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    const monthAgo = new Date(now)
    monthAgo.setMonth(now.getMonth() - 1)
    const createdAt = new Date(target.created_at)
    const affectsWeekly = nextLiked || createdAt >= weekAgo
    const affectsMonthly = nextLiked || createdAt >= monthAgo

    setAllQuestionSets((prev) => prev.map((set) => (
      set.set_id === setId
        ? {
            ...set,
            liked_by_client: nextLiked,
            like_count: Math.max(0, set.like_count + delta),
            weekly_like_count: affectsWeekly ? Math.max(0, set.weekly_like_count + delta) : set.weekly_like_count,
            monthly_like_count: affectsMonthly ? Math.max(0, set.monthly_like_count + delta) : set.monthly_like_count,
          }
        : set
    )))

    setLocalQuestionSetLiked(setId, nextLiked)

    try {
      await toggleQuestionSetLike(setId, getLibraryClientId(), nextLiked)
      await loadQuestionSets()
    } catch (error) {
      console.warn('좋아요를 서버에 저장하지 못해 브라우저에만 보관했습니다:', formatServiceError(error))
    }
  }

  const handleCopySet = async (setId: string) => {
    try {
      await copyQuestionSetFromQuestionsOnly(setId)
      notify('내 문제집에 담았습니다.', 'success')
      router.push('/teacher')
    } catch (error) {
      console.error('Error copying set:', error)
      notify('문제집을 담지 못했습니다: ' + formatServiceError(error), 'error')
    }
  }

  const handleStartGame = (setId: string) => {
    router.push(`/teacher/dashboard?set=${encodeURIComponent(setId)}`)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
              <Library className="h-4 w-4" />
              수업 준비 라이브러리
            </div>
            <h1 className="text-3xl font-black tracking-normal text-black sm:text-4xl">
              바로 수업에 쓸 퀴즈 세트를 찾아보세요
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-500">
              필요한 자료를 고른 뒤 내 문제집에 담아 수정하거나, 바로 게임을 시작할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
            {[
              { label: '전체 자료', value: allQuestionSets.length.toLocaleString(), icon: Library },
              { label: '검색 결과', value: filteredSets.length.toLocaleString(), icon: Search },
              { label: '총 문항', value: filteredSets.reduce((sum, set) => sum + set.question_count, 0).toLocaleString(), icon: FileQuestion },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">{item.label}</span>
                  <item.icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-black text-black">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="단원명, 과목, 학년으로 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-bold text-black outline-none transition placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
          <div className="flex items-center gap-2">
            <select
              value={sortType}
              onChange={(event) => setSortType(event.target.value as SortType)}
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="likes">좋아요순</option>
              <option value="recent">최신순</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="h-12 rounded-lg px-4 text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-black"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <FilterRow
            label="학교급"
            items={SCHOOL_LEVELS}
            value={selectedSchoolLevel}
            onChange={(value) => {
              setSelectedSchoolLevel(value)
              setSelectedGrade('all')
              setSelectedSubject('all')
            }}
          />

          {selectedSchoolLevel !== 'all' && (
            <FilterRow
              label="학년"
              items={[
                { id: 'all', name: '전체' },
                ...GRADE_GROUPS[selectedSchoolLevel as SchoolLevel].map((grade) => ({
                  id: `${selectedSchoolLevel}-${grade}`,
                  name: selectedSchoolLevel === 'elementary' ? `초${grade}` : `${grade}학년`,
                })),
              ]}
              value={selectedGrade}
              onChange={setSelectedGrade}
            />
          )}

          <FilterRow
            label="과목"
            items={[{ id: 'all', name: '전체' }, ...currentSubjectOptions]}
            value={selectedSubject}
            onChange={setSelectedSubject}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PopularPanel
          title="주간 인기글"
          metricLabel="이번 주"
          sets={weeklyPopularSets}
          metric={(set) => set.weekly_like_count}
          onSelect={setPreviewSetId}
        />
        <PopularPanel
          title="월간 인기글"
          metricLabel="이번 달"
          sets={monthlyPopularSets}
          metric={(set) => set.monthly_like_count}
          onSelect={setPreviewSetId}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <SlidersHorizontal className="h-4 w-4" />
              {filteredSets.length.toLocaleString()}개 자료
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-black" />
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center ring-1 ring-slate-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Search className="h-6 w-6 text-slate-400" />
              </div>
              <h2 className="mt-4 text-lg font-black text-black">맞는 자료가 없습니다</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">검색어나 필터를 조금 넓혀보세요.</p>
              <button
                onClick={resetFilters}
                className="mt-5 rounded-lg bg-black px-4 py-2.5 text-sm font-black text-white transition hover:bg-neutral-800"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            filteredSets.map((set) => (
              <article
                key={set.set_id}
                onClick={() => setPreviewSetId(set.set_id)}
                className={`w-full rounded-lg bg-white p-5 text-left shadow-sm ring-1 transition ${
                  selectedSet?.set_id === set.set_id
                    ? 'ring-black'
                    : 'ring-slate-200 hover:bg-slate-50'
                } cursor-pointer`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {set.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="truncate text-lg font-black text-black">{set.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
                      <span>{set.creator}</span>
                      <span>·</span>
                      <span>{set.question_count}문제</span>
                      <span>·</span>
                      <span>{new Date(set.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleToggleLike(set.set_id)
                      }}
                      className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-black transition ${
                        set.liked_by_client
                          ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                      }`}
                      aria-label={`${set.name} 좋아요`}
                    >
                      <Heart className={`h-4 w-4 ${set.liked_by_client ? 'fill-current' : ''}`} />
                      {set.like_count.toLocaleString()}
                    </button>
                    <ArrowRight className="hidden h-5 w-5 text-slate-300 sm:block" />
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            {selectedSet ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-500">선택한 자료</div>
                    <div className="mt-0.5 text-xs font-bold text-slate-400">수업 준비 패널</div>
                  </div>
                </div>

                <h2 className="mt-5 text-xl font-black leading-snug text-black">{selectedSet.name}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <InfoTile label="문항 수" value={`${selectedSet.question_count}개`} icon={FileQuestion} />
                  <InfoTile label="좋아요" value={`${selectedSet.like_count.toLocaleString()}개`} icon={Heart} />
                  <InfoTile label="대상" value={getGradeLabel(selectedSet.grade)} icon={GraduationCap} />
                  <InfoTile label="과목" value={getSubjectName(selectedSet.subject)} icon={BookOpen} />
                </div>

                <div className="mt-5 space-y-2">
                  <button
                    onClick={() => void handleToggleLike(selectedSet.set_id)}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition ${
                      selectedSet.liked_by_client
                        ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100 hover:bg-rose-100'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-rose-600'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${selectedSet.liked_by_client ? 'fill-current' : ''}`} />
                    {selectedSet.liked_by_client ? '좋아요 취소' : '좋아요'}
                  </button>
                  <button
                    onClick={() => handleCopySet(selectedSet.set_id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-black text-white transition hover:bg-neutral-800"
                  >
                    <Plus className="h-4 w-4" />
                    내 문제집에 담기
                  </button>
                  <button
                    onClick={() => handleStartGame(selectedSet.set_id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-black text-black ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    바로 게임 시작
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/teacher/library?set=${selectedSet.set_id}`)
                      notify('링크가 복사되었습니다.', 'success')
                    }}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-black"
                  >
                    <Copy className="h-4 w-4" />
                    링크 복사
                  </button>
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-500">자료를 선택하면 수업 준비 패널이 열립니다.</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}

function PopularPanel({
  title,
  metricLabel,
  sets,
  metric,
  onSelect,
}: {
  title: string
  metricLabel: string
  sets: QuestionSet[]
  metric: (set: QuestionSet) => number
  onSelect: (setId: string) => void
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <Trophy className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-black text-black">{title}</h2>
      </div>

      {sets.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-5 text-sm font-bold text-slate-500">
          아직 집계된 좋아요가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {sets.map((set, index) => (
            <button
              key={set.set_id}
              type="button"
              onClick={() => onSelect(set.set_id)}
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-slate-50"
            >
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-black">{set.name}</span>
                <span className="mt-1 block text-xs font-bold text-slate-400">
                  {getGradeLabel(set.grade)} · {getSubjectName(set.subject)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-600">
                <Heart className="h-3.5 w-3.5 fill-current" />
                {metric(set).toLocaleString()} {metricLabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterRow({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: Array<{ id: string; name: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-16 flex-shrink-0 text-sm font-black text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-black transition ${
              value === item.id
                ? 'bg-black text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-slate-400" />
      <div className="mt-2 text-xs font-bold text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-black">{value}</div>
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center">로딩 중...</div>}>
      <LibraryPageContent />
    </Suspense>
  )
}
