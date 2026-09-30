'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Confetti from 'react-confetti'
import { ArrowRight } from 'lucide-react'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import PawBackgroundDecor from '@/components/PawBackgroundDecor'
import { useAudioContext } from '@/components/AudioProvider'
import { gameAssets, mascotAnimations } from '@/assets/game-assets'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import {
  buildResultAnalytics,
  type Player,
  type QuestionAnalysis,
  type Room,
} from './resultAnalytics'
import { getScoreDisplay } from '@/lib/game/scoreDisplay'

type TeacherEndSequenceProps = {
  room: Room
  players: Player[]
  questions: AnalyticsQuestion[]
  onRestart?: () => void
  isRestarting?: boolean
  /** 시작 단계 — /dev/result-preview 에서 특정 화면을 바로 열어볼 때만 쓴다 */
  initialStage?: Stage
}

type RankedPlayer = ReturnType<typeof buildResultAnalytics>['players'][number]

type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6

const STAGE_DELAYS: Record<Stage, number> = {
  0: 2400,
  1: 4200,
  2: 4200,
  3: 5200,
  // 시상대가 3등 → 2등 → 1등 차례로 올라오므로 1등까지 다 선 뒤에도 잠시 머문다
  4: 9000,
  5: 0,
  6: 0,
}

/** 시상대에 올라오는 순서와 간격(초) — 발표와 같은 3등 → 2등 → 1등 */
const PODIUM_REVEAL_ORDER = [3, 2, 1] as const
const PODIUM_FIRST_DELAY = 0.2
const PODIUM_STEP = 1.1

const RESULT_ANNOUNCEMENT_TRACK = {
  id: 'result-announcement',
  title: 'Funky Victory Loop',
  src: '/audio/bgm/result-announcement.mp3',
}

/* ─────────────────────────────────────────────────────────────
   퀴즈독 결과 발표 — 로비·랜딩과 같은 하늘 배경 + 파스텔 스티커 카드.
   예전 어두운 무대 + 방사형 빛줄기는 욱일기처럼 보여 걷어냈다(2026-09-30).
───────────────────────────────────────────────────────────── */

const NAVY = '#1E3A8A'

/** 등수별 파스텔 색을 한곳에 모아 발표 카드와 시상대가 같은 톤을 쓰게 한다 */
const RANK_THEME = {
  1: {
    medal: '/trophy.webp',
    accent: '#FFD84D',
    border: '#FCD34D',
    hard: '#E9B308',
    glow: 'rgba(253, 224, 71, 0.4)',
    dot: 'rgba(252, 211, 77, 0.28)',
    soft: '#FFF8DB',
    chipBg: '#FEF3C7',
    chipText: '#92400E',
    podium: 'linear-gradient(180deg, #FFF3B0 0%, #FDE68A 45%, #FCD34D 100%)',
  },
  2: {
    medal: '/silver.webp',
    accent: '#7DD3FC',
    border: '#7DD3FC',
    hard: '#38AEE6',
    glow: 'rgba(125, 211, 252, 0.4)',
    dot: 'rgba(125, 211, 252, 0.28)',
    soft: '#EAF7FF',
    chipBg: '#E0F2FE',
    chipText: '#0369A1',
    podium: 'linear-gradient(180deg, #E6F6FF 0%, #BAE6FD 45%, #7DD3FC 100%)',
  },
  3: {
    medal: '/bronze.webp',
    accent: '#FFB088',
    border: '#FDBA8C',
    hard: '#F28C52',
    glow: 'rgba(253, 186, 140, 0.4)',
    dot: 'rgba(253, 186, 140, 0.3)',
    soft: '#FFF1E6',
    chipBg: '#FFEDD5',
    chipText: '#C2410C',
    podium: 'linear-gradient(180deg, #FFEADB 0%, #FED0AE 45%, #FDBA8C 100%)',
  },
} as const

type RankTheme = (typeof RANK_THEME)[1 | 2 | 3]

/** 카드에 넘기는 CSS 변수(.result-sticker · .result-polka 가 읽는다) */
function themeVars(theme: RankTheme): CSSProperties {
  return {
    '--result-hard': theme.hard,
    '--result-glow': theme.glow,
    '--result-dot': theme.dot,
  } as CSSProperties
}

const CONFETTI_COLORS = ['#FF8FB8', '#FFD84D', '#4FC3F7', '#6EE7B7', '#FFA96B', '#FFFFFF']

type ConfettiPiece = { shape: number; w: number }

