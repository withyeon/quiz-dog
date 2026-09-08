import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'
import {
  CHEST_COUNT,
  GOLD_LOSS_RATE,
  GOLD_MULTIPLIER,
  GOLD_STEAL_RATE,
  MAX_GOLD_STACK,
  SHIELD_STREAK,
  toPercent,
} from '@/lib/game/goldQuest'
import { TOWER_QUIZZES_PER_WAVE, WAVES, getQuizGoldRange } from '@/lib/game/tower'
import {
  ANSWER_SPEED_THRESHOLDS,
  DOLL_TYPES,
  MACHINE_RANK_THRESHOLDS,
  MAX_COMBO_STREAK,
  MAX_MACHINE_RANK,
  getAimGradeLabel,
  getAimTierFloor,
  getAnswerSpeedLabel,
  getComboState,
  getMachineRankName,
} from '@/lib/game/fishing'
import {
  GACHA_TIER_CHANCE,
  GRID_SIZE,
  PRODUCT_OPTION_COUNT,
  QUIZZES_PER_PRODUCT,
  SPEED_BONUS_PER_SECOND,
  WRONG_PENALTY_RATE,
  getMaxReachableSynergy,
} from '@/lib/game/convenienceStore'
import {
  CUSTOMER_PATIENCE_SECONDS,
  MENU_ITEMS,
  RESTOCK_PER_CORRECT,
} from '@/lib/game/cafe'
import { MAX_CUSTOMERS_IN_LINE } from '@/lib/game/cafeConfig'
import {
  CAFE_ITEMS,
  GOLDEN_SPATULA_MULTIPLIER,
  ITEM_CHOICE_COUNT,
  RARE_ITEM_STREAK,
} from '@/lib/game/cafeItems'
import {
  BONE_PICKUP_REWARD,
  BONUS_ROUND_SECONDS,
  CARD_DEFS,
  CARD_PICK_SECONDS,
  CLEANER_DELAY_SECONDS,
  COMBO_STEPS,
  CORRECT_ROUND_SCORE,
  CORRECT_ROUND_SECONDS,
  GOLDEN_DOG_SCORE,
  POOP_HIT_PENALTY,
  SCORE_THIEF_AMOUNT,
  CARD_CHOICE_COUNT as PUPPY_CARD_CHOICE_COUNT,
} from '@/lib/game/강아지대소동'
import { withJosa } from '@/lib/utils/korean'

/** 조준을 가장 잘 맞혔을 때 보장되는 최소 인형 등급 */
const AIM_PERFECT_TIER = getAimTierFloor('perfect') ?? '영웅'
/** 전설 인형이 줄 수 있는 최고 점수 */
const LEGEND_MAX_SCORE = Math.max(...DOLL_TYPES.filter((doll) => doll.tier === '전설').map((doll) => doll.maxScore))

/** 오답 때 잃는 비율(%) */
const WRONG_PENALTY_PERCENT = toPercent(WRONG_PENALTY_RATE)
/** 빨리 맞혔을 때 전설 확률이 평소의 몇 배가 되는지 */
const FAST_LEGEND_ODDS_RATIO = Math.round(GACHA_TIER_CHANCE.fast.전설 / GACHA_TIER_CHANCE.normal.전설)
/** 진열대를 한 종류로 채웠을 때 나오는 최대 시너지 배율 */
const MAX_SYNERGY = getMaxReachableSynergy()

const CAFE_BEST_SELL = MENU_ITEMS.reduce((best, menu) => (menu.sellPrice > best.sellPrice ? menu : best))

/** 강아지 대소동 콤보 단계 — 낮은 연속수부터 순서대로 (3연속 1.5배 → 5연속 2배) */
const PUPPY_COMBO_STEPS = [...COMBO_STEPS].sort((a, b) => a.streak - b.streak)
const PUPPY_COMBO_SMALL = PUPPY_COMBO_STEPS[0]
const PUPPY_COMBO_BIG = PUPPY_COMBO_STEPS[PUPPY_COMBO_STEPS.length - 1]

