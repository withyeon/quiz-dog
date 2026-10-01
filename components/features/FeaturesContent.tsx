'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Check,
  KeyRound,
  Smartphone,
  Zap,
  Trophy,
  BarChart3,
  Users,
  ShieldCheck,
  Library,
  ArrowRight,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PawBackgroundDecor from '@/components/PawBackgroundDecor'
import GameModeCard from '@/components/landing/GameModeCard'
import FeatureClip from '@/components/features/FeatureClip'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import { gameAssets } from '@/assets/game-assets'
import { visibleGameModes } from '@/components/landing/gameModesData'

/* ─────────────────────────────────────────────────────────────
   공통 조각
───────────────────────────────────────────────────────────── */
const CARD_SHADOW = '0 4px 6px rgba(0,0,0,0.04), 0 16px 40px rgba(148,163,184,0.14)'
const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
}

function SectionBadge({ children, color = '#0369A1', bg = '#E0F2FE', border = '#7DD3FC' }: {
  children: React.ReactNode
  color?: string
  bg?: string
  border?: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black"
      style={{ color, background: bg, border: `2px solid ${border}` }}
    >
      {children}
    </span>
  )
}

function SectionHeading({
  badge,
  badgeIcon,
  badgeColor,
  badgeBg,
  badgeBorder,
  title,
  subtitle,
}: {
  badge: string
  badgeIcon?: string
  badgeColor?: string
  badgeBg?: string
  badgeBorder?: string
  title: React.ReactNode
  subtitle?: string
}) {
  return (
    <motion.div {...FADE_UP} className="mb-12 text-center">
      <SectionBadge color={badgeColor} bg={badgeBg} border={badgeBorder}>
        {badgeIcon && <Image src={badgeIcon} alt="" width={20} height={20} unoptimized className="h-5 w-5 object-contain" />}
        {badge}
      </SectionBadge>
      <h2 className="mt-5 text-4xl sm:text-5xl">
        <PixelHeading>{title}</PixelHeading>
      </h2>
      {subtitle && <p className="-mt-1 text-base text-slate-500 sm:text-lg">{subtitle}</p>}
    </motion.div>
  )
}