/** 꽃가루를 동그라미·하트·반짝이 별로 그린다 (react-confetti가 조각마다 this로 부른다) */
function drawCuteConfetti(this: ConfettiPiece, ctx: CanvasRenderingContext2D) {
  const size = 3 + this.w / 3
  ctx.beginPath()
  if (this.shape === 0) {
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2)
  } else if (this.shape === 1) {
    ctx.moveTo(0, -size * 0.3)
    ctx.bezierCurveTo(-size * 0.1, -size * 0.9, -size, -size * 0.7, -size * 0.9, -size * 0.1)
    ctx.bezierCurveTo(-size * 0.8, size * 0.4, -size * 0.2, size * 0.7, 0, size * 0.95)
    ctx.bezierCurveTo(size * 0.2, size * 0.7, size * 0.8, size * 0.4, size * 0.9, -size * 0.1)
    ctx.bezierCurveTo(size, -size * 0.7, size * 0.1, -size * 0.9, 0, -size * 0.3)
  } else {
    for (let point = 0; point < 8; point += 1) {
      const angle = (point * Math.PI) / 4 - Math.PI / 2
      const radius = point % 2 === 0 ? size : size * 0.38
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (point === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
  ctx.fill()
}

/** 배경 반짝이·하트는 매 렌더마다 흔들리면 안 되므로 고정 좌표를 쓴다 */
const DECOR = [
  { kind: 'sparkle', left: '9%', top: '15%', size: 34, delay: '0s' },
  { kind: 'heart', left: '16%', top: '56%', size: 26, delay: '0.8s', color: '#FF8FB8', outline: '#E0548A' },
  { kind: 'sparkle', left: '27%', top: '7%', size: 22, delay: '1.6s' },
  { kind: 'heart', left: '86%', top: '18%', size: 30, delay: '0.4s', color: '#FF8FB8', outline: '#E0548A' },
  { kind: 'sparkle', left: '80%', top: '60%', size: 30, delay: '1.2s' },
  { kind: 'heart', left: '70%', top: '8%', size: 20, delay: '2s', color: '#7DD3FC', outline: '#2E9FD6' },
  { kind: 'sparkle', left: '92%', top: '42%', size: 22, delay: '2.4s' },
  { kind: 'heart', left: '5%', top: '36%', size: 20, delay: '1.9s', color: '#FFD84D', outline: '#D9A300' },
] as const

/** 픽셀 하트 — 7×6 칸을 채우고 둘레 한 칸을 테두리로 두른다 */
const HEART_FILL_ROWS = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
const HEART_PIXELS = (() => {
  const fill = new Set<string>()
  HEART_FILL_ROWS.forEach((row, y) => {
    Array.from(row).forEach((cell, x) => {
      if (cell === 'X') fill.add(`${x + 1},${y + 1}`)
    })
  })
  const outline: Array<[number, number]> = []
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if (fill.has(`${x},${y}`)) continue
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => fill.has(`${x + dx},${y + dy}`))
      if (touches) outline.push([x, y])
    }
  }
  return {
    fill: Array.from(fill).map((key) => key.split(',').map(Number) as [number, number]),
    outline,
  }
})()

