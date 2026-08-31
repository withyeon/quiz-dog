'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Sparkles,
  FileText,
  Youtube,
  ScanLine,
  PenLine,
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
import { gameAssets } from '@/assets/game-assets'
import { gameModesData, visibleGameModeCount } from '@/components/landing/gameModesData'

/* ─────────────────────────────────────────────────────────────
   공통 조각
───────────────────────────────────────────────────────────── */
const CARD_SHADOW = '0 4px 6px rgba(0,0,0,0.04), 0 16px 40px rgba(148,163,184,0.14)'
const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
}

function SectionBadge({ children, color = '#2563EB', bg = '#DBEAFE', border = '#93C5FD' }: {
  children: React.ReactNode
  color?: string
  bg?: string
  border?: string
}) {
  return (
    <span
      className="inline-block rounded-full px-4 py-1.5 text-sm font-black"
      style={{ color, background: bg, border: `2px solid ${border}` }}
    >
      {children}
    </span>
  )
}

function SectionHeading({
  badge,
  badgeColor,
  badgeBg,
  badgeBorder,
  title,
  subtitle,
}: {
  badge: string
  badgeColor?: string
  badgeBg?: string
  badgeBorder?: string
  title: React.ReactNode
  subtitle: string
}) {
  return (
    <motion.div {...FADE_UP} className="mb-12 text-center">
      <SectionBadge color={badgeColor} bg={badgeBg} border={badgeBorder}>
        {badge}
      </SectionBadge>
      <h2 className="mt-4 text-3xl font-black leading-tight text-[#0F172A] sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base text-slate-500 sm:text-lg">{subtitle}</p>
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

function CheckLine({ children, color = '#0EA5E9' }: { children: React.ReactNode; color?: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color }} strokeWidth={3} />
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
          background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 40%, #0ea5e9 100%)',
          boxShadow: '0 8px 24px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.45)',
          color: '#FFFFFF',
        }
      : {
          background: '#FFFFFF',
          boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
          color: '#1E40AF',
          border: '2px solid #BFDBFE',
        }
  return (
    <Link href={href} className={className}>
      <motion.span
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ y: 0, scale: 0.98 }}
        className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-black sm:text-lg"
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
  { icon: Zap, text: '설치 없이 웹에서 바로' },
  { icon: KeyRound, text: '학생은 가입 없이 코드로 입장' },
  { icon: Smartphone, text: 'PC · 태블릿 · 휴대폰 모두 지원' },
]

const STEPS = [
  {
    step: '01',
    emoji: '📎',
    title: '자료를 올려요',
    description: '수업 자료 파일이나 유튜브 링크, 아니면 단원명 한 줄이면 충분해요.',
    color: '#0EA5E9',
  },
  {
    step: '02',
    emoji: '🤖',
    title: 'AI가 문제를 만들어요',
    description: '유형별 개수까지 정해서 생성하고, 화면에서 바로 다듬을 수 있어요.',
    color: '#7C3AED',
  },
  {
    step: '03',
    emoji: '🎮',
    title: '게임 코드를 공유해요',
    description: '게임 모드를 고르고 코드를 띄우면 학생들이 곧바로 들어와요.',
    color: '#F59E0B',
  },
]

const AI_SOURCES = [
  {
    icon: PenLine,
    title: '주제 한 줄로',
    description: '단원이나 활동명을 적으면 바로 퀴즈 초안을 잡아줘요.',
    helper: '예: 4학년 1학기 분수의 덧셈',
    color: '#0EA5E9',
  },
  {
    icon: FileText,
    title: '수업 자료에서',
    description: '학습지, 안내문, 발표 자료에서 낼 만한 문제를 골라요.',
    helper: 'PDF · DOCX · PPTX · PPT · TXT · CSV',
    color: '#7C3AED',
  },
  {
    icon: Youtube,
    title: '유튜브 영상에서',
    description: '영상 속 설명을 바탕으로 확인 문제를 구성해요.',
    helper: '영상 링크만 붙여넣기',
    color: '#EF4444',
  },
  {
    icon: ScanLine,
    title: '시험지 스캔에서',
    description: '스캔한 활동지나 사진 속 문제를 편집 가능한 형태로 옮겨요.',
    helper: 'PDF · JPG · PNG · WEBP',
    color: '#F59E0B',
  },
]

const AI_DETAILS = [
  '객관식 · OX · 주관식을 유형별 개수로 지정 (최대 20문항)',
  '“쉽게 내주세요” 같은 추가 요청사항을 AI에게 전달',
  '과목과 대상 학년을 골라 눈높이에 맞춘 문제로',
  '생성 결과를 문항별로 검토하고 그 자리에서 수정',
  'AI 없이 직접 문제를 입력하는 수동 작성도 지원',
]

