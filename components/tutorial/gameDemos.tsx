'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { ComponentType } from 'react'
import type { GameModeId } from '@/lib/game/modes'
import {
  ENEMY_TYPES,
  PLAYER_START_HP,
  PLAYER_START_GOLD,
  TOWER_QUIZZES_PER_WAVE,
  TOWER_TYPES,
  WAVES,
  getQuizGoldRange,
} from '@/lib/game/tower'
import { SKILLS, type SkillId } from '@/lib/game/skills'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  StageCard,
  TapPointer,
  PLAYER_NAME,
  PLAYER_IMAGE,
  type DemoPhase,
  type HudMetric,
} from '@/components/tutorial/TutorialDemoFrame'

/* 공통 4단계(퀴즈→정답→액션→결과) 빌더 */
function buildPhases(captions: [string, string, string, string]): DemoPhase[] {
  return [
    { key: 'quiz', duration: 2000, step: 1, caption: captions[0] },
    { key: 'correct', duration: 1600, step: 2, caption: captions[1] },
    { key: 'action', duration: 2100, step: 3, caption: captions[2] },
    { key: 'result', duration: 2500, step: 4, caption: captions[3] },
  ]
}

/* score가 result에서 오르는 공통 metric */
function risingMetric(opts: { emoji: string; base: number; gain: number; suffix: string }) {
  return (phase: string): HudMetric => {
    const isUp = phase === 'result'
    return {
      emoji: opts.emoji,
      value: isUp ? opts.base + opts.gain : opts.base,
      from: isUp ? opts.base : undefined,
      suffix: opts.suffix,
    }
  }
}

const isAnswered = (phase: string) => phase === 'correct'
const isResult = (phase: string) => phase === 'result'

/* 무대 액션 패널 공통 래퍼 */
function Scene({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <StageCard id="scene" className={`relative w-full max-w-xl ${className}`}>
      {children}
    </StageCard>
  )
}

/* 큰 결과 뱃지 */
function ResultBadge({ show, text }: { show: boolean; text: string }) {
  if (!show) return null
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 16 }}
      className="lg-banner-correct font-bitbit mx-auto mt-4 w-fit px-5 py-2 text-center text-base font-black text-white drop-shadow sm:text-lg"
    >
      {text}
    </motion.div>
  )
}