function PixelHeart({
  size,
  color,
  outline,
  className = '',
  style,
}: {
  size: number
  color: string
  outline: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 9 8"
      width={size}
      height={(size * 8) / 9}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      aria-hidden
    >
      {HEART_PIXELS.outline.map(([x, y]) => (
        <rect key={`o${x}-${y}`} x={x} y={y} width={1} height={1} fill={outline} />
      ))}
      {HEART_PIXELS.fill.map(([x, y]) => (
        <rect key={`f${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />
      ))}
      <rect x={2} y={2} width={1} height={1} fill="#FFFFFF" opacity={0.85} />
    </svg>
  )
}

/** 랜딩 PixelHeading 과 같은 흰 글자 + 남색 외곽선. 발표 화면은 글자가 커서 굵기를 em 으로 맞춘다 */
function CuteHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block font-black leading-tight ${className}`}
      style={{
        color: '#FFFFFF',
        WebkitTextStrokeWidth: '0.055em',
        WebkitTextStrokeColor: NAVY,
        paintOrder: 'stroke fill',
        letterSpacing: '0.04em',
        textShadow: '0 0.05em 0 #1B3378, 0 0.08em 0.1em rgba(12, 32, 77, 0.22)',
      }}
    >
      {children}
    </span>
  )
}

/** 로비 PixelBtn 과 같은 통통한 알약 버튼 (링크로도 쓸 수 있게 따로 둔다) */
const BUTTON_TONES = {
  blue: {
    background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
    color: '#FFFFFF',
    hard: '#0b8fc4',
    border: 'transparent',
  },
  green: {
    background: 'linear-gradient(180deg, #86EFAC 0%, #4ADE80 45%, #22C55E 100%)',
    color: '#FFFFFF',
    hard: '#15803D',
    border: 'transparent',
  },
  white: {
    background: '#FFFFFF',
    color: '#0369A1',
    hard: '#BAE6FD',
    border: '#BAE6FD',
  },
} as const

function CuteButton({
  tone = 'blue',
  href,
  onClick,
  disabled = false,
  className = '',
  children,
}: {
  tone?: keyof typeof BUTTON_TONES
  href?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  const palette = BUTTON_TONES[tone]
  const style: CSSProperties = {
    background: palette.background,
    color: palette.color,
    border: `3px solid ${palette.border}`,
    boxShadow: disabled ? 'none' : `0 6px 0 ${palette.hard}, 0 14px 26px rgba(14, 165, 233, 0.22)`,
    textShadow: tone === 'white' ? undefined : '0 1px 0 rgba(0, 0, 0, 0.18)',
  }
  const classes = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-xl font-black transition-transform hover:-translate-y-0.5 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60 sm:px-10 sm:py-5 sm:text-[28px] ${className}`

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes} style={style}>
      {children}
    </button>
  )
}

/** 흰 알약 안내 문구 — 로비 상태 칩과 같은 톤 */
function SkyPill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-2 break-keep rounded-full bg-white px-6 py-2.5 text-center font-black ${className}`}
      style={{ color: NAVY, border: '3px solid #BAE6FD', boxShadow: '0 5px 0 #BAE6FD' }}
    >
      {children}
    </span>
  )
}

function Mascot({ kind, size, className = '' }: { kind: 'pome' | 'sigol'; size: number; className?: string }) {
  return (
    <Image
      // 포메는 발표 내내 짝짝 박수 치는 움직이는 그림을 쓴다 (unoptimized 라 애니메이션이 그대로 나간다)
      src={kind === 'pome' ? mascotAnimations.pomeClap : gameAssets.mascot_sigol.tight}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={`pixelated object-contain drop-shadow-[0_6px_0_rgba(30,58,138,0.12)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

export default function TeacherEndSequence({
  room,
  players,
  questions,
  onRestart,
  isRestarting = false,
  initialStage = 0,
}: TeacherEndSequenceProps) {
  const analytics = useMemo(
    () => buildResultAnalytics(players, questions, room),
    [players, questions, room],
  )
  const [stage, setStage] = useState<Stage>(initialStage)
  const [reviewIndex, setReviewIndex] = useState(0)
  const { playBGM, stopBGM } = useAudioContext()
  const topThree = useMemo(() => analytics.players.slice(0, 3), [analytics])
  // 실제로 틀린 적이 있는 문항만 복습 화면에 올린다.
  // 전에는 정답률 낮은 순 상위 3개를 무조건 올려서, 모두 100%인 방에서도
  // "정답률 100%만 맞췄어요" 같은 화면이 떴다.
  const reviewQuestions = useMemo(
    () => analytics.hardestQuestions.filter((question) => question.incorrectCount > 0).slice(0, 3),
    [analytics],
  )
  // 관중석·단체 사진은 순위와 상관없이 들어온 순서로 세운다 (점수 줄 세우기처럼 보이지 않게)
  const everyone = useMemo(() => {
    const joinedAt = new Map(players.map((player) => [player.id, player.created_at ?? '']))
    return [...analytics.players].sort(
      (a, b) =>
        (joinedAt.get(a.id) ?? '').localeCompare(joinedAt.get(b.id) ?? '') ||
        a.nickname.localeCompare(b.nickname, 'ko'),
    )
  }, [analytics, players])
  // 시상대 차례: 있는 등수만 3 → 2 → 1 로 이어 붙인다 (2명이면 2등이 먼저 바로 올라온다)
  const podiumDelays = useMemo(() => {
    const delays: Partial<Record<1 | 2 | 3, number>> = {}
    PODIUM_REVEAL_ORDER.filter((rank) => topThree[rank - 1]).forEach((rank, order) => {
      delays[rank] = PODIUM_FIRST_DELAY + order * PODIUM_STEP
    })
    return delays
  }, [topThree])
  // 이미 공개된 친구는 관중석에서도 트로피를 달아 준다
  const revealedBadges = useMemo(() => {
    const badges: Record<string, 1 | 2 | 3> = {}
    PODIUM_REVEAL_ORDER.forEach((rank) => {
      const player = topThree[rank - 1]
      if (player && stage >= 4 - rank) badges[player.id] = rank
    })
    return badges
  }, [stage, topThree])
  const [winnerOnPodium, setWinnerOnPodium] = useState(false)

  useEffect(() => {
    // 참가자가 3명이 안 되면 빈 등수는 건너뛴다 (빈 카드가 뜨지 않게)
    const revealStages: Record<number, number> = { 1: 2, 2: 1, 3: 0 }
    const emptyReveal = stage in revealStages && !topThree[revealStages[stage]]
    const delay = emptyReveal ? 0 : STAGE_DELAYS[stage]
    if (!emptyReveal && !delay) return

    const timer = window.setTimeout(() => {
      setStage((current) => {
        const nextStage = Math.min(6, current + 1) as Stage
        if (nextStage >= 5) stopBGM()
        return nextStage
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [stage, stopBGM, topThree])

  useEffect(() => {
    if (stage <= 4) {
      playBGM('result', RESULT_ANNOUNCEMENT_TRACK)
      return
    }

    stopBGM()
  }, [playBGM, stage, stopBGM])

  useEffect(() => {
    return () => stopBGM()
  }, [stopBGM])

  // 꽃가루는 1등이 시상대에 올라선 순간 터뜨린다
  useEffect(() => {
    if (stage !== 4) return
    const timer = window.setTimeout(() => setWinnerOnPodium(true), ((podiumDelays[1] ?? 0) + 0.7) * 1000)
    return () => window.clearTimeout(timer)
  }, [podiumDelays, stage])

  const nextReview = () => {
    if (reviewIndex < reviewQuestions.length - 1) {
      setReviewIndex((value) => value + 1)
      return
    }
    stopBGM()
    setStage(6)
  }

  const revealRank = stage >= 1 && stage <= 3 ? ((4 - stage) as 1 | 2 | 3) : null

  return (
    <main className="result-stage relative min-h-dvh overflow-hidden font-bitbit">
      <StageBackdrop glow={revealRank ? RANK_THEME[revealRank].glow : undefined} />

      {(stage === 0 || stage === 3 || (stage === 4 && winnerOnPodium) || stage === 6) && (
        <Confetti
          recycle={stage !== 6}
          numberOfPieces={stage === 6 ? 120 : 220}
          colors={CONFETTI_COLORS}
          drawShape={drawCuteConfetti as (context: CanvasRenderingContext2D) => void}
          style={{ zIndex: 5 }}
        />
      )}

      <div className="relative z-10">
        {stage === 0 && (
          <section className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[clamp(120px,18vh,170px)] text-center">
            <div className="result-bob mb-4 flex items-end gap-3">
              <Mascot kind="pome" size={132} />
              <Mascot kind="sigol" size={112} />
            </div>
            <h1 className="result-pop">
              <CuteHeading className="text-[clamp(72px,11vw,160px)]">게임 끝!</CuteHeading>
            </h1>
            <SkyPill className="result-fade-up mt-6 text-[clamp(18px,3vw,40px)] [animation-delay:0.35s]">
              두근두근! 곧 Top 3를 발표할게요
            </SkyPill>
            <div className="mt-10 flex items-center gap-4">
              {['#FF8FB8', '#FFD84D', '#4FC3F7'].map((color, index) => (
                <span
                  key={color}
                  className="result-dot h-5 w-5 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 3px 0 rgba(30, 58, 138, 0.15)`, animationDelay: `${index * 0.18}s` }}
                />
              ))}
            </div>
          </section>
        )}

        {revealRank && (
          <RevealStage
            key={revealRank}
            rank={revealRank}
            player={topThree[revealRank - 1]}
            gameMode={room.game_mode}
          />
        )}

        {stage === 4 && (
          <section className="relative flex min-h-dvh flex-col px-2 pt-[min(2rem,4vh)] sm:px-8">
            <header className="flex flex-col items-center text-center">
              <h1 className="result-drop-in">
                <CuteHeading className="text-[clamp(40px,min(6.5vw,10vh),92px)]">
                  오늘의 <span style={{ color: '#FFD84D' }}>Top 3</span>
                </CuteHeading>
              </h1>
              <SkyPill className="result-fade-up mt-2 text-[clamp(15px,min(2vw,3vh),28px)] [animation-delay:0.3s]">
                참가자 {analytics.players.length}명 · 모두 정말 잘했어요!
                <PixelHeart size={26} color="#FF8FB8" outline="#E0548A" />
              </SkyPill>
            </header>

            <div className="relative mx-auto mt-auto flex w-full max-w-6xl items-end justify-center gap-2 pt-[min(2rem,4vh)] sm:gap-5">
              {topThree[1] && (
                <PodiumSpot rank={2} player={topThree[1]} gameMode={room.game_mode} height="h-[28vh] min-h-[130px]" delay={podiumDelays[2] ?? 0} />
              )}
              {topThree[0] && (
                <PodiumSpot rank={1} player={topThree[0]} gameMode={room.game_mode} height="h-[34vh] min-h-[150px]" delay={podiumDelays[1] ?? 0} />
              )}
              {topThree[2] && (
                <PodiumSpot rank={3} player={topThree[2]} gameMode={room.game_mode} height="h-[22vh] min-h-[110px]" delay={podiumDelays[3] ?? 0} />
              )}
            </div>

            {/* 시상대가 구름 위로 솟아오른 것처럼 아래를 구름으로 덮는다 */}
            <CloudBank peek={0.35} scale={0.6} className="z-20" />

            {/* 구름 위에서 박수 치는 포메·시골이 */}
            <div className="pointer-events-none absolute bottom-[4vw] left-[2%] z-30 hidden xl:block">
              <Mascot kind="pome" size={150} className="result-bob" />
            </div>
            <div className="pointer-events-none absolute bottom-[4vw] right-[2%] z-30 hidden xl:block">
              <Mascot kind="sigol" size={130} className="result-bob [animation-delay:0.9s]" />
            </div>
          </section>
        )}

        {stage === 5 && (
          <ReviewQuestionStage
            question={reviewQuestions[reviewIndex]}
            index={reviewIndex}
            total={reviewQuestions.length}
            onNext={nextReview}
          />
        )}

        {stage === 6 && (
          <section className="flex min-h-dvh flex-col items-center justify-center px-4 pb-36 pt-[min(2.5rem,5vh)] text-center sm:px-8 sm:pb-40">
            <Image
              src="/quizdog-logo.webp"
              alt="퀴즈독"
              width={400}
              height={125}
              className="result-pop h-auto w-[clamp(200px,min(30vw,30vh),360px)]"
              priority
            />
            <SkyPill className="result-fade-up mt-3 text-[clamp(18px,min(2.4vw,3.6vh),34px)] [animation-delay:0.3s]">
              {everyone.length > 0 ? (
                <span>
                  오늘 함께한 친구들 {everyone.length}명
                  <span className="hidden sm:inline"> · </span>
                  <br className="sm:hidden" />
                  모두 수고했어요!
                </span>
              ) : (
                '오늘도 모두 수고했어요!'
              )}
              <PixelHeart size={28} color="#FF8FB8" outline="#E0548A" />
            </SkyPill>
            <FriendsPhoto players={everyone} />

            {/* 단체 사진 옆에서 함께 웃는 포메·시골이 */}
            <div className="pointer-events-none fixed bottom-6 left-6 z-20 hidden items-end gap-2 xl:flex">
              <Mascot kind="pome" size={120} className="result-bob" />
              <Mascot kind="sigol" size={100} className="result-bob [animation-delay:0.8s]" />
            </div>
            <div className="fixed inset-x-4 bottom-6 z-30 flex justify-center gap-3 sm:inset-x-auto sm:bottom-8 sm:right-8 sm:gap-4">
              <CuteButton tone="white" onClick={onRestart} disabled={!onRestart || isRestarting}>
                {isRestarting ? '다시 시작 중' : '다시 시작하기'}
              </CuteButton>
              <CuteButton tone="green" href={`/teacher/game/${room.room_code}/report`}>
                수업 종료
              </CuteButton>
            </div>
          </section>
        )}
      </div>

      {stage <= 3 && everyone.length > 0 && <CheeringCrowd players={everyone} badges={revealedBadges} />}
    </main>
  )
}

