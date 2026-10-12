'use client'

import { toast } from '@/components/ui/Toaster'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { CHARACTERS } from '@/lib/utils/characters'
import { GAME_MODES, getGameModeUrl, type GameModeId } from '@/lib/game/modes'
import { listQuestionSetsWithCounts, type QuestionSetSummary } from '@/lib/services/questionSets'
import { createPlayerForRoom, createRoom, startRoom } from '@/lib/services/rooms'
import { DEFAULT_DEV_PLAY_FLAGS, readDevPlayFlags, writeDevPlayFlags, type DevPlayFlags } from '@/lib/dev/devPlayFlags'
import {
  DEFAULT_DEV_BOT_SETTINGS,
  DEV_BOT_DIFFICULTIES,
  DEV_BOT_MAX_COUNT,
  DEV_GAME_DURATION_MINUTES,
  createDevBotNicknames,
  readDevBotSettings,
  writeDevBotSession,
  writeDevBotSettings,
  type DevBot,
  type DevBotDifficulty,
  type DevBotSettings,
} from '@/lib/dev/devBots'
import Image from 'next/image'

// 플레이 테스트용 스위치. 켜면 이 탭에서 시작한 게임에만 적용된다(lib/dev/devPlayFlags.ts).
const DEV_PLAY_TOGGLES: Array<{ key: keyof DevPlayFlags; label: string; description: string }> = [
  {
    key: 'hanjaOnly',
    label: '한글 없애기',
    description: '문제 지문에서 한글을 지워 한자만 보입니다.',
  },
  {
    key: 'forceShortAnswer',
    label: '객관식 → 단답식',
    description: '객관식·OX 문제의 보기를 숨기고 모든 문제를 직접 입력해서 풀게 합니다. (OX 는 O 또는 X 입력)',
  },
]

function DevToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border-2 border-gray-200 px-4 py-3 cursor-pointer hover:border-gray-300">
      <span className="flex-1">
        <span className="block font-semibold text-gray-800">{label}</span>
        <span className="block text-sm text-gray-500 mt-0.5">{description}</span>
      </span>
      <span className="relative inline-flex shrink-0 items-center mt-1">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-7 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

// 마지막으로 고른 문제집. 같은 문제집으로 여러 번 테스트하므로, 다시 /dev 를 열어도 그대로 골라 둔다(이 탭에서만).
const DEV_SET_ID_KEY = 'quizdog:devSetId'

function readLastDevSetId(): string | null {
  try {
    return window.sessionStorage.getItem(DEV_SET_ID_KEY)
  } catch {
    return null
  }
}

function writeLastDevSetId(setId: string): void {
  try {
    window.sessionStorage.setItem(DEV_SET_ID_KEY, setId)
  } catch {
    // 저장이 막혀도 이번 화면에서는 고른 대로 동작한다
  }
}

