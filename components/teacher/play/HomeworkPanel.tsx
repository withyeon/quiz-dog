'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import QRCodeSVG from 'react-qr-code'
import { BookOpenCheck, Copy, ExternalLink, Loader2, Radio, Square } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { confirmAsync } from '@/components/ui/ConfirmDialog'
import QuestionSetPicker from '@/components/teacher/play/QuestionSetPicker'
import GameDurationPicker from '@/components/teacher/play/GameDurationPicker'
import StudyOptionsFields from '@/components/teacher/play/StudyOptionsFields'
import { HOMEWORK_PLAY_MODES, getGameModeConfig, type GameModeId } from '@/lib/game/modes'
import {
  DEFAULT_STUDY_SETTINGS,
  buildRoomSettings,
  describeStudySettings,
  parseStudySettings,
  type StudySettings,
} from '@/lib/game/studySettings'
import type { QuestionSetSummary } from '@/lib/services/questionSets'
import { assertQuestionSetHasQuestions } from '@/lib/services/rooms'
import {
  closeHomeworkRoom,
  createHomeworkRoom,
  defaultHomeworkDueAt,
  describeHomeworkError,
  formatDueAt,
  listOpenHomeworkRooms,
  toDateTimeLocalValue,
  type HomeworkRoomSummary,
} from '@/lib/services/homework'

export type HostMode = 'live' | 'homework'

