import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'
import { GAME_CONSTANTS as ZOMBIE } from '@/lib/game/zombie'
import {
  PLAYER_CLASSES,
  REVIVAL_STREAK_REQUIRED,
  REVIVAL_HEALTH_RATIO,
  TEAM_MIN_PLAYERS,
} from '@/lib/game/battleRoyale'
import { DEFAULT_SETTINGS as DLD_SETTINGS, ENERGY as DLD_ENERGY } from '@/lib/game/dontlookdown'
import {
  CHEST_COUNT,
  SHIELD_STREAK,
  toPercent,
} from '@/lib/game/goldQuest'
import { TOWER_QUIZZES_PER_WAVE, WAVES, getQuizGoldRange } from '@/lib/game/tower'
import {
  MACHINE_RANK_THRESHOLDS,
  MAX_COMBO_STREAK,
  MAX_MACHINE_RANK,
  getAnswerSpeedLabel,
  getComboState,
  getMachineRankName,
} from '@/lib/game/fishing'
import {
  GRID_SIZE,
  QUIZZES_PER_PRODUCT,
  SPEED_BONUS_PER_SECOND,
  WRONG_PENALTY_RATE,
  getMaxReachableSynergy,
} from '@/lib/game/convenienceStore'
import {
  CUSTOMER_PATIENCE_SECONDS,
} from '@/lib/game/cafe'
import { MAX_CUSTOMERS_IN_LINE } from '@/lib/game/cafeConfig'
import {
  RARE_ITEM_STREAK,
} from '@/lib/game/cafeItems'
import { DIAMOND_CASH_VALUE, INVESTIGATE_RECOVER_RATE, VAULT_COUNT } from '@/lib/game/mafia'
import {
  BONE_PICKUP_REWARD,
  CARD_DEFS,
  COMBO_STEPS,
  CORRECT_ROUND_SCORE,
  GOLDEN_DOG_SCORE,
  POOP_HIT_PENALTY,
  SCORE_THIEF_AMOUNT,
  CARD_CHOICE_COUNT as PUPPY_CARD_CHOICE_COUNT,
} from '@/lib/game/강아지대소동'
import { withJosa } from '@/lib/utils/korean'

/** 오답 때 잃는 비율(%) */
const WRONG_PENALTY_PERCENT = toPercent(WRONG_PENALTY_RATE)
/** 진열대를 한 종류로 채웠을 때 나오는 최대 시너지 배율 */
const MAX_SYNERGY = getMaxReachableSynergy()
/** 마피아: 친구 조사로 몰래보기를 잡았을 때 가져오는 비율(%) */
const MAFIA_RECOVER_PERCENT = toPercent(INVESTIGATE_RECOVER_RATE)

/** 강아지 대소동 콤보 단계 — 낮은 연속수부터 순서대로 (3연속 1.5배 → 5연속 2배) */
const PUPPY_COMBO_STEPS = [...COMBO_STEPS].sort((a, b) => a.streak - b.streak)
const PUPPY_COMBO_SMALL = PUPPY_COMBO_STEPS[0]
const PUPPY_COMBO_BIG = PUPPY_COMBO_STEPS[PUPPY_COMBO_STEPS.length - 1]

