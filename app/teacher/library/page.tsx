'use client'

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  FileQuestion,
  GraduationCap,
  Library,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import GameTypeSelector, { type GameType } from '@/components/GameTypeSelector'
import { DEFAULT_GAME_MODE, type GameModeId } from '@/lib/game/modes'
import {
  copyQuestionSetFromQuestionsOnly,
  listQuestionSetIndexFromQuestions,
} from '@/lib/services/questionSets'

type QuestionSet = {
  set_id: string
  name: string
  question_count: number
  created_at: string
  subject: string
  grade: string
  creator: string
  tags: string[]
}

const SUBJECTS = [
  { id: 'integrated', name: '통합교과' },
  { id: 'creative', name: '창체' },
  { id: 'korean', name: '국어' },
  { id: 'math', name: '수학' },
  { id: 'social', name: '사회' },
  { id: 'science', name: '과학' },
  { id: 'english', name: '영어' },
  { id: 'ethics', name: '도덕' },
]

const SCHOOL_LEVELS = [
  { id: 'all', name: '전체' },
  { id: 'elementary', name: '초등' },
  { id: 'middle', name: '중등' },
  { id: 'high', name: '고등' },
]

const GRADE_GROUPS = {
  elementary: ['1', '2', '3', '4', '5', '6'],
  middle: ['1', '2', '3'],
  high: ['1', '2', '3'],
} as const

type SchoolLevel = keyof typeof GRADE_GROUPS
type SortType = 'recommended' | 'recent' | 'name' | 'question_count'

const extractSubject = (setId: string): string => {
  const subject = SUBJECTS.find((item) => setId.includes(item.id))
  return subject?.id || 'integrated'
}

