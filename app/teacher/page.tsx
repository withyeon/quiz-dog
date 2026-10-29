'use client'

import { confirmAsync } from '@/components/ui/ConfirmDialog'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Search,
  Copy,
  Heart,
  Pencil,
  Play,
  Plus,
  Trash2,
  Share2,
  Globe,
  Smartphone,
  Folder,
  FolderInput,
  FolderOpen,
  Check,
  Minus,
  X,
} from 'lucide-react'
import {
  copyQuestionSetFromQuestionsOnly,
  deleteQuestionSet,
  deleteQuestionSets,
  duplicateQuestionSet,
  listQuestionSetIndexFromQuestions,
  listQuestionSetsWithCounts,
  type QuestionSetIndexItem,
  type QuestionSetSummary,
} from '@/lib/services/questionSets'
import { getGameStatsForOwner } from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import { getLocalLikedQuestionSetIds, getLibraryClientId } from '@/lib/utils/libraryClientId'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toaster'
import QuestionSetPreviewModal from '@/components/teacher/QuestionSetPreviewModal'
import ShareSetModal from '@/components/share/ShareSetModal'
import { setLibraryListing } from '@/lib/services/sharing'
import { EmptyState, LoadingState } from '@/components/ui/StateViews'
import PixelIcon from '@/components/ui/PixelIcon'
import VocabStudyLinkModal from '@/components/vocab/VocabStudyLinkModal'
import { VOCAB_ENTRY_VISIBLE } from '@/lib/vocab/flags'
import {
  createQuestionSetFolder,
  deleteQuestionSetFolder,
  FOLDER_MIGRATION_NEEDED_MESSAGE,
  listQuestionSetFolders,
  moveQuestionSetsToFolder,
  normalizeFolderName,
  renameQuestionSetFolder,
  type QuestionSetFolder,
} from '@/lib/services/questionSetFolders'
import {
  FolderBar,
  FolderNameDialog,
  MoveToFolderDialog,
  SET_DRAG_TYPE,
  type FolderFilter,
} from '@/components/teacher/QuestionSetFolders'

type QuestionSet = QuestionSetSummary

/** 단어장은 카드 편집기에서, 보통 문제집은 문제 편집기에서 고친다 */
function editPathOf(set: { id: string; kind?: string }): string {
  return set.kind === 'vocab'
    ? `/teacher/vocab/${encodeURIComponent(set.id)}/edit`
    : `/teacher/sets/${encodeURIComponent(set.id)}/edit`
}
type LikedQuestionSet = QuestionSetIndexItem & {
  name: string
}

type SourceType = 'topic' | 'youtube' | 'text' | 'pdf'

type SortKey = 'recent' | 'title'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: '최신순' },
  { key: 'title', label: '이름순' },
]

// 마지막으로 열어 둔 폴더를 다음에 들어와도 그대로 보여 준다 (이 브라우저에서만)
const FOLDER_FILTER_STORAGE_KEY = 'quizdog:teacher-folder-filter'

function readStoredFolderFilter(): FolderFilter {
  try {
    return window.localStorage.getItem(FOLDER_FILTER_STORAGE_KEY) || 'all'
  } catch {
    return 'all'
  }
}

