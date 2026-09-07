'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Replace, Sparkles, Zap } from 'lucide-react'
import {
  GACHA_TIER_CHANCE,
  GRID_SIZE,
  PRODUCT_OPTION_COUNT,
  PRODUCT_POOL,
  QUIZZES_PER_PRODUCT,
  QUIZ_TIME_LIMIT,
  calculateProductIncome,
  calculateTickIncome,
  calculateTotalCPS,
  formatMoney,
  formatProductIncomeRate,
  getCategorySynergy,
  getMaxReachableSynergy,
  getSpeedBonus,
  getTierColor,
  roundMoney,
  type AnswerSpeed,
  type Product,
  type ProductCategory,
  type ProductTier,
} from '@/lib/game/convenienceStore'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  PLAYER_NAME,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 전설의 편의점 튜토리얼 데모.
 *   (lib/game/convenienceStore.ts · app/factory/page.tsx · components/ConvenienceStore.tsx)
 * 장면 8개는 튜토리얼 규칙 8장과 1:1로 맞춰 두었습니다.
 * 선생님이 규칙을 넘기면 같은 번호의 장면이 뜹니다.
 * 화면에 나오는 숫자·낱말은 전부 실제 상수와 계산 함수에서 가져오므로
 * 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

/** 상품 원본에서 실제 게임과 같은 모양의 상품 하나를 만든다 */
function makeProduct(baseId: string): Product {
  const base = PRODUCT_POOL.find((product) => product.baseId === baseId) ?? PRODUCT_POOL[0]
  return { ...base, id: baseId, level: 1, sellPrice: roundMoney(base.income * 10) }
}

/** 등급별 대표 상품 — 그 등급에서 한 번에 가장 많이 버는 상품 */
function topProductOfTier(tier: ProductTier): Product {
  const best = PRODUCT_POOL.filter((product) => product.tier === tier).reduce((a, b) => (b.income > a.income ? b : a))
  return makeProduct(best.baseId)
}

/** 정답 속도별 등급 확률(%). 일반은 나머지 전부라 따로 계산한다. */
function tierChance(speed: AnswerSpeed, tier: ProductTier): number {
  const chance = GACHA_TIER_CHANCE[speed]
  if (tier === '일반') return 100 - chance.전설 - chance.영웅 - chance.희귀
  return chance[tier]
}

const TIERS: ProductTier[] = ['전설', '영웅', '희귀', '일반']
const CATEGORIES: ProductCategory[] = ['식품', '음료', '간식', '프리미엄']

/** 데모에서 문제를 푸는 데 걸린 시간 — 빠른 정답 구간 안쪽 */
const ANSWER_SECONDS = 7
const SPEED_BONUS = getSpeedBonus(ANSWER_SECONDS * 1000, QUIZ_TIME_LIMIT)

/** 규칙 3 — 상품 도착 모달에 뜨는 후보들. 가운데(희귀)가 이 중 가장 좋은 상품이다. */
const PICK_OPTIONS = ['p4', 'p6', 'p3'].map(makeProduct)
const PICKED_INDEX = 1

/** 규칙 4 — 고른 상품(컵라면)까지 진열한 초반 매대 */
const START_SHELF = ['p1', 'p5', 'p2', 'p6'].map(makeProduct)
const START_SHELF_NEW_INDEX = START_SHELF.length - 1
const START_SHELF_CPS = roundMoney(calculateTotalCPS(START_SHELF))
/** 4초째 틱 — 초반 매대의 상품이 모두 한 번에 돈을 내는 순간 */
const START_SHELF_TICK = calculateTickIncome(START_SHELF, 4)

/** 규칙 6 — 9칸이 꽉 찬 매대와, 가장 적게 버는 칸(생수) */
const FULL_SHELF = ['p1', 'p5', 'p8', 'p2', 'p6', 'p7', 'p10', 'p4', 'p9'].map(makeProduct)
const REPLACE_INDEX = 0
/** 교체해서 넣을 새 상품 — 전설 떡볶이 */
const NEW_PRODUCT = makeProduct('p13')

/** 규칙 7 — 교체를 마친 매대. 식품이 하나 늘어 시너지가 올라간다. */
const SYNERGY_SHELF = FULL_SHELF.map((product, index) => (index === REPLACE_INDEX ? NEW_PRODUCT : product))
const SYNERGY_BEFORE = getCategorySynergy('식품', FULL_SHELF)
const SYNERGY_AFTER = getCategorySynergy('식품', SYNERGY_SHELF)
const MAX_SYNERGY = getMaxReachableSynergy()