const PLAY_TYPES = [
  { emoji: '🔢', name: '순서 풀이', description: '문제를 주어진 순서대로 풀어야 완료할 수 있어요.', color: '#0EA5E9' },
  { emoji: '🎯', name: '자유 풀이', description: '원하는 순서대로 자유롭게 문제를 선택해서 풀 수 있어요.', color: '#22C55E' },
  { emoji: '⏱️', name: '라운드전', description: '라운드별로 문제를 풀며 다 함께 경쟁하는 방식이에요.', color: '#F59E0B' },
  { emoji: '🤝', name: '팀전', description: '팀을 나눠서 함께 문제를 풀며 경쟁해요.', color: '#7C3AED' },
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
    color: '#7C3AED',
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
    color: '#F59E0B',
  },
]

const REPORT_POINTS = [
  { title: '평균 정답률 한눈에', description: '참여 인원, 문항 수, 평균 정답률 같은 핵심 지표를 게임이 끝나면 바로 확인해요.' },
  { title: '문항별 정답률', description: '어떤 문제에서 학생들이 막혔는지 보이니까 다시 짚을 부분을 고르기 쉬워요.' },
  { title: '학생별 상세 기록', description: '학생마다 어떤 문항을 맞고 틀렸는지 표로 펼쳐 보고, 개별 피드백에 활용해요.' },
  { title: '지난 게임 기록 보관', description: '진행했던 게임이 기록으로 남아 언제든 다시 열어볼 수 있어요.' },
]

const LIBRARY_POINTS = [
  '다른 선생님이 공개한 문제집을 검색해서 그대로 가져오기',
  '과목 · 학년으로 필터링해 우리 반에 맞는 자료 찾기',
  '내가 만든 문제집을 공개로 전환해 함께 나누기',
  '링크 복사 한 번으로 동료 선생님께 공유',
]

