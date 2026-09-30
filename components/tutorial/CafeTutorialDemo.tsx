"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart, TrendingUp, X } from "lucide-react";
import CafeImage from "@/components/cafe/CafeImage";
import ItemChoiceModal from "@/components/cafe/ItemChoiceModal";
import PixelIcon from "@/components/ui/PixelIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuizSetName from "@/components/game/QuizSetName";
import {
  CUSTOMER_PATIENCE_SECONDS,
  MENU_ITEMS,
  RESTOCK_PER_CORRECT,
  STARTER_MENU_ID,
  UPGRADES,
  formatCafeMoney,
  formatCafeMoneyDelta,
  formatTime,
  type MenuItem,
} from "@/lib/game/cafe";
import { MAX_CUSTOMERS_IN_LINE } from "@/lib/game/cafeConfig";
import {
  CAFE_ITEMS,
  GOLDEN_SPATULA_MULTIPLIER,
  ITEM_CHOICE_COUNT,
  RARE_ITEM_STREAK,
  type CafeItem,
} from "@/lib/game/cafeItems";
import { withJosa } from "@/lib/utils/korean";
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  CountUp,
  PLAYER_NAME,
  RIVALS,
  DEMO_SET_NAME,
} from "@/components/tutorial/TutorialDemoFrame";

/**
 * 달콤 바삭 카페 튜토리얼 데모.
 *   (components/CafeView.tsx · cafe/ItemChoiceModal.tsx · cafe/CafeShop.tsx · lib/game/cafe.ts · cafeItems.ts)
 * 장면 8개는 튜토리얼 규칙 8장과 1:1로 맞춰 두었습니다.
 *
 * 실제 화면과 같은 재료로 그립니다:
 *   - 상단 HUD(시간·돈·손님 수·아이템 칩·상점 버튼)는 CafeView 상단 바와 같은 클래스
 *   - 손님(캐릭터 + 주문 말풍선 + 인내심 게이지), 접시 줄, 음식 채우기 버튼도 CafeView 그대로
 *   - 아이템 고르기는 실제 ItemChoiceModal 컴포넌트를 그대로 띄움
 *   - 상점은 CafeShop 카드와 같은 Card 구성
 * 숫자·낱말은 전부 실제 상수에서 가져오므로 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

const TOAST =
  MENU_ITEMS.find((menu) => menu.id === STARTER_MENU_ID) ?? MENU_ITEMS[0];
const LOCKED_MENUS = MENU_ITEMS.filter((menu) => menu.id !== TOAST.id);
/** 상점 장면에서 사는 메뉴 — 잠긴 메뉴 중 가장 싼 것 */
const CEREAL = LOCKED_MENUS.reduce((best, menu) =>
  menu.cost < best.cost ? menu : best,
);
const ADVERTISING =
  UPGRADES.find((upgrade) => upgrade.id === "advertising") ?? UPGRADES[0];

const TOAST_PRICE = TOAST.sellPrice;
/** 황금 주걱 서빙 = 기본가 + 보너스(기본가 × 2) = 기본가 × 배율 */
const GOLDEN_EARN = TOAST_PRICE * GOLDEN_SPATULA_MULTIPLIER;

/** 상점 장면에서 시리얼을 살 수 있으려면 그 전에 이만큼은 벌어 두어야 한다 */
const CASH_START = Math.max(
  12_000,
  CEREAL.cost - TOAST_PRICE - GOLDEN_EARN + 1_000,
);
const CASH_AFTER_SERVE = CASH_START + TOAST_PRICE;
const CASH_AFTER_GOLDEN = CASH_AFTER_SERVE + GOLDEN_EARN;
const CASH_AFTER_SHOP = CASH_AFTER_GOLDEN - CEREAL.cost;
/**
 * 8장: 게임이 끝났을 때 가진 돈 — 이 돈이 곧 순위다 (cafe/page.tsx 는 가진 돈 cash 를 점수로 보낸다).
 * 시리얼을 연 뒤 끝날 때까지 시리얼·토스트를 더 판 것으로 친다.
 */
const FINAL_CASH = CASH_AFTER_SHOP + CEREAL.sellPrice * 12 + TOAST_PRICE * 8;
const roundToThousand = (value: number) => Math.round(value / 1_000) * 1_000;

const SERVED_START = 5;
const TIME_LEFT_SECONDS = 4 * 60 + 32;