/** 총 매출은 속도 보너스와 자동 수익이 들어올 때 한 번씩 오른다 */
const BASE_MONEY = 12000
const MONEY_AFTER_BONUS = BASE_MONEY + SPEED_BONUS
const MONEY_AFTER_TICK = MONEY_AFTER_BONUS + START_SHELF_TICK
const MONEY_BY_PHASE: Record<string, { value: number; from?: number }> = {
  quiz: { value: BASE_MONEY },
  correct: { value: MONEY_AFTER_BONUS, from: BASE_MONEY },
  product: { value: MONEY_AFTER_BONUS },
  shelf: { value: MONEY_AFTER_TICK, from: MONEY_AFTER_BONUS },
  tier: { value: MONEY_AFTER_TICK },
  replace: { value: MONEY_AFTER_TICK },
  synergy: { value: MONEY_AFTER_TICK },
  score: { value: MONEY_AFTER_TICK },
}

/** 매대 한 칸 — 실제 진열대 슬롯과 같은 모양 */
function ShelfSlot({
  product,
  shelf,
  highlight,
  showIncome,
}: {
  product: Product | null
  shelf: Product[]
  highlight?: 'new' | 'replace'
  showIncome?: boolean
}) {
  if (!product) {
    return (
      <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-dashed border-white/30 bg-white/10 text-[11px] font-bold text-white/50">
        빈 매대
      </div>
    )
  }

  return (
    <motion.div
      initial={highlight === 'new' ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className={`relative flex h-[72px] items-center gap-2 overflow-hidden rounded-xl border-2 px-2 ${product.color} ${
        highlight === 'replace' ? 'border-amber-400 ring-2 ring-amber-300' : product.borderColor
      }`}
    >
      <span
        className={`absolute right-1 top-1 rounded-full px-1.5 text-[8px] font-black text-white shadow-sm ${getTierColor(product.tier)}`}
      >
        {product.tier}
      </span>
      <Image src={product.image} alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0 object-contain" />
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold text-slate-500">{product.name}</p>
        <p className="text-[11px] font-black text-slate-800">{formatProductIncomeRate(product, shelf)}</p>
      </div>

      {/* 수익이 들어올 때 뜨는 초록 숫자 — 실제 화면과 같은 연출 */}
      {showIncome && (
        <motion.span
          className="pointer-events-none absolute bottom-1 right-1 text-[11px] font-black text-emerald-600"
          animate={{ opacity: [0, 1, 1, 0], y: [4, -6, -10, -16] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.4 }}
        >
          +{formatMoney(calculateProductIncome(product, shelf))}
        </motion.span>
      )}

      {highlight === 'replace' && <TapPointer />}
    </motion.div>
  )
}

/** 매대 3×3 */
function Shelf({
  shelf,
  highlightIndex,
  highlightKind,
  showIncome,
}: {
  shelf: Product[]
  highlightIndex?: number
  highlightKind?: 'new' | 'replace'
  showIncome?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: GRID_SIZE }, (_, index) => (
        <ShelfSlot
          key={index}
          product={shelf[index] ?? null}
          shelf={shelf}
          highlight={index === highlightIndex ? highlightKind : undefined}
          showIncome={showIncome}
        />
      ))}
    </div>
  )
}

/** 어두운 무대 위에 올리는 편의점 패널 */
function StorePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-bitbit rounded-3xl border border-white/25 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-md">
      {children}
    </div>
  )
}

/** 규칙 1·2 — 퀴즈 위에 뜨는 정답 카운터와 속도 보너스 */
function QuizScene({ answered }: { answered: boolean }) {
  return (
    <StageCard id="factory-quiz" className="w-full max-w-xl">
      <div className="font-bitbit mb-3 flex flex-wrap items-center justify-center gap-2">
        <div className="rounded-full bg-black/50 px-4 py-2 backdrop-blur">
          <span className="text-sm font-black text-white sm:text-base">
            {answered ? '상품 도착!' : '다음 상품까지 1 문제'}
          </span>
        </div>
        {answered ? (
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 16 }}
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-[#17262a] shadow-lg sm:text-base"
          >
            +{formatMoney(SPEED_BONUS)} 속도 보너스!
          </motion.span>
        ) : (
          <span className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-black text-white shadow-lg sm:text-base">
            틀리면 돈을 잃어요
          </span>
        )}
      </div>
      <GlassQuizStep
        question="물건을 사고파는 곳은?"
        options={['가게', '학교', '병원', '공원']}
        correctIndex={0}
        answered={answered}
      />
    </StageCard>
  )
}