function storeFolderFilter(filter: FolderFilter) {
  try {
    window.localStorage.setItem(FOLDER_FILTER_STORAGE_KEY, filter)
  } catch {
    // 저장소를 못 쓰는 창(사생활 보호 등)이면 기억만 못 할 뿐이다
  }
}

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

  // 공유 모달을 띄울 문제집 (null 이면 닫힘)
  const [sharingSet, setSharingSet] = useState<{ id: string; title: string } | null>(null)
  // 제목을 누르면 문제를 읽기 전용으로 훑어본다(수정 화면까지 안 가고)
  const [previewSet, setPreviewSet] = useState<{ id: string; title: string; kind?: string } | null>(null)
  // 학생 공부 링크 창을 띄울 단어장
  const [studyLinkSet, setStudyLinkSet] = useState<{ id: string; title: string } | null>(null)
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [likedQuestionSets, setLikedQuestionSets] = useState<LikedQuestionSet[]>([])
  const [loading, setLoading] = useState(true)
  const [gameStats, setGameStats] = useState({ gameCount: 0, playerCount: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [folders, setFolders] = useState<QuestionSetFolder[]>([])
  // sql/20261029_question_set_folders.sql 실행 전이면 false — 폴더 버튼을 누르면 안내만 한다
  const [foldersAvailable, setFoldersAvailable] = useState(true)
  const [folderFilter, setFolderFilterState] = useState<FolderFilter>('all')
  const [folderDialog, setFolderDialog] = useState<{ mode: 'create' } | { mode: 'rename'; folder: QuestionSetFolder } | null>(null)
  const [movingSet, setMovingSet] = useState<QuestionSet | null>(null)
  // 여러 문제집을 골라 한 번에 지우거나 폴더로 옮긴다
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkMoving, setBulkMoving] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const lastClickedIdRef = useRef<string | null>(null)

  const setFolderFilter = (filter: FolderFilter) => {
    setFolderFilterState(filter)
    storeFolderFilter(filter)
    setSelectedIds(new Set())
  }

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
      const [sets, likedIndexItems, stats, folderResult] = await Promise.all([
        listQuestionSetsWithCounts(userId),
        listQuestionSetIndexFromQuestions(getLibraryClientId()),
        // 게임 통계는 실패해도 문제집 목록은 보여야 하므로 따로 처리한다
        getGameStatsForOwner(userId).catch(() => ({ gameCount: 0, playerCount: 0 })),
        // 폴더도 마찬가지 — 못 읽으면 폴더 없이 전체 목록만 보인다
        listQuestionSetFolders().catch((error) => {
          console.error('Error loading folders:', error)
          return { folders: [] as QuestionSetFolder[], available: true }
        }),
      ])
      const localLikedSetIds = getLocalLikedQuestionSetIds()
      setQuestionSets(sets)
      setGameStats(stats)
      setFolders(folderResult.folders)
      setFoldersAvailable(folderResult.available)
      // 기억해 둔 폴더가 지워졌으면 전체로 돌아간다
      const storedFilter = readStoredFolderFilter()
      const filterStillExists =
        storedFilter === 'all' ||
        (storedFilter === 'none' && folderResult.folders.length > 0) ||
        folderResult.folders.some((folder) => folder.id === storedFilter)
      setFolderFilter(filterStillExists ? storedFilter : 'all')
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
    router.push(`/teacher/play?set=${encodeURIComponent(setId)}`)
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

  /** 목록 한 줄의 자료실 공개 여부를 다시 불러오지 않고 바로 반영한다. */
  const applyLibraryState = (setId: string, isPublic: boolean) => {
    setQuestionSets((prev) => prev.map((set) => (set.id === setId ? { ...set, is_public: isPublic } : set)))
  }

  /**
   * 자료실에 올린 문제집을 다시 내린다.
   * 공유 모달 안에도 같은 토글이 있지만, 아이콘 뒤에 숨어 있어 찾기 어렵다는 피드백이 있어
   * 공개 중인 문제집에는 목록에서 바로 누를 수 있는 버튼을 둔다.
   */
  const handleUnpublish = async (set: QuestionSet) => {
    const ok = await confirmAsync({
      title: '자료실에서 내릴까요?',
      message: '다른 선생님이 자료실에서 더 이상 찾을 수 없게 돼요. 이미 담아 간 문제집은 그대로 남고, 언제든 다시 올릴 수 있어요.',
      confirmLabel: '자료실에서 내리기',
    })
    if (!ok) return

    try {
      await setLibraryListing(set.id, false)
      applyLibraryState(set.id, false)
      toast.success('자료실에서 내렸어요.')
    } catch (error) {
      console.error('자료실 회수 실패:', error)
      toast.error('자료실에서 내리지 못했어요: ' + formatServiceError(error))
    }
  }

  const openCreateFolder = () => {
    if (!foldersAvailable) {
      toast.error(FOLDER_MIGRATION_NEEDED_MESSAGE)
      return
    }
    setFolderDialog({ mode: 'create' })
  }

  const addFolder = async (name: string): Promise<QuestionSetFolder> => {
    const folder = await createQuestionSetFolder(name)
    setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })))
    return folder
  }

  const handleCreateFolder = async (name: string) => {
    const folder = await addFolder(name)
    setFolderDialog(null)
    setFolderFilter(folder.id)
    toast.success(`'${folder.name}' 폴더를 만들었어요.`)
  }

  const handleRenameFolder = async (folder: QuestionSetFolder, name: string) => {
    await renameQuestionSetFolder(folder.id, name)
    const nextName = normalizeFolderName(name)
    setFolders((prev) =>
      prev
        .map((item) => (item.id === folder.id ? { ...item, name: nextName } : item))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })),
    )
    setFolderDialog(null)
    toast.success('폴더 이름을 바꿨어요.')
  }

  const handleDeleteFolder = async (folder: QuestionSetFolder) => {
    const ok = await confirmAsync({
      title: `'${folder.name}' 폴더를 지울까요?`,
      message: '폴더만 지워지고, 안에 있던 문제집은 그대로 남아 "폴더 없음"으로 옮겨져요.',
      confirmLabel: '폴더 지우기',
      destructive: true,
    })
    if (!ok) return

    try {
      await deleteQuestionSetFolder(folder.id)
      setFolders((prev) => prev.filter((item) => item.id !== folder.id))
      setQuestionSets((prev) => prev.map((set) => (set.folder_id === folder.id ? { ...set, folder_id: null } : set)))
      setFolderFilter('all')
      toast.success('폴더를 지웠어요.')
    } catch (error) {
      console.error('Error deleting folder:', error)
      toast.error('폴더를 지우지 못했어요: ' + formatServiceError(error))
    }
  }

  /** 화면에 먼저 반영하고 저장한다. 저장이 실패하면 원래 폴더로 되돌린다. */
  const moveSets = async (setIds: string[], folderId: string | null, folderName?: string) => {
    const previousFolders = new Map(
      questionSets
        .filter((set) => setIds.includes(set.id) && (set.folder_id ?? null) !== folderId)
        .map((set) => [set.id, set.folder_id ?? null] as const),
    )
    if (previousFolders.size === 0) return

    setQuestionSets((prev) => prev.map((set) => (previousFolders.has(set.id) ? { ...set, folder_id: folderId } : set)))
    try {
      await moveQuestionSetsToFolder([...previousFolders.keys()], folderId)
      const name = folderName ?? folders.find((folder) => folder.id === folderId)?.name
      const countLabel = previousFolders.size > 1 ? `${previousFolders.size}개를 ` : ''
      toast.success(folderId ? `${countLabel}'${name ?? '폴더'}' 폴더로 옮겼어요.` : `${countLabel}폴더 밖으로 꺼냈어요.`)
    } catch (error) {
      setQuestionSets((prev) =>
        prev.map((set) => (previousFolders.has(set.id) ? { ...set, folder_id: previousFolders.get(set.id) ?? null } : set)),
      )
      throw error
    }
  }

  const moveSet = (setId: string, folderId: string | null, folderName?: string) => moveSets([setId], folderId, folderName)

  const handleDropSet = (setId: string, folderId: string | null) => {
    moveSet(setId, folderId).catch((error) => {
      console.error('Error moving question set:', error)
      toast.error('옮기지 못했어요: ' + formatServiceError(error))
    })
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

  const handleBulkDelete = async (sets: QuestionSet[]) => {
    if (sets.length === 0 || bulkBusy) return
    const ok = await confirmAsync({
      title: `문제집 ${sets.length}개를 삭제할까요?`,
      message: '삭제하면 되돌릴 수 없어요. 고른 문제집의 문제도 함께 사라집니다.',
      confirmLabel: `${sets.length}개 삭제하기`,
      destructive: true,
    })
    if (!ok) return

    setBulkBusy(true)
    try {
      await deleteQuestionSets(sets.map((set) => set.id))
      toast.success(`문제집 ${sets.length}개를 삭제했어요.`)
      setSelectedIds(new Set())
      loadQuestionSets()
    } catch (error) {
      console.error('Error deleting question sets:', error)
      toast.error('삭제하지 못했어요: ' + formatServiceError(error))
    } finally {
      setBulkBusy(false)
    }
  }

  const totalQuestions = questionSets.reduce((sum, set) => sum + set.question_count, 0)

  // 제목·검색어 모두 NFC 로 맞춰 비교한다 — macOS 파일 이름(NFD)에서 온 옛 제목도 찾도록
  const normalizedQuery = searchQuery.normalize('NFC').trim().toLowerCase()
  const folderById = new Map(folders.map((folder) => [folder.id, folder]))
  // 지워진 폴더를 가리키는 folder_id 는 폴더 없음으로 본다
  const folderOf = (set: QuestionSet) => (set.folder_id && folderById.has(set.folder_id) ? set.folder_id : null)
  const folderCounts = new Map<string, number>()
  questionSets.forEach((set) => {
    const folderId = folderOf(set)
    if (folderId) folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1)
  })
  const unfiledCount = questionSets.filter((set) => !folderOf(set)).length
  const selectedFolder = folderFilter !== 'all' && folderFilter !== 'none' ? folderById.get(folderFilter) ?? null : null
  const folderLabel = selectedFolder?.name ?? (folderFilter === 'none' ? '폴더 없음' : null)
  const canMoveSets = foldersAvailable
  const visibleSets = questionSets
    .filter((set) => {
      if (folderFilter === 'all') return true
      if (folderFilter === 'none') return !folderOf(set)
      return folderOf(set) === folderFilter
    })
    .filter((set) => !normalizedQuery || set.title.normalize('NFC').toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title, 'ko')
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  // 폴더·검색으로 가려진 문제집은 선택에서 빼고 본다 — 안 보이는 걸 지우지 않도록
  const selectedSets = visibleSets.filter((set) => selectedIds.has(set.id))
  const allVisibleSelected = visibleSets.length > 0 && selectedSets.length === visibleSets.length
  const selecting = selectedSets.length > 0

  const toggleSelected = (setId: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const turnOn = !prev.has(setId)
      const anchorId = lastClickedIdRef.current
      const anchorIndex = anchorId ? visibleSets.findIndex((set) => set.id === anchorId) : -1
      const index = visibleSets.findIndex((set) => set.id === setId)
      // Shift+클릭이면 마지막으로 누른 줄부터 이 줄까지 한꺼번에 고른다
      const range =
        shiftKey && anchorIndex >= 0 && index >= 0
          ? visibleSets.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1)
          : visibleSets.filter((set) => set.id === setId)
      range.forEach((set) => (turnOn ? next.add(set.id) : next.delete(set.id)))
      return next
    })
    lastClickedIdRef.current = setId
  }

  const toggleAllVisible = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleSets.map((set) => set.id)))
    lastClickedIdRef.current = null
  }

  const recentSets = [...questionSets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-7xl">
      {loading ? (
        <LoadingState label="문제집을 불러오는 중" minHeight="min-h-[520px]" card={false} />
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
                  {VOCAB_ENTRY_VISIBLE && (
                    <Link
                      href="/teacher/vocab/new"
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                    >
                      <Image src="/icons/ticket.webp" alt="" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
                      단어장 만들기
                    </Link>
                  )}
                  <Link
                    href="/teacher/library"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    <Image src="/gold-quest/treasure-chest.webp" alt="" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
                    자료실
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-50 p-5">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/mascot_pome.webp"
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
                      { icon: '/icons/rare.webp', label: 'AI로 만들기', href: '/teacher/create' },
                      { icon: '/zombie/log.webp', label: '직접 작성', href: '/teacher/create' },
                      ...(VOCAB_ENTRY_VISIBLE ? [{ icon: '/icons/ticket.webp', label: '단어장 만들기', href: '/teacher/vocab/new' }] : []),
                      { icon: '/gold-quest/treasure-chest.webp', label: '자료실에서 가져오기', href: '/teacher/library' },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition hover:border-sky-200 hover:bg-sky-50"
                      >
                        <span className="flex items-center gap-3 font-bold">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                            <Image src={item.icon} alt="" width={24} height={24} unoptimized className="h-6 w-6 object-contain" />
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
                {VOCAB_ENTRY_VISIBLE && (
                  <Link
                    href="/teacher/vocab/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    <Image src="/icons/ticket.webp" alt="" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
                    단어장 만들기
                  </Link>
                )}
                <Link
                  href="/teacher/library"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <Image src="/gold-quest/treasure-chest.webp" alt="" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
                  자료실
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {[
              { icon: '/zombie/quiz.webp', label: '문제집', value: questionSets.length.toLocaleString(), tone: 'bg-sky-100 text-sky-600' },
              { icon: '/assets/icons/joystick-64.png', label: '진행한 게임', value: gameStats.gameCount.toLocaleString(), tone: 'bg-emerald-50 text-emerald-600' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">{item.label}</span>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                    <Image src={item.icon} alt="" width={26} height={26} unoptimized className="h-[26px] w-[26px] object-contain" />
                  </span>
                </div>
                <div className="mt-5 text-3xl font-black tracking-tight text-slate-900">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h2 className="flex min-w-0 items-center gap-2 text-xl font-extrabold tracking-tight text-slate-900">
                      {folderLabel ? (
                        <>
                          <FolderOpen className="h-5 w-5 flex-shrink-0 text-sky-500" />
                          <span className="truncate">{folderLabel}</span>
                        </>
                      ) : (
                        '문제집 목록'
                      )}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {normalizedQuery
                        ? `검색 결과 ${visibleSets.length}개`
                        : folderLabel
                          ? `문제집 ${visibleSets.length}개`
                          : `게임 시작 · 문항 수정 · 전체 ${questionSets.length}개`}
                    </p>
                    {selectedFolder && (
                      <div className="mt-2 flex gap-3 text-sm font-bold">
                        <button
                          type="button"
                          onClick={() => setFolderDialog({ mode: 'rename', folder: selectedFolder })}
                          className="text-slate-500 underline-offset-4 transition hover:text-sky-700 hover:underline"
                        >
                          이름 바꾸기
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFolder(selectedFolder)}
                          className="text-slate-500 underline-offset-4 transition hover:text-red-600 hover:underline"
                        >
                          폴더 지우기
                        </button>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/teacher/create"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                  >
                    <Plus className="h-4 w-4" />
                    새 문제집
                  </Link>
                </div>

                {/* 문제집이 쌓이면 한 목록으로는 찾기 어려워서 폴더로 나눠 보게 한다 */}
                <div className="mt-4">
                  <FolderBar
                    folders={folders}
                    counts={folderCounts}
                    totalCount={questionSets.length}
                    unfiledCount={unfiledCount}
                    selected={folderFilter}
                    onSelect={setFolderFilter}
                    onCreate={openCreateFolder}
                    onDropSet={handleDropSet}
                  />
                </div>

                {/* 문제집이 쌓이면 스크롤로 찾기 어려워서 검색·정렬을 둔다 */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <PixelIcon name="scan" size={20} alt="" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="문제집 이름 검색"
                      aria-label="문제집 이름 검색"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSortKey(option.key)}
                        className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${
                          sortKey === option.key
                            ? 'bg-white text-sky-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleSets.length > 0 && (
                  <div
                    className={`mt-3 flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 transition ${
                      selecting ? 'bg-sky-50 ring-1 ring-sky-200' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={toggleAllVisible}
                      className="inline-flex items-center gap-2 rounded-lg py-1 pr-2 text-sm font-bold text-slate-600 transition hover:text-sky-700"
                      aria-label={allVisibleSelected ? '선택 모두 풀기' : '보이는 문제집 모두 선택'}
                    >
                      <SelectBox checked={allVisibleSelected} indeterminate={selecting && !allVisibleSelected} />
                      {selecting ? `${selectedSets.length}개 선택됨` : '전체 선택'}
                    </button>
                    {selecting ? (
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        {canMoveSets && (
                          <button
                            type="button"
                            disabled={bulkBusy}
                            onClick={() => setBulkMoving(true)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"
                          >
                            <FolderInput className="h-4 w-4" />
                            폴더로 옮기기
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={bulkBusy}
                          onClick={() => void handleBulkDelete(selectedSets)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          삭제
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedIds(new Set())}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800"
                          aria-label="선택 풀기"
                          title="선택 풀기"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">체크해서 여러 개를 한 번에 옮기거나 지울 수 있어요 · Shift+클릭으로 범위 선택</span>
                    )}
                  </div>
                )}
              </div>
              {/* 문제집이 많아도 페이지가 끝없이 길어지지 않게 목록만 안에서 스크롤한다 */}
              <div className="max-h-[min(70vh,760px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-b-2xl">
                {visibleSets.length === 0 && !normalizedQuery && (
                  <EmptyState
                    card={false}
                    icon={Folder}
                    title="이 폴더는 비어 있어요"
                    description="문제집 줄의 폴더 버튼을 누르거나, 문제집을 끌어다 위의 폴더에 놓으면 옮겨져요"
                    action={
                      <button
                        type="button"
                        onClick={() => setFolderFilter('all')}
                        className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                      >
                        전체 문제집 보기
                      </button>
                    }
                  />
                )}
                {visibleSets.length === 0 && normalizedQuery && (
                  <EmptyState
                    card={false}
                    icon={Search}
                    title={`'${searchQuery.trim()}' 와 일치하는 문제집이 없어요`}
                    description={folderLabel ? `'${folderLabel}' 안에서 찾았어요. 전체에서 찾아보세요` : '다른 이름으로 찾아보세요'}
                    action={
                      folderLabel ? (
                        <button
                          type="button"
                          onClick={() => setFolderFilter('all')}
                          className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                        >
                          전체에서 찾기
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
                        >
                          검색어 지우기
                        </button>
                      )
                    }
                  />
                )}
                {visibleSets.map((set) => (
                  <div
                    key={set.id}
                    draggable={canMoveSets}
                    onDragStart={canMoveSets ? (event) => {
                      event.dataTransfer.setData(SET_DRAG_TYPE, set.id)
                      event.dataTransfer.effectAllowed = 'move'
                    } : undefined}
                    className={`flex flex-col gap-4 p-5 transition md:flex-row md:items-center ${
                      selectedIds.has(set.id) ? 'bg-sky-50/70 hover:bg-sky-50' : 'hover:bg-slate-50'
                    }`}
                  >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                      <button
                        type="button"
                        onClick={(event) => toggleSelected(set.id, event.shiftKey)}
                        className="-m-2 flex-shrink-0 rounded-lg p-2"
                        aria-label={`${set.title} ${selectedIds.has(set.id) ? '선택 풀기' : '선택'}`}
                        aria-pressed={selectedIds.has(set.id)}
                      >
                        <SelectBox checked={selectedIds.has(set.id)} />
                      </button>
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${set.kind === 'vocab' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                        <Image src={set.kind === 'vocab' ? '/icons/ticket.webp' : '/zombie/quiz.webp'} alt="" width={32} height={32} unoptimized className="h-8 w-8 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setPreviewSet({ id: set.id, title: set.title, kind: set.kind })}
                          title="문제 미리보기"
                          className="block max-w-full truncate text-left text-base font-bold text-slate-900 underline-offset-4 transition hover:text-sky-700 hover:underline"
                        >
                          {set.title}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm font-medium text-slate-500">
                          {set.kind === 'vocab' && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">단어장</span>
                          )}
                          <span>{set.question_count}{set.kind === 'vocab' ? '장' : '문항'}</span>
                          <span>·</span>
                          <span>{new Date(set.created_at).toLocaleDateString('ko-KR')}</span>
                          {folderFilter === 'all' && folderOf(set) && (
                            <button
                              type="button"
                              onClick={() => setFolderFilter(folderOf(set)!)}
                              className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
                              title="이 폴더 열기"
                            >
                              <Folder className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{folderById.get(folderOf(set)!)?.name}</span>
                            </button>
                          )}
                          {set.is_public && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-black text-sky-700 ring-1 ring-sky-200">
                              <Globe className="h-3 w-3" />
                              자료실 공개 중
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        onClick={() => handleStartGame(set.id)}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5"
                        style={{
                          background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
                          boxShadow: '0 3px 0 #0b8fc4, 0 6px 12px rgba(14,165,233,0.22)',
                          textShadow: '0 1px 0 rgba(0,0,0,0.18)',
                        }}
                      >
                        <Play className="h-4 w-4 fill-current" />
                        게임 시작
                      </button>
                      {set.kind === 'vocab' && (
                        <button
                          onClick={() => setStudyLinkSet({ id: set.id, title: set.title })}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-white"
                          title="학생이 혼자 공부하는 링크 · QR"
                        >
                          <Smartphone className="h-4 w-4" />
                          공부 링크
                        </button>
                      )}
                      {set.is_public && (
                        <button
                          onClick={() => handleUnpublish(set)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-700 transition hover:border-sky-300 hover:bg-white"
                          aria-label={`${set.title} 자료실에서 내리기`}
                          title="자료실에서 내리기"
                        >
                          <Globe className="h-4 w-4" />
                          자료실에서 내리기
                        </button>
                      )}
                      {canMoveSets && (
                        <button
                          onClick={() => setMovingSet(set)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                          aria-label={`${set.title} 폴더로 옮기기`}
                          title="폴더로 옮기기"
                        >
                          <FolderInput className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setSharingSet({ id: set.id, title: set.title })}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                        aria-label={`${set.title} 공유 설정`}
                        title="공유 설정 (링크 · 자료실)"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => router.push(editPathOf(set))}
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
                  <span className="block text-lg font-extrabold text-slate-900">나만의 문제집 만들기</span>
                  <span className="mt-1 block text-sm font-medium text-slate-500">AI로 30초 생성</span>
                </span>
              </Link>
            </aside>
          </section>
        </div>
      )}

      {previewSet && (
        <QuestionSetPreviewModal
          setId={previewSet.id}
          title={previewSet.title}
          onClose={() => setPreviewSet(null)}
          actions={(
            <>
              <button
                type="button"
                onClick={() => { const target = previewSet; setPreviewSet(null); router.push(editPathOf(target)) }}
                className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={() => { const id = previewSet.id; setPreviewSet(null); handleStartGame(id) }}
                className="flex h-11 items-center justify-center rounded-xl bg-sky-500 px-5 text-sm font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
              >
                게임 시작
              </button>
            </>
          )}
        />
      )}
      {studyLinkSet && (
        <VocabStudyLinkModal
          setId={studyLinkSet.id}
          title={studyLinkSet.title}
          onClose={() => setStudyLinkSet(null)}
        />
      )}
      {folderDialog?.mode === 'create' && (
        <FolderNameDialog
          title="새 폴더"
          confirmLabel="만들기"
          folders={folders}
          onSubmit={handleCreateFolder}
          onClose={() => setFolderDialog(null)}
        />
      )}
      {folderDialog?.mode === 'rename' && (
        <FolderNameDialog
          title="폴더 이름 바꾸기"
          confirmLabel="바꾸기"
          initialName={folderDialog.folder.name}
          folders={folders}
          exceptId={folderDialog.folder.id}
          onSubmit={(name) => handleRenameFolder(folderDialog.folder, name)}
          onClose={() => setFolderDialog(null)}
        />
      )}
      {movingSet && (
        <MoveToFolderDialog
          setTitle={movingSet.title}
          currentFolderId={folderOf(movingSet)}
          folders={folders}
          onMove={async (folderId) => {
            await moveSet(movingSet.id, folderId)
            setMovingSet(null)
          }}
          onCreateAndMove={async (name) => {
            const folder = await addFolder(name)
            await moveSet(movingSet.id, folder.id, folder.name)
            setMovingSet(null)
          }}
          onClose={() => setMovingSet(null)}
        />
      )}
      {bulkMoving && selectedSets.length > 0 && (
        <MoveToFolderDialog
          setTitle={`문제집 ${selectedSets.length}개`}
          currentFolderId={
            selectedSets.every((set) => folderOf(set) === folderOf(selectedSets[0])) ? folderOf(selectedSets[0]) : undefined
          }
          folders={folders}
          onMove={async (folderId) => {
            await moveSets(selectedSets.map((set) => set.id), folderId)
            setBulkMoving(false)
            setSelectedIds(new Set())
          }}
          onCreateAndMove={async (name) => {
            const folder = await addFolder(name)
            await moveSets(selectedSets.map((set) => set.id), folder.id, folder.name)
            setBulkMoving(false)
            setSelectedIds(new Set())
          }}
          onClose={() => setBulkMoving(false)}
        />
      )}
      {sharingSet && (
        <ShareSetModal
          setId={sharingSet.id}
          title={sharingSet.title}
          onClose={() => setSharingSet(null)}
          onLibraryChange={(isPublic) => applyLibraryState(sharingSet.id, isPublic)}
        />
      )}
    </div>
  )
}

function SelectBox({ checked, indeterminate = false }: { checked: boolean; indeterminate?: boolean }) {
  const on = checked || indeterminate
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
        on ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 bg-white'
      }`}
    >
      {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : indeterminate ? <Minus className="h-3.5 w-3.5" strokeWidth={3.5} /> : null}
    </span>
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
    <Suspense fallback={<LoadingState label="불러오는 중" minHeight="min-h-[520px]" card={false} />}>
      <TeacherPageContent />
    </Suspense>
  )
}