/** 3장: 일반 아이템만 나온다 (연속 정답이 모자라 희귀는 아직) */
const COMMON_PICKS: CafeItem[] = [
  CAFE_ITEMS.EXPRESS_LANE,
  CAFE_ITEMS.SECRET_RECIPE,
  CAFE_ITEMS.BAD_REVIEW,
];
const COMMON_PICKED = CAFE_ITEMS.SECRET_RECIPE;
/** 비법 레시피 = 해금 메뉴 재고 +2 (CafeView handleItemSelect 의 restockMenu 두 번) */
const SECRET_RECIPE_RESTOCK = 2;
/** 6장: 3연속이면 희귀 하나가 후보에 섞여 나온다 */
const RARE_PICKS: CafeItem[] = [
  CAFE_ITEMS.RUSH_HOUR,
  CAFE_ITEMS.GOLDEN_SPATULA,
  CAFE_ITEMS.PRICE_CRASH,
];
const RARE_PICKED = CAFE_ITEMS.GOLDEN_SPATULA;

const STOCK_AFTER_CORRECT = RESTOCK_PER_CORRECT;
const STOCK_AFTER_RECIPE = STOCK_AFTER_CORRECT + SECRET_RECIPE_RESTOCK;
const STOCK_AFTER_SERVE = STOCK_AFTER_RECIPE - 1;
const STOCK_AFTER_GOLDEN = STOCK_AFTER_SERVE - 1;

type DemoCustomer = {
  id: string;
  image: string;
  menu: MenuItem;
  patience: number;
};

/** 손님은 해금된 메뉴만 주문한다 (lib/game/cafe.ts createCustomer) — 그래서 전부 토스트 */
const CUSTOMERS: Record<string, DemoCustomer> = {
  a: { id: "a", image: "/character/webp/1.webp", menu: TOAST, patience: 0.8 },
  b: { id: "b", image: "/character/webp/5.webp", menu: TOAST, patience: 0.55 },
  c: { id: "c", image: "/character/webp/8.webp", menu: TOAST, patience: 0.16 },
  d: { id: "d", image: "/character/webp/12.webp", menu: TOAST, patience: 0.9 },
};

// ───────────────────────── 박자(beat) ─────────────────────────
// 한 장면 안에서 "포인터 → 누름 → 결과" 순서로 연출을 나눈다. HUD 도 같은 박자를 본다.

type BeatSetter = (beat: number) => void;

/** 장면이 붙은 뒤 times[i] ms 가 지나면 beat 가 i+1 이 된다 */
function useBeats(times: number[], onBeat?: BeatSetter): number {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    onBeat?.(0);
    const timers = times.map((time, index) =>
      setTimeout(() => {
        setBeat(index + 1);
        onBeat?.(index + 1);
      }, time),
    );
    return () => timers.forEach(clearTimeout);
    // 장면이 붙는 순간부터 한 번만 잰다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return beat;
}

/** 장면이 바뀌면 박자를 0으로 되돌린다 (이전 장면의 박자가 새 장면 HUD 에 새지 않게) */
function BeatReset({ phase, onReset }: { phase: string; onReset: () => void }) {
  useEffect(() => {
    onReset();
  }, [phase, onReset]);
  return null;
}

/** 실제 DOM 버튼(글자로 찾음) 위에 손가락 포인터를 올린다 — GlassQuizStep 과 같은 방식 */
function useButtonPointer(
  boxRef: RefObject<HTMLDivElement | null>,
  text: string,
  enabled: boolean,
): { left: number; top: number } | null {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!enabled) {
      setPos(null);
      return;
    }
    const box = boxRef.current;
    if (!box) return;
    const button = [...box.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(text),
    );
    if (!button) return;
    const boxRect = box.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    setPos({
      left: rect.right - boxRect.left - 44,
      top: rect.bottom - boxRect.top - 22,
    });
  }, [boxRef, text, enabled]);
  return pos;
}

/** 실제 모달의 10초 타이머가 0에서 멈춰 보이지 않게, 오래 머물면 새로 그린다 */
function useEpoch(interval: number): number {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setEpoch((e) => e + 1), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return epoch;
}

// ───────────────────────── HUD (CafeView 상단 바) ─────────────────────────

type HudState = {
  /** 남은 시간(초). 없으면 TIME_LEFT_SECONDS */
  time?: number;
  cash: number;
  cashFrom?: number;
  served: number;
  servedFrom?: number;
  golden: boolean;
};