/** 규칙 3 — 상품 도착! 셋 중 하나 고르기 */
function PickScene() {
  return (
    <StageCard id="factory-pick" className="w-full max-w-2xl">
      <StorePanel>
        <div className="mb-3 text-center">
          <h3 className="flex items-center justify-center gap-2 text-lg font-black text-white sm:text-xl">
            <Sparkles className="h-5 w-5 text-yellow-300" /> 상품 도착! 하나를 고르세요
          </h3>
          <p className="text-xs font-bold text-white/70">높은 등급일수록 더 많은 돈을 법니다</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {PICK_OPTIONS.map((product, index) => {
            const picked = index === PICKED_INDEX
            return (
              <motion.div
                key={product.id}
                animate={{ scale: picked ? 1.04 : 1, opacity: picked ? 1 : 0.65 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 20 }}
                className={`relative flex flex-col items-center gap-1 rounded-2xl border-4 p-3 ${product.color} ${
                  picked ? 'border-amber-400 shadow-lg' : product.borderColor
                }`}
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black text-white ${getTierColor(product.tier)}`}
                >
                  {product.tier}
                </span>
                <Image src={product.image} alt="" width={52} height={52} className="h-[52px] w-[52px] object-contain" />
                <p className="text-sm font-black text-slate-800">{product.name}</p>
                <p className="text-xs font-black text-slate-600">{formatProductIncomeRate(product)}</p>
                {picked && <TapPointer />}
              </motion.div>
            )
          })}
        </div>
      </StorePanel>
    </StageCard>
  )
}

/** 규칙 4 — 진열한 상품이 알아서 버는 돈 */
function ShelfScene() {
  return (
    <StageCard id="factory-shelf" className="w-full max-w-lg">
      <StorePanel>
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-black text-white/85">
            진열 상품 수 {START_SHELF.length} / {GRID_SIZE}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 text-xs font-black text-[#17262a]">
            <Zap className="h-3.5 w-3.5" /> +{formatMoney(START_SHELF_CPS)} /초
          </span>
        </div>
        <Shelf shelf={START_SHELF} highlightIndex={START_SHELF_NEW_INDEX} highlightKind="new" showIncome />
      </StorePanel>
    </StageCard>
  )
}

/** 규칙 5 — 등급이 오르면 수익도 확률도 달라진다 */
function TierScene() {
  const topIncome = topProductOfTier('전설').income

  return (
    <StageCard id="factory-tier" className="w-full max-w-xl">
      <StorePanel>
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-black text-white/70">
          <span>등급별 대표 상품</span>
          <span>평소 → 빨리 맞혔을 때</span>
        </div>
        <div className="space-y-2">
          {TIERS.map((tier, index) => {
            const product = topProductOfTier(tier)
            const normal = tierChance('normal', tier)
            const fast = tierChance('fast', tier)
            const up = fast > normal
            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="flex items-center gap-2 rounded-xl bg-white/90 px-2 py-1.5"
              >
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black text-white ${getTierColor(tier)}`}>
                  {tier}
                </span>
                <Image src={product.image} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
                <span className="w-20 shrink-0 truncate text-[11px] font-bold text-slate-600">{product.name}</span>

                {/* 수익 막대 — 한 번에 버는 금액이 등급마다 얼마나 차이 나는지 */}
                <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <motion.div
                    className={`h-full rounded-full ${getTierColor(tier)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(product.income / topIncome) * 100}%` }}
                    transition={{ delay: 0.15 + index * 0.08, duration: 0.5 }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-[11px] font-black text-slate-800">
                  {formatProductIncomeRate(product)}
                </span>
                <span
                  className={`w-20 shrink-0 text-right text-[11px] font-black ${up ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {normal}% → {fast}%
                </span>
              </motion.div>
            )
          })}
        </div>
      </StorePanel>
    </StageCard>
  )
}

/** 규칙 6 — 9칸이 꽉 차면 적게 버는 칸을 교체 */
function ReplaceScene() {
  return (
    <StageCard id="factory-replace" className="w-full max-w-lg">
      <StorePanel>
        <div className="mb-2 flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-2.5 py-2">
          <Replace className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-[11px] font-black text-amber-900">매대가 꽉 찼습니다. 교체할 상품을 고르세요.</p>
            <p className="truncate text-[10px] font-bold text-amber-700">
              새 상품: {NEW_PRODUCT.name} · {formatProductIncomeRate(NEW_PRODUCT)}
            </p>
          </div>
        </div>
        <Shelf shelf={FULL_SHELF} highlightIndex={REPLACE_INDEX} highlightKind="replace" />
      </StorePanel>
    </StageCard>
  )
}

/** 규칙 7 — 같은 종류를 모으면 붙는 배수 */
function SynergyScene() {
  return (
    <StageCard id="factory-synergy" className="w-full max-w-sm">
      <StorePanel>
        <p className="mb-2 text-center text-sm font-black text-white">카테고리 시너지</p>
        <div className="space-y-1.5">
          {CATEGORIES.map((category, index) => {
            const count = SYNERGY_SHELF.filter((product) => product.category === category).length
            const synergy = getCategorySynergy(category, SYNERGY_SHELF)
            const grew = category === '식품' && SYNERGY_AFTER > SYNERGY_BEFORE
            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                  grew ? 'bg-amber-400 text-[#17262a]' : 'bg-white/90 text-slate-700'
                }`}
              >
                <span className="text-xs font-black">{category}</span>
                <span className="text-sm font-black tabular-nums">
                  {count}개 × {synergy.toFixed(1)}
                  {grew && <span className="ml-1 text-[11px]">↑</span>}
                </span>
              </motion.div>
            )
          })}
        </div>
        <p className="mt-2 text-center text-[11px] font-bold text-white/70">
          {GRID_SIZE}칸을 한 종류로 채우면 최대 {MAX_SYNERGY.toFixed(1)}배
        </p>
      </StorePanel>
    </StageCard>
  )
}

