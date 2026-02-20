'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { generateRoomCode } from '@/lib/utils/gameCode'
import { CHARACTERS } from '@/lib/utils/characters'
import type { Database } from '@/types/database.types'
import Image from 'next/image'

type GameMode = 'gold_quest' | 'racing' | 'battle_royale' | 'fishing' | 'factory' | 'cafe' | 'mafia' | 'tower' | 'dontlookdown'

const GAME_MODES: { mode: GameMode; name: string; description: string; image: string; emoji: string }[] = [
  {
    mode: 'gold_quest',
    name: '🏴‍☠️ 해적왕의 보물찾기',
    description: '황금빛 보물이 잠든 섬, 지도를 따라 모험을 떠나는 짜릿한 해적 어드벤처!',
    image: '/gold-quest.png',
    emoji: '🏴‍☠️',
  },
  {
    mode: 'racing',
    name: '🏃 미션: 등교 임파서블',
    description: '닫히는 교문을 향해 전력 질주! 장애물을 피해 달리는 스릴 만점 등교 레이싱.',
    image: '/racing.png',
    emoji: '🏃',
  },
  {
    mode: 'battle_royale',
    name: '❄️ 눈싸움 대작전',
    description: '던지고 피하고 명중시켜라! 설원 위에서 펼쳐지는 예측불허 스노우 액션.',
    image: '/battle-royale.png',
    emoji: '❄️',
  },
  {
    mode: 'fishing',
    name: '🕹️ 두근두근 인형뽑기',
    description: '손끝에 집중하라! 집게가 움직일 때마다 심장이 쫄깃해지는 행운의 뽑기 한판.',
    image: '/fishing.png',
    emoji: '🕹️',
  },
  {
    mode: 'factory',
    name: '🏪 전설의 편의점',
    description: '진열부터 계산까지 내 손으로! 동네 최고의 핫플레이스를 만드는 경영 시뮬레이션.',
    image: '/factory.png',
    emoji: '🏪',
  },
  {
    mode: 'cafe',
    name: '☕ 달콤 바삭 카페',
    description: '손님에게 음식을 서빙하고 카페를 성장시키는 달콤한 경영 게임!',
    image: '/cafe.png',
    emoji: '☕',
  },
  {
    mode: 'mafia',
    name: '🕴️ 쉿! 마피아',
    description: '금고를 털고, 배신하고, 색출하라! 느와르 스타일의 심리전 게임!',
    image: '/mafia.png',
    emoji: '🕴️',
  },
  {
    mode: 'tower',
    name: '🏰 타워 디펜스',
    description: '퀴즈를 풀어 타워를 설치하고, 밀려오는 적들을 막아내는 전략 게임!',
    image: '/tower-defense.svg',
    emoji: '🏰',
  },
  {
    mode: 'dontlookdown',
    name: '⛰️ Don\'t Look Down',
    description: '파워업을 모으고 장애물을 피하며 6개 Summit을 넘어 정상을 정복하라!',
    image: '/tower-defense.svg',
    emoji: '⛰️',
  },
]

export default function DevPage() {
  const router = useRouter()
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [loading, setLoading] = useState(false)
  const [nickname, setNickname] = useState('개발자')
  const [questionSets, setQuestionSets] = useState<any[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)

  // 문제집 로드
  useEffect(() => {
    const loadSets = async () => {
      const { data } = await supabase
        .from('question_sets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      setQuestionSets(data || [])
      if (data && data.length > 0) {
        setSelectedSetId((data as any)[0].id) // 첫 번째 세트 자동 선택
      }
    }
    loadSets()
  }, [])

  const handleStartGame = async () => {
    if (!selectedMode) return

    setLoading(true)
    try {
      // 1. 방 코드 생성
      const roomCode = generateRoomCode()

      // 2. 방 생성
      const roomInsert: Database['public']['Tables']['rooms']['Insert'] = {
        room_code: roomCode,
        status: 'playing', // 바로 playing 상태로 시작
        current_q_index: 0,
        game_mode: selectedMode,
        set_id: selectedSetId, // 선택된 문제집 ID 포함
      }

      const { error: roomError } = await (supabase
        .from('rooms')
        .insert(roomInsert as any) as any)

      if (roomError) throw roomError

      // 3. 플레이어 생성
      const randomCharacter = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
      const isBattleRoyale = selectedMode === 'battle_royale'

      const playerInsert: Database['public']['Tables']['players']['Insert'] = {
        room_code: roomCode,
        nickname: nickname.trim() || '개발자',
        score: 0,
        gold: 0,
        avatar: randomCharacter.emoji,
        is_online: true,
        health: isBattleRoyale ? 100 : undefined,
        position: selectedMode === 'racing' ? 0 : undefined,
      }

      const { data: playerData, error: playerError } = await (supabase
        .from('players')
        .insert(playerInsert as any)
        .select()
        .single() as any)

      if (playerError) throw playerError

      // 4. 게임 페이지로 이동
      const gameUrl = selectedMode === 'racing'
        ? `/racing?room=${roomCode}&playerId=${playerData.id}`
        : selectedMode === 'battle_royale'
          ? `/battle?room=${roomCode}&playerId=${playerData.id}`
          : selectedMode === 'fishing'
            ? `/fishing?room=${roomCode}&playerId=${playerData.id}`
            : selectedMode === 'factory'
              ? `/factory?room=${roomCode}&playerId=${playerData.id}`
              : selectedMode === 'cafe'
                ? `/cafe?room=${roomCode}&playerId=${playerData.id}`
                : selectedMode === 'mafia'
                  ? `/mafia?room=${roomCode}&playerId=${playerData.id}`
                  : selectedMode === 'tower'
                    ? `/tower?room=${roomCode}&playerId=${playerData.id}`
                    : selectedMode === 'dontlookdown'
                      ? `/dontlookdown?room=${roomCode}&playerId=${playerData.id}`
                      : `/game?room=${roomCode}&playerId=${playerData.id}`

      router.push(gameUrl)
    } catch (error) {
      console.error('Error starting dev game:', error)
      alert('게임 시작에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
      <div className="max-w-6xl mx-auto">
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
                key={game.mode}
                onClick={() => setSelectedMode(game.mode)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === game.mode
                  ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                <Image
                  src={game.image}
                  alt={game.name}
                  width={200}
                  height={200}
                  className="w-32 h-32 object-contain mb-3"
                />
                <div className="font-bold text-lg text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>
                  {game.name}
                </div>
                <div className="text-sm text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>
                  {game.description}
                </div>
                {selectedMode === game.mode && (
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