export type GameTutorialSlide = {
  title: string
  body: string
  /** 데모 영상이 없는 모드에서만 쓰이는 보조 요약. 타워 디펜스처럼 문장만 쓰는 모드는 생략합니다. */
  points?: string[]
}

export type GameTutorial = {
  gameMode: GameModeId
  title: string
  subtitle: string
  slides: GameTutorialSlide[]
}

export const GAME_TUTORIALS: Record<GameModeId, GameTutorial> = {
  // 숫자는 모두 lib/game/goldQuest.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(상자 · 골드 · 함정 · 방어권)만 씁니다.
  gold_quest: {
    gameMode: 'gold_quest',
    title: '해적왕의 보물찾기',
    subtitle: '퀴즈를 맞히고 보물 상자를 열어 골드를 모아요.',
    slides: [
      {
        title: '퀴즈를 맞혀야 상자를 열어요',
        body: '틀리면 이번 상자는 없어요',
      },
      {
        title: `상자 ${CHEST_COUNT}개 중 하나를 골라요`,
        body: '열어봐야 무엇이 들었는지 알아요',
      },
      {
        title: '보물을 찾으면 골드를 받아요',
        body: `황금 왕관은 ${MAX_GOLD_STACK}골드, 유니콘은 ${GOLD_MULTIPLIER.UNICORN}배!`,
      },
      {
        title: '함정을 밟으면 골드가 줄어요',
        body: `드래곤은 골드를 ${toPercent(GOLD_LOSS_RATE.DRAGON)}%나 가져가요`,
      },
      {
        title: '친구 골드를 빼앗기도 해요',
        body: `마법사를 찾으면 ${toPercent(GOLD_STEAL_RATE.WIZARD)}%까지 가져와요`,
      },
      {
        title: `${SHIELD_STREAK}연속 정답이면 방어권`,
        body: '함정도 도둑도 한 번 막아줘요',
      },
      {
        title: '골드가 가장 많으면 1등',
        body: '순위는 끝날 때까지 바뀌어요',
      },
    ],
  },
  battle_royale: {
    gameMode: 'battle_royale',
    title: '눈싸움 대작전',
    subtitle: '퀴즈로 눈덩이를 만들고 상대를 맞히는 생존 대결입니다.',
    slides: [
      {
        title: '목표',
        body: '체력을 지키면서 상대를 공격해 마지막까지 살아남습니다.',
        points: ['정답으로 공격 기회 획득', '상대 체력 낮추기', '내 체력 관리하기'],
      },
      {
        title: '플레이 방식',
        body: '문제를 맞히면 눈덩이를 던질 수 있고, 공격 대상 선택이 중요합니다.',
        points: ['정답 후 공격', '강한 상대 우선 견제', '체력이 낮으면 신중하게 플레이'],
      },
      {
        title: '승리 기준',
        body: '종료 시점에 체력과 점수 흐름이 좋은 플레이어가 높은 순위를 차지합니다.',
        points: ['생존이 핵심', '무리한 공격보다 정확도', '마지막까지 방심 금지'],
      },
    ],
  },
  // 숫자는 모두 lib/game/fishing.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(집게 · 조준 · 내리기 · 인형 · 점수)만 씁니다.
  fishing: {
    gameMode: 'fishing',
    title: '두근두근 인형뽑기',
    subtitle: '퀴즈를 맞히고 집게를 조준해 좋은 인형을 뽑아요.',
    slides: [
      {
        title: '퀴즈를 맞혀야 뽑아요',
        body: '틀리면 이번 뽑기는 없어요',
      },
      {
        title: '빨리 맞히면 점수 UP',
        body: `${ANSWER_SPEED_THRESHOLDS.perfect}초 안에 맞히면 ${getAnswerSpeedLabel('perfect')}!`,
      },
      {
        title: '집게는 좌우로 움직여요',
        body: '내리기를 눌러 멈춰요',
      },
      {
        title: '노란 칸에 멈추면 대박',
        body: `조준이 ${getAimGradeLabel('perfect')}이면 ${AIM_PERFECT_TIER} 인형 이상`,
      },
      {
        title: '인형마다 점수가 달라요',
        body: `전설 인형은 한 마리에 ${LEGEND_MAX_SCORE.toLocaleString()}점 넘게!`,
      },
      {
        title: `연속 정답이면 점수 ${getComboState(MAX_COMBO_STREAK).multiplier}배`,
        body: `${MAX_COMBO_STREAK}문제 연속으로 맞혀야 해요`,
      },
      {
        title: '집게는 점점 좋아져요',
        body: `${MACHINE_RANK_THRESHOLDS[2]}문제마다 한 단계, ${MACHINE_RANK_THRESHOLDS[MAX_MACHINE_RANK]}문제면 ${getMachineRankName(MAX_MACHINE_RANK)}!`,
      },
      {
        title: '점수가 가장 높으면 1등',
        body: '뽑은 인형 점수를 모두 더해요',
      },
    ],
  },
  // 숫자는 모두 lib/game/convenienceStore.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(매대 · 진열 · 상품 · 등급 · 시너지 · 매출)만 씁니다.
  factory: {
    gameMode: 'factory',
    title: '전설의 편의점',
    subtitle: '퀴즈를 맞혀 상품을 받고, 매대를 채워 돈을 벌어요.',
    slides: [
      {
        title: '퀴즈를 맞혀야 벌어요',
        body: `틀리면 가진 돈의 ${WRONG_PENALTY_PERCENT}%를 잃어요`,
      },
      {
        title: '빨리 맞히면 보너스 UP',
        body: `남은 1초마다 ${SPEED_BONUS_PER_SECOND}원씩!`,
      },
      {
        title: `${QUIZZES_PER_PRODUCT}문제 맞히면 상품 하나`,
        body: `${PRODUCT_OPTION_COUNT}개 중에서 하나만 골라요`,
      },
      {
        title: '진열하면 돈이 들어와요',
        body: '상품마다 버는 시간이 달라요',
      },
      {
        title: '등급이 높을수록 좋아요',
        body: `빨리 맞히면 전설 확률 ${FAST_LEGEND_ODDS_RATIO}배`,
      },
      {
        title: `${GRID_SIZE}칸이 꽉 차면 교체해요`,
        body: '적게 버는 상품을 바꿔요',
      },
      {
        title: '같은 종류끼리 모으세요',
        body: `${GRID_SIZE}칸을 한 종류로 채우면 ${MAX_SYNERGY}배!`,
      },
      {
        title: '돈이 가장 많으면 1등',
        body: '끝날 때 가진 돈으로 정해요',
      },
    ],
  },
  // 숫자는 모두 lib/game/cafe.ts · cafeItems.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(음식 채우기 · 재고 · 서빙 · 손님 · 상점 · 아이템)만 씁니다.
  cafe: {
    gameMode: 'cafe',
    title: '달콤 바삭 카페',
    subtitle: '퀴즈를 맞혀 음식을 채우고, 손님을 서빙해 돈을 벌어요.',
    slides: [
      {
        title: '음식 채우기를 눌러요',
        body: '퀴즈를 풀어야 음식을 만들어요',
      },
      {
        title: '맞히면 재고가 생겨요',
        body: `해금된 메뉴 재고가 ${RESTOCK_PER_CORRECT}개 늘어요`,
      },
      {
        title: '아이템을 하나 골라요',
        body: `정답이면 ${ITEM_CHOICE_COUNT}개 중에서 골라요`,
      },
      {
        title: '손님을 눌러 서빙해요',
        body: '주문한 메뉴 재고가 있어야 해요',
      },
      {
        title: `손님은 ${CUSTOMER_PATIENCE_SECONDS}초만 기다려요`,
        body: `${MAX_CUSTOMERS_IN_LINE}명까지 줄을 서요`,
      },
      {
        title: `${RARE_ITEM_STREAK}연속이면 희귀 아이템`,
        body: `${CAFE_ITEMS.GOLDEN_SPATULA.name}은 다음 서빙 ${GOLDEN_SPATULA_MULTIPLIER}배!`,
      },
      {
        title: '돈으로 메뉴를 열어요',
        body: `${CAFE_BEST_SELL.name}는 한 개에 ${CAFE_BEST_SELL.sellPrice.toLocaleString()}원!`,
      },
      {
        title: '돈이 가장 많으면 1등',
        body: '끝날 때 가진 돈으로 정해요',
      },
    ],
  },
  mafia: {
    gameMode: 'mafia',
    title: '쉿! 마피아',
    subtitle: '퀴즈와 선택으로 금고, 조사, 심리전을 오가는 게임입니다.',
    slides: [
      {
        title: '목표',
        body: '역할과 상황을 활용해 가장 유리한 결과를 만듭니다.',
        points: ['정답으로 행동 기회 확보', '상대 움직임 관찰', '중요한 순간에 선택'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈를 풀며 조사와 행동의 기회를 얻습니다.',
        points: ['정보 확인', '대상 선택', '심리전 활용'],
      },
      {
        title: '승리 기준',
        body: '점수와 역할 수행 결과가 순위에 영향을 줍니다.',
        points: ['정답률 확보', '선택 실수 줄이기', '상황 변화 읽기'],
      },
    ],
  },
  dontlookdown: {
    gameMode: 'dontlookdown',
    title: '점프점프',
    subtitle: '퀴즈를 풀고 발판을 올라 정상에 가까워지는 등반 게임입니다.',
    slides: [
      {
        title: '목표',
        body: '떨어지지 않고 최대한 높이 올라갑니다.',
        points: ['정답으로 진행 기회 확보', '발판을 침착하게 선택', '높이 올라갈수록 집중'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈와 점프 판단이 함께 이어집니다.',
        points: ['문제 풀기', '다음 발판 확인', '위험한 발판 피하기'],
      },
      {
        title: '승리 기준',
        body: '종료 시점에 더 높은 곳에 도달한 플레이어가 앞섭니다.',
        points: ['높이 기록', '생존 유지', '실수 줄이기'],
      },
    ],
  },
  // 숫자는 모두 lib/game/tower.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(웨이브 · 출구 · 체력 · 골드 · 타워)만 씁니다.
  tower: {
    gameMode: 'tower',
    title: '타워 디펜스',
    subtitle: '퀴즈를 풀어 골드를 모으고, 타워를 세워 적을 막아요.',
    slides: [
      {
        title: `웨이브 ${WAVES.length}번 막으면 이겨요`,
        body: '적이 계속 몰려와요',
      },
      {
        title: '출구로 나가면 체력 깎여요',
        body: '체력 0이면 게임 끝',
      },
      {
        title: `먼저 퀴즈 ${TOWER_QUIZZES_PER_WAVE}문제`,
        body: '다 풀어야 웨이브 시작',
      },
      {
        title: '맞히면 골드를 받아요',
        body: `빨리 풀면 ${getQuizGoldRange().max}골드!`,
      },
      {
        title: `${TOWER_QUIZZES_PER_WAVE}문제 다 맞히면 아이템`,
        body: '하나만 틀려도 못 받아요',
      },
      {
        title: '골드로 타워를 세워요',
        body: '길 위에는 못 세워요',
      },
    ],
  },
  zombie: {
    gameMode: 'zombie',
    title: '좀비를 피해라!',
    subtitle: '퀴즈를 풀며 감염을 피하고 제한 시간 동안 생존합니다.',
    slides: [
      {
        title: '목표',
        body: '좀비 감염을 피하면서 끝까지 살아남습니다.',
        points: ['정답으로 생존 행동 확보', '위험 신호 확인', '팀 상황 살피기'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈, 조사, 회복, 방어가 상황에 따라 이어집니다.',
        points: ['문제 풀기', '역할과 상태 확인', '필요한 행동 선택'],
      },
      {
        title: '승리 기준',
        body: '생존 여부와 게임 내 기여가 결과에 반영됩니다.',
        points: ['감염 피하기', '정답률 유지', '마지막까지 생존'],
      },
    ],
  },
  treat_rush: {
    gameMode: 'treat_rush',
    title: '간식런',
    subtitle: '달리며 장애물을 피하고 퀴즈로 점수를 올립니다.',
    slides: [
      {
        title: '목표',
        body: '끝까지 달리며 간식과 점수를 최대한 모읍니다.',
        points: ['장애물 피하기', '퀴즈로 보상 획득', '속도감 있게 플레이'],
      },
      {
        title: '플레이 방식',
        body: '달리기 조작과 퀴즈 풀이가 번갈아 등장합니다.',
        points: ['점프와 슬라이드', '퀴즈 정답 선택', '아이템 박스 활용'],
      },
      {
        title: '승리 기준',
        body: '주행 점수와 퀴즈 보상을 합쳐 순위가 정해집니다.',
        points: ['오래 달리기', '정답 많이 맞히기', '아이템 놓치지 않기'],
      },
    ],
  },
  // 숫자는 모두 lib/game/강아지대소동.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(랜덤박스 · 대소동 · 똥 · 뼈다귀 · 콤보 · 점수)만 씁니다.
  poop_dodge: {
    gameMode: 'poop_dodge',
    title: '강아지 대소동',
    subtitle: '퀴즈를 맞혀 랜덤박스를 열고, 떨어지는 똥을 피해요.',
    slides: [
      {
        title: `퀴즈를 맞히면 +${CORRECT_ROUND_SCORE}점`,
        body: '틀리면 점수 없이 대소동만 해요',
      },
      {
        title: `랜덤박스 ${PUPPY_CARD_CHOICE_COUNT}개 중 하나를 골라요`,
        body: `${CARD_PICK_SECONDS}초가 지나면 저절로 열려요`,
      },
      {
        title: '좌우로 움직여 똥을 피해요',
        body: `${CORRECT_ROUND_SECONDS}초만 버티면 끝!`,
      },
      {
        title: `똥에 맞으면 -${POOP_HIT_PENALTY}점`,
        body: `뼈다귀를 먹으면 +${BONE_PICKUP_REWARD}점`,
      },
      {
        title: '우산과 청소기가 지켜줘요',
        body: `우산은 한 번 막고, 청소기는 ${CLEANER_DELAY_SECONDS}초 뒤 싹!`,
      },
      {
        title: `${PUPPY_COMBO_SMALL.streak}연속이면 ${PUPPY_COMBO_SMALL.multiplier}배`,
        body: `${PUPPY_COMBO_BIG.streak}연속으로 맞히면 ${PUPPY_COMBO_BIG.multiplier}배!`,
      },
      {
        title: '친구를 방해하는 카드도 있어요',
        body: `${withJosa(CARD_DEFS.poop_bomb.label, '은/는')} 1등에게, ${withJosa(CARD_DEFS.score_thief.label, '은/는')} 친구 점수 ${SCORE_THIEF_AMOUNT}을 가져와요`,
      },
      {
        title: `${withJosa(CARD_DEFS.golden_dog.label, '이/가')} 나오면 대박`,
        body: `+${GOLDEN_DOG_SCORE}점에 무적까지!`,
      },
      {
        title: '점수가 가장 많으면 1등',
        body: `시간이 끝나면 보너스 대소동 ${BONUS_ROUND_SECONDS}초를 더 해요`,
      },
    ],
  },
}

export function getGameTutorial(gameMode: GameModeId): GameTutorial {
  return GAME_TUTORIALS[gameMode] ?? {
    gameMode,
    title: getGameModeConfig(gameMode).label,
    subtitle: getGameModeConfig(gameMode).description,
    slides: [],
  }
}

export function getTutorialHiddenStorageKey(gameMode: GameModeId): string {
  return `quizdog.gameTutorial.hidden.${gameMode}`
}