function hudState(phase: string, beat: number): HudState {
  switch (phase) {
    case "serve":
      return beat >= 2
        ? {
            cash: CASH_AFTER_SERVE,
            cashFrom: CASH_START,
            served: SERVED_START + 1,
            servedFrom: SERVED_START,
            golden: false,
          }
        : { cash: CASH_START, served: SERVED_START, golden: false };
    case "patience":
      return {
        cash: CASH_AFTER_SERVE,
        served: SERVED_START + 1,
        golden: false,
      };
    case "rare":
      if (beat >= 4) {
        return {
          cash: CASH_AFTER_GOLDEN,
          cashFrom: CASH_AFTER_SERVE,
          served: SERVED_START + 2,
          servedFrom: SERVED_START + 1,
          golden: false,
        };
      }
      return {
        cash: CASH_AFTER_SERVE,
        served: SERVED_START + 1,
        golden: beat >= 2,
      };
    case "shop":
      return beat >= 2
        ? {
            cash: CASH_AFTER_SHOP,
            cashFrom: CASH_AFTER_GOLDEN,
            served: SERVED_START + 2,
            golden: false,
          }
        : { cash: CASH_AFTER_GOLDEN, served: SERVED_START + 2, golden: false };
    case "score":
      return { time: 0, cash: FINAL_CASH, served: SERVED_START + 20, golden: false };
    default:
      return { cash: CASH_START, served: SERVED_START, golden: false };
  }
}

/** CafeView 상단 바의 정보 칩 하나 (폰 크기 변형) */
function HudChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border-2 border-white/30 bg-white/20 px-2 py-1 backdrop-blur-sm">
      {children}
    </div>
  );
}

function CafeHud({ time, cash, cashFrom, served, servedFrom, golden }: HudState) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <HudChip>
          <PixelIcon name="time" size={24} alt="" />
          <span className="whitespace-nowrap font-mono text-lg font-bold text-slate-700">
            {formatTime(time ?? TIME_LEFT_SECONDS)}
          </span>
        </HudChip>
        <HudChip>
          <PixelIcon name="gold" size={22} alt="" />
          <motion.span
            key={cash}
            initial={{ scale: cashFrom !== undefined ? 1.2 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 16 }}
            className="whitespace-nowrap text-lg font-bold tabular-nums text-slate-700"
          >
            {cashFrom !== undefined ? (
              <CountUp from={cashFrom} to={cash} duration={900} />
            ) : (
              cash.toLocaleString("ko-KR")
            )}
            원
          </motion.span>
        </HudChip>
        <QuizSetName title={DEMO_SET_NAME} className="hidden lg:flex" />
        <div className="hidden sm:block">
          <HudChip>
            <PixelIcon name="people" size={22} alt="" />
            <span className="whitespace-nowrap text-lg font-bold tabular-nums text-slate-700">
              {servedFrom !== undefined ? (
                <CountUp from={servedFrom} to={served} duration={600} />
              ) : (
                served
              )}
              명
            </span>
          </HudChip>
        </div>
        <AnimatePresence>
          {golden && (
            <motion.div
              key="golden-spatula"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-1 text-sm font-black text-amber-950"
            >
              <CafeImage
                src={CAFE_ITEMS.GOLDEN_SPATULA.image}
                alt={CAFE_ITEMS.GOLDEN_SPATULA.name}
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                fallbackEmoji={CAFE_ITEMS.GOLDEN_SPATULA.emoji}
                fallbackClassName="h-5 w-5 text-sm"
              />
              {GOLDEN_SPATULA_MULTIPLIER}배
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Button className="shrink-0 border-4 border-amber-800 bg-white px-3 py-2 text-sm font-bold text-amber-700 shadow-xl hover:bg-amber-50">
        <ShoppingCart className="mr-1.5 h-5 w-5" />
        상점
      </Button>
    </div>
  );
}

// ───────────────────────── 카페 무대 (CafeView 본문) ─────────────────────────

