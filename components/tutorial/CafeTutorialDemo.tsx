'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import {
  ADVERTISING_SPEED_MULTIPLIER,
  CUSTOMER_PATIENCE_SECONDS,
  MENU_ITEMS,
  STARTER_MENU_ID,
  UPGRADES,
  formatCafeMoney,
  formatCafeMoneyDelta,
  type MenuItem,
} from '@/lib/game/cafe'
import { MAX_CUSTOMERS_IN_LINE } from '@/lib/game/cafeConfig'
import {
  CAFE_ITEMS,
  GOLDEN_SPATULA_MULTIPLIER,
  ITEM_CHOICE_COUNT,
  RARE_ITEM_STREAK,
  type CafeItem,
} from '@/lib/game/cafeItems'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  PLAYER_NAME,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 달콤 바삭 카페 튜토리얼 데모.
 *   (lib/game/cafe.ts · cafeItems.ts · components/CafeView.tsx)
 * 장면 8개는 튜토리얼 규칙 8장과 1:1로 맞춰 두었습니다.
 * 화면에 나오는 숫자·낱말은 전부 실제 상수에서 가져오므로
 * 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

const TOAST = MENU_ITEMS.find((menu) => menu.id === STARTER_MENU_ID) ?? MENU_ITEMS[0]
const CEREAL = MENU_ITEMS.find((menu) => menu.id === 'cereal') ?? MENU_ITEMS[1]
const BURGER = MENU_ITEMS.reduce((best, menu) => (menu.sellPrice > best.sellPrice ? menu : best))
const ADVERTISING = UPGRADES.find((upgrade) => upgrade.id === 'advertising') ?? UPGRADES[0]

const TOAST_PRICE = TOAST.sellPrice
const GOLDEN_EARN = TOAST_PRICE * GOLDEN_SPATULA_MULTIPLIER

const BASE_MONEY = 12_000
const MONEY_AFTER_SERVE = BASE_MONEY + TOAST_PRICE
const MONEY_AFTER_GOLDEN = MONEY_AFTER_SERVE + GOLDEN_EARN

const MONEY_BY_PHASE: Record<string, { value: number; from?: number }> = {
  quiz: { value: BASE_MONEY },
  restock: { value: BASE_MONEY },
  item: { value: BASE_MONEY },
  serve: { value: MONEY_AFTER_SERVE, from: BASE_MONEY },
  patience: { value: MONEY_AFTER_SERVE },
  rare: { value: MONEY_AFTER_GOLDEN, from: MONEY_AFTER_SERVE },
  shop: { value: MONEY_AFTER_GOLDEN },
  score: { value: MONEY_AFTER_GOLDEN },
}

const ITEM_PICKS: CafeItem[] = [CAFE_ITEMS.EXPRESS_LANE, CAFE_ITEMS.GOLDEN_SPATULA, CAFE_ITEMS.BAD_REVIEW]
const PICKED_ITEM = CAFE_ITEMS.GOLDEN_SPATULA

const DEMO_CUSTOMERS: { image: string; menu: MenuItem; patience: number }[] = [
  { image: '/character/webp/1.webp', menu: TOAST, patience: 0.82 },
  { image: '/character/webp/5.webp', menu: CEREAL, patience: 0.48 },
  { image: '/character/webp/8.webp', menu: BURGER, patience: 0.16 },
]

function CafePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-bitbit rounded-3xl border border-white/25 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-md">
      {children}
    </div>
  )
}

function MenuIcon({ menu, size }: { menu: MenuItem; size: number }) {
  return (
    <Image
      src={menu.image}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="object-contain"
      style={{ width: size, height: size }}
    />
  )
}