/* ─────────────────────────────────────────────────────────────
   페이지
───────────────────────────────────────────────────────────── */
export default function FeaturesContent() {
  return (
    <div
      className="min-h-dvh font-bitbit"
      style={{ background: 'linear-gradient(180deg, #E0EEFF 0%, #F0F4FF 55%, #F8F9FF 100%)' }}
    >
      <Navbar />

      {/* ══ 히어로 ═══════════════════════════════════════════ */}
      <section className="px-4 pb-12 pt-32 sm:pt-36">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <SectionBadge>퀴즈독 기능 소개</SectionBadge>

            <h1 className="mt-5 text-4xl font-black leading-tight text-[#0F172A] sm:text-5xl md:text-6xl">
              수업 준비는 3분,
              <br />
              교실은 <span style={{ color: '#2E7BD4' }}>게임</span>으로
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
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
                <Sparkles className="h-5 w-5" />
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
      <section className="scroll-mt-32 px-4 py-16" id="how">
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
                  <div className="p-7">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="text-4xl">{step.emoji}</span>
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
      <section className="scroll-mt-32 px-4 py-16" id="ai">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="🤖 AI 문제 생성"
            badgeColor="#7C3AED"
            badgeBg="#F3E8FF"
            badgeBorder="#D8B4FE"
            title={<>어떤 자료든 <span style={{ color: '#7C3AED' }}>문제집</span>이 됩니다</>}
            subtitle="네 가지 방법 중 편한 걸로 시작하세요."
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
                      <source.icon className="h-6 w-6" style={{ color: source.color }} strokeWidth={2.5} />
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
                    만들기 전에 원하는 대로 맞추고,
                    <br />
                    만든 뒤엔 직접 다듬어요
                  </h3>
                  <p className="text-[15px] font-bold leading-relaxed text-slate-500">
                    AI가 만든 문제를 그대로 쓰지 않아도 돼요. 생성 결과를 검토 화면에서 확인하고,
                    문장이나 보기를 선생님이 원하는 대로 고친 다음 저장할 수 있어요.
                  </p>
                </div>
                <ul className="space-y-3">
                  {AI_DETAILS.map((detail) => (
                    <CheckLine key={detail} color="#7C3AED">
                      {detail}
                    </CheckLine>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ══ 게임 모드 ════════════════════════════════════════ */}
      <section className="scroll-mt-32 px-4 py-16" id="games">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="🎮 게임 모드"
            badgeColor="#B45309"
            badgeBg="#FEF3C7"
            badgeBorder="#FCD34D"
            title={
              <>
                같은 문제집으로 <span style={{ color: '#F59E0B' }}>{visibleGameModeCount}가지</span> 게임
              </>
            }
            subtitle="문제집은 그대로 두고 게임만 바꿔도 완전히 다른 수업이 돼요."
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {gameModesData.map((game, i) => (
              <motion.div
                key={game.name}
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: (i % 6) * 0.06 }}
                whileHover={{ y: -4 }}
              >
                <div
                  className="h-full rounded-2xl bg-white p-4 sm:p-5"
                  style={{ boxShadow: CARD_SHADOW, borderTop: `3px solid ${game.color}` }}
                >
                  <Image
                    src={game.titleImage}
                    alt={game.name}
                    width={540}
                    height={180}
                    className="mb-3 h-24 w-full object-contain sm:h-32"
                  />
                  <p className="text-center text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">
                    {game.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* 진행 방식 */}
          <motion.div {...FADE_UP} className="mt-14">
            <h3 className="mb-6 text-center text-2xl font-black text-[#0F172A]">
              진행 방식도 골라서
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLAY_TYPES.map((type, i) => (
                <motion.div key={type.name} {...FADE_UP} transition={{ delay: i * 0.07 }}>
                  <Card>
                    <div className="p-6 text-center">
                      <span className="text-3xl">{type.emoji}</span>
                      <h4 className="mb-2 mt-3 text-lg font-black" style={{ color: type.color }}>
                        {type.name}
                      </h4>
                      <p className="text-sm font-bold leading-relaxed text-slate-500">{type.description}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ 학생 참여 ════════════════════════════════════════ */}
      <section className="scroll-mt-32 px-4 py-16" id="play">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="🐾 학생 참여"
            badgeColor="#0369A1"
            badgeBg="#E0F2FE"
            badgeBorder="#7DD3FC"
            title={<>코드 하나로 <span style={{ color: '#0EA5E9' }}>전원 입장</span></>}
            subtitle="계정을 만들 필요가 없어서 1학년 교실에서도 바로 시작할 수 있어요."
          />

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
      <section className="scroll-mt-32 px-4 py-16" id="report">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="📊 결과 리포트"
            badgeColor="#15803D"
            badgeBg="#DCFCE7"
            badgeBorder="#86EFAC"
            title={<>게임이 끝나면 <span style={{ color: '#16A34A' }}>기록</span>이 남아요</>}
            subtitle="재미있게 놀고 끝나는 게 아니라, 무엇을 더 가르쳐야 할지가 보입니다."
          />

          <div className="grid gap-6 md:grid-cols-2">
            <motion.div {...FADE_UP} className="md:row-span-2">
              <Card accent="linear-gradient(90deg, #16A34A, #4ADE80)">
                <div className="flex h-full flex-col justify-center p-8">
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

            {REPORT_POINTS.map((point, i) => (
              <motion.div key={point.title} {...FADE_UP} transition={{ delay: i * 0.07 }}>
                <Card>
                  <div className="p-6">
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
      </section>

      {/* ══ 자료실 ═══════════════════════════════════════════ */}
      <section className="scroll-mt-32 px-4 py-16" id="library">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            badge="📚 자료실"
            badgeColor="#7C3AED"
            badgeBg="#F3E8FF"
            badgeBorder="#D8B4FE"
            title="다른 선생님의 문제집을 그대로"
            subtitle="처음부터 만들지 않아도 돼요. 공개된 문제집을 가져와 우리 반에 맞게 고쳐 쓰세요."
          />

          <motion.div {...FADE_UP}>
            <Card>
              <div className="grid gap-8 p-8 md:grid-cols-[auto_1fr] md:items-center">
                <span
                  className="inline-flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(124,58,237,0.10)' }}
                >
                  <Library className="h-10 w-10 text-[#7C3AED]" strokeWidth={2.5} />
                </span>
                <ul className="space-y-3">
                  {LIBRARY_POINTS.map((point) => (
                    <CheckLine key={point} color="#7C3AED">
                      {point}
                    </CheckLine>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>

          <motion.div {...FADE_UP} className="mt-6 text-center">
            <Link
              href="/teacher/library"
              className="inline-flex items-center gap-2 text-base font-black text-[#7C3AED] hover:underline"
            >
              자료실 둘러보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══ 마지막 CTA ═══════════════════════════════════════ */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <div
              className="rounded-3xl bg-white p-10 text-center sm:p-14"
              style={{ boxShadow: '0 8px 48px rgba(14,165,233,0.14), 0 2px 8px rgba(0,0,0,0.05)' }}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black text-white"
                style={{ background: 'linear-gradient(90deg, #7C3AED, #A855F7)' }}
              >
                🎉 베타 테스트 기간 전 기능 무료
              </span>

              <h2 className="mb-4 mt-5 text-3xl font-black leading-tight text-[#0F172A] sm:text-4xl">
                다음 수업부터 바로 써보세요
              </h2>
              <p className="mb-8 text-base font-bold text-slate-500 sm:text-lg">
                선생님 계정만 만들면 준비 끝. 학생은 언제나 무료입니다.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <CtaButton href="/teacher">
                  <Sparkles className="h-5 w-5" />
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
