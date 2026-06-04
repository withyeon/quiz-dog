'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { ComponentType } from 'react'
import type { GameModeId } from '@/lib/game/modes'
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
        '정답! 눈덩이를 손에 넣었어요',
        '상대를 조준해 눈덩이를 던져요',
        '명중! 상대 체력이 깎여요',
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
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit flex items-center justify-between gap-3 p-5">
              <Fighter name={PLAYER_NAME} img={PLAYER_IMAGE} hp={100} />
              <motion.div
                className="text-4xl"
                initial={{ x: -40, opacity: 0 }}
                animate={isResult(phase) ? { x: 60, opacity: [1, 1, 0] } : { x: -40, opacity: 1 }}
                transition={{ duration: 0.7 }}
              >
                ❄️
              </motion.div>
              <Fighter name="시골이" img="/assets/icons/mascot_sigol-64.png" hp={isResult(phase) ? 65 : 100} hit={isResult(phase)} />
            </div>
            <ResultBadge show={isResult(phase)} text="명중! -35 체력" />
          </Scene>
        )
      }
    </TutorialDemoFrame>
  )
}

function Fighter({ name, img, hp, hit }: { name: string; img: string; hp: number; hit?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        animate={hit ? { x: [0, -6, 6, -3, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="relative h-16 w-16 overflow-hidden rounded-full bg-white/80 ring-2 ring-white/70"
      >
        <Image src={img} alt={name} fill className="object-contain p-1" sizes="64px" />
      </motion.div>
      <span className="text-xs font-black text-white drop-shadow">{name}</span>
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
function TowerDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/tower-defense.png"
      metric={risingMetric({ emoji: '⭐', base: 30, gain: 20, suffix: '점' })}
      phases={buildPhases([
        '퀴즈를 맞혀요',
        '정답! 타워 설치권을 얻었어요',
        '길목에 타워를 설치해요',
        '적 처치! 방어 성공',
      ])}
    >
      {({ phase }) =>
        phase === 'quiz' || phase === 'correct' ? (
          <GlassQuizStep
            question="성을 지키는 높은 건물은?"
            options={['타워', '풍선', '연못', '구름']}
            correctIndex={0}
            answered={isAnswered(phase)}
          />
        ) : (
          <Scene>
            <div className="rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md font-bitbit relative flex h-40 items-center justify-between p-5">
              {/* 타워 */}
              <motion.div
                animate={phase === 'action' ? { scale: [0.5, 1.15, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white/85"
              >
                <Image src="/tower/basic.svg" alt="" width={72} height={72} className="h-18 w-18 object-contain" />
                {phase === 'action' && <TapPointer />}
              </motion.div>
              {/* 투사체 */}
              <motion.div
                className="text-2xl"
                animate={isResult(phase) ? { x: [0, 80], opacity: [1, 0] } : { x: 0, opacity: 0 }}
                transition={{ duration: 0.6 }}
              >
                ⭐
              </motion.div>
              {/* 적 */}
              <motion.div
                animate={isResult(phase) ? { scale: 0, rotate: 40 } : { scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="relative h-16 w-16"
              >
                <Image src="/tower/enemy/normal.svg" alt="" fill className="object-contain" sizes="64px" />
              </motion.div>
            </div>
            <ResultBadge show={isResult(phase)} text="적 처치! +20점" />
          </Scene>
        )
      }
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