/** 실시간 수업 ↔ 과제로 내기 전환 탭 */
export function HostModeToggle({ value, onChange }: { value: HostMode; onChange: (mode: HostMode) => void }) {
  const items: Array<{ id: HostMode; label: string; hint: string; icon: React.ReactNode }> = [
    { id: 'live', label: '실시간 수업', hint: '지금 교실에서 같이 해요', icon: <Radio className="h-5 w-5" /> },
    { id: 'homework', label: '과제로 내기', hint: '학생이 기한 안에 혼자 풀어요', icon: <BookOpenCheck className="h-5 w-5" /> },
  ]
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={active}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
              active ? 'bg-sky-500 text-white shadow-sm shadow-sky-200' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-black">{item.label}</span>
              <span className={`block text-xs font-semibold ${active ? 'text-sky-50' : 'text-slate-400'}`}>{item.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface HomeworkPanelProps {
  questionSets: QuestionSetSummary[]
  selectedSetId: string
  onSelectSet: (setId: string) => void
  setsLoading: boolean
  setsError: string | null
  ownerId: string | null
}

/**
 * 과제 만들기 + 진행 중인 과제 목록.
 * 실시간 수업과 달리 방을 만드는 순간 playing이 되고 선생님 화면은 닫아도 된다.
 */
export default function HomeworkPanel({
  questionSets, selectedSetId, onSelectSet, setsLoading, setsError, ownerId,
}: HomeworkPanelProps) {
  const router = useRouter()
  // 과제는 공부 모드가 기본이다. 게임을 고르면 혼자서도 성립하는 게임 목록이 나온다.
  const [gameMode, setGameMode] = useState<GameModeId>('study')
  const [studySettings, setStudySettings] = useState<StudySettings>(DEFAULT_STUDY_SETTINGS)
  const isStudy = gameMode === 'study'
  const [minutes, setMinutes] = useState(5)
  const [dueAtValue, setDueAtValue] = useState(() => toDateTimeLocalValue(defaultHomeworkDueAt()))
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<HomeworkRoomSummary | null>(null)
  const [openRooms, setOpenRooms] = useState<HomeworkRoomSummary[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [closingCode, setClosingCode] = useState<string | null>(null)

  const setIds = useMemo(() => questionSets.map((set) => set.id), [questionSets])
  const setIdsKey = setIds.join(',')

  const refreshList = useCallback(async () => {
    if (setIds.length === 0) { setOpenRooms([]); return }
    setListLoading(true)
    try {
      setOpenRooms(await listOpenHomeworkRooms(setIds))
    } catch (error) {
      // 마이그레이션 전이면 컬럼이 없어 실패한다 — 목록만 비워 두고 조용히 넘어간다
      console.warn('과제 목록을 불러오지 못했습니다:', describeHomeworkError(error))
      setOpenRooms([])
    } finally {
      setListLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIdsKey])

  useEffect(() => { void refreshList() }, [refreshList])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrlOf = (code: string) => `${origin}/lobby?code=${code}`

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}를 복사했어요.`)
    } catch {
      toast.error('복사에 실패했어요. 직접 선택해서 복사해주세요.')
    }
  }

  const handleCreate = async () => {
    if (!selectedSetId) {
      toast.info(questionSets.length === 0 ? '먼저 문제집을 만들어주세요.' : '과제로 낼 문제집을 선택해주세요.')
      return
    }
    const due = new Date(dueAtValue)
    if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now() + 5 * 60 * 1000) {
      toast.error('마감은 지금부터 최소 5분 뒤여야 해요.')
      return
    }
    setCreating(true)
    try {
      await assertQuestionSetHasQuestions(selectedSetId)
      const room = await createHomeworkRoom({
        setId: selectedSetId,
        gameMode,
        // 공부 모드는 제한 시간 없이 마감까지 푼다
        durationSeconds: isStudy ? null : minutes * 60,
        dueAt: due.toISOString(),
        ...(isStudy ? { settings: buildRoomSettings(studySettings) } : {}),
      })
      setCreated({ ...room, playerCount: 0 })
      toast.success('과제를 냈어요. 코드나 링크를 학생들에게 나눠주세요.')
      void refreshList()
    } catch (error) {
      toast.error('과제 만들기에 실패했어요: ' + describeHomeworkError(error))
    } finally {
      setCreating(false)
    }
  }

  const handleClose = async (room: HomeworkRoomSummary) => {
    const ok = await confirmAsync({
      title: '이 과제를 마감할까요?',
      message: `${room.playerCount}명이 참여했어요. 마감하면 더 이상 들어올 수 없고, 성적이 게임 기록에 저장돼요.`,
      confirmLabel: '마감하기',
    })
    if (!ok) return
    setClosingCode(room.room_code)
    try {
      await closeHomeworkRoom(room.room_code, ownerId)
      toast.success('과제를 마감했어요. 게임 기록에서 결과를 볼 수 있어요.')
      if (created?.room_code === room.room_code) setCreated(null)
      void refreshList()
    } catch (error) {
      toast.error('마감에 실패했어요: ' + describeHomeworkError(error))
    } finally {
      setClosingCode(null)
    }
  }

  const selectedSet = questionSets.find((set) => set.id === selectedSetId)

  return (
    <div className="mb-6 space-y-6">
      {/* 과제 만들기 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <div className="text-sm font-semibold text-slate-500">과제로 내기</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">학생이 기한 안에 혼자 풀어요</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            코드만 나눠주면 돼요. 공부 모드는 시간 제한 없이 마감까지 풀고, 게임은 들어온 순간부터 정한 시간만큼 플레이해요. 결과는 게임 기록에 모여요.
          </p>
        </div>

        {/* 형식 고르기 — 공부 모드가 첫 번째, 게임은 혼자서도 성립하는 모드만 */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold text-slate-600">형식</label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGameMode('study')}
              aria-pressed={isStudy}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                isStudy ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-2xl">📖</span>
              <span className="min-w-0">
                <span className={`block font-black ${isStudy ? 'text-sky-800' : 'text-slate-700'}`}>공부 모드</span>
                <span className="block text-xs font-semibold text-slate-400">문제만 차근차근 · 바로 정답 확인 · 틀린 문제 다시</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => { if (isStudy) setGameMode(HOMEWORK_PLAY_MODES[0]) }}
              aria-pressed={!isStudy}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                !isStudy ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-2xl">🎮</span>
              <span className="min-w-0">
                <span className={`block font-black ${!isStudy ? 'text-sky-800' : 'text-slate-700'}`}>게임</span>
                <span className="block text-xs font-semibold text-slate-400">재미있게 · 정한 시간 동안 플레이</span>
              </span>
            </button>
          </div>
          {isStudy && (
            <StudyOptionsFields value={studySettings} onChange={setStudySettings} context="homework" />
          )}
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${isStudy ? 'hidden' : ''}`}>
            {HOMEWORK_PLAY_MODES.map((id) => {
              const mode = getGameModeConfig(id)
              const active = id === gameMode
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGameMode(id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center text-xs font-black leading-snug transition sm:text-sm ${
                    active ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {mode.image ? (
                    <Image
                      src={mode.image}
                      alt={mode.label}
                      width={72}
                      height={72}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center text-2xl">{mode.emoji}</span>
                  )}
                  <span className="font-bitbit w-full">{mode.label}</span>
                </button>
              )
            })}
          </div>
          {!isStudy && (
            <p className="mt-2 text-xs font-semibold text-slate-400">눈싸움·마피아·좀비처럼 여럿이 있어야 하는 게임은 과제로 낼 수 없어요.</p>
          )}
        </div>

        <div className="mb-5">
          <QuestionSetPicker
            questionSets={questionSets}
            selectedSetId={selectedSetId}
            loading={setsLoading}
            error={setsError}
            onSelect={onSelectSet}
            onCreateQuestionSet={() => router.push('/teacher/create')}
          />
        </div>

        <div className="mb-5 grid gap-5 md:grid-cols-2">
          {isStudy ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">시간</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                제한 시간 없음 · 마감 전까지 언제든 풀어요
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">학생 한 명당 플레이 시간</label>
              <GameDurationPicker minutes={minutes} onChange={setMinutes} />
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">제출 마감</label>
            <input
              type="datetime-local"
              value={dueAtValue}
              min={toDateTimeLocalValue(new Date())}
              onChange={(e) => setDueAtValue(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !selectedSetId}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-9 py-4 text-lg font-bold text-white shadow-sm shadow-sky-200 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:hover:translate-y-0"
          >
            {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpenCheck className="h-5 w-5" />}
            {selectedSet ? `"${selectedSet.title}" 과제로 내기` : '과제로 내기'}
          </button>
        </div>
      </div>

      {/* 방금 만든 과제 */}
      {created && (
        <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="text-sm font-black text-sky-700">과제 코드</div>
              <div className="mt-1 text-5xl font-black tracking-[0.2em] text-slate-900">{created.room_code}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copy(created.room_code, '코드')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-700 hover:bg-sky-100"
                >
                  <Copy className="h-4 w-4" /> 코드 복사
                </button>
                <button
                  type="button"
                  onClick={() => copy(inviteUrlOf(created.room_code), '링크')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-700 hover:bg-sky-100"
                >
                  <ExternalLink className="h-4 w-4" /> 링크 복사
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <dt className="font-semibold text-slate-500">형식</dt>
                <dd className="font-black text-slate-800">{getGameModeConfig(created.game_mode).label}</dd>
                {created.game_mode === 'study' ? (
                  <>
                    <dt className="font-semibold text-slate-500">옵션</dt>
                    <dd className="font-black text-slate-800">{describeStudySettings(parseStudySettings(created.settings))}</dd>
                  </>
                ) : (
                  <>
                    <dt className="font-semibold text-slate-500">한 명당</dt>
                    <dd className="font-black text-slate-800">{Math.round((created.duration_seconds ?? 0) / 60)}분</dd>
                  </>
                )}
                <dt className="font-semibold text-slate-500">마감</dt>
                <dd className="font-black text-slate-800">{formatDueAt((created as { due_at?: string | null }).due_at)}</dd>
              </dl>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={inviteUrlOf(created.room_code)} size={132} />
            </div>
          </div>
        </div>
      )}

      {/* 진행 중인 과제 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">진행 중인 과제</h3>
          {listLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        {openRooms.length === 0 ? (
          <p className="text-sm font-medium text-slate-400">아직 진행 중인 과제가 없어요.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {openRooms.map((room) => {
              const set = questionSets.find((item) => item.id === room.set_id)
              const mode = getGameModeConfig(room.game_mode)
              const dueAt = (room as { due_at?: string | null }).due_at
              const isPastDue = dueAt ? new Date(dueAt).getTime() < Date.now() : false
              return (
                <li key={room.room_code} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-black tracking-widest text-slate-800">{room.room_code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-black text-slate-800">
                      {mode.image ? (
                        <Image
                          src={mode.image}
                          alt=""
                          width={28}
                          height={28}
                          className="h-6 w-6 flex-shrink-0 object-contain"
                        />
                      ) : (
                        <span>{mode.emoji}</span>
                      )}
                      {set?.title ?? '문제집'}
                    </span>
                    <span className={`block text-xs font-semibold ${isPastDue ? 'text-red-500' : 'text-slate-400'}`}>
                      {isPastDue ? '마감 지남' : `마감 ${formatDueAt(dueAt)}`} · {room.playerCount}명 참여
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(inviteUrlOf(room.room_code), '링크')}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                  >
                    링크
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/teacher/report/${room.room_code}`)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                  >
                    결과 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClose(room)}
                    disabled={closingCode === room.room_code}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    {closingCode === room.room_code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                    마감
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