/** 관중석·단체 사진 테두리 — 친구마다 파스텔을 돌려 쓴다 */
const FRIEND_TONES = ['#FFB3D1', '#FDE68A', '#BAE6FD', '#BBF7D0', '#FED7AA'] as const

/** 발표하는 동안 아래 구름 위에서 폴짝폴짝 응원하는 참가자 전원. 화면에 다 안 들어가면 옆으로 흘러간다 */
function CheeringCrowd({ players, badges }: { players: RankedPlayer[]; badges: Record<string, 1 | 2 | 3> }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [parade, setParade] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    const row = rowRef.current
    if (!box || !row) return
    // 관찰을 시작하면 콜백이 한 번 바로 불리므로 첫 측정도 여기서 된다
    const observer = new ResizeObserver(() => setParade(row.offsetWidth > box.clientWidth))
    observer.observe(box)
    observer.observe(row)
    return () => observer.disconnect()
  }, [players.length])

  const friends = (copy: string) =>
    players.map((player, index) => (
      <CrowdFriend
        key={`${copy}-${player.id}`}
        player={player}
        index={index}
        badge={badges[player.id]}
      />
    ))

  return (
    <div
      ref={boxRef}
      className="pointer-events-none absolute inset-x-0 bottom-[clamp(6px,1.4vh,16px)] z-20 overflow-hidden pt-8"
      aria-label={`참가한 친구들 ${players.length}명`}
    >
      <div
        className={`flex w-max ${parade ? 'result-parade' : 'mx-auto'}`}
        style={parade ? ({ '--parade-duration': `${Math.max(20, players.length * 2.2)}s` } as CSSProperties) : undefined}
      >
        <div ref={rowRef} className="flex shrink-0 items-end">
          {friends('a')}
        </div>
        {parade && (
          <div className="flex shrink-0 items-end" aria-hidden>
            {friends('b')}
          </div>
        )}
      </div>
    </div>
  )
}