/** 흰 카드 — 페이지 전체에서 반복되는 기본 블록 */
function Card({
  children,
  className = '',
  accent,
}: {
  children: React.ReactNode
  className?: string
  /** 상단 컬러 스트라이프 색 (없으면 스트라이프 없음) */
  accent?: string
}) {
  return (
    <div
      className={`h-full overflow-hidden rounded-2xl bg-white ${className}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      {accent && <div style={{ height: 5, background: accent }} />}
      {children}
    </div>
  )
}

/**
 * 실제 화면 캡처(16:10). public/main/features/ 아래 webp. 표처럼 글씨가 많아 영상보다 정지 화면이 나은 곳(리포트 표 2장)에 쓴다.
 * 그 밖의 기능 화면은 FeatureClip(짧은 반복 클립)으로 보여 준다.
 * 캡처 방법은 components/landing/featureIntroData.ts 상단 주석 참고 — 화면이 바뀌면 같은 구도로 다시 찍는다.
 */
function Shot({
  src,
  alt,
  caption,
  bleed = false,
}: {
  src: string
  alt: string
  caption?: string
  /** 카드 상단에 여백 없이 붙일 때 (모서리 둥글기·테두리 없음) */
  bleed?: boolean
}) {
  return (
    <figure className="m-0">
      <div
        className={
          bleed
            ? 'relative aspect-[16/10] w-full overflow-hidden border-b border-slate-100 bg-slate-50'
            : 'relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50'
        }
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
          className="object-cover object-top"
        />
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center text-[13px] font-bold text-slate-400">{caption}</figcaption>
      )}
    </figure>
  )
}

function CheckLine({
  children,
  color = '#0EA5E9',
  icon,
}: {
  children: React.ReactNode
  color?: string
  /** 체크 표시 대신 띄울 public 픽셀 이미지 */
  icon?: string
}) {
  return (
    <li className="flex items-start gap-2.5">
      {icon ? (
        <Image src={icon} alt="" width={24} height={24} unoptimized className="h-6 w-6 flex-shrink-0 object-contain" />
      ) : (
        <Check className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color }} strokeWidth={3} />
      )}
      <span className="text-[15px] font-bold leading-relaxed text-slate-700">{children}</span>
    </li>
  )
}

function CtaButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'ghost'
  className?: string
}) {
  const style =
    variant === 'primary'
      ? {
          background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
          boxShadow:
            '0 6px 0 #0b8fc4, 0 12px 24px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
          textShadow: '0 1px 0 rgba(0,0,0,0.18)',
          color: '#FFFFFF',
        }
      : {
          background: '#FFFFFF',
          boxShadow: '0 5px 0 rgba(186,230,253,0.9), 0 10px 20px rgba(14,165,233,0.14)',
          color: '#0369A1',
          border: '2px solid #BAE6FD',
        }
  return (
    <Link href={href} className={className}>
      <motion.span
        whileHover={{ y: -3 }}
        whileTap={{ y: 0 }}
        className="inline-flex items-center justify-center gap-2 rounded-full px-9 py-4 text-base font-black sm:text-lg"
        style={style}
      >
        {children}
      </motion.span>
    </Link>
  )
}

/* ─────────────────────────────────────────────────────────────
   데이터
───────────────────────────────────────────────────────────── */
const HERO_POINTS = [
  { icon: Zap, text: '설치 없음' },
  { icon: KeyRound, text: '학생은 가입 없이 코드로 입장' },
  { icon: Smartphone, text: 'PC · 태블릿 · 휴대폰 모두 지원' },
]

const STEPS = [
  {
    step: '01',
    icon: '/zombie/log.webp',
    title: '자료를 올려요',
    description: '수업 자료 파일, 유튜브 링크, 주제 입력이면 충분해요.',
    color: '#0EA5E9',
    clip: 'step-upload',
    clipAlt: '문제 만들기 화면에 수업 자료 파일들이 올라가고 AI가 읽어 들이는 모습',
  },
  {
    step: '02',
    icon: '/icons/rare.webp',
    title: 'AI가 문제를 만들어요',
    description: '다양한 유형으로 생성하고 수정도 바로 가능해요.',
    color: '#14B8A6',
    clip: 'step-ai',
    clipAlt: 'AI가 객관식과 OX 문제를 만들어 정답까지 표시하는 모습',
  },
  {
    step: '03',
    icon: '/assets/icons/joystick-128.png',
    title: '게임 코드를 공유해요',
    description: '학생들은 6자리 숫자 코드를 입력해서 간편하게 들어와요.',
    color: '#F43F5E',
    clip: 'step-code',
    clipAlt: '6자리 참가 코드가 뜨고 학생들이 차례로 입장하는 모습',
  },
]

const AI_SOURCES = [
  {
    icon: '/icons/rare.webp',
    title: '주제 한 줄로',
    description: '단원이나 활동명을 적으면 바로 퀴즈 초안을 잡아줘요.',
    helper: '예: 4학년 1학기 분수의 덧셈',
    color: '#0EA5E9',
  },
  {
    icon: '/zombie/log.webp',
    title: '수업 자료에서',
    description: '학습지, 안내문, 발표 자료에서 낼 만한 문제를 골라요.',
    helper: 'PDF · DOCX · PPTX · PPT · TXT · CSV',
    color: '#14B8A6',
  },
  {
    icon: '/icons/flip.webp',
    title: '유튜브 영상에서',
    description: '영상 속 설명을 바탕으로 확인 문제를 구성해요.',
    helper: '영상 링크만 붙여넣기',
    color: '#EF4444',
  },
  {
    icon: '/icons/scan.webp',
    title: '시험지 스캔에서',
    description: '스캔한 활동지나 사진 속 문제를 편집 가능한 형태로 옮겨요.',
    helper: 'PDF · JPG · PNG · WEBP',
    color: '#F97316',
  },
]

const AI_DETAILS = [
  { icon: '/icons/correct.webp', text: '객관식 · OX · 주관식을 유형별 개수로 지정 (최대 20문항)' },
  { icon: '/assets/icons/mascot-pome-64.png', text: '“쉽게 내주세요” 같은 추가 요청사항을 AI에게 전달' },
  { icon: '/icons/people.webp', text: '과목과 대상 학년을 골라 눈높이에 맞춘 문제로' },
  { icon: '/icons/lucky.webp', text: '생성 결과를 문항별로 검토하고 그 자리에서 수정' },
  { icon: '/zombie/quiz.webp', text: 'AI 없이 직접 문제를 입력하는 수동 작성도 지원' },
]

const STUDENT_POINTS = [
  {
    icon: KeyRound,
    title: '가입도, 설치도 없이',
    description: '학생은 화면에 뜬 참여 코드만 입력하면 끝. 계정을 만들 필요가 없어요.',
    color: '#0EA5E9',
  },
  {
    icon: Users,
    title: '닉네임 + 강아지 캐릭터',
    description: '이름을 정하고 마음에 드는 강아지를 골라 대기실에서 기다려요.',
    color: '#14B8A6',
  },
  {
    icon: ShieldCheck,
    title: '부적절한 닉네임 자동 차단',
    description: '비속어 필터가 걸러 주기 때문에 교실에서 안심하고 쓸 수 있어요.',
    color: '#22C55E',
  },
  {
    icon: Trophy,
    title: '실시간 순위표',
    description: '점수가 올라가는 게 바로 보여서 끝까지 집중이 유지돼요.',
    color: '#F97316',
  },
]

const REPORT_POINTS = [
  { title: '평균 정답률 한눈에', description: '참여 인원, 문항 수, 평균 정답률 같은 핵심 지표를 게임이 끝나면 바로 확인해요.' },
  { title: '문항별 정답률', description: '어떤 문제에서 학생들이 막혔는지 보이니까 다시 짚을 부분을 고르기 쉬워요.' },
  { title: '학생별 상세 기록', description: '학생마다 어떤 문항을 맞고 틀렸는지 표로 펼쳐 보고, 개별 피드백에 활용해요.' },
  { title: '지난 게임 기록 보관', description: '진행했던 게임이 기록으로 남아 언제든 다시 열어볼 수 있어요.' },
]

const LIBRARY_POINTS = [
  '우리 반 진도에 맞는 문제집 활용하기',
  '재미있는 퀴즈로 계기교육도 쉽고 재밌게 공부하기',
  '자료집의 문제집으로 간편하게 수업 준비하기',
]

/* ─────────────────────────────────────────────────────────────
   페이지
───────────────────────────────────────────────────────────── */
export default function FeaturesContent() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#d9eef5] font-bitbit">
      <PawBackgroundDecor />
      <div className="page-texture-overlay" aria-hidden />
      <Navbar />

      {/* ══ 히어로 ═══════════════════════════════════════════ */}
      <section className="relative z-[2] px-4 pb-12 pt-32 sm:pt-36">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <SectionBadge>퀴즈독 기능 소개</SectionBadge>

            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl">
              <PixelHeading>
                수업 준비는 3분,
                <br />
                교실은 <PixelAccent>게임</PixelAccent>으로
              </PixelHeading>
            </h1>

            <p className="mx-auto -mt-1 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              자료만 올리면 AI가 문제를 만들고, 학생들은 코드 하나로 바로 입장해요.
              <br className="hidden sm:block" />
              퀴즈독이 교실에서 어떻게 쓰이는지 아래에서 확인해 보세요.
            </p>

            {/* 마스코트 */}
            <motion.div
              className="mt-8 flex justify-center gap-3"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src={gameAssets['mascot-pome'].tight}
                alt="포메 마스코트"
                width={88}
                height={88}
                unoptimized
                className="pixelated h-[72px] w-[72px] object-contain sm:h-[88px] sm:w-[88px]"
              />
              <Image
                src={gameAssets.mascot_sigol.tight}
                alt="시골 마스코트"
                width={88}
                height={88}
                unoptimized
                className="pixelated h-[72px] w-[72px] object-contain sm:h-[88px] sm:w-[88px]"
              />
            </motion.div>

            {/* 핵심 포인트 */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {HERO_POINTS.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-slate-700"
                  style={{ boxShadow: '0 2px 10px rgba(15,23,42,0.06)' }}
                >
                  <Icon className="h-4 w-4 text-sky-500" strokeWidth={2.5} />
                  {text}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <CtaButton href="/teacher">
                <Image
                  src="/assets/icons/joystick-64.png"
                  alt=""
                  aria-hidden
                  width={64}
                  height={64}
                  unoptimized
                  className="h-6 w-6 object-contain"
                />
                무료로 시작하기
              </CtaButton>
              <CtaButton href="/lobby" variant="ghost">
                코드로 입장하기
              </CtaButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ 3단계 흐름 ═══════════════════════════════════════ */}
      <section className="relative z-[2] scroll-mt-32 px-4 py-16" id="how">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            badge="이렇게 쓰여요"
            title="수업 준비, 세 단계면 끝나요"
            subtitle="파일 하나만 있으면 문제집부터 게임까지 이어집니다."
          />

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div key={step.step} {...FADE_UP} transition={{ delay: i * 0.1 }}>
                <Card accent={step.color}>
                  <FeatureClip name={step.clip} alt={step.clipAlt} bleed />
                  <div className="p-7">
                    <div className="mb-4 flex items-center gap-3">
                      <Image src={step.icon} alt="" width={44} height={44} unoptimized className="h-11 w-11 object-contain" />
                      <span className="text-2xl font-black" style={{ color: step.color }}>
                        {step.step}
                      </span>
                    </div>
                    <h3 className="mb-2 text-xl font-black text-[#0F172A]">{step.title}</h3>
                    <p className="text-[15px] font-bold leading-relaxed text-slate-500">{step.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AI 문제 생성 ═════════════════════════════════════ */}
      <section className="relative z-[2] scroll-mt-32 px-4 py-16" id="ai">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="AI 문제 생성"
            badgeIcon="/icons/rare.webp"
            title={<>어떤 자료도 <PixelAccent>퀴즈</PixelAccent>가 됩니다!</>}
          />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {AI_SOURCES.map((source, i) => (
              <motion.div key={source.title} {...FADE_UP} transition={{ delay: i * 0.08 }}>
                <Card>
                  <div className="flex h-full flex-col p-6">
                    <span
                      className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: `${source.color}1A` }}
                    >
                      <Image src={source.icon} alt="" width={32} height={32} unoptimized className="h-8 w-8 object-contain" />
                    </span>
                    <h3 className="mb-2 text-lg font-black text-[#0F172A]">{source.title}</h3>
                    <p className="mb-4 flex-1 text-sm font-bold leading-relaxed text-slate-500">
                      {source.description}
                    </p>
                    <span
                      className="inline-block rounded-lg px-3 py-1.5 text-xs font-black"
                      style={{ background: `${source.color}14`, color: source.color }}
                    >
                      {source.helper}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* 생성 옵션 상세 */}
          <motion.div {...FADE_UP} transition={{ delay: 0.15 }} className="mt-8">
            <Card>
              <div className="grid gap-8 p-8 md:grid-cols-2 md:items-center">
                <div>
                  <h3 className="mb-3 text-2xl font-black leading-snug text-[#0F172A]">
                    AI로 간편한 퀴즈 생성하기
                  </h3>
                  <p className="mb-6 text-[15px] font-bold leading-relaxed text-slate-500">
                    AI가 만든 문제를 그대로 쓰지 않아도 돼요. 생성 결과를 검토 화면에서 확인하고,
                    문장이나 보기를 선생님이 원하는 대로 고친 다음 저장할 수 있어요.
                  </p>
                  <ul className="space-y-3">
                    {AI_DETAILS.map((detail) => (
                      <CheckLine key={detail.text} icon={detail.icon}>
                        {detail.text}
                      </CheckLine>
                    ))}
                  </ul>
                </div>
                <FeatureClip
                  name="ai-options"
                  alt="과목과 학년을 고르고 유형별 문항 개수를 올린 뒤 추가 요청을 적는 AI 생성 옵션 화면"
                  caption="과목·학년·문항 구성과 추가 요청을 정하는 옵션 화면"
                />
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ══ 게임 모드 ════════════════════════════════════════ */}
      <section className="relative z-[2] scroll-mt-32 px-4 py-16" id="games">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="게임 모드"
            badgeIcon="/assets/icons/joystick-64.png"
            title={
              <>
                초등교사 출신 개발자가 만든
                <br />
                <PixelAccent>초등학생 눈높이 게임</PixelAccent>!
              </>
            }
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
            {visibleGameModes.map((game, i) => (
              <GameModeCard key={game.name} game={game} index={i} animationsReady />
            ))}
          </div>
        </div>
      </section>

      {/* ══ 학생 참여 ════════════════════════════════════════ */}
      <section className="relative z-[2] scroll-mt-32 px-4 py-16" id="play">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="학생 참여"
            badgeIcon="/assets/icons/mascot-pome-64.png"
            badgeColor="#0369A1"
            badgeBg="#E0F2FE"
            badgeBorder="#7DD3FC"
            title={<>학생은 <PixelAccent>코드로</PixelAccent> 입장</>}
            subtitle="회원가입, 설치 등 복잡한 절차가 필요하지 않습니다."
          />

          <motion.div {...FADE_UP} className="mb-8 grid gap-6 md:grid-cols-2">
            <Card>
              <div className="p-4 sm:p-5">
                <FeatureClip
                  name="play-code"
                  alt="학생이 6자리 게임 코드를 입력하고 닉네임을 정하는 입장 화면"
                  caption="① 선생님이 알려준 6자리 코드를 넣고 닉네임을 정해요"
                />
              </div>
            </Card>
            <Card>
              <div className="p-4 sm:p-5">
                <FeatureClip
                  name="play-character"
                  alt="강아지 캐릭터를 고르면 입장이 끝나고 친구들이 대기실에 모이는 화면"
                  caption="② 강아지 캐릭터를 고르고 친구들과 대기실에서 기다려요"
                />
              </div>
            </Card>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {STUDENT_POINTS.map((point, i) => (
              <motion.div key={point.title} {...FADE_UP} transition={{ delay: i * 0.08 }}>
                <Card>
                  <div className="flex gap-4 p-6">
                    <span
                      className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${point.color}1A` }}
                    >
                      <point.icon className="h-6 w-6" style={{ color: point.color }} strokeWidth={2.5} />
                    </span>
                    <div>
                      <h3 className="mb-1.5 text-lg font-black text-[#0F172A]">{point.title}</h3>
                      <p className="text-sm font-bold leading-relaxed text-slate-500">{point.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 리포트 ═══════════════════════════════════════════ */}
      <section className="relative z-[2] scroll-mt-32 px-4 py-16" id="report">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="결과 리포트"
            badgeIcon="/trophy.webp"
            badgeColor="#15803D"
            badgeBg="#DCFCE7"
            badgeBorder="#86EFAC"
            title={<>수업과 <PixelAccent>평가</PixelAccent>를 한 번에</>}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <motion.div {...FADE_UP}>
              <Card accent="linear-gradient(90deg, #16A34A, #4ADE80)">
                <FeatureClip name="report" alt="참여 학생 수, 평균 정답률, 문항별 정답률이 채워지는 게임 결과 리포트" bleed />
                <div className="flex flex-col justify-center p-8">
                  <BarChart3 className="mb-4 h-10 w-10 text-emerald-500" strokeWidth={2.5} />
                  <h3 className="mb-3 text-2xl font-black leading-snug text-[#0F172A]">
                    한 판이 그대로
                    <br />
                    형성평가가 됩니다
                  </h3>
                  <p className="text-[15px] font-bold leading-relaxed text-slate-500">
                    학생들이 게임을 하는 동안 쌓인 답안이 문항별 · 학생별 통계로 정리돼요.
                    수업을 마치고 리포트만 열면 다음 차시에 무엇을 짚어야 할지 바로 정할 수 있습니다.
                  </p>
                </div>
              </Card>
            </motion.div>

            <div className="flex flex-col gap-6">
              {REPORT_POINTS.map((point, i) => (
                <motion.div key={point.title} {...FADE_UP} transition={{ delay: i * 0.07 }} className="flex-1">
                  <Card>
                    <div className="flex h-full flex-col justify-center p-6">
                      <h3 className="mb-1.5 flex items-center gap-2 text-lg font-black text-[#0F172A]">
                        <Check className="h-5 w-5 text-emerald-500" strokeWidth={3} />
                        {point.title}
                      </h3>
                      <p className="text-sm font-bold leading-relaxed text-slate-500">{point.description}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div {...FADE_UP} className="mt-6 grid gap-6 md:grid-cols-2">
            <Card>
              <div className="p-4 sm:p-5">
                <Shot
                  src="/main/features/report-matrix.webp"
                  alt="학생별로 문항마다 맞고 틀린 답이 표로 정리된 문항별 분석 매트릭스"
                  caption="문항별 분석 — 어떤 문제에서 막혔는지 한눈에"
                />
              </div>
            </Card>
            <Card>
              <div className="p-4 sm:p-5">
                <Shot
                  src="/main/features/report-students.webp"
                  alt="학생별 정답률, 점수, 평균 응답시간이 정리된 표"
                  caption="학생별 분석 — 정답률·점수·응답 시간을 학생마다"
                />
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ══ 자료실 ═══════════════════════════════════════════ */}
      <section className="relative z-[2] scroll-mt-32 px-4 py-16" id="library">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            badge="자료실"
            badgeIcon="/zombie/quiz.webp"
            badgeColor="#0F766E"
            badgeBg="#CCFBF1"
            badgeBorder="#5EEAD4"
            title="자료집의 문제집을 활용해보세요"
          />

          <motion.div {...FADE_UP}>
            <Card>
              <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1.15fr_1fr] md:items-center">
                <FeatureClip
                  name="library"
                  alt="자료실 문제집 목록에서 하나를 고르고 내 문제집에 담는 화면"
                />
                <div>
                  <span
                    className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(20,184,166,0.12)' }}
                  >
                    <Library className="h-8 w-8 text-[#14B8A6]" strokeWidth={2.5} />
                  </span>
                  <ul className="space-y-3">
                    {LIBRARY_POINTS.map((point) => (
                      <CheckLine key={point} color="#14B8A6">
                        {point}
                      </CheckLine>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div {...FADE_UP} className="mt-6 text-center">
            <Link
              href="/teacher/library"
              className="inline-flex items-center gap-2 text-base font-black text-[#0F766E] hover:underline"
            >
              자료실 둘러보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══ 마지막 CTA ═══════════════════════════════════════ */}
      <section className="relative z-[2] px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <div
              className="rounded-3xl bg-white p-10 text-center sm:p-14"
              style={{ boxShadow: '0 8px 48px rgba(14,165,233,0.14), 0 2px 8px rgba(0,0,0,0.05)' }}
            >
              <motion.div
                className="mb-6 flex justify-center gap-4"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image
                  src={gameAssets['mascot-pome'].tight}
                  alt="포메 마스코트"
                  width={90}
                  height={90}
                  unoptimized
                  className="pixelated h-[90px] w-[90px] object-contain"
                />
                <Image
                  src={gameAssets.mascot_sigol.tight}
                  alt="시골 마스코트"
                  width={90}
                  height={90}
                  unoptimized
                  className="pixelated h-[90px] w-[90px] object-contain"
                />
              </motion.div>

              <span
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black text-white"
                style={{ background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }}
              >
                <Image src="/icons/ticket.webp" alt="" width={20} height={20} unoptimized className="h-5 w-5 object-contain" />
                가입 후 2주 Pro 기능 무료 체험
              </span>

              <h2 className="mt-5 text-4xl sm:text-5xl">
                <PixelHeading>
                  지금 <PixelAccent>바로</PixelAccent> 써보세요
                </PixelHeading>
              </h2>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <CtaButton href="/teacher">
                  <Image
                    src="/assets/icons/joystick-64.png"
                    alt=""
                    aria-hidden
                    width={64}
                    height={64}
                    unoptimized
                    className="h-6 w-6 object-contain"
                  />
                  무료로 시작하기
                </CtaButton>
                <CtaButton href="/pricing" variant="ghost">
                  요금제 보기
                </CtaButton>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