function formatDevStartError(error: unknown): string {
  if (error instanceof Error) {
    const m = error.message
    if (/failed to fetch|load failed|networkerror/i.test(m)) {
      return `${m} — Supabase에 연결하지 못했습니다. .env.local(URL·Anon Key)·클라우드 프로젝트 활성화·로컬이면 supabase start·VPN/확장프로그램 차단을 확인하세요.`
    }
    return m
  }
  if (error && typeof error === 'object') {
    const e = error as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [e.message, e.details, e.hint, e.code].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )
    if (parts.length > 0) {
      const joined = parts.join(' — ')
      if (/failed to fetch|load failed|networkerror/i.test(joined)) {
        return `${joined} — Supabase에 연결하지 못했습니다. .env.local(URL·Anon Key)·클라우드 프로젝트 활성화·로컬이면 supabase start·VPN/확장프로그램 차단을 확인하세요.`
      }
      return joined
    }
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export default function DevPage() {
  const router = useRouter()
  const [selectedMode, setSelectedMode] = useState<GameModeId | null>(null)
  const [loading, setLoading] = useState(false)
  const [nickname, setNickname] = useState('개발자')
  const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [setSearch, setSetSearch] = useState('')
  const setListRef = useRef<HTMLUListElement | null>(null)

  // 처음 불러왔을 때 고른 문제집(지난번에 고른 것일 수 있다)이 목록 아래쪽이면 목록 안에서만 그 자리로 내려 준다
  useEffect(() => {
    const list = setListRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    // 목록이 relative 라 offsetTop 이 목록 기준이다. 고른 항목이 가운데 오게 한다.
    if (list && selected) list.scrollTop = selected.offsetTop - (list.clientHeight - selected.offsetHeight) / 2
    // 문제집 목록이 처음 채워질 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionSets])
  const [connectionHint, setConnectionHint] = useState<string | null>(null)
  // 서버 렌더와 어긋나지 않게 기본값으로 시작하고, 마운트 후 이 탭에 저장된 값을 읽는다.
  const [playFlags, setPlayFlags] = useState<DevPlayFlags>(DEFAULT_DEV_PLAY_FLAGS)
  const [botSettings, setBotSettings] = useState<DevBotSettings>(DEFAULT_DEV_BOT_SETTINGS)

  useEffect(() => {
    setPlayFlags(readDevPlayFlags())
    setBotSettings(readDevBotSettings())
  }, [])

  const updateBotSettings = (next: Partial<DevBotSettings>) => {
    setBotSettings((prev) => {
      const merged = { ...prev, ...next }
      writeDevBotSettings(merged)
      return merged
    })
  }

  const updatePlayFlag = (key: keyof DevPlayFlags, value: boolean) => {
    setPlayFlags(writeDevPlayFlags({ [key]: value }))
  }

  // Supabase 연결 + 문제집 로드
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const cfg = checkSupabaseConfig()
      if (!cfg.isValid) {
        if (!cancelled) setConnectionHint(cfg.error ?? 'Supabase 설정을 확인할 수 없습니다.')
        return
      }
      const conn = await testSupabaseConnection()
      if (!cancelled && !conn.success) {
        setConnectionHint(conn.error ?? 'Supabase 연결에 실패했습니다.')
        return
      }
      if (!cancelled) setConnectionHint(null)

      if (cancelled) return
      try {
        const sets = await listQuestionSetsWithCounts()
        if (cancelled) return
        // 전부 보여 준다(최신순). 목록은 스크롤되고 검색할 수 있다.
        setQuestionSets(sets)
        if (sets.length > 0) {
          const lastSetId = readLastDevSetId()
          setSelectedSetId(sets.some((set) => set.id === lastSetId) ? lastSetId : sets[0].id)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setConnectionHint((prev) => prev ?? `문제집을 불러오지 못했습니다: ${message}`)
        setQuestionSets([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const handleStartGame = async () => {
    if (!selectedMode) return

    const cfg = checkSupabaseConfig()
    if (!cfg.isValid) {
      toast.error(cfg.error ?? 'Supabase 설정이 올바르지 않습니다.')
      return
    }

    setLoading(true)
    // 게임 화면이 읽는 값은 sessionStorage 이므로, 시작 직전에 한 번 더 확정해 둔다.
    writeDevPlayFlags(playFlags)
    try {
      const room = await createRoom({
        setId: selectedSetId,
        gameMode: selectedMode,
      })

      const randomCharacter = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
      const createHuman = () => createPlayerForRoom({
        roomCode: room.room_code,
        nickname: nickname.trim() || '개발자',
        avatar: randomCharacter.emoji,
        gameMode: selectedMode,
      })

      // 봇 친구가 있으면 나 → 봇 → startRoom 순서로 넣는다.
      // - startRoom 의 눈싸움 체력 초기화·좀비 역할 배정·레이드 초기화는 "시작할 때 방에 있는 학생"에게만 한다.
      //   봇과 나 모두 받아야 게임 안에서 제대로 보인다(봇만 받고 나는 못 받으면 좀비는 역할 없이 멈춘다).
      // - 떨어지지마는 게임을 시작하는 순간 방에 있는 학생만 맵에 그린다. 봇이 미리 있어야 한다.
      // - 내가 가장 먼저 만든 행이라, 접속 정보(presence)가 잠깐 비어도 방장(눈싸움 팀 배정)은 내가 된다.
      // 봇이 없으면 예전 순서(startRoom → 나) 그대로다.
      // 게임 시간. 정하면 실제 수업처럼 시간이 흐르고, 끝나면 이 탭이 선생님 대신 방을 끝낸다(DevBotRunner).
      const durationSeconds = botSettings.durationMinutes ? botSettings.durationMinutes * 60 : undefined
      let playerData: { id: string } | null = null
      let bots: DevBot[] = []
      if (botSettings.count > 0) {
        playerData = await createHuman()
        bots = await Promise.all(
          createDevBotNicknames(botSettings.count, botSettings.difficulty).map(async (botNickname) => {
            const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
            const created = await createPlayerForRoom({
              roomCode: room.room_code,
              nickname: botNickname,
              avatar: character.imagePath || character.emoji,
              gameMode: selectedMode,
            })
            return { playerId: created.id, nickname: botNickname, difficulty: botSettings.difficulty }
          }),
        )
        await startRoom({ roomCode: room.room_code, gameMode: selectedMode, durationSeconds })
      } else {
        await startRoom({ roomCode: room.room_code, gameMode: selectedMode, durationSeconds })
        playerData = await createHuman()
      }

      const pid = playerData?.id
      if (!pid) {
        throw new Error('플레이어 생성 후 id를 받지 못했습니다.')
      }

      // 실행기(components/dev/DevBotRunner.tsx)가 이 탭에서 읽는다. 봇을 움직이고, 시간이 끝나면 방을 끝낸다.
      writeDevBotSession({ roomCode: room.room_code, gameMode: selectedMode, setId: selectedSetId, aggressive: botSettings.aggressive, bots })

      const gameUrl = getGameModeUrl(selectedMode, room.room_code, pid)

      router.push(gameUrl)
    } catch (error) {
      const msg = formatDevStartError(error)
      console.error('Error starting dev game:', msg, error)
      toast.error('게임 시작에 실패했습니다: ' + msg)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
      <div className="max-w-6xl mx-auto">
        {connectionHint && (
          <div
            className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            <strong className="block font-semibold mb-1">Supabase 연결</strong>
            {connectionHint}
          </div>
        )}
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4 font-bitbit">
            🛠️ 개발 모드
          </h1>
          <p className="text-xl text-gray-600">
            게임을 빠르게 테스트할 수 있는 개발자 전용 페이지입니다
          </p>
        </div>

        {/* 닉네임 입력 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            닉네임 (선택사항)
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="개발자"
            maxLength={20}
          />
        </div>

        {/* 문제집 선택 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            문제집 선택
          </label>
          {questionSets.length === 0 ? (
            <p className="text-gray-500 text-sm">문제집이 없습니다. 먼저 문제집을 생성해주세요.</p>
          ) : (
            <>
              <input
                type="search"
                value={setSearch}
                onChange={(e) => setSetSearch(e.target.value)}
                placeholder={`문제집 ${questionSets.length}개 중 검색`}
                aria-label="문제집 검색"
                className="mb-2 w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {(() => {
                const keyword = setSearch.trim().toLowerCase()
                const visibleSets = keyword
                  ? questionSets.filter((set) => set.title.toLowerCase().includes(keyword))
                  : questionSets
                const selectedSet = questionSets.find((set) => set.id === selectedSetId)
                return (
                  <>
                    {selectedSet && (
                      <p className="mb-2 text-sm text-gray-600">
                        선택: <span className="font-semibold text-gray-900">{selectedSet.title}</span> · {selectedSet.question_count}문제
                      </p>
                    )}
                    <ul ref={setListRef} className="relative max-h-72 overflow-y-auto rounded-lg border-2 border-gray-200 divide-y divide-gray-100" role="listbox" aria-label="문제집 목록">
                      {visibleSets.map((set) => {
                        const selected = set.id === selectedSetId
                        return (
                          <li key={set.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                setSelectedSetId(set.id)
                                writeLastDevSetId(set.id)
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                                selected ? 'bg-blue-50 font-semibold text-blue-900' : 'hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate">{set.title}</span>
                              <span className={`shrink-0 text-xs ${set.question_count === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                {set.question_count}문제
                              </span>
                            </button>
                          </li>
                        )
                      })}
                      {visibleSets.length === 0 && (
                        <li className="px-4 py-3 text-sm text-gray-500">&apos;{setSearch.trim()}&apos;이(가) 들어간 문제집이 없어요</li>
                      )}
                    </ul>
                  </>
                )
              })()}
            </>
          )}
        </div>

        {/* 플레이 테스트 스위치 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            플레이 테스트 스위치
          </label>
          <div className="space-y-3">
            {DEV_PLAY_TOGGLES.map((toggle) => (
              <DevToggle
                key={toggle.key}
                label={toggle.label}
                description={toggle.description}
                checked={playFlags[toggle.key]}
                onChange={(next) => updatePlayFlag(toggle.key, next)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            이 탭에서 시작한 게임에만 적용되고, 탭을 닫으면 꺼집니다. 다른 학생 화면에는 영향이 없습니다.
          </p>
        </div>

        {/* 게임 시간 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            게임 시간 <span className="font-normal text-gray-500">(끝나면 결과 화면으로 넘어가요)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[null, ...DEV_GAME_DURATION_MINUTES].map((minutes) => (
              <button
                key={minutes ?? 'unlimited'}
                type="button"
                onClick={() => updateBotSettings({ durationMinutes: minutes })}
                aria-pressed={botSettings.durationMinutes === minutes}
                className={`h-10 rounded-lg border-2 px-4 font-bold transition ${
                  botSettings.durationMinutes === minutes
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {minutes === null ? '무제한' : `${minutes}분`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            /dev 방에는 선생님 화면이 없어서, 시간이 끝나면 이 탭이 선생님 대신 방을 끝냅니다. 무제한이면 예전처럼 끝나지 않습니다.
          </p>
        </div>

        {/* 봇 친구 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            봇 친구 <span className="font-normal text-gray-500">(혼자 하기 심심할 때 같은 방에 들어와 같이 풀어요)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: DEV_BOT_MAX_COUNT + 1 }, (_, count) => (
              <button
                key={count}
                type="button"
                onClick={() => updateBotSettings({ count })}
                aria-pressed={botSettings.count === count}
                className={`h-10 min-w-10 rounded-lg border-2 px-3 font-bold transition ${
                  botSettings.count === count
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {count === 0 ? '없음' : `${count}명`}
              </button>
            ))}
          </div>
          <div className={`mt-4 grid grid-cols-3 gap-2 ${botSettings.count === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
            {(Object.keys(DEV_BOT_DIFFICULTIES) as DevBotDifficulty[]).map((difficulty) => {
              const profile = DEV_BOT_DIFFICULTIES[difficulty]
              const active = botSettings.difficulty === difficulty
              return (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => updateBotSettings({ difficulty })}
                  aria-pressed={active}
                  className={`rounded-lg border-2 px-3 py-2 text-left transition ${
                    active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="block font-bold text-gray-900">
                    {profile.label}급 <span className="text-sm font-semibold text-gray-500">정답률 {Math.round(profile.accuracy * 100)}%</span>
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">{profile.description}</span>
                </button>
              )
            })}
          </div>
          <div className={`mt-4 ${botSettings.count === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
            <DevToggle
              label="공격 자주"
              description="봇이 방해·공격 아이템(강탈·세금·화면 뒤집기·똥폭탄·친구 조사 등)을 훨씬 자주 씁니다. 끄면 게임 규칙의 확률 그대로라 봇이 적으면 공격이 드뭅니다."
              checked={botSettings.aggressive}
              onChange={(aggressive) => updateBotSettings({ aggressive })}
            />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            봇은 이 탭에서 게임 화면이 열려 있는 동안만 움직이고, 순위표·결과에 다른 학생처럼 나옵니다.
          </p>
        </div>

        {/* 게임 모드 선택 */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 font-bitbit">
            게임 모드 선택
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GAME_MODES.map((game) => (
              <motion.button
                key={game.id}
                onClick={() => setSelectedMode(game.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === game.id
                  ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                {game.image ? (
                  <Image
                    src={game.image}
                    alt={game.label}
                    width={200}
                    height={200}
                    className="w-32 h-32 object-contain mb-3"
                  />
                ) : (
                  <div className="w-32 h-32 mb-3 flex items-center justify-center text-7xl">
                    {game.emoji}
                  </div>
                )}
                <div className="font-bold text-lg text-gray-900 mb-2 font-bitbit">
                  {game.emoji} {game.label}
                </div>
                <div className="text-sm text-gray-600 text-center px-2 font-bitbit">
                  {game.description}
                </div>
                {selectedMode === game.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-3 text-2xl"
                  >
                    ✅
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 시작 버튼 */}
        <div className="mt-8 text-center">
          <motion.button
            onClick={handleStartGame}
            disabled={!selectedMode || loading}
            whileHover={{ scale: selectedMode && !loading ? 1.05 : 1 }}
            whileTap={{ scale: selectedMode && !loading ? 0.95 : 1 }}
            className={`px-12 py-6 rounded-xl font-bold text-xl shadow-lg transition-all ${selectedMode && !loading
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              } font-bitbit`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  ⏳
                </motion.span>
                게임 시작 중
              </span>
            ) : (
              <span className="flex items-center gap-2">
                🚀 게임 시작하기
              </span>
            )}
          </motion.button>
          {!selectedMode && (
            <p className="mt-4 text-gray-500 text-sm">
              게임 모드를 선택해주세요
            </p>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="mt-8 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-yellow-900 mb-2">💡 안내사항</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 이 페이지는 개발/테스트 전용입니다</li>
            <li>• 자동으로 방이 생성되고 플레이어가 입장됩니다</li>
            <li>• 게임은 바로 시작 상태(playing)로 설정됩니다</li>
            <li>• 선택한 문제집의 실제 문제를 사용합니다</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
