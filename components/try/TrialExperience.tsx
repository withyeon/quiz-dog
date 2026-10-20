'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, RotateCcw, Sparkles, Timer } from 'lucide-react'
import { useAudioContext } from '@/components/AudioProvider'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toaster'
import GameGuideChips from '@/components/landing/GameGuideChips'
import { gameModesData } from '@/components/landing/gameModesData'
import { gameAssets } from '@/assets/game-assets'
import { CHARACTERS } from '@/lib/utils/characters'
import { pickBotNames, writeDevBotSession } from '@/lib/dev/devBots'
import { getGameModeConfig, getGameModeUrl, type GameModeId } from '@/lib/game/modes'
import { createPlayerForRoom, createRoom, startRoom } from '@/lib/services/rooms'
import { formatServiceError } from '@/lib/services/errors'
import { getLibraryClientId } from '@/lib/utils/libraryClientId'
import { loadFeaturedTrialSet, loadTrialSet, type TrialSet } from '@/lib/trial/trialQuestions'
import {
  TRIAL_BOT_COUNT,
  TRIAL_DURATION_SECONDS,
  TRIAL_GAME_MODES,
  TRIAL_NICKNAME,
  clearTrialSession,
  readTrialSession,
  trialBotCount,
  writeTrialSession,
} from '@/lib/trial/trialSession'

/** 체험을 끝낸 시각 — 가입 뒤 "체험하고 온 선생님" 비율을 볼 때 쓸 수 있게 브라우저에 남긴다 */
const TRIAL_DONE_KEY = 'quizdog_trial_completed_at'

const TRIAL_CARDS = TRIAL_GAME_MODES
  .map((id) => gameModesData.find((game) => game.modeId === id))
  .filter((game): game is NonNullable<typeof game> => Boolean(game))

/**
 * 가입 없이 1분 체험.
 * 게임을 하나 고르면 /dev 와 같은 방식으로 체험 방을 만들고(문제집은 ?set= 또는 자료실 인기 문제집),
 * 학생이 보는 실제 게임 화면으로 들어간다. 방은 2분짜리로 시작하고 봇 실행기가 시간이 끝나면 방을 끝낸다.
 * 게임 위에는 TrialGameBanner 가 떠 있고, '체험 마치기'(/try?done=1)로 오면 같은 문제집으로 수업을 시작하는 길을 안내한다.
 * 공개된 게임 전부를 고를 수 있다(TRIAL_GAME_MODES). 봇 친구(TRIAL_BOT_COUNT)를 /dev 와 같은 실행기로 붙여 팀전·역할전·협동전도 된다.
 */
function TrialExperienceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedSetId = searchParams?.get('set') ?? null
  const isDone = searchParams?.get('done') === '1'
  const { user } = useAuth()
  const { playSFX } = useAudioContext()

  const [set, setSet] = useState<TrialSet | null | undefined>(undefined)
  const [starting, setStarting] = useState<GameModeId | null>(null)
  const [doneMode, setDoneMode] = useState<GameModeId | null>(null)

  // 문제집 고르기 — ?set= → 자료실 인기 문제집. 체험을 마치고 왔으면 그 방의 문제집을 그대로 쓴다
  useEffect(() => {
    let cancelled = false
    const session = readTrialSession()
    if (isDone && session) {
      // 게임 탭을 떠났으니 봇 실행기도 멈춘다
      writeDevBotSession(null)
      setSet({ id: session.setId, title: session.setTitle, questionCount: 0 })
      setDoneMode(session.gameMode)
      try { window.localStorage.setItem(TRIAL_DONE_KEY, new Date().toISOString()) } catch {}
      return
    }
    const load = async () => {
      const fromSet = requestedSetId ? await loadTrialSet(requestedSetId).catch(() => null) : null
      const loaded = fromSet ?? await loadFeaturedTrialSet(getLibraryClientId()).catch(() => null)
      if (!cancelled) setSet(loaded)
    }
    void load()
    return () => { cancelled = true }
  }, [isDone, requestedSetId])

  const handleStart = async (mode: GameModeId) => {
    if (!set || starting) return
    playSFX('click')
    setStarting(mode)
    try {
      // 방에 trial 표시를 남겨 관리자 점검에서 체험 방을 구분할 수 있게 한다. 2시간 뒤 자동 종료는 일반 방과 같다
      const room = await createRoom({ setId: set.id, gameMode: mode, settings: { trial: true } })
      const randomAvatar = () => {
        const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
        return character.imagePath || character.emoji
      }
      // /dev 와 같은 순서: 나 → 봇 → 시작. 눈싸움 팀·좀비 역할·레이드 초기화·점프점프 맵은 "시작할 때 방에 있는 학생"만 받는다.
      // 내가 첫 행이라 방장(눈싸움 팀 배정)도 내가 된다.
      const player = await createPlayerForRoom({ roomCode: room.room_code, nickname: TRIAL_NICKNAME, avatar: randomAvatar(), gameMode: mode })
      const bots = await Promise.all(
        pickBotNames(trialBotCount(mode)).map(async (nickname) => {
          const created = await createPlayerForRoom({ roomCode: room.room_code, nickname, avatar: randomAvatar(), gameMode: mode })
          return { playerId: created.id, nickname, difficulty: 'medium' as const }
        }),
      )
      await startRoom({ roomCode: room.room_code, gameMode: mode, durationSeconds: TRIAL_DURATION_SECONDS })
      // 봇 실행기(components/dev/DevBotRunner.tsx)가 이 탭에서 읽는다. 봇이 문제를 풀고, 시간이 끝나면 선생님 대신 방을 끝낸다
      writeDevBotSession({ roomCode: room.room_code, gameMode: mode, setId: set.id, aggressive: false, bots })
      writeTrialSession({ roomCode: room.room_code, gameMode: mode, setId: set.id, setTitle: set.title, startedAt: new Date().toISOString() })
      router.push(getGameModeUrl(mode, room.room_code, player.id))
    } catch (error) {
      console.error('체험 방을 만들지 못했습니다:', error)
      toast.error('체험을 열지 못했어요: ' + formatServiceError(error))
      setStarting(null)
    }
  }

  // "이 문제로 우리 반 수업하기" — 로그인하면 자료실에서 같은 문제집으로 게임 시작까지 이어진다
  const classHref = useMemo(() => {
    if (!set) return user ? '/teacher' : '/login?redirect=%2Fteacher'
    const target = `/teacher/library?set=${encodeURIComponent(set.id)}&action=play&from=try`
    return user ? target : `/login?redirect=${encodeURIComponent(target)}`
  }, [set, user])

  const ctaButton = (
    <Link
      href={classHref}
      onClick={() => playSFX('click')}
      className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-black text-white sm:w-auto"
      style={{
        background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
        boxShadow: '0 6px 0 #0b8fc4, 0 12px 24px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
        textShadow: '0 1px 0 rgba(0,0,0,0.18)',
      }}
    >
      {set ? '이 문제로 우리 반 수업하기' : '무료로 시작하기'}
      <ArrowRight className="h-5 w-5" />
    </Link>
  )

  return (
    <main className="gold-quest-ambient relative min-h-dvh overflow-hidden break-keep p-4 font-bitbit sm:p-6 lg:p-8">
      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="gold-quest-ink-panel mb-4 flex items-center justify-between gap-3 p-3 text-[#17262a] sm:mb-6 sm:p-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/header-logo.webp" alt="퀴즈독" width={140} height={42} className="h-9 w-auto object-contain sm:h-11" priority />
          </Link>
          <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black text-[#0369A1] sm:text-sm">가입 없이 1분 체험</span>
        </header>

        {!isDone && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="gold-quest-panel p-5 text-[#17262a] sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-black text-[#0369A1] ring-1 ring-sky-200">
              <Sparkles className="h-3.5 w-3.5" />
              학생이 보는 화면 그대로
            </span>
            <h1 className="gold-quest-title mt-4 text-3xl font-black leading-tight sm:text-4xl">
              게임을 하나 골라 바로 해보세요
            </h1>
            <p className="mt-3 text-base font-semibold leading-relaxed text-[#2a3f45] sm:text-lg">
              학생을 모으지 않아도, 가입하지 않아도 돼요. 고른 게임이 실제 수업과 똑같이 열리고,
              <br className="hidden sm:block" />
              봇 친구 {TRIAL_BOT_COUNT}명과 함께 {Math.round(TRIAL_DURATION_SECONDS / 60)}분 동안 플레이할 수 있어요. 팀전·역할전·협동전도 그대로예요.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-[#2a3f45]"><Timer className="h-4 w-4 text-[#0369A1]" />최대 {Math.round(TRIAL_DURATION_SECONDS / 60)}분</span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-[#2a3f45]"><Image src={gameAssets['mascot-pome'].tight} alt="" width={18} height={18} unoptimized className="pixelated h-[18px] w-[18px] object-contain" />봇 친구 {TRIAL_BOT_COUNT}명과 함께</span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-amber-900">
                {set === undefined ? '문제집 고르는 중…' : set ? <>문제집: {set.title}</> : '지금은 체험에 쓸 공개 문제집이 없어요'}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {TRIAL_CARDS.map((game) => {
                const busy = starting === game.modeId
                return (
                  <motion.button
                    key={game.modeId}
                    type="button"
                    disabled={!set || starting !== null}
                    onClick={() => void handleStart(game.modeId)}
                    whileHover={set && !starting ? { y: -4 } : {}}
                    whileTap={set && !starting ? { scale: 0.98 } : {}}
                    className="flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-md transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: busy ? game.color : 'rgba(226,232,240,0.9)' }}
                    aria-label={`${game.name} 체험 시작`}
                  >
                    <div className="relative flex aspect-[16/10] items-center justify-center p-3" style={{ background: `linear-gradient(160deg, ${game.bg}, rgba(255,255,255,0.9))` }}>
                      {game.previewImage && (
                        <Image src={game.previewImage} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover opacity-40" />
                      )}
                      <Image src={game.titleImage} alt={game.name} width={320} height={110} className="relative h-full max-h-[64px] w-auto max-w-[90%] object-contain" style={{ filter: 'drop-shadow(0 3px 6px rgba(15,23,42,0.25))' }} />
                      {busy && (
                        <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-black text-[#0369A1]">
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />방 만드는 중
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 border-t px-3 py-2.5" style={{ borderColor: 'rgba(226,232,240,0.9)' }}>
                      <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                        <Image src={game.icon} alt="" width={18} height={18} unoptimized className="h-[18px] w-[18px] object-contain" />
                        {game.name}
                      </p>
                      <p className="line-clamp-2 text-[11px] leading-snug text-slate-500 sm:text-xs">{getGameModeConfig(game.modeId).description}</p>
                      <div className="mt-auto pt-1"><GameGuideChips modeId={game.modeId} size="sm" /></div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-600">
              봇 친구는 문제를 풀고 아이템도 써요. 실제 수업에서는 학생들이 코드로 들어와 같은 자리에서 플레이해요.
            </p>
          </motion.section>
        )}

        {isDone && (
          <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="gold-quest-panel mx-auto max-w-2xl p-6 text-center text-[#17262a] sm:p-8">
            <motion.div className="mb-4 flex justify-center gap-3" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <Image src={gameAssets['mascot-pome'].tight} alt="" width={84} height={84} unoptimized className="pixelated h-[72px] w-[72px] object-contain" />
              <Image src={gameAssets.mascot_sigol.tight} alt="" width={84} height={84} unoptimized className="pixelated h-[72px] w-[72px] object-contain" />
            </motion.div>
            <h2 className="gold-quest-title text-3xl font-black sm:text-4xl">체험 완료!</h2>
            {doneMode && (
              <p className="mt-2 text-sm font-bold text-slate-500">{getGameModeConfig(doneMode).label}{set ? ` · ${set.title}` : ''}</p>
            )}
            <p className="mt-4 text-base font-semibold leading-relaxed text-[#2a3f45]">
              학생들은 코드 하나로 들어와 방금 그 화면 그대로 플레이해요.
              <br className="hidden sm:block" />
              같은 문제로 우리 반 수업을 바로 시작할 수 있어요.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {ctaButton}
              <Link href="/explore" className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-sky-200 bg-white px-6 py-4 text-base font-black text-[#0369A1] sm:w-auto">
                다른 문제집 둘러보기
              </Link>
            </div>
            <Link
              href={set ? `/try?set=${encodeURIComponent(set.id)}` : '/try'}
              onClick={clearTrialSession}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 underline-offset-4 hover:underline"
            >
              <RotateCcw className="h-4 w-4" />
              다른 게임도 해보기
            </Link>
            {!user && (
              <p className="mt-4 text-xs font-semibold text-slate-500">로그인하면 이 문제집이 선택된 자료실로 돌아와 바로 게임을 시작할 수 있어요.</p>
            )}
          </motion.section>
        )}
      </div>
    </main>
  )
}

export default function TrialExperience() {
  return (
    <Suspense fallback={<main className="gold-quest-ambient min-h-dvh" />}>
      <TrialExperienceContent />
    </Suspense>
  )
}