/** 손님 하나 — 캐릭터 + 주문 말풍선 + 인내심 게이지 (CafeView 의 손님 마크업) */
function CustomerFigure({
  customer,
  pointer,
}: {
  customer: DemoCustomer;
  pointer?: boolean;
}) {
  const { image, menu, patience } = customer;
  const isUrgent = patience < 0.3;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 100, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 100, scale: 0.5, x: 200 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="group relative flex cursor-pointer flex-col items-center"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className={`mb-1.5 flex items-center justify-center ${isUrgent ? "animate-pulse scale-110" : ""}`}
      >
        <div className="relative h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem]">
          <CafeImage
            src={image}
            alt="손님"
            width={72}
            height={72}
            className="h-full w-full object-contain"
            fallbackEmoji="🐶"
            fallbackClassName="h-full w-full text-5xl"
          />
        </div>
      </motion.div>

      <div
        className={`min-w-[92px] rounded-2xl border-4 bg-white px-2 py-2 shadow-xl sm:min-w-[120px] sm:px-4 sm:py-3 ${
          isUrgent
            ? "animate-pulse border-red-500 bg-red-50"
            : "border-amber-400"
        }`}
      >
        <div className="text-center">
          <div className="mb-1.5 flex items-center justify-center">
            <CafeImage
              src={menu.image}
              alt={menu.name}
              width={56}
              height={56}
              className="h-10 w-10 object-contain sm:h-14 sm:w-14"
              fallbackEmoji={menu.emoji}
              fallbackClassName="text-3xl"
            />
          </div>
          <div className="mb-0.5 whitespace-nowrap text-xs font-bold text-gray-800 sm:mb-1 sm:text-sm">
            {menu.name}
          </div>
          <div className="text-xs font-semibold text-green-600">
            {formatCafeMoneyDelta(menu.sellPrice)}
          </div>
        </div>
      </div>

      <div className="mt-1.5 h-2 w-20 overflow-hidden rounded-full border-2 border-gray-400 bg-gray-200 sm:mt-2 sm:w-28">
        <motion.div
          initial={{ width: "100%" }}
          animate={{
            width: `${patience * 100}%`,
            backgroundColor:
              patience > 0.5
                ? "#10b981"
                : patience > 0.3
                  ? "#f59e0b"
                  : "#ef4444",
          }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
        />
      </div>
      <div className="mt-1 text-xs font-semibold text-gray-600">
        {Math.ceil(patience * CUSTOMER_PATIENCE_SECONDS)}초
      </div>

      {pointer && <TapPointer className="-right-3 top-24" />}
    </motion.div>
  );
}