function CrowdFriend({ player, index, badge }: { player: RankedPlayer; index: number; badge?: 1 | 2 | 3 }) {
  const tone = FRIEND_TONES[index % FRIEND_TONES.length]

  return (
    <div className="flex w-[clamp(66px,min(6.6vw,11vh),100px)] shrink-0 flex-col items-center px-1">
      {/* 음수 지연으로 처음부터 제각각 다른 박자에 뛰게 한다 */}
      <div className="result-cheer relative" style={{ animationDelay: `${-((index * 0.37) % 1.8)}s` }}>
        <div className="rounded-[18px] bg-white p-1" style={{ border: `3px solid ${tone}`, boxShadow: `0 4px 0 ${tone}` }}>
          <PlayerAvatarDisplay
            avatar={player.avatar}
            nickname={player.nickname}
            fallback="🐶"
            className="relative h-[clamp(40px,min(4.6vw,7.5vh),64px)] w-[clamp(40px,min(4.6vw,7.5vh),64px)] overflow-hidden rounded-[13px] bg-white text-3xl"
            sizes="64px"
          />
        </div>
        {badge && (
          <Image
            src={RANK_THEME[badge].medal}
            alt=""
            width={40}
            height={40}
            className="result-pop absolute -right-3 -top-4 h-8 w-8 object-contain drop-shadow-[0_3px_0_rgba(30,58,138,0.16)]"
          />
        )}
      </div>
      <span
        className="mt-1.5 max-w-full truncate rounded-full bg-white px-2 py-0.5 text-[clamp(11px,min(1.05vw,1.8vh),16px)] font-black leading-tight"
        style={{ color: NAVY, border: `2px solid ${tone}` }}
      >
        {player.nickname}
      </span>
    </div>
  )
}