function PatienceBar({ ratio }: { ratio: number }) {
  const color = ratio > 0.5 ? 'bg-emerald-400' : ratio > 0.3 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: '100%' }}
        animate={{ width: `${Math.max(8, ratio * 100)}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  )
}

function CustomerCard({
  image,
  menu,
  patience,
  highlight,
  showEarn,
}: {
  image: string
  menu: MenuItem
  patience: number
  highlight?: boolean
  showEarn?: boolean
}) {
  const secondsLeft = Math.max(1, Math.ceil(patience * CUSTOMER_PATIENCE_SECONDS))
  return (
    <div className="relative flex w-[104px] flex-col items-center">
      <div className="relative h-14 w-14 overflow-hidden rounded-full bg-white/90">
        <Image src={image} alt="" fill unoptimized className="object-contain" sizes="56px" />
      </div>
      <motion.div
        animate={highlight ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 1.2, repeat: Infinity }}
        className={`relative mt-1 w-full rounded-2xl border-4 bg-white px-2 py-2 text-center shadow-lg ${
          highlight ? 'border-amber-400' : patience < 0.3 ? 'border-red-400 bg-red-50' : 'border-amber-300'
        }`}
      >
        <div className="flex justify-center">
          <MenuIcon menu={menu} size={40} />
        </div>
        <p className="mt-0.5 text-[11px] font-black text-slate-800">{menu.name}</p>
        <p className="text-[10px] font-bold text-emerald-600">{formatCafeMoneyDelta(menu.sellPrice)}</p>
        {highlight && <TapPointer />}
        {showEarn && (
          <motion.span
            className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#17262a] shadow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 16 }}
          >
            {formatCafeMoneyDelta(TOAST_PRICE)}
          </motion.span>
        )}
      </motion.div>
      <PatienceBar ratio={patience} />
      <p className="mt-0.5 text-[10px] font-bold text-white/80">{secondsLeft}초</p>
    </div>
  )
}

function QuizScene({ answered }: { answered: boolean }) {
  return (
    <StageCard id="cafe-quiz" className="w-full max-w-xl">
      <div className="font-bitbit mb-3 flex flex-wrap items-center justify-center gap-2">
        <div
          className={`rounded-full px-4 py-2 text-sm font-black shadow-lg sm:text-base ${
            answered ? 'bg-emerald-400 text-[#17262a]' : 'bg-[#88D1E7] text-[#1a5f8f]'
          }`}
        >
          {answered ? `✅ 정답! 🍽️ ${TOAST.name} 재고 충전!` : '🍽️ 음식 채우기  스페이스바'}
        </div>
      </div>
      <GlassQuizStep
        question="아침에 자주 먹는 빵은?"
        options={['토스트', '벽돌', '연필', '신발']}
        correctIndex={0}
        answered={answered}
      />
    </StageCard>
  )
}

function ItemScene() {
  return (
    <StageCard id="cafe-item" className="w-full max-w-2xl">
      <CafePanel>
        <div className="mb-3 text-center">
          <h3 className="text-lg font-black text-white sm:text-xl">
            ✅ 정답! 🍽️ {TOAST.name} 재고 충전!
          </h3>
          <p className="text-xs font-bold text-white/70">{ITEM_CHOICE_COUNT}개 중에서 하나만 골라요</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ITEM_PICKS.map((item) => {
            const picked = item.id === PICKED_ITEM.id
            const isBuff = item.type === 'buff'
            return (
              <motion.div
                key={item.id}
                animate={{ scale: picked ? 1.04 : 1, opacity: picked ? 1 : 0.7 }}
                className={`relative flex min-h-[132px] flex-col items-center gap-1 rounded-2xl border-4 p-2.5 ${
                  isBuff ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50'
                } ${item.rarity === 'rare' ? 'ring-2 ring-amber-400' : ''}`}
              >
                <span className="text-3xl">{item.emoji}</span>
                <p className="text-center text-sm font-black text-slate-900">{item.name}</p>
                <p className="text-center text-[10px] font-bold leading-tight text-slate-600">{item.description}</p>
                {item.rarity === 'rare' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                    ✨ 희귀
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isBuff ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                  }`}
                >
                  {isBuff ? '🟢 나에게 좋아요' : '🔴 상대 방해'}
                </span>
                {picked && <TapPointer />}
              </motion.div>
            )
          })}
        </div>
      </CafePanel>
    </StageCard>
  )
}

function ServeScene() {
  return (
    <StageCard id="cafe-serve" className="w-full max-w-lg">
      <CafePanel>
        <div className="flex items-end justify-center gap-3 py-2">
          <CustomerCard
            image={DEMO_CUSTOMERS[0].image}
            menu={TOAST}
            patience={0.7}
            highlight
            showEarn
          />
        </div>
            <p className="mt-3 text-center text-sm font-black text-amber-300">
          {TOAST.name} 서빙! {formatCafeMoneyDelta(TOAST_PRICE)}
        </p>
      </CafePanel>
    </StageCard>
  )
}

function PatienceScene() {
  return (
    <StageCard id="cafe-patience" className="w-full max-w-xl">
      <CafePanel>
        <p className="mb-2 text-center text-xs font-black text-white/80">
          줄 {MAX_CUSTOMERS_IN_LINE}명 · {CUSTOMER_PATIENCE_SECONDS}초 안에 서빙해요
        </p>
        <div className="flex items-end justify-center gap-2">
          {DEMO_CUSTOMERS.map((customer) => (
            <CustomerCard
              key={customer.image}
              image={customer.image}
              menu={customer.menu}
              patience={customer.patience}
            />
          ))}
        </div>
      </CafePanel>
    </StageCard>
  )
}

function RareScene() {
  return (
    <StageCard id="cafe-rare" className="w-full max-w-sm">
      <CafePanel>
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow">
            🔥 {RARE_ITEM_STREAK}연속 정답
          </span>
          <span className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-black text-amber-950 shadow">
            {CAFE_ITEMS.GOLDEN_SPATULA.emoji} {GOLDEN_SPATULA_MULTIPLIER}배
          </span>
        </div>
        <div className="flex justify-center">
          <CustomerCard image={DEMO_CUSTOMERS[0].image} menu={TOAST} patience={0.7} highlight />
        </div>
        <p className="mt-2 text-center text-sm font-black text-amber-300">
          {CAFE_ITEMS.GOLDEN_SPATULA.name} 서빙! {formatCafeMoneyDelta(GOLDEN_EARN)}
        </p>
      </CafePanel>
    </StageCard>
  )
}