/** 접시 줄 — 모든 메뉴 슬롯 (CafeView 의 접시 영역). 데모는 폭이 좁아 한 줄(sm)로 편다 */
function PlateRow({
  stock,
  unlocked,
  orders,
  pop,
}: {
  stock: Record<string, number>;
  unlocked: string[];
  orders: string[];
  pop?: string;
}) {
  return (
    <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-1.5 sm:grid-cols-8">
      {MENU_ITEMS.map((menu) => {
        const isUnlocked = unlocked.includes(menu.id);
        const count = stock[menu.id] || 0;
        const hasOrder = orders.includes(menu.id);
        return (
          <div key={menu.id} className="relative flex flex-col items-center">
            <motion.div
              animate={pop === menu.id ? { scale: [1, 1.18, 1] } : {}}
              transition={{ duration: 0.5 }}
              className={`relative h-14 w-14 rounded-full border-2 shadow-md ${
                isUnlocked
                  ? count > 0
                    ? hasOrder
                      ? "scale-105 border-green-400 bg-green-100"
                      : "border-amber-300 bg-white"
                    : "border-amber-300 bg-white opacity-60"
                  : "border-gray-500 bg-gray-300 opacity-40"
              }`}
            >
              {isUnlocked && count > 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-1.5">
                  <CafeImage
                    src={menu.image}
                    alt={menu.name}
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                    fallbackEmoji={menu.emoji}
                    fallbackClassName="text-2xl"
                  />
                </div>
              )}
              {isUnlocked && (
                <motion.div
                  key={count}
                  initial={{ scale: pop === menu.id ? 1.6 : 1 }}
                  animate={{ scale: 1 }}
                  className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                    count > 0
                      ? "border-blue-600 bg-blue-500 text-white"
                      : "border-gray-600 bg-gray-500 text-white"
                  }`}
                >
                  {count}
                </motion.div>
              )}
              {hasOrder && isUnlocked && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-yellow-600 bg-yellow-400"
                >
                  <span className="text-[10px]">⚡</span>
                </motion.div>
              )}
            </motion.div>
            {isUnlocked && (
              <div className="mt-1 max-w-[56px] truncate text-center text-[10px] font-bold text-gray-700">
                {menu.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 음식 채우기 버튼 + 안내 문구 (CafeView 하단) */
function FillFoodButton({ pointer }: { pointer?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Button
          variant="outline"
          className="h-auto min-h-0 min-w-[280px] items-center justify-between gap-3 border-2 border-[#3A9BDC] bg-[#88D1E7] px-10 py-1.5 text-sm font-bold text-[#1a5f8f] shadow-[0_3px_0_#3A9BDC] hover:border-[#3A9BDC] hover:bg-[#7ec8e0] hover:text-[#1a5f8f]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #D9F2F9 0%, #88D1E7 52%, #7ec5e8 100%)",
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <PixelIcon name="dish" size={22} alt="" />
            음식 채우기
          </span>
          <span className="mr-3 text-xs font-semibold text-[#1a5f8f]/85">
            스페이스바
          </span>
        </Button>
        {pointer && <TapPointer />}
      </div>
      <p className="text-center text-xs font-bold text-slate-700 drop-shadow-sm">
        손님을 클릭하여 주문한 메뉴를 서빙하세요! 재고가 없으면 음식 채우기
        버튼을 눌러주세요.
      </p>
    </div>
  );
}

type StageProps = {
  customers: DemoCustomer[];
  toastStock: number;
  unlocked?: string[];
  pop?: string;
  pointerOn?: "button" | string;
};

/** 실제 카페 화면 본문: 손님 줄 → 접시 줄 → 음식 채우기 버튼 */
function CafeStage({
  customers,
  toastStock,
  unlocked = [TOAST.id],
  pop,
  pointerOn,
}: StageProps) {
  const stock = { [TOAST.id]: toastStock };
  const orders = customers.map((customer) => customer.menu.id);
  return (
    <div className="flex h-full w-full flex-col justify-end">
      {/* 폰은 무대가 낮아 손님 줄이 HUD 를 덮는다 → 폰에서만 내용을 줄여 아래에 붙인다 */}
      <div className="flex flex-col gap-3 pb-1 [zoom:0.78] sm:[zoom:1]">
        <div className="flex min-h-[200px] items-end justify-center gap-2 sm:gap-3">
          <AnimatePresence>
            {customers.map((customer) => (
              <CustomerFigure
                key={customer.id}
                customer={customer}
                pointer={pointerOn === customer.id}
              />
            ))}
          </AnimatePresence>
        </div>
        <PlateRow stock={stock} unlocked={unlocked} orders={orders} pop={pop} />
        <FillFoodButton pointer={pointerOn === "button"} />
      </div>
    </div>
  );
}

/** 퀴즈·아이템·상점이 뜰 때 실제 화면처럼 뒤를 어둡게 누른다 (CafeView 의 z-40 오버레이) */
function Overlay({
  children,
  dark = "rgba(0,0,0,0.45)",
}: {
  children: ReactNode;
  dark?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex justify-center overflow-y-auto p-3"
      style={{ background: dark, backdropFilter: "blur(4px)" }}
    >
      <div className="my-auto flex w-full justify-center">{children}</div>
    </motion.div>
  );
}

function Scene({ id, children }: { id: string; children: ReactNode }) {
  return (
    <StageCard id={id} className="absolute inset-0">
      {children}
    </StageCard>
  );
}

// ───────────────────────── 장면 ─────────────────────────

const WAITING = [CUSTOMERS.a, CUSTOMERS.b];

/** 1장: 음식 채우기를 누르면 퀴즈가 뜬다 */
function QuizScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([1300], onBeat);
  return (
    <Scene id="cafe-quiz">
      <CafeStage
        customers={WAITING}
        toastStock={0}
        pointerOn={beat === 0 ? "button" : undefined}
      />
      <AnimatePresence>
        {beat >= 1 && (
          <Overlay key="quiz">
            <GlassQuizStep
              question="대한민국의 수도는?"
              options={["서울", "부산", "제주", "인천"]}
              correctIndex={0}
              answered={false}
            />
          </Overlay>
        )}
      </AnimatePresence>
    </Scene>
  );
}

/** 2장: 정답 → 접시에 재고가 생긴다 */
function RestockScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([1500], onBeat);
  return (
    <Scene id="cafe-restock">
      <CafeStage
        customers={WAITING}
        toastStock={beat >= 1 ? STOCK_AFTER_CORRECT : 0}
        pop={beat >= 1 ? TOAST.id : undefined}
      />
      <AnimatePresence>
        {beat === 0 ? (
          <Overlay key="quiz">
            <GlassQuizStep
              question="대한민국의 수도는?"
              options={["서울", "부산", "제주", "인천"]}
              correctIndex={0}
              answered
            />
          </Overlay>
        ) : (
          // ItemChoiceModal 머리글과 같은 문구 — 정답 직후 실제로 이렇게 뜬다
          <div
            key="banner"
            className="pointer-events-none absolute inset-x-3 top-3 z-30 flex justify-center"
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex flex-wrap items-center justify-center gap-2 rounded-lg border-4 border-amber-300 bg-white px-4 py-2 text-base font-black text-slate-950 shadow-2xl sm:whitespace-nowrap sm:px-5 sm:text-xl"
            >
              <PixelIcon name="correct" size={26} alt="정답" />
              <span className="inline-flex items-center gap-1">
                정답!
                <PixelIcon name="dish" size={22} alt="" />
                {TOAST.name} 재고 충전!
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Scene>
  );
}

/** 실제 ItemChoiceModal 을 그대로 띄우고, 고를 카드 위에 포인터를 올린다 */
function ItemPick({
  items,
  picked,
  streak,
  pointerOn,
}: {
  items: CafeItem[];
  picked: CafeItem;
  streak: number;
  pointerOn: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const epoch = useEpoch(9000);
  const pointer = useButtonPointer(boxRef, picked.name, pointerOn);
  return (
    <div ref={boxRef} className="relative w-full max-w-3xl">
      <div className="[zoom:0.55] sm:[zoom:0.82]">
        <ItemChoiceModal
          key={epoch}
          items={items}
          restockedMenuName={TOAST.name}
          consecutiveCorrect={streak}
          players={[]}
          currentPlayerId={null}
          onSelect={() => undefined}
          onSkip={() => undefined}
        />
      </div>
      {pointer && (
        <div
          className="pointer-events-none absolute"
          style={{ left: pointer.left, top: pointer.top }}
        >
          <TapPointer className="left-0 top-0" />
        </div>
      )}
    </div>
  );
}

/** 3장: 아이템 3개 중 하나 */
function ItemScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([900], onBeat);
  return (
    <Scene id="cafe-item">
      <CafeStage customers={WAITING} toastStock={STOCK_AFTER_CORRECT} />
      <Overlay>
        <ItemPick
          items={COMMON_PICKS}
          picked={COMMON_PICKED}
          streak={1}
          pointerOn={beat >= 1}
        />
      </Overlay>
    </Scene>
  );
}

/** 4장: 손님을 눌러 서빙 */
function ServeScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([600, 1100], onBeat);
  const customers = beat >= 2 ? [CUSTOMERS.b] : WAITING;
  return (
    <Scene id="cafe-serve">
      <CafeStage
        customers={customers}
        toastStock={beat >= 2 ? STOCK_AFTER_SERVE : STOCK_AFTER_RECIPE}
        pop={beat >= 2 ? TOAST.id : undefined}
        pointerOn={beat === 1 ? CUSTOMERS.a.id : undefined}
      />
      {beat >= 2 && (
        // 위치는 일반 div 가 잡고 motion 은 떠오르기만 (translate 클래스가 덮어써지지 않게)
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center">
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -100, scale: 1.5 }}
            transition={{ duration: 2 }}
            className="text-4xl font-bold text-green-400 drop-shadow-2xl"
            style={{ textShadow: "0 0 10px rgba(34, 197, 94, 0.8)" }}
          >
            {formatCafeMoneyDelta(TOAST_PRICE)}
          </motion.div>
        </div>
      )}
    </Scene>
  );
}

/** 5장: 15초를 넘긴 손님은 가 버린다 */
function PatienceScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([1600], onBeat);
  const line = [CUSTOMERS.b, CUSTOMERS.d, CUSTOMERS.c].slice(
    0,
    MAX_CUSTOMERS_IN_LINE,
  );
  const customers =
    beat >= 1
      ? line.filter((customer) => customer.id !== CUSTOMERS.c.id)
      : line;
  return (
    <Scene id="cafe-patience">
      <CafeStage customers={customers} toastStock={STOCK_AFTER_SERVE} />
    </Scene>
  );
}

/** 6장: 3연속 정답 → 황금 주걱 → 다음 서빙 3배 */
function RareScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([700, 2000, 2500, 2900], onBeat);
  const customers = beat >= 4 ? [CUSTOMERS.d] : [CUSTOMERS.b, CUSTOMERS.d];
  return (
    <Scene id="cafe-rare">
      <CafeStage
        customers={customers}
        toastStock={beat >= 4 ? STOCK_AFTER_GOLDEN : STOCK_AFTER_SERVE}
        pop={beat >= 4 ? TOAST.id : undefined}
        pointerOn={beat === 3 ? CUSTOMERS.b.id : undefined}
      />
      <AnimatePresence>
        {beat < 2 && (
          <Overlay key="item">
            <ItemPick
              items={RARE_PICKS}
              picked={RARE_PICKED}
              streak={RARE_ITEM_STREAK}
              pointerOn={beat >= 1}
            />
          </Overlay>
        )}
        {beat >= 4 && (
          // CafeView 의 showGoldenEffect 연출
          <motion.div
            key="golden"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-amber-300/15"
          >
            <div className="rounded-lg bg-amber-400 px-6 py-4 text-2xl font-black text-amber-950 shadow-2xl sm:px-8 sm:py-5 sm:text-3xl">
              <span className="inline-flex items-center gap-2">
                <CafeImage
                  src={CAFE_ITEMS.GOLDEN_SPATULA.image}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  fallbackEmoji={CAFE_ITEMS.GOLDEN_SPATULA.emoji}
                  fallbackClassName="h-10 w-10 text-3xl"
                />
                {CAFE_ITEMS.GOLDEN_SPATULA.name} {GOLDEN_SPATULA_MULTIPLIER}배
                수익!
              </span>
            </div>
            <div className="absolute inset-x-0 top-[14%] flex justify-center">
              <motion.div
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -60, scale: 1.5 }}
                transition={{ duration: 2 }}
                className="text-4xl font-bold text-amber-300 drop-shadow-2xl"
                style={{ textShadow: "0 0 14px rgba(251, 191, 36, 0.9)" }}
              >
                {formatCafeMoneyDelta(GOLDEN_EARN)}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Scene>
  );
}

/** 상점 메뉴 카드 — CafeShop 의 Card 와 같은 구성 */
function ShopMenuCard({ menu, canBuy }: { menu: MenuItem; canBuy: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <Card
        className={`border-4 ${canBuy ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"}`}
      >
        <CardHeader className="p-4 pb-2">
          <div className="mb-2 flex justify-center">
            <CafeImage
              src={menu.image}
              alt={menu.name}
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              fallbackEmoji={menu.emoji}
              fallbackClassName="h-16 w-16 text-4xl"
            />
          </div>
          <CardTitle className="text-center text-lg text-gray-900">
            {menu.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2 text-center">
            <div className="whitespace-nowrap text-base font-bold text-amber-600 sm:text-xl">
              {formatCafeMoney(menu.cost)}
            </div>
            <div className="whitespace-nowrap text-xs font-bold text-green-600">
              팔면 {formatCafeMoneyDelta(menu.sellPrice)}
            </div>
            <Button
              disabled={!canBuy}
              className={`w-full whitespace-nowrap px-2 text-xs sm:text-sm ${canBuy ? "bg-green-500 hover:bg-green-600" : "cursor-not-allowed bg-gray-300"}`}
            >
              {canBuy ? "잠금 해제!" : "돈 부족"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** 7장: 상점 — CafeView 의 상점 모달 + CafeShop */
function ShopScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([900, 1700], onBeat);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointer = useButtonPointer(boxRef, "잠금 해제!", beat === 1);
  const bought = beat >= 2;
  const cash = bought ? CASH_AFTER_SHOP : CASH_AFTER_GOLDEN;
  const shown = LOCKED_MENUS.filter(
    (menu) => menu.id !== CEREAL.id || !bought,
  ).slice(0, 4);
  return (
    <Scene id="cafe-shop">
      <CafeStage
        customers={[CUSTOMERS.d]}
        toastStock={STOCK_AFTER_GOLDEN}
        unlocked={bought ? [TOAST.id, CEREAL.id] : [TOAST.id]}
      />
      <Overlay dark="rgba(0,0,0,0.5)">
        <div ref={boxRef} className="relative w-full max-w-4xl">
          <div className="[zoom:0.55] sm:[zoom:0.8]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full rounded-3xl border-4 border-amber-300 bg-white p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
                  <ShoppingCart className="h-8 w-8 text-amber-600" />
                  상점
                </h2>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-1 text-base font-bold text-slate-700">
                    <PixelIcon name="gold" size={20} alt="" />
                    <span key={cash} className="tabular-nums">
                      {bought ? (
                        <CountUp
                          from={CASH_AFTER_GOLDEN}
                          to={cash}
                          duration={900}
                        />
                      ) : (
                        cash.toLocaleString("ko-KR")
                      )}
                      원
                    </span>
                  </span>
                  <span className="rounded-full p-2 text-gray-500">
                    <X className="h-6 w-6" />
                  </span>
                </div>
              </div>
              <h3 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <PixelIcon name="dish" size={28} alt="" /> 메뉴 잠금 해제
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <AnimatePresence>
                  {shown.map((menu) => (
                    <ShopMenuCard
                      key={menu.id}
                      menu={menu}
                      canBuy={menu.id === CEREAL.id && !bought}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <h3 className="mb-2 mt-4 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                업그레이드
              </h3>
              <Card className="border-4 border-gray-300 bg-gray-50">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {ADVERTISING.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {ADVERTISING.description}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="whitespace-nowrap text-base font-bold text-blue-600 sm:text-xl">
                      {formatCafeMoney(ADVERTISING.cost)}
                    </div>
                    <Button disabled className="cursor-not-allowed bg-gray-300">
                      돈 부족
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
          {pointer && (
            <div
              className="pointer-events-none absolute"
              style={{ left: pointer.left, top: pointer.top }}
            >
              <TapPointer className="left-0 top-0" />
            </div>
          )}
        </div>
      </Overlay>
    </Scene>
  );
}

/** 8장: 끝났을 때 가진 돈 순위 — HUD 의 돈(0:00)과 내 순위 금액이 같다 */
function ScoreScene({ onBeat }: { onBeat: BeatSetter }) {
  useBeats([], onBeat);
  return (
    <Scene id="cafe-score">
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <MiniLeaderboard
          title="최종 순위 · 가진 돈"
          rows={[
            { name: PLAYER_NAME, value: FINAL_CASH, me: true },
            { name: RIVALS[1].name, value: roundToThousand(FINAL_CASH * 0.78) },
            { name: RIVALS[2].name, value: roundToThousand(FINAL_CASH * 0.55) },
          ]}
          suffix="원"
        />
      </div>
    </Scene>
  );
}

export default function CafeTutorialDemo() {
  const [beat, setBeat] = useState(0);
  const resetBeat = useCallback(() => setBeat(0), []);
  const onBeat = useCallback((next: number) => setBeat(next), []);

  return (
    <TutorialDemoFrame
      backgroundSrc="/background/cafe.webp"
      header={({ phase }) => (
        <>
          <BeatReset phase={phase} onReset={resetBeat} />
          <CafeHud {...hudState(phase, beat)} />
        </>
      )}
      /* 규칙 8장과 1:1 — lib/game/tutorials.ts 의 cafe 슬라이드 순서와 같습니다 */
      phases={[
        {
          key: "quiz",
          duration: 3400,
          step: 1,
          caption: "음식 채우기를 누르면 퀴즈가 나와요",
        },
        {
          key: "restock",
          duration: 3400,
          step: 2,
          caption: `정답! ${TOAST.name} 재고가 ${RESTOCK_PER_CORRECT}개 늘어요`,
        },
        {
          key: "item",
          duration: 3200,
          step: 3,
          caption: `아이템 ${ITEM_CHOICE_COUNT}개 중 하나 선택!`,
        },
        {
          key: "serve",
          duration: 3400,
          step: 4,
          caption: `손님을 누르면 ${withJosa(TOAST.name, "을/를")} 서빙하고 ${formatCafeMoneyDelta(TOAST_PRICE)}`,
        },
        {
          key: "patience",
          duration: 3400,
          step: 5,
          caption: `${CUSTOMER_PATIENCE_SECONDS}초가 지나면 손님이 그냥 가 버려요`,
        },
        {
          key: "rare",
          duration: 5200,
          step: 6,
          caption: `${RARE_ITEM_STREAK}연속 정답이면 희귀 아이템이 나와요`,
        },
        {
          key: "shop",
          duration: 3800,
          step: 7,
          caption: "상점에서 새로운 메뉴도 살 수 있어요",
        },
        {
          key: "score",
          duration: 3400,
          step: 8,
          caption: "끝났을 때 돈이 가장 많은 사람이 승리!",
        },
      ]}
    >
      {({ phase }) => {
        if (phase === "quiz") return <QuizScene key="quiz" onBeat={onBeat} />;
        if (phase === "restock")
          return <RestockScene key="restock" onBeat={onBeat} />;
        if (phase === "item") return <ItemScene key="item" onBeat={onBeat} />;
        if (phase === "serve")
          return <ServeScene key="serve" onBeat={onBeat} />;
        if (phase === "patience")
          return <PatienceScene key="patience" onBeat={onBeat} />;
        if (phase === "rare") return <RareScene key="rare" onBeat={onBeat} />;
        if (phase === "shop") return <ShopScene key="shop" onBeat={onBeat} />;
        return <ScoreScene key="score" onBeat={onBeat} />;
      }}
    </TutorialDemoFrame>
  );
}
