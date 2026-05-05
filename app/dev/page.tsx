'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { CHARACTERS } from '@/lib/utils/characters'
import { GAME_MODES, getGameModeUrl, type GameModeId } from '@/lib/game/modes'
import { listQuestionSetsWithCounts } from '@/lib/services/questionSets'
import { createPlayerForRoom, createRoom, startRoom } from '@/lib/services/rooms'
import Image from 'next/image'

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
  const [questionSets, setQuestionSets] = useState<any[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [connectionHint, setConnectionHint] = useState<string | null>(null)

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
        setQuestionSets(sets.slice(0, 5))
        if (sets.length > 0) {
          setSelectedSetId(sets[0].id)
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
      alert(cfg.error ?? 'Supabase 설정이 올바르지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const room = await createRoom({
        setId: selectedSetId,
        gameMode: selectedMode,
      })
      await startRoom({ roomCode: room.room_code, gameMode: selectedMode })

      const randomCharacter = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]

      const playerData = await createPlayerForRoom({
        roomCode: room.room_code,
        nickname: nickname.trim() || '개발자',
        avatar: randomCharacter.emoji,
        gameMode: selectedMode,
      })

      const pid = playerData?.id
      if (!pid) {
        throw new Error('플레이어 생성 후 id를 받지 못했습니다.')
      }

      const gameUrl = getGameModeUrl(selectedMode, room.room_code, pid)

      router.push(gameUrl)
    } catch (error) {
      const msg = formatDevStartError(error)
      console.error('Error starting dev game:', msg, error)
      alert('게임 시작에 실패했습니다: ' + msg)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>
            🛠️ 개발 모드
          </h1>
          <p className="text-xl text-gray-600">
            게임을 빠르게 테스트할 수 있는 개발자 전용 페이지입니다
          </p>
        </motion.div>

        {/* 닉네임 입력 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200"
        >
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
        </motion.div>

        {/* 문제집 선택 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200"
        >
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            문제집 선택
          </label>
          {questionSets.length === 0 ? (
            <p className="text-gray-500 text-sm">문제집이 없습니다. 먼저 문제집을 생성해주세요.</p>
          ) : (
            <select
              value={selectedSetId || ''}
              onChange={(e) => setSelectedSetId(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {questionSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.title}
                </option>
              ))}
            </select>
          )}
        </motion.div>

        {/* 게임 모드 선택 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>
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
                <div className="font-bold text-lg text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>
                  {game.emoji} {game.label}
                </div>
                <div className="text-sm text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>
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
        </motion.div>

        {/* 시작 버튼 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <motion.button
            onClick={handleStartGame}
            disabled={!selectedMode || loading}
            whileHover={{ scale: selectedMode && !loading ? 1.05 : 1 }}
            whileTap={{ scale: selectedMode && !loading ? 0.95 : 1 }}
            className={`px-12 py-6 rounded-xl font-bold text-xl shadow-lg transition-all ${selectedMode && !loading
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  ⏳
                </motion.span>
                게임 시작 중...
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
        </motion.div>

        {/* 안내 메시지 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6"
        >
          <h3 className="text-lg font-bold text-yellow-900 mb-2">💡 안내사항</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 이 페이지는 개발/테스트 전용입니다</li>
            <li>• 자동으로 방이 생성되고 플레이어가 입장됩니다</li>
            <li>• 게임은 바로 시작 상태(playing)로 설정됩니다</li>
            <li>• 선택한 문제집의 실제 문제를 사용합니다</li>
          </ul>
        </motion.div>
      </div>
    </main>
  )
}