export type GameTutorialSlide = {
  title: string
  body?: string
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
        title: '퀴즈를 맞히고 보물 상자를 열어요',
      },
      {
        title: `상자 ${CHEST_COUNT}개 중 하나를 골라요`,
      },
      {
        title: '보물을 찾으면 골드를 받아요',
      },
      {
        title: '함정을 밟으면 골드가 줄어요',
        body: '드래곤을 만나면 골드가 절반 줄어요',
      },
      {
        title: '친구 골드를 빼앗기도 해요',
      },
      {
        title: `${SHIELD_STREAK}연속 정답이면 방어권`,
        body: '함정도 도둑도 한 번 막아줘요',
      },
      {
        title: '골드가 많은 사람이 승리',
      },
    ],
  },
  battle_royale: {
    gameMode: 'battle_royale',
    title: '눈싸움 대작전',
    subtitle: '홍팀과 청팀으로 나뉘어 퀴즈로 눈뭉치를 만들고 상대 팀을 맞히는 팀 대결입니다.',
    slides: [
      {
        title: '팀과 장비를 고릅니다',
        body: `${TEAM_MIN_PLAYERS}명 이상이면 홍팀🔥과 청팀❄️으로 자동으로 나뉩니다. 그다음 장비를 하나 고릅니다.`,
        points: [
          `${PLAYER_CLASSES.ice_fist.icon} ${PLAYER_CLASSES.ice_fist.name} — 세게 던지지만 다음 눈뭉치가 느립니다`,
          `${PLAYER_CLASSES.rapid_fire.icon} ${PLAYER_CLASSES.rapid_fire.name} — 약한 대신 가장 빠르게 던집니다`,
          `${PLAYER_CLASSES.shield.icon} ${PLAYER_CLASSES.shield.name} — 체온 ${PLAYER_CLASSES.shield.maxHealth}에 피해도 덜 받습니다`,
          `${PLAYER_CLASSES.hot_choco.icon} ${PLAYER_CLASSES.hot_choco.name} — 맞힐 때마다 체온 +${PLAYER_CLASSES.hot_choco.healAmount}`,
        ],
      },
      {
        title: '맞히면 던집니다',
        body: '문제를 맞히면 눈뭉치가 장전됩니다. 상대 팀 친구를 골라 던지세요.',
        points: [
          '미리 상대를 찍어두면 정답과 동시에 날아갑니다',
          '빨리 답할수록 데미지가 커집니다 (최대 2배 이상)',
          '같은 팀에게는 던질 수 없어요',
          '가끔 왕눈덩이·눈보라·휴대 난로가 나옵니다',
        ],
      },
      {
        title: '체온이 0이 되면 눈사람',
        body: `눈사람이 되어도 끝이 아닙니다. ${REVIVAL_STREAK_REQUIRED}문제를 연속으로 맞히면 체온 ${Math.round(REVIVAL_HEALTH_RATIO * 100)}%로 돌아옵니다.`,
        points: [
          '눈사람인 동안에는 공격할 수 없어요',
          '중간에 틀리면 연속 정답이 처음부터입니다',
          '시간이 지나면 폭설 주의보로 모두의 체온이 조금씩 떨어집니다',
        ],
      },
      {
        title: '상대 팀을 모두 눈사람으로 만들면 승리!',
        body: '퀴즈를 열심히 풀어서 상대 팀의 체온을 떨어뜨리기',
        points: [
          '시간이 끝나면 남은 체온으로 순위를 매깁니다',
          '혼자 앞서기보다 팀의 생존자 수가 중요합니다',
          `${TEAM_MIN_PLAYERS}명이 안 되면 팀 없이 개인전으로 진행됩니다`,
        ],
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
        title: '퀴즈를 맞히고 뽑기 기회를 얻어요',
      },
      {
        title: '빨리 맞히면 점수 UP',
        body: `5초 안에 맞히면 ${getAnswerSpeedLabel('perfect')}!`,
      },
      {
        title: '집게는 좌우로 움직여요',
        body: '내리기 버튼이나 스페이스바를 눌러요',
      },
      {
        title: '노란색 칸에서 멈추면 점수가 높은 인형이 나와요!',
      },
      {
        title: '인형마다 점수가 달라요',
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
        title: '퀴즈를 맞혀요',
        body: `틀리면 가진 돈의 ${WRONG_PENALTY_PERCENT}%를 잃어요`,
      },
      {
        title: '빨리 맞히면 보너스 UP',
        body: `남은 1초마다 ${SPEED_BONUS_PER_SECOND}원씩!`,
      },
      {
        title: `${QUIZZES_PER_PRODUCT}문제를 맞히면 상품을 진열할 수 있어요`,
      },
      {
        title: '상품을 진열하면 돈이 들어와요',
        body: '상품마다 버는 돈이 달라요',
      },
      {
        title: '퀴즈를 빨리 맞히면 좋은 상품이 나올 확률이 높아져요',
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
        body: '퀴즈를 풀어요',
      },
      {
        title: '퀴즈를 맞히면 음식이 생겨요',
      },
      {
        title: '아이템을 하나 골라요',
        body: '정답이면 아이템을 고를 수 있어요',
      },
      {
        title: '손님을 눌러 서빙해요',
        body: '주문한 메뉴 재고가 있어야 해요',
      },
      {
        title: `손님은 ${CUSTOMER_PATIENCE_SECONDS}초까지 기다리니 문제를 빨리 풀고 음식을 서빙해요`,
        body: `손님은 최대 ${MAX_CUSTOMERS_IN_LINE}명까지 줄을 서요`,
      },
      {
        title: `${RARE_ITEM_STREAK}연속 정답이면 희귀 아이템`,
      },
      {
        title: '상점에서 새로운 메뉴도 살 수 있어요',
      },
      {
        // 순위는 끝났을 때 가진 돈(cash) — 메뉴·업그레이드를 사거나 세금을 내면 줄어든다 (app/cafe/page.tsx 점수 동기화)
        title: '끝났을 때 돈이 가장 많은 사람이 승리!',
        body: '메뉴·업그레이드를 사면 가진 돈이 줄어요',
      },
    ],
  },
  // 숫자는 모두 lib/game/mafia.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(금고 열기 · 친구 조사 · 금고 몰래보기 · 자금 · CLEAR)만 씁니다.
  mafia: {
    gameMode: 'mafia',
    title: '쉿! 마피아',
    subtitle: '퀴즈를 맞히고 금고를 열거나 친구를 조사해 자금을 가장 많이 모아요.',
    slides: [
      {
        title: '퀴즈를 맞히면 금고 열기 또는 친구 조사를 골라요',
      },
      {
        title: `금고 ${VAULT_COUNT}개 중 하나를 열어요`,
        body: '현금, 다이아몬드, 배수(x2)가 들어 있어요',
      },
      {
        title: '금고 몰래보기 버튼을 누르면 금고에 있는 물건을 볼 수 있어요.',
        body: '대신 친구가 조사하면 들켜요',
      },
      {
        title: '친구 조사 버튼을 눌러서 금고를 몰래본 친구를 잡아요',
        body: `성공하면 그 친구 돈의 ${MAFIA_RECOVER_PERCENT}%가 내꺼! 친구가 결백하면 아무 일도 일어나지 않아요`,
      },
      {
        title: '시간이 끝났을 때 돈이 가장 많은 사람이 승리!',
        body: `다이아몬드는 1개당 $${DIAMOND_CASH_VALUE}`,
      },
    ],
  },
  dontlookdown: {
    gameMode: 'dontlookdown',
    title: '점프점프',
    subtitle: '문제를 풀어 에너지를 얻고, 그 에너지로 발판을 올라 정상까지 가는 등반 게임입니다.',
    slides: [
      {
        title: '움직이려면 에너지가 필요해요',
        body: '걷는 것도 점프도 전부 에너지를 씁니다. 에너지가 떨어지면 그 자리에서 한 발짝도 못 움직여요.',
        points: [
          `점프 한 번 ${DLD_ENERGY.JUMP_COST} · 더블 점프 ${DLD_ENERGY.DOUBLE_JUMP_COST} · 걷기 초당 ${Math.round(DLD_ENERGY.MOVE_COST * 60)}`,
          `시작 에너지는 ${DLD_ENERGY.START} — 점프 두 번이면 끝납니다`,
          `떨어지면 ${DLD_ENERGY.FALL_PENALTY}을 잃고 마지막 체크포인트로 돌아가요`,
        ],
      },
      {
        title: '에너지는 문제로 채웁니다',
        body: `Q키(또는 화면의 문제 버튼)로 언제든 문제를 열 수 있어요. 맞히면 에너지 +${DLD_SETTINGS.energyPerQuestion}.`,
        points: [
          '연속으로 맞히면 콤보 보너스가 최대 +400까지 붙습니다',
          '틀리면 에너지가 줄어드니 급하게 찍지 마세요',
          '오르다 막히면 안전한 발판에서 문제를 여러 개 풀어두면 좋아요',
        ],
      },
      {
        title: '조작과 발판',
        body: '좌우 방향키로 이동, 스페이스로 점프(공중에서 한 번 더 누르면 더블 점프)입니다.',
        points: [
          'Shift를 누르면 빨라지지만 에너지를 더 씁니다',
          '체크포인트 발판을 밟아두면 떨어져도 거기서 다시 시작해요',
          '사라지는 발판·가시·움직이는 발판은 위로 갈수록 많아집니다',
          '파워업은 E·R키로 사용합니다 (실드·로켓·유령 등)',
        ],
      },
      {
        title: '승리 기준',
        body: `제한 시간이 끝났을 때 가장 높이 오른 사람이 1등입니다. 정상은 ${DLD_SETTINGS.summitGoal}m예요.`,
        points: [
          '정상에 먼저 닿아도 게임은 시간이 끝날 때까지 이어집니다',
          '떨어져도 기록한 최고 높이는 그대로 남아요',
          '다른 친구들이 지금 어디쯤인지 화면에서 볼 수 있어요',
        ],
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
        body: '챙겨 뒀다가 원할 때 써요',
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
    subtitle: '몰래 정해진 좀비를 피해 제한 시간까지 살아남는 정체 숨김 게임입니다.',
    slides: [
      {
        title: '나는 인간일까, 좀비일까?',
        body: '게임이 시작되면 반의 일부가 몰래 좀비가 됩니다. 내 역할은 나만 볼 수 있어요.',
        points: [
          '인간: 감염되지 않고 제한 시간까지 버티기',
          '좀비: 인간을 모두 감염시키기',
          '누가 좀비인지는 아무도 모른 채 시작합니다',
        ],
      },
      {
        title: '문제를 맞혀야 행동할 수 있어요',
        body: '퀴즈를 맞히면 내 역할에 맞는 행동을 한 번 고를 수 있습니다.',
        points: [
          `인간: 치료(체력 +${ZOMBIE.HUMAN_HEAL_AMOUNT}) · 방어막(+${ZOMBIE.HUMAN_SHIELD_AMOUNT}) · 스캔(한 명의 정체 확인)`,
          `좀비: 인간 한 명을 골라 공격 (${ZOMBIE.ZOMBIE_BASE_ATTACK} 데미지)`,
          `3연속 정답이면 인간은 체력 +${ZOMBIE.CORRECT_STREAK_3_BONUS}, 좀비는 공격력 +${ZOMBIE.ZOMBIE_STREAK_BONUS}`,
        ],
      },
      {
        title: '체력은 좀비 공격으로만 줄어요',
        body: `인간은 체력 ${ZOMBIE.HUMAN_INITIAL_HEALTH}으로 시작합니다. 문제를 틀려도 체력은 그대로지만, 그 턴엔 행동할 수 없고 연속 정답도 끊깁니다.`,
        points: [
          '방어막이 있으면 공격 데미지를 먼저 막아줍니다',
          '체력이 0이 되면 감염되어 좀비 편이 됩니다',
          '좀비가 되어도 계속 플레이해요 — 이제 남은 인간을 감염시키는 편입니다',
        ],
      },
      {
        title: '승리와 순위',
        body: '시간이 끝났을 때 인간이 한 명이라도 남아 있으면 인간 팀 승리입니다.',
        points: [
          '모두 감염되면 그 순간 좀비 팀 승리로 끝납니다',
          '순위는 생존한 인간이 먼저, 그다음 감염시킨 수',
          '스캔으로 확인한 정체는 게임이 끝날 때까지 기억됩니다',
        ],
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
        body: '뼈다귀를 먹고 장애물을 피해요. 방향키를 이용합니다.',
        points: ['장애물 피하기', '퀴즈로 보상 획득', '속도감 있게 플레이'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈를 맞히면 아이템이 나와요',
        points: ['점프와 슬라이드', '퀴즈 정답 선택', '아이템 박스 활용'],
      },
      {
        title: '승리',
        body: '뼈다귀를 많이 모으고 퀴즈를 맞히고 점수를 얻어요. 점수가 많을수록 승리!',
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
      },
      {
        title: '좌우로 움직여 똥을 피해요',
        body: '방향키를 이용합니다. 폰이나 태블릿은 화면 터치와 드래그로 이동합니다.',
      },
      {
        title: `똥에 맞으면 -${POOP_HIT_PENALTY}점`,
        body: `뼈다귀를 먹으면 +${BONE_PICKUP_REWARD}점`,
      },
      {
        title: '퀴즈를 맞혀서 좋은 아이템을 얻으세요',
      },
      {
        title: `${PUPPY_COMBO_SMALL.streak}연속이면 ${PUPPY_COMBO_SMALL.multiplier}배`,
        body: `${PUPPY_COMBO_BIG.streak}연속으로 맞히면 ${PUPPY_COMBO_BIG.multiplier}배!`,
      },
      {
        title: '친구를 방해하는 아이템도 있어요',
        body: `${withJosa(CARD_DEFS.poop_bomb.label, '은/는')} 1등에게, ${withJosa(CARD_DEFS.score_thief.label, '은/는')} 친구 점수 ${SCORE_THIEF_AMOUNT}을 가져와요`,
      },
      {
        title: `${CARD_DEFS.golden_dog.label} 아이템이 제일 좋은거예요`,
        body: `+${GOLDEN_DOG_SCORE}점에 무적까지!`,
      },
      {
        title: '점수가 가장 많으면 1등',
      },
    ],
  },
  study: {
    gameMode: 'study',
    title: '공부 모드',
    subtitle: '게임 없이 문제만 차근차근 풀어요.',
    slides: [
      {
        title: '문제를 하나씩 풀어요',
        body: '시간 제한 없이 내 속도로 넘겨요',
      },
      {
        title: '바로 정답을 확인해요',
        body: '틀리면 정답과 해설이 나와요',
      },
      {
        title: '틀린 문제는 다시 풀어요',
        body: '다 맞힐 때까지 한 번 더!',
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