const extractGrade = (setId: string): string => {
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

const getGradeLabel = (grade: string) => {
  const [level, number] = grade.split('-')
  const levelLabel = level === 'elementary' ? '초등' : level === 'middle' ? '중등' : '고등'
  return `${levelLabel} ${number}학년`
}

const generateTags = (setId: string): string[] => {
  const grade = extractGrade(setId)
  return [getGradeLabel(grade), getSubjectName(extractSubject(setId))]
}

function LibraryPageContent() {
  const router = useRouter()

  const [allQuestionSets, setAllQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedSchoolLevel, setSelectedSchoolLevel] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortType, setSortType] = useState<SortType>('recommended')
  const [previewSetId, setPreviewSetId] = useState<string | null>(null)
  const [showGameTypeSelector, setShowGameTypeSelector] = useState(false)
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)

  const loadQuestionSets = useCallback(async () => {
    try {
      setLoading(true)
      const indexItems = await listQuestionSetIndexFromQuestions()
      const sets = indexItems.map((item) => ({
        ...item,
        name: item.set_id.replace('set-', '문제집 '),
        subject: extractSubject(item.set_id),
        grade: extractGrade(item.set_id),
        creator: '퀴즈독 자료실',
        tags: generateTags(item.set_id),
      }))

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

    if (sortType === 'recent') {
      return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    if (sortType === 'name') {
      return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
    }

    if (sortType === 'question_count') {
      return filtered.sort((a, b) => b.question_count - a.question_count)
    }

    return filtered.sort((a, b) => {
      const questionDelta = b.question_count - a.question_count
      if (questionDelta !== 0) return questionDelta
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [allQuestionSets, searchQuery, selectedGrade, selectedSchoolLevel, selectedSubject, sortType])

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
    setSortType('recommended')
  }

  const handleCopySet = async (setId: string) => {
    try {
      await copyQuestionSetFromQuestionsOnly(setId)
      alert('내 문제집에 담았습니다.')
      router.push('/teacher')
    } catch (error) {
      console.error('Error copying set:', error)
      alert('문제집을 담지 못했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleStartGame = (setId: string) => {
    setSelectedSetId(setId)
    setShowGameTypeSelector(true)
  }

  const handleGameTypeSelect = (gameType: GameType) => {
    if (!selectedSetId) return

    const modeByType: Record<GameType, GameModeId> = {
      sequential: DEFAULT_GAME_MODE,
      free: 'dontlookdown',
      round: 'battle_royale',
      team: 'gold_quest',
    }
    const gameMode = modeByType[gameType]

    router.push(`/teacher/dashboard?set=${selectedSetId}&gameType=${gameType}&gameMode=${gameMode}`)
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
            <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
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
                <div className="mt-3 text-2xl font-black text-slate-950">{item.value}</div>
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
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
          <div className="flex items-center gap-2">
            <select
              value={sortType}
              onChange={(event) => setSortType(event.target.value as SortType)}
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="recommended">추천순</option>
              <option value="recent">최근 추가순</option>
              <option value="question_count">문항 많은순</option>
              <option value="name">이름순</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="h-12 rounded-lg px-4 text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
            }}
          />

          {selectedSchoolLevel !== 'all' && (
            <FilterRow
              label="학년"
              items={[
                { id: 'all', name: '전체' },
                ...GRADE_GROUPS[selectedSchoolLevel as SchoolLevel].map((grade) => ({
                  id: `${selectedSchoolLevel}-${grade}`,
                  name: `${grade}학년`,
                })),
              ]}
              value={selectedGrade}
              onChange={setSelectedGrade}
            />
          )}

          <FilterRow
            label="과목"
            items={[{ id: 'all', name: '전체' }, ...SUBJECTS]}
            value={selectedSubject}
            onChange={setSelectedSubject}
          />
        </div>
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
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center ring-1 ring-slate-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Search className="h-6 w-6 text-slate-400" />
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-950">맞는 자료가 없습니다</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">검색어나 필터를 조금 넓혀보세요.</p>
              <button
                onClick={resetFilters}
                className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            filteredSets.map((set) => (
              <button
                key={set.set_id}
                onClick={() => setPreviewSetId(set.set_id)}
                className={`w-full rounded-lg bg-white p-5 text-left shadow-sm ring-1 transition ${
                  selectedSet?.set_id === set.set_id
                    ? 'ring-slate-950'
                    : 'ring-slate-200 hover:bg-slate-50'
                }`}
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
                    <h3 className="truncate text-lg font-black text-slate-950">{set.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
                      <span>{set.creator}</span>
                      <span>·</span>
                      <span>{set.question_count}문제</span>
                      <span>·</span>
                      <span>{new Date(set.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <ArrowRight className="hidden h-5 w-5 text-slate-300 sm:block" />
                </div>
              </button>
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

                <h2 className="mt-5 text-xl font-black leading-snug text-slate-950">{selectedSet.name}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <InfoTile label="문항 수" value={`${selectedSet.question_count}개`} icon={FileQuestion} />
                  <InfoTile label="대상" value={getGradeLabel(selectedSet.grade)} icon={GraduationCap} />
                  <InfoTile label="과목" value={getSubjectName(selectedSet.subject)} icon={BookOpen} />
                  <InfoTile label="출처" value="자료실" icon={Library} />
                </div>

                <div className="mt-5 space-y-2">
                  <button
                    onClick={() => handleCopySet(selectedSet.set_id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    내 문제집에 담기
                  </button>
                  <button
                    onClick={() => handleStartGame(selectedSet.set_id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    바로 게임 시작
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/teacher/library?set=${selectedSet.set_id}`)
                      alert('링크가 복사되었습니다.')
                    }}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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

      <GameTypeSelector
        isOpen={showGameTypeSelector}
        onClose={() => {
          setShowGameTypeSelector(false)
          setSelectedSetId(null)
        }}
        onSelect={handleGameTypeSelect}
        questionSetName={selectedSetId ? allQuestionSets.find((set) => set.set_id === selectedSetId)?.name : undefined}
      />
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
                ? 'bg-slate-950 text-white'
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
  icon: typeof BookOpen
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-slate-400" />
      <div className="mt-2 text-xs font-bold text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-900">{value}</div>
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <LibraryPageContent />
    </Suspense>
  )
}