/* ─────────────── 1. 눈싸움 대작전 ─────────────── */
function BattleRoyaleDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/battle-royale.png"
      metric={risingMetric({ emoji: '❄️', base: 0, gain: 1, suffix: '명중' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 눈뭉치를 장전했어요',
        '상대팀(청팀)을 조준해 던져요',
        '명중! 상대팀 체온이 깎여요',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="눈은 무슨 색일까요?"
            options={['하얀색', '검은색', '파란색', '빨간색']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit p-5">
              {/* 팀 대결 헤더 */}
              <div className="mb-4 flex items-center justify-center gap-2 text-xs font-black text-white/90">
                <span className="rounded-full bg-rose-500/80 px-2.5 py-1">🐕 홍팀 2</span>
                <span className="text-white/60">VS</span>
                <span className="rounded-full bg-sky-500/80 px-2.5 py-1">🐺 청팀 2</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Fighter name={PLAYER_NAME} img={PLAYER_IMAGE} hp={100} team="red" />
                <motion.div
                  className="text-4xl"
                  initial={{ x: -40, opacity: 0 }}
                  animate={isResult(phase) ? { x: 60, opacity: [1, 1, 0] } : { x: -40, opacity: 1 }}
                  transition={{ duration: 0.7 }}
                >
                  ❄️
                </motion.div>
                <Fighter name="밥톨이" img="/assets/icons/mascot_sigol-64.png" hp={isResult(phase) ? 65 : 100} hit={isResult(phase)} team="blue" />
              </div>
            </div>
            <ResultBadge show={isResult(phase)} text="명중! 청팀 -35 체온" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

function Fighter({ name, img, hp, hit, team }: { name: string; img: string; hp: number; hit?: boolean; team?: 'red' | 'blue' }) {
  const ring = team === 'red' ? 'ring-rose-400' : team === 'blue' ? 'ring-sky-400' : 'ring-white/70'
  const teamEmoji = team === 'red' ? '🐕' : team === 'blue' ? '🐺' : null
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        animate={hit ? { x: [0, -6, 6, -3, 0] } : {}}
        transition={{ duration: 0.4 }}
        className={`relative h-16 w-16 overflow-hidden rounded-full bg-white/80 ring-2 ${ring}`}
      >
        <Image src={img} alt={name} fill className="object-contain p-1" sizes="64px" />
      </motion.div>
      <span className="text-xs font-black text-white drop-shadow">
        {teamEmoji && <span className="mr-0.5">{teamEmoji}</span>}{name}
      </span>
      <div className="h-2.5 w-20 overflow-hidden rounded-full bg-black/40">
        <motion.div className="h-full rounded-full bg-emerald-400" animate={{ width: `${hp}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  )
}

/* ─────────────── 2. 두근두근 인형뽑기 ─────────────── */
function FishingDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/fishing.png"
      metric={risingMetric({ emoji: '🧸', base: 80, gain: 120, suffix: '점' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 뽑기 기회를 얻었어요',
        '집게를 내려 인형을 노려요',
        '희귀 인형 획득! 점수 UP',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="곰이 겨울에 하는 것은?"
            options={['겨울잠', '수영', '소풍', '등산']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit p-5">
              {/* 집게 */}
              <motion.div
                className="mx-auto mb-1 text-3xl"
                style={{ width: 'fit-content' }}
                animate={isResult(phase) ? { y: [0, 36, 0] } : { y: 0 }}
                transition={{ duration: 1.2 }}
              >
                🪝
              </motion.div>
              <div className="flex items-end justify-around gap-3">
                {[3, 7, 11].map((n, i) => {
                  const grabbed = isResult(phase) && i === 1
                  return (
                    <motion.div
                      key={n}
                      animate={grabbed ? { y: -24, scale: 1.1 } : { y: 0, scale: 1 }}
                      transition={{ duration: 0.6 }}
                      className={`relative flex h-20 w-20 items-center justify-center rounded-2xl ${
                        grabbed ? 'bg-amber-200/90 ring-2 ring-amber-300' : 'bg-white/25'
                      }`}
                    >
                      <Image src={`/fishing/${n}.svg`} alt="" width={64} height={64} className="h-14 w-14 object-contain" />
                      {phase === 'action' && i === 1 && <TapPointer />}
                    </motion.div>
                  )
                })}
              </div>
            </div>
            <ResultBadge show={isResult(phase)} text="희귀 인형! +120점" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 3. 전설의 편의점 ─────────────── */
function FactoryDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/factory.png"
      metric={risingMetric({ emoji: '💰', base: 1500, gain: 500, suffix: '원' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 진열 기회를 얻었어요',
        '빈 칸에 상품을 진열해요',
        '판매 완료! 매출이 올라요',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="물건을 사고파는 곳은?"
            options={['가게', '학교', '병원', '공원']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit p-5">
              <div className="grid grid-cols-3 gap-3">
                {['/store/banana_milk.svg', '/store/chocolate.svg', '/store/kimbap.svg'].map((src, i) => {
                  const filled = i < 2 || isResult(phase) || phase === 'action'
                  const justAdded = i === 2
                  return (
                    <motion.div
                      key={src}
                      className={`relative flex h-24 items-center justify-center rounded-xl ${
                        justAdded && !filled ? 'border-2 border-dashed border-white/50 bg-white/10' : 'bg-white/85'
                      }`}
                      animate={justAdded && filled ? { scale: [0.6, 1.12, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      {filled && <Image src={src} alt="" width={56} height={56} className="h-14 w-14 object-contain" />}
                      {phase === 'action' && justAdded && <TapPointer />}
                    </motion.div>
                  )
                })}
              </div>
              {isResult(phase) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-center text-2xl">
                  🧑‍🦰 → 💰
                </motion.div>
              )}
            </div>
            <ResultBadge show={isResult(phase)} text="판매 완료! +500원" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 4. 달콤 바삭 카페 ─────────────── */
function CafeDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/cafe.png"
      metric={risingMetric({ emoji: '⭐', base: 40, gain: 30, suffix: '점' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 서빙 기회를 얻었어요',
        '손님이 주문한 메뉴를 서빙해요',
        '손님 만족! 점수 UP',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="아침에 자주 먹는 빵은?"
            options={['토스트', '벽돌', '연필', '신발']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit flex items-center justify-between gap-4 p-5">
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl">🧑</span>
                <div className="rounded-xl bg-white/85 px-3 py-1 text-sm font-black text-[#17262a]">🍔 주세요!</div>
              </div>
              <motion.div
                animate={isResult(phase) ? { x: 0, opacity: 1 } : { x: -30, opacity: 0.5 }}
                transition={{ duration: 0.6 }}
                className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/85"
              >
                <Image src="/cafe/burger.svg" alt="" width={64} height={64} className="h-14 w-14 object-contain" />
                {phase === 'action' && <TapPointer />}
              </motion.div>
              <span className="text-4xl">{isResult(phase) ? '😋' : '🙂'}</span>
            </div>
            <ResultBadge show={isResult(phase)} text="서빙 성공! +30점" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 5. 쉿! 마피아 ─────────────── */
function MafiaDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/mafia.png"
      metric={risingMetric({ emoji: '🔑', base: 60, gain: 50, suffix: '점' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 행동 기회를 얻었어요',
        '금고 털기와 조사 중 하나를 골라요',
        '금고 성공! 골드를 챙겨요',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="비밀을 지킬 때 내는 소리는?"
            options={['쉿', '와', '쾅', '딩동']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                animate={isResult(phase) ? { scale: 1.05 } : {}}
                className={`rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit relative flex flex-col items-center gap-2 p-5 ${
                  isResult(phase) ? 'ring-2 ring-amber-300' : ''
                }`}
              >
                <span className="text-4xl">{isResult(phase) ? '💰' : '🔓'}</span>
                <span className="text-sm font-black text-white">금고 털기</span>
                {phase === 'action' && <TapPointer />}
              </motion.div>
              <div className={`rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit flex flex-col items-center gap-2 p-5 ${isResult(phase) ? 'opacity-50' : ''}`}>
                <span className="text-4xl">🔍</span>
                <span className="text-sm font-black text-white">조사하기</span>
              </div>
            </div>
            <ResultBadge show={isResult(phase)} text="금고 성공! +50점" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 6. 점프점프 ─────────────── */
function DontLookDownDemo() {
  return (
    <TutorialDemoFrame
      backgroundClassName="bg-gradient-to-b from-sky-300 via-sky-400 to-indigo-500"
      metric={risingMetric({ emoji: '⛰️', base: 12, gain: 6, suffix: 'm' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 점프할 힘을 얻었어요',
        '다음 발판으로 점프해요',
        '한 칸 더 위로! 높이 기록 UP',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="위로 뛰어오르는 동작은?"
            options={['점프', '수면', '식사', '독서']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene className="max-w-xs">
            <div className="relative mx-auto h-64 w-48">
              {/* 발판 (아래→위) */}
              {[
                { x: 20, y: 200 },
                { x: 90, y: 130 },
                { x: 30, y: 60 },
              ].map((p, i) => (
                <div key={i} className="absolute" style={{ left: p.x, top: p.y }}>
                  <Image src={`/dontlookdown/platforms/${i + 2}.svg`} alt="" width={88} height={28} className="h-7 w-22 object-contain" />
                </div>
              ))}
              {/* 캐릭터: action=중간발판, result=위발판 */}
              <motion.div
                className="absolute h-12 w-12 overflow-hidden rounded-full bg-white/85 ring-2 ring-white"
                animate={isResult(phase) ? { left: 52, top: 22 } : { left: 36, top: 92 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
              >
                <Image src={PLAYER_IMAGE} alt={PLAYER_NAME} fill className="object-contain p-1" sizes="48px" />
              </motion.div>
            </div>
            <ResultBadge show={isResult(phase)} text="점프 성공! 18m 도달" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 7. 타워 디펜스 ─────────────── */
/**
 * 실제 게임 흐름 그대로 재현합니다.
 *   (lib/game/tower.ts · hooks/useTowerDefenseGame.ts · app/tower/page.tsx)
 * 장면 6개는 튜토리얼 규칙 6장과 1:1로 맞춰 두었습니다.
 * 선생님이 규칙을 넘기면 같은 번호의 장면이 뜹니다.
 * 화면에 나오는 숫자는 전부 상수에서 계산하므로 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */
const TOWER_QUIZ_GOLD = getQuizGoldRange().max // 가장 빨리 맞혔을 때 받는 골드
const TOWER_BUILD_COST = TOWER_TYPES.BASIC.cost // 화살 타워 설치비
const TOWER_LEAK_DAMAGE = ENEMY_TYPES.NORMAL.leakDamage // 적 하나가 출구로 나갔을 때 깎이는 체력

/** 골드는 정답(+) → 타워 설치(-) 순으로 오르내립니다. 실제 게임과 같은 흐름입니다. */
const TOWER_GOLD_AFTER_QUIZ = PLAYER_START_GOLD + TOWER_QUIZ_GOLD
const TOWER_GOLD_BY_PHASE: Record<string, { value: number; from?: number }> = {
  goal: { value: PLAYER_START_GOLD },
  leak: { value: PLAYER_START_GOLD },
  quiz: { value: PLAYER_START_GOLD },
  correct: { value: TOWER_GOLD_AFTER_QUIZ, from: PLAYER_START_GOLD },
  item: { value: TOWER_GOLD_AFTER_QUIZ },
  build: { value: TOWER_GOLD_AFTER_QUIZ - TOWER_BUILD_COST, from: TOWER_GOLD_AFTER_QUIZ },
}

/** 아이템 예시 3장 — 실제로는 getSkillChoices() 가 매번 3장을 무작위로 뽑아 줍니다. */
const TOWER_ITEM_IDS: SkillId[] = ['OVERCLOCK', 'BLIZZARD', 'HEAL']
const TOWER_PICKED_ITEM_INDEX = 1

/** 웨이브 퀴즈 진행 표시 — 실제 화면의 "웨이브 퀴즈 n/3" 과 같은 뜻 */
function WaveQuizCounter({ solved, goldGain }: { solved: number; goldGain?: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
      <div className="font-bitbit flex items-center gap-2.5 rounded-full bg-black/50 px-4 py-2 backdrop-blur">
        <span className="text-sm font-black text-white sm:text-base">
          웨이브 퀴즈 {solved}/{TOWER_QUIZZES_PER_WAVE}
        </span>
        <span className="flex items-center gap-1.5">
          {Array.from({ length: TOWER_QUIZZES_PER_WAVE }, (_, i) => (
            <motion.span
              key={i}
              animate={{ scale: i < solved ? 1 : 0.7 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className={`h-3 w-3 rounded-full ${i < solved ? 'bg-amber-400' : 'bg-white/30'}`}
            />
          ))}
        </span>
      </div>
      {goldGain !== undefined && (
        <motion.span
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16 }}
          className="font-bitbit rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-[#17262a] shadow-lg sm:text-base"
        >
          +{goldGain}골드
        </motion.span>
      )}
    </div>
  )
}

/** 적 한 마리 */
function RoadEnemy({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative h-12 w-12 ${className ?? ''}`} style={style}>
      <Image src="/tower/enemy/normal/normal.svg" alt="" fill className="object-contain" sizes="48px" />
    </div>
  )
}

/**
 * 잔디(세울 수 있는 곳) / 길(못 세우는 곳) 두 칸 무대.
 * 규칙 1·2·6 이 같은 무대를 쓰고 장면만 달라집니다.
 */
function TowerRoadScene({ mode }: { mode: 'goal' | 'leak' | 'build' }) {
  const isLeak = mode === 'leak'
  const isBuild = mode === 'build'
  const hp = isLeak ? PLAYER_START_HP - TOWER_LEAK_DAMAGE : PLAYER_START_HP

  return (
    <StageCard id="tower-road" className="w-full max-w-2xl">
      <div className="font-bitbit relative h-60 overflow-hidden rounded-3xl border border-white/25 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-md">
        {/* 실제 게임 화면 위쪽에 뜨는 표시와 같은 것 */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-black text-white/85">
            웨이브 1 / {WAVES.length}
          </span>
          <motion.span
            animate={isLeak ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={isLeak ? { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 } : undefined}
            className={`rounded-full px-3 py-1 text-xs font-black ${
              isLeak ? 'bg-rose-500 text-white' : 'bg-black/50 text-white/85'
            }`}
          >
            ❤️ 체력 {hp}
          </motion.span>
        </div>

        {/* 잔디 — 타워를 세울 수 있는 곳 */}
        <div className="mt-2 flex h-24 items-center gap-3 rounded-2xl bg-emerald-400/15 px-6">
          {isBuild ? (
            <>
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 15 }}
                className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/85 ring-2 ring-emerald-300"
              >
                <Image src="/tower/basic.svg" alt="" width={64} height={64} className="h-16 w-16 object-contain" />
                <TapPointer />
              </motion.div>
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-full bg-emerald-400 px-3 py-1.5 text-sm font-black text-[#17262a]"
              >
                여기는 세울 수 있어요
              </motion.span>
            </>
          ) : (
            <span className="text-sm font-black text-white/40">잔디 — 타워를 세우는 곳</span>
          )}
        </div>

        {/* 길 — 적이 지나가는 곳, 타워를 못 세웁니다 */}
        <div className="relative mt-2 flex h-20 items-center justify-between rounded-2xl border-2 border-dashed border-white/30 bg-white/10 px-3">
          <span className="z-10 rounded-full bg-emerald-500/80 px-2.5 py-1 text-xs font-black text-white">입구</span>
          <span className="z-10 rounded-full bg-rose-500/85 px-2.5 py-1 text-xs font-black text-white">출구</span>

          {/* 규칙 1 — 적이 줄지어 몰려옵니다 */}
          {mode === 'goal' && [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute left-14 top-1/2 -translate-y-1/2"
              animate={{ x: [0, 300] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', delay: i * 1.5 }}
            >
              <RoadEnemy />
            </motion.div>
          ))}

          {/* 규칙 2 — 적이 출구로 빠져나가면 체력이 깎입니다 */}
          {isLeak && (
            <>
              <motion.div
                className="absolute left-14 top-1/2 -translate-y-1/2"
                animate={{ x: [0, 330], opacity: [1, 1, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', times: [0, 0.85, 1] }}
              >
                <RoadEnemy />
              </motion.div>
              <motion.span
                className="absolute right-2 top-0 z-20 rounded-full bg-rose-500 px-3 py-1 text-sm font-black text-white shadow-lg"
                animate={{ opacity: [0, 0, 1, 1, 0], y: [0, 0, -14, -20, -26] }}
                transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.8, 0.88, 0.95, 1] }}
              >
                -{TOWER_LEAK_DAMAGE}
              </motion.span>
            </>
          )}

          {/* 규칙 6 — 길 위에는 못 세우고, 타워가 적을 막습니다 */}
          {isBuild && (
            <>
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55, type: 'spring', stiffness: 320, damping: 18 }}
                className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-4 py-1.5 text-sm font-black text-white shadow-lg"
              >
                ✕ 길 위에는 못 세워요
              </motion.span>
              <motion.div
                className="absolute left-14 top-1/2 -translate-y-1/2"
                animate={{ x: [0, 40, 40], scale: [1, 1, 0], rotate: [0, 0, 40], opacity: [1, 1, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.55, 0.75] }}
              >
                <RoadEnemy />
              </motion.div>
            </>
          )}
        </div>

        {/* 타워가 쏘는 화살 */}
        {isBuild && (
          <motion.div
            className="absolute left-[68px] top-[92px] h-6 w-6"
            animate={{ x: [0, 0, 60], y: [0, 0, 84], opacity: [0, 1, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.42, 0.62] }}
          >
            <Image src="/tower/projectile/arrow.svg" alt="" fill className="object-contain" sizes="24px" />
          </motion.div>
        )}
      </div>

      {isBuild && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 1.9 }}
          className="lg-banner-correct font-bitbit mx-auto mt-4 w-fit px-5 py-2 text-center text-base font-black text-white drop-shadow sm:text-lg"
        >
          막았어요! 출구까지 못 갔어요
        </motion.div>
      )}
    </StageCard>
  )
}

function TowerDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/tower-defense.png"
      metric={(phase) => ({
        emoji: '💰',
        value: TOWER_GOLD_BY_PHASE[phase]?.value ?? PLAYER_START_GOLD,
        from: TOWER_GOLD_BY_PHASE[phase]?.from,
        suffix: '골드',
      })}
      /* 규칙 6장과 1:1 — lib/game/tutorials.ts 의 tower 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'goal', duration: 2800, step: 1, caption: `웨이브 ${WAVES.length}번을 다 막으면 이겨요` },
        { key: 'leak', duration: 2800, step: 2, caption: `출구로 나가면 체력이 ${TOWER_LEAK_DAMAGE} 깎여요` },
        { key: 'quiz', duration: 2400, step: 3, caption: `웨이브 전에 퀴즈 ${TOWER_QUIZZES_PER_WAVE}문제!` },
        { key: 'correct', duration: 1800, step: 4, caption: `빨리 맞혀서 ${TOWER_QUIZ_GOLD}골드!` },
        { key: 'item', duration: 2400, step: 5, caption: `${TOWER_QUIZZES_PER_WAVE}문제 다 맞히면 아이템 하나` },
        { key: 'build', duration: 3400, step: 6, caption: '길을 피해 타워를 세워 적을 막아요' },
      ]}
    >
      {({ phase }) => {
        /* 3·4단계 — 웨이브를 시작하려면 퀴즈부터 다 풀어야 합니다 */
        if (phase === 'quiz' || phase === 'correct') {
          const answered = isAnswered(phase)
          return (
            <StageCard id="tower-quiz" className="w-full max-w-xl">
              <WaveQuizCounter
                solved={answered ? TOWER_QUIZZES_PER_WAVE : TOWER_QUIZZES_PER_WAVE - 1}
                goldGain={answered ? TOWER_QUIZ_GOLD : undefined}
              />
              <GlassQuizStep
                question="세종대왕이 만든 글자는?"
                options={['한글', '한자', '숫자', '그림']}
                correctIndex={0}
                answered={answered}
              />
            </StageCard>
          )
        }

        /* 5단계 — 세 문제를 모두 맞혔을 때만 아이템 3장이 나옵니다 */
        if (phase === 'item') {
          return (
            <StageCard id="tower-items" className="w-full max-w-xl">
              <div className="font-bitbit rounded-3xl border border-white/25 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
                <p className="mb-4 text-center text-base font-black text-amber-300">아이템 하나를 골라요</p>
                <div className="grid grid-cols-3 gap-3">
                  {TOWER_ITEM_IDS.map((id, i) => {
                    const skill = SKILLS[id]
                    const picked = i === TOWER_PICKED_ITEM_INDEX
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, y: 26 }}
                        animate={picked ? { opacity: 1, y: [26, 0, 0, -10] } : { opacity: 1, y: 0 }}
                        transition={
                          picked
                            ? { duration: 1.3, times: [0, 0.2, 0.62, 1] }
                            : { delay: i * 0.12, type: 'spring', stiffness: 280, damping: 22 }
                        }
                        className={`relative flex flex-col items-center gap-2 rounded-2xl p-4 ${
                          picked ? 'bg-white/90' : 'bg-white/20'
                        }`}
                      >
                        <span className={`flex h-14 w-14 items-center justify-center rounded-xl ${skill.color} text-3xl shadow-lg`}>
                          {skill.emoji}
                        </span>
                        <span className={`text-base font-black ${picked ? 'text-[#17262a]' : 'text-white'}`}>
                          {skill.name}
                        </span>
                        {picked && (
                          <motion.span
                            className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-300"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.85 }}
                          />
                        )}
                        {picked && <TapPointer />}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </StageCard>
          )
        }

        /* 1·2·6단계 — 길과 잔디를 보여주는 무대 */
        return <TowerRoadScene mode={phase === 'goal' ? 'goal' : phase === 'leak' ? 'leak' : 'build'} />
      }}
    </TutorialDemoFrame>
  )
}