export default function FactoryTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/factory.png"
      metric={(phase) => ({
        emoji: '💰',
        value: MONEY_BY_PHASE[phase]?.value ?? MONEY_AFTER_TICK,
        from: MONEY_BY_PHASE[phase]?.from,
        suffix: '원',
      })}
      /* 규칙 8장과 1:1 — lib/game/tutorials.ts 의 factory 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 2400, step: 1, caption: '퀴즈를 맞혀야 돈도 상품도 생겨요' },
        {
          key: 'correct',
          duration: 2400,
          step: 2,
          caption: `${ANSWER_SECONDS}초 만에 정답! +${formatMoney(SPEED_BONUS)}`,
        },
        {
          key: 'product',
          duration: 3200,
          step: 3,
          caption: `${QUIZZES_PER_PRODUCT}문제 정답 — ${PRODUCT_OPTION_COUNT}개 중 하나를 골라요`,
        },
        {
          key: 'shelf',
          duration: 3400,
          step: 4,
          caption: `진열해 두면 알아서 벌어요 — 초당 ${formatMoney(START_SHELF_CPS)}`,
        },
        { key: 'tier', duration: 3800, step: 5, caption: '등급이 높을수록 수익도 확률도 커져요' },
        { key: 'replace', duration: 3400, step: 6, caption: `${GRID_SIZE}칸이 꽉 차면 적게 버는 칸을 교체해요` },
        {
          key: 'synergy',
          duration: 3200,
          step: 7,
          caption: `같은 종류를 모으면 수익 ×${SYNERGY_AFTER.toFixed(1)}`,
        },
        { key: 'score', duration: 3000, step: 8, caption: '끝날 때 가진 돈으로 순위를 정해요' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz' || phase === 'correct') return <QuizScene answered={phase === 'correct'} />
        if (phase === 'product') return <PickScene />
        if (phase === 'shelf') return <ShelfScene />
        if (phase === 'tier') return <TierScene />
        if (phase === 'replace') return <ReplaceScene />
        if (phase === 'synergy') return <SynergyScene />
        return (
          <MiniLeaderboard
            rows={[
              { name: PLAYER_NAME, value: MONEY_AFTER_TICK, me: true },
              { name: '밥톨이', value: roundMoney(MONEY_AFTER_TICK * 0.78) },
              { name: '알밤이', value: roundMoney(MONEY_AFTER_TICK * 0.55) },
            ]}
            suffix="원"
          />
        )
      }}
    </TutorialDemoFrame>
  )
}