function ShopScene() {
  const shopMenus = [TOAST, CEREAL, BURGER]
  return (
    <StageCard id="cafe-shop" className="w-full max-w-xl">
      <CafePanel>
        <div className="mb-2 flex items-center justify-center gap-2 text-white">
          <ShoppingCart className="h-4 w-4" />
          <p className="text-sm font-black">상점 · 메뉴 잠금 해제</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {shopMenus.map((menu) => {
            const unlocked = menu.id === TOAST.id
            const canBuy = menu.id === CEREAL.id
            return (
              <div
                key={menu.id}
                className={`relative flex flex-col items-center gap-1 rounded-2xl border-4 p-2 ${
                  unlocked
                    ? 'border-emerald-400 bg-emerald-50'
                    : canBuy
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 bg-gray-100'
                }`}
              >
                <MenuIcon menu={menu} size={44} />
                <p className="text-sm font-black text-slate-800">{menu.name}</p>
                <p className="text-[10px] font-bold text-amber-700">
                  {unlocked ? '해금됨' : formatCafeMoney(menu.cost)}
                </p>
                <p className="text-[10px] font-black text-emerald-700">팔면 {formatCafeMoney(menu.sellPrice)}</p>
                {canBuy && (
                  <>
                    <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-black text-white">
                      잠금 해제!
                    </span>
                    <TapPointer />
                  </>
                )}
                {!unlocked && !canBuy && (
                  <span className="rounded-full bg-gray-400 px-2 py-0.5 text-[10px] font-black text-white">돈 부족</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 rounded-xl bg-white/90 px-3 py-2">
          <p className="text-xs font-black text-slate-800">{ADVERTISING.name}</p>
          <p className="text-[11px] font-bold text-slate-600">
            손님 {ADVERTISING_SPEED_MULTIPLIER}배 · {formatCafeMoney(ADVERTISING.cost)}
          </p>
        </div>
      </CafePanel>
    </StageCard>
  )
}

export default function CafeTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/cafe.webp"
      metric={(phase) => ({
        emoji: '💰',
        value: MONEY_BY_PHASE[phase]?.value ?? MONEY_AFTER_GOLDEN,
        from: MONEY_BY_PHASE[phase]?.from,
        suffix: '원',
      })}
      phases={[
        { key: 'quiz', duration: 2400, step: 1, caption: '음식 채우기를 눌러 퀴즈를 풀어요' },
        { key: 'restock', duration: 2400, step: 2, caption: `정답! ${TOAST.name} 재고가 채워져요` },
        {
          key: 'item',
          duration: 3200,
          step: 3,
          caption: `아이템 ${ITEM_CHOICE_COUNT}개 중 하나 — 나에게 좋거나 상대 방해`,
        },
        { key: 'serve', duration: 3000, step: 4, caption: `손님을 누르면 ${TOAST.name}를 서빙해요` },
        {
          key: 'patience',
          duration: 3000,
          step: 5,
          caption: `${CUSTOMER_PATIENCE_SECONDS}초가 지나면 손님이 가 버려요`,
        },
        {
          key: 'rare',
          duration: 3200,
          step: 6,
          caption: `${RARE_ITEM_STREAK}연속이면 ${CAFE_ITEMS.GOLDEN_SPATULA.name} — 다음 서빙 ${GOLDEN_SPATULA_MULTIPLIER}배`,
        },
        {
          key: 'shop',
          duration: 3400,
          step: 7,
          caption: `${BURGER.name}는 한 개에 ${BURGER.sellPrice.toLocaleString()}원`,
        },
        { key: 'score', duration: 3000, step: 8, caption: '끝날 때 가진 돈으로 순위를 정해요' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz' || phase === 'restock') return <QuizScene answered={phase === 'restock'} />
        if (phase === 'item') return <ItemScene />
        if (phase === 'serve') return <ServeScene />
        if (phase === 'patience') return <PatienceScene />
        if (phase === 'rare') return <RareScene />
        if (phase === 'shop') return <ShopScene />
        return (
          <MiniLeaderboard
            rows={[
              { name: PLAYER_NAME, value: MONEY_AFTER_GOLDEN, me: true },
              { name: '밥톨이', value: Math.round(MONEY_AFTER_GOLDEN * 0.78) },
              { name: '알밤이', value: Math.round(MONEY_AFTER_GOLDEN * 0.55) },
            ]}
            suffix="원"
          />
        )
      }}
    </TutorialDemoFrame>
  )
}