/* ─────────────── 8. 좀비를 피해라! ─────────────── */
function ZombieDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/zombie/background.png"
      metric={risingMetric({ emoji: '⏱️', base: 40, gain: 10, suffix: '초' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 방어 카드를 얻었어요',
        '방패로 좀비의 공격을 막아요',
        '감염 차단! 생존 시간 UP',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="밤에 무덤에서 나온다는 것은?"
            options={['좀비', '나비', '햇님', '무지개']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit relative flex items-center justify-center gap-6 p-6">
              <motion.span className="text-5xl" animate={isResult(phase) ? { x: -10, opacity: 0.4 } : { x: 0 }}>
                🧟
              </motion.span>
              <motion.div
                animate={phase === 'action' ? { scale: [0.6, 1.15, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white/85"
              >
                <Image src="/zombie/shield.svg" alt="" width={72} height={72} className="h-18 w-18 object-contain" />
                {phase === 'action' && <TapPointer />}
              </motion.div>
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-white/85 ring-2 ring-white">
                <Image src={PLAYER_IMAGE} alt={PLAYER_NAME} fill className="object-contain p-1" sizes="56px" />
              </div>
            </div>
            <ResultBadge show={isResult(phase)} text="감염 차단! 생존 +10초" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 9. 간식런 ─────────────── */
function TreatRushDemo() {
  return (
    <TutorialDemoFrame
      backgroundClassName="bg-gradient-to-b from-orange-200 via-amber-300 to-yellow-200"
      metric={risingMetric({ emoji: '🦴', base: 100, gain: 50, suffix: '점' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 가속 부스터를 얻었어요',
        '장애물을 점프로 피해요',
        '간식 박스 획득! 점수 UP',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="강아지가 좋아하는 간식은?"
            options={['뼈다귀', '돌멩이', '지우개', '못']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit relative flex h-40 items-end justify-between p-5">
              <div className="h-1.5 w-full self-end rounded-full bg-white/40" style={{ position: 'absolute', bottom: 24, left: 0 }} />
              {/* 강아지 점프 */}
              <motion.div
                className="relative z-10 h-16 w-16 overflow-hidden rounded-full bg-white/85 ring-2 ring-white"
                animate={phase === 'action' ? { y: [-0, -46, 0] } : { y: 0 }}
                transition={{ duration: 0.9 }}
              >
                <Image src={PLAYER_IMAGE} alt={PLAYER_NAME} fill className="object-contain p-1" sizes="64px" />
              </motion.div>
              {/* 장애물 */}
              <motion.div className="relative z-10 h-12 w-12" animate={isResult(phase) ? { x: -180 } : { x: 0 }} transition={{ duration: 0.6 }}>
                <Image src="/mini-game/rock.svg" alt="" fill className="object-contain" sizes="48px" />
              </motion.div>
              {/* 간식 박스 */}
              <motion.span
                className="relative z-10 text-4xl"
                animate={isResult(phase) ? { scale: [1, 1.3, 0], y: -10 } : { scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                🎁
              </motion.span>
            </div>
            <ResultBadge show={isResult(phase)} text="간식 획득! +50점" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* ─────────────── 10. 강아지 대소동 ─────────────── */
function PoopDodgeDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/puppy-chaos.png"
      metric={risingMetric({ emoji: '⭐', base: 50, gain: 40, suffix: '점' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 카드 뽑기 기회를 얻었어요',
        '카드 한 장을 골라 뽑아요',
        '우산 획득! 공격을 막아요',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="비 올 때 쓰는 것은?"
            options={['우산', '부채', '장갑', '안경']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2].map((i) => {
                const picked = i === 1
                const revealed = isResult(phase) && picked
                return (
                  <motion.div
                    key={i}
                    animate={revealed ? { rotateY: 0, y: -16 } : {}}
                    className={`relative flex h-32 w-24 items-center justify-center rounded-2xl ${
                      revealed ? 'bg-white/90 ring-2 ring-amber-300' : 'bg-indigo-500/80'
                    } ${isResult(phase) && !picked ? 'opacity-50' : ''}`}
                  >
                    {revealed ? (
                      <Image src="/puppy-chaos/umbrella.svg" alt="" width={64} height={64} className="h-16 w-16 object-contain" />
                    ) : (
                      <span className="text-3xl text-white/90">?</span>
                    )}
                    {phase === 'action' && picked && <TapPointer />}
                  </motion.div>
                )
              })}
            </div>
            <ResultBadge show={isResult(phase)} text="우산 카드! 공격 방어" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

/* 레지스트리 — gold_quest 는 별도 컴포넌트(GoldQuestTutorialDemo)에서 처리 */
export const GAME_DEMO_REGISTRY: Partial<Record<GameModeId, ComponentType>> = {
  battle_royale: BattleRoyaleDemo,
  fishing: FishingDemo,
  factory: FactoryDemo,
  cafe: CafeDemo,
  mafia: MafiaDemo,
  dontlookdown: DontLookDownDemo,
  tower: TowerDemo,
  zombie: ZombieDemo,
  treat_rush: TreatRushDemo,
  poop_dodge: PoopDodgeDemo,
}