/** 마무리 화면 단체 사진 — 인원이 많을수록 조금씩 작게 */
function FriendsPhoto({ players }: { players: RankedPlayer[] }) {
  if (players.length === 0) return null

  const layout =
    players.length <= 8
      ? {
          item: 'w-[clamp(88px,min(12vw,17vh),148px)]',
          avatar: 'h-[clamp(64px,min(9vw,12vh),112px)] w-[clamp(64px,min(9vw,12vh),112px)]',
          name: 'text-[clamp(13px,min(1.5vw,2.4vh),22px)]',
        }
      : players.length <= 20
        ? {
            item: 'w-[clamp(76px,min(9vw,13vh),116px)]',
            avatar: 'h-[clamp(52px,min(6.5vw,9vh),84px)] w-[clamp(52px,min(6.5vw,9vh),84px)]',
            name: 'text-[clamp(12px,min(1.3vw,2vh),18px)]',
          }
        : {
            item: 'w-[clamp(66px,min(7vw,10.5vh),96px)]',
            avatar: 'h-[clamp(42px,min(5vw,7vh),66px)] w-[clamp(42px,min(5vw,7vh),66px)]',
            name: 'text-[clamp(11px,min(1.05vw,1.7vh),15px)]',
          }

  return (
    <div className="mt-[min(2rem,4vh)] flex w-full max-w-6xl flex-wrap justify-center gap-y-[min(1rem,2vh)]">
      {players.map((player, index) => {
        const tone = FRIEND_TONES[index % FRIEND_TONES.length]
        return (
          <div
            key={player.id}
            className={`result-pop flex shrink-0 flex-col items-center px-1 ${layout.item}`}
            style={{ animationDelay: `${0.4 + Math.min(index, 30) * 0.05}s` }}
          >
            <div className="result-bob" style={{ animationDelay: `${-((index * 0.43) % 2.6)}s` }}>
              <div className="rounded-[22px] bg-white p-1.5" style={{ border: `3px solid ${tone}`, boxShadow: `0 5px 0 ${tone}` }}>
                <PlayerAvatarDisplay
                  avatar={player.avatar}
                  nickname={player.nickname}
                  fallback="🐶"
                  className={`relative overflow-hidden rounded-[16px] bg-white text-4xl ${layout.avatar}`}
                  sizes="112px"
                />
              </div>
            </div>
            <span
              className={`mt-2 max-w-full truncate rounded-full bg-white px-1.5 py-0.5 font-black leading-tight ${layout.name}`}
              style={{ color: NAVY, border: `2px solid ${tone}` }}
            >
              {player.nickname}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 구름 둥실 — 앞뒤 두 겹의 흰 동그라미를 겹쳐 뭉게구름처럼 보이게 한다 */
const CLOUD_PUFFS = {
  back: [
    { left: '-6%', size: 20 },
    { left: '10%', size: 16 },
    { left: '24%', size: 22 },
    { left: '40%', size: 17 },
    { left: '53%', size: 21 },
    { left: '68%', size: 16 },
    { left: '80%', size: 22 },
    { left: '94%', size: 18 },
  ],
  front: [
    { left: '-3%', size: 18 },
    { left: '12%', size: 23 },
    { left: '30%', size: 16 },
    { left: '43%', size: 24 },
    { left: '60%', size: 17 },
    { left: '73%', size: 22 },
    { left: '88%', size: 19 },
  ],
}

function CloudBank({
  peek = 0.45,
  scale = 1,
  className = '',
}: {
  /** 동그라미가 화면 위로 드러나는 비율 */
  peek?: number
  /** 구름 동그라미 크기 배율 */
  scale?: number
  className?: string
}) {
  const puff = (size: number) => {
    const diameter = `min(${size * scale}vw, ${size * scale * 1.7}vh)`
    return { width: diameter, height: diameter, bottom: `calc(${diameter} * ${-(1 - peek)})` }
  }

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`} aria-hidden>
      <div className="result-cloud absolute inset-x-0 bottom-[1.5vw] [animation-delay:-4s]">
        {CLOUD_PUFFS.back.map((cloud) => (
          <span
            key={`b${cloud.left}`}
            className="absolute rounded-full bg-[#EEF8FC]"
            style={{ left: cloud.left, ...puff(cloud.size) }}
          />
        ))}
      </div>
      <div className="result-cloud absolute inset-x-0 bottom-0">
        {CLOUD_PUFFS.front.map((cloud) => (
          <span
            key={`f${cloud.left}`}
            className="absolute rounded-full bg-white shadow-[0_-6px_24px_rgba(14,165,233,0.12)]"
            style={{ left: cloud.left, ...puff(cloud.size) }}
          />
        ))}
      </div>
    </div>
  )
}

/** 모든 단계가 공유하는 하늘 배경 (발바닥·반짝이·하트·구름) */
function StageBackdrop({ glow }: { glow?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <PawBackgroundDecor edgesOnly />
      <div className="page-texture-overlay" />
      {glow && (
        <div
          className="absolute left-1/2 top-1/2 h-[85vh] w-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-700"
          style={{ background: `radial-gradient(closest-side, ${glow}, transparent 72%)` }}
        />
      )}
      {DECOR.map((item) =>
        item.kind === 'sparkle' ? (
          <Image
            key={`${item.left}-${item.top}`}
            src="/icons/rare.webp"
            alt=""
            width={item.size}
            height={item.size}
            sizes={`${item.size}px`}
            className="result-twinkle absolute object-contain"
            style={{ left: item.left, top: item.top, width: item.size, height: item.size, animationDelay: item.delay }}
          />
        ) : (
          <PixelHeart
            key={`${item.left}-${item.top}`}
            size={item.size}
            color={item.color}
            outline={item.outline}
            className="result-twinkle absolute"
            style={{ left: item.left, top: item.top, animationDelay: item.delay }}
          />
        ),
      )}
      <CloudBank />
    </div>
  )
}

/** 등수 동그라미 배지 — 시상대와 같은 파스텔 */
function RankBadge({ rank, className = '' }: { rank: 1 | 2 | 3; className?: string }) {
  const theme = RANK_THEME[rank]
  return (
    <span
      className={`flex items-center justify-center rounded-full ${className}`}
      style={{ background: theme.podium, border: '4px solid #FFFFFF', boxShadow: `0 4px 0 ${theme.hard}` }}
    >
      <CuteHeading className="leading-none">{rank}</CuteHeading>
    </span>
  )
}

function RevealStage({
  rank,
  player,
  gameMode,
}: {
  rank: 1 | 2 | 3
  player: RankedPlayer | undefined
  gameMode?: string | null
}) {
  const theme = RANK_THEME[rank]
  const scoreDisplay = getScoreDisplay({ score: player?.score ?? 0 }, gameMode)

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-5 pb-[clamp(120px,18vh,170px)] pt-6 text-center sm:px-8">
      <div className="result-drop-in mb-[min(2.5rem,4vh)] flex items-center gap-4 sm:gap-5">
        <Image
          src={theme.medal}
          alt=""
          width={88}
          height={88}
          className="result-bob h-16 w-16 object-contain drop-shadow-[0_5px_0_rgba(30,58,138,0.14)] sm:h-20 sm:w-20"
        />
        <CuteHeading className="text-[clamp(44px,min(7vw,11vh),100px)]">
          <span style={{ color: theme.accent }}>{rank}</span>등은?
        </CuteHeading>
      </div>

      <div className="relative w-full max-w-3xl">
        {/* 카드 양옆에서 응원하는 포메·시골이 */}
        <div className="pointer-events-none absolute -bottom-6 -left-28 z-20 hidden lg:block">
          <Mascot kind="pome" size={130} className="result-bob" />
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-24 z-20 hidden lg:block">
          <Mascot kind="sigol" size={112} className="result-bob [animation-delay:0.8s]" />
        </div>

        {/* 톡톡 떠오르는 하트 */}
        {[
          { left: '8%', delay: '0s', size: 30 },
          { left: '88%', delay: '0.9s', size: 24 },
          { left: '76%', delay: '1.8s', size: 20 },
        ].map((heart) => (
          <div key={heart.left} className="pointer-events-none absolute -top-4 z-20" style={{ left: heart.left }}>
            <PixelHeart
              size={heart.size}
              color="#FF8FB8"
              outline="#E0548A"
              className="result-float-up"
              style={{ animationDelay: heart.delay }}
            />
          </div>
        ))}

        <div className="result-pop">
          <div
            className="result-sticker result-polka relative rounded-[44px] border-[6px] bg-white px-6 pb-[min(2.5rem,4.5vh)] pt-[min(3rem,6vh)] sm:px-12"
            style={{ borderColor: theme.border, ...themeVars(theme) }}
          >
            <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
              <div className="relative shrink-0">
                {rank === 1 && (
                  <div className="absolute -top-14 left-1/2 z-10 w-20 -translate-x-1/2 sm:-top-16 sm:w-24">
                    <Image
                      src="/icons/crown.webp"
                      alt=""
                      width={96}
                      height={96}
                      className="result-wiggle h-auto w-full drop-shadow-[0_4px_0_rgba(30,58,138,0.16)]"
                    />
                  </div>
                )}
                <div className="rounded-[32px] p-2" style={{ background: theme.soft, boxShadow: `0 5px 0 ${theme.border}` }}>
                  <PlayerAvatarDisplay
                    avatar={player?.avatar}
                    nickname={player?.nickname}
                    fallback="🐶"
                    className="relative h-28 w-28 overflow-hidden rounded-[26px] bg-white text-6xl sm:h-[clamp(84px,15vh,128px)] sm:w-[clamp(84px,15vh,128px)]"
                    sizes="128px"
                  />
                </div>
                <RankBadge rank={rank} className="absolute -bottom-3 -right-4 h-14 w-14 text-3xl" />
              </div>
              <span
                className="min-w-0 break-keep text-[clamp(40px,min(7vw,10vh),96px)] font-black leading-tight"
                style={{ color: NAVY }}
              >
                {player?.nickname || '참가자'}
              </span>
            </div>

            <div className="relative mt-[min(2.25rem,4vh)] flex justify-center">
              <div
                className="flex items-center gap-3 rounded-full px-8 py-2 text-[clamp(30px,min(5vw,7vh),60px)] font-black sm:py-3"
                style={{
                  background: theme.chipBg,
                  color: theme.chipText,
                  border: `4px solid ${theme.border}`,
                  boxShadow: `0 6px 0 ${theme.border}`,
                }}
              >
                {scoreDisplay.icon && (
                  <Image src={scoreDisplay.icon} alt="" width={48} height={48} className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
                )}
                {scoreDisplay.text}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PodiumSpot({
  rank,
  player,
  gameMode,
  height,
  delay,
}: {
  rank: 1 | 2 | 3
  player: RankedPlayer | undefined
  gameMode?: string | null
  height: string
  /** 이 시상대가 올라오기 시작하는 시각(초) */
  delay: number
}) {
  const theme = RANK_THEME[rank]
  const scoreDisplay = getScoreDisplay({ score: player?.score ?? 0 }, gameMode)
  const isWinner = rank === 1

  return (
    <div className="flex w-full min-w-0 max-w-xs flex-col items-center">
      {isWinner && (
        <div
          className="result-drop-in relative z-20 -mb-3 w-14 sm:-mb-4 sm:w-[clamp(52px,9vh,80px)]"
          style={{ animationDelay: `${delay + 0.9}s` }}
        >
          <Image
            src="/icons/crown.webp"
            alt=""
            width={80}
            height={80}
            className="result-wiggle h-auto w-full drop-shadow-[0_4px_0_rgba(30,58,138,0.16)]"
          />
        </div>
      )}

      {/* 선수 카드 — 시상대 위에 올라선 것처럼 살짝 겹쳐 둔다 */}
      <div
        className="result-fade-up relative z-10 -mb-4 w-full px-1"
        style={{ animationDelay: `${delay + 0.45}s` }}
      >
        <div
          className="result-polka rounded-[26px] border-4 bg-white px-1.5 pb-[min(1.25rem,2.4vh)] pt-[min(1rem,2vh)] text-center sm:rounded-[32px] sm:px-4"
          style={{
            borderColor: theme.border,
            boxShadow: `0 7px 0 ${theme.hard}, 0 16px 30px rgba(14, 165, 233, 0.16)`,
            ...themeVars(theme),
          }}
        >
          <div className="mx-auto w-fit rounded-[20px] p-1.5" style={{ background: theme.soft, boxShadow: `0 4px 0 ${theme.border}` }}>
            <PlayerAvatarDisplay
              avatar={player?.avatar}
              nickname={player?.nickname}
              fallback="🐶"
              className="relative h-11 w-11 overflow-hidden rounded-2xl bg-white text-3xl sm:h-[clamp(40px,7vh,64px)] sm:w-[clamp(40px,7vh,64px)] sm:text-4xl"
              sizes="64px"
            />
          </div>
          <span
            className="mt-2 block max-w-full truncate text-[clamp(18px,min(3vw,4.5vh),44px)] font-black leading-tight"
            style={{ color: NAVY }}
          >
            {player?.nickname || '-'}
          </span>
          <span
            className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[clamp(13px,min(2.2vw,3.4vh),30px)] font-black sm:px-4 sm:py-1.5"
            style={{ background: theme.chipBg, color: theme.chipText, border: `3px solid ${theme.border}` }}
          >
            {scoreDisplay.icon && (
              <Image src={scoreDisplay.icon} alt="" width={28} height={28} className="hidden h-6 w-6 shrink-0 object-contain sm:block" />
            )}
            <span className="truncate">{scoreDisplay.text}</span>
          </span>
        </div>
      </div>

      {/* 시상대 — 생크림을 얹은 파스텔 케이크처럼 */}
      <div
        className={`result-rise result-shine relative ${height} w-full rounded-t-[26px] sm:rounded-t-[34px]`}
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.5) 3px, transparent 3.5px), ${theme.podium}`,
          backgroundSize: '30px 30px, 100% 100%',
          boxShadow: 'inset 0 -12px 0 rgba(255, 255, 255, 0.22), 0 -4px 24px rgba(14, 165, 233, 0.14)',
          animationDelay: `${delay}s`,
        }}
      >
        <span className="result-frosting absolute inset-x-0 top-0 h-[22px] rounded-t-[26px] sm:rounded-t-[34px]" aria-hidden />
        <div className="relative flex items-center justify-center gap-1 pt-7 sm:gap-2">
          <Image
            src={theme.medal}
            alt=""
            width={64}
            height={64}
            className="h-9 w-9 object-contain drop-shadow-[0_3px_0_rgba(30,58,138,0.14)] sm:h-14 sm:w-14"
          />
          <CuteHeading className="text-[clamp(40px,min(6vw,8vh),92px)] leading-none">{rank}</CuteHeading>
        </div>
      </div>
    </div>
  )
}

function ReviewQuestionStage({
  question,
  index,
  total,
  onNext,
}: {
  question: QuestionAnalysis | undefined
  index: number
  total: number
  onNext: () => void
}) {
  if (!question) {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center px-6 pb-28 text-center">
        <div className="result-bob mb-6 flex items-end gap-3">
          <Mascot kind="pome" size={120} />
          <Mascot kind="sigol" size={102} />
        </div>
        <CuteHeading className="text-[clamp(44px,7vw,104px)]">다시 볼 문제가 없어요!</CuteHeading>
        <SkyPill className="mt-5 text-[clamp(20px,2.6vw,36px)]">
          모두 잘 맞혔어요
          <PixelHeart size={28} color="#FF8FB8" outline="#E0548A" />
        </SkyPill>
        <CuteButton className="mt-12" onClick={onNext}>
          마무리로
          <ArrowRight className="h-7 w-7" />
        </CuteButton>
      </section>
    )
  }

  return (
    <section className="flex min-h-dvh flex-col px-4 pb-8 pt-6 sm:px-10 sm:pt-8">
      <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-5">
        <CuteHeading className="text-[clamp(30px,4vw,56px)]">다 같이 다시 볼 문제</CuteHeading>
        {total > 1 && (
          <SkyPill className="text-[clamp(18px,2.2vw,30px)]">
            {index + 1} / {total}
          </SkyPill>
        )}
      </div>
      <div
        className="flex flex-1 flex-col justify-center rounded-[36px] border-4 bg-white p-6 sm:p-10"
        style={{ color: NAVY, borderColor: '#BAE6FD', boxShadow: '0 10px 0 #BAE6FD, 0 24px 48px rgba(14, 165, 233, 0.16)' }}
      >
        <h1 className="text-[clamp(34px,5vw,76px)] font-black leading-tight tracking-normal">
          <span className="mr-3 inline-block rounded-full bg-sky-100 px-4 py-1 align-middle text-[0.55em] text-sky-700">
            질문 {question.index + 1}
          </span>
          {question.text}
        </h1>
        {question.options.length > 0 && (
          <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              const isAnswer = option === question.answer || String(optionIndex + 1) === question.answer
              return (
                <div
                  key={`${option}-${optionIndex}`}
                  className="flex items-center gap-3 rounded-[24px] border-4 p-5 text-[clamp(24px,3vw,44px)] font-black sm:p-6"
                  style={
                    isAnswer
                      ? { borderColor: '#86EFAC', background: '#F0FDF4', color: '#166534', boxShadow: '0 5px 0 #86EFAC' }
                      : { borderColor: '#E0F2FE', background: '#F8FCFF', color: NAVY, boxShadow: '0 5px 0 #E0F2FE' }
                  }
                >
                  <span className="min-w-0 flex-1">
                    {optionIndex + 1}. {option}
                  </span>
                  {isAnswer && (
                    <Image src="/icons/correct.webp" alt="정답" width={56} height={56} className="h-10 w-10 shrink-0 object-contain sm:h-14 sm:w-14" />
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-4 sm:mt-10 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="break-keep rounded-[28px] px-6 py-3 text-[clamp(22px,3vw,46px)] font-black sm:px-8 sm:py-4"
            style={{ background: '#DCFCE7', color: '#166534', border: '4px solid #86EFAC' }}
          >
            정답: {question.answer}
          </div>
          <div
            className="break-keep rounded-[28px] px-6 py-3 text-[clamp(20px,3vw,44px)] font-black sm:px-8 sm:py-4"
            style={{ background: '#FEF3C7', color: '#92400E', border: '4px solid #FCD34D' }}
          >
            정답률 {question.accuracy}% · {question.attemptCount}번 중 {question.correctCount}번 정답
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <CuteButton onClick={onNext}>
          {index + 1 >= total ? '마무리' : '다음'}
          <ArrowRight className="h-7 w-7" />
        </CuteButton>
      </div>
    </section>
  )
}
