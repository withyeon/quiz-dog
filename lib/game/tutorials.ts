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
import { RAID, RAID_ROLES } from '@/lib/game/raid'
import { ARENA } from '@/lib/game/raidArena'
import { BUNGEO, FILLING_BY_ID, GRADE_BY_ID } from '@/lib/game/bungeoppang'
import { RAMEN, VERDICT_MONEY } from '@/lib/game/ramen'
import { GARDEN } from '@/lib/game/garden'
import { SURVIVOR } from '@/lib/game/survivor'
import { BONE_RUSH } from '@/lib/game/boneRush'
import { QUIZPANG } from '@/lib/game/quizpang'

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
    subtitle: '몰래 정해진 좀비를 피해 구조 무전기를 고치고, 헬기가 올 때까지 살아남는 정체 숨김 게임입니다.',
    slides: [
      {
        title: '나는 인간일까, 좀비일까?',
        body: '게임이 시작되면 반의 일부가 몰래 좀비가 됩니다. 내 역할은 나만 볼 수 있어요.',
        points: [
          '인간: 구조 무전기를 다 고쳐 헬기 부르기',
          '좀비: 인간을 감염시키거나 무전기 방해하기',
          '누가 좀비인지는 아무도 모른 채 시작합니다',
        ],
      },
      {
        title: '정답마다 무전기가 고쳐져요',
        body: `인간이 정답을 맞힐 때마다 무전기가 +${ZOMBIE.RADIO_PER_CORRECT}칸씩 고쳐지고, 행동을 하나 더 고를 수 있습니다.`,
        points: [
          `인간: 수리(+${ZOMBIE.RADIO_REPAIR_AMOUNT}칸) · 방어막(공격 1번 막기) · 치료(+${ZOMBIE.HUMAN_HEAL_AMOUNT}) · 스캔·백신`,
          `좀비: 인간 공격(${ZOMBIE.ZOMBIE_BASE_ATTACK} 데미지) 또는 무전기 방해(−${ZOMBIE.SABOTAGE_AMOUNT}칸)`,
          '첫 1분 동안 반이 맞힌 정답 수로 무전기 목표가 정해져요',
        ],
      },
      {
        title: '스캔하고 백신으로 구해요',
        body: `체력이 0이 되면 감염되지만, 감염된 친구는 백신 ${ZOMBIE.VACCINE_DOSES}발을 맞으면 인간으로 돌아옵니다.`,
        points: [
          '스캔하면 처음 좀비인지 감염된 친구인지 알 수 있어요 (처음 좀비는 백신이 안 들어요)',
          `공격받은 친구는 ${ZOMBIE.HIDE_SECONDS}초 동안 숨어서 다시 공격받지 않아요`,
          '문제를 틀려도 체력은 그대로 — 그 턴에 행동만 못 해요',
        ],
      },
      {
        title: '승리와 순위',
        body: `무전기를 다 고치면 헬기가 ${ZOMBIE.HELI_SECONDS}초 뒤에 와요. 그때 인간이 남아 있으면 인간 팀 승리입니다.`,
        points: [
          '시간 안에 무전기를 못 고치거나, 인간이 모두 감염되면 좀비 팀 승리',
          `헬기를 부른 뒤에는 좀비 공격력 ×${ZOMBIE.HELI_RUSH_MULTIPLIER} — 마지막까지 버텨요`,
          '순위: 살아남은 인간(수리·구출) 먼저, 그다음 좀비(감염·방해)',
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
  // 숫자는 모두 lib/game/raid.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  // 화면에 실제로 뜨는 낱말(펭귄 · 체력 · 데미지 · 얼음 방패 · 필살기 · 기절 · 역할)만 씁니다.
  raid: {
    gameMode: 'raid',
    title: '황제 펭귄을 막아라!',
    subtitle: '퀴즈로 물풍선을 얻고, 아레나에서 펭귄을 맞히는 협동 게임입니다. 경쟁이 아니라 모두가 한 편이에요.',
    slides: [
      {
        title: '퀴즈를 맞히면 물풍선이 생겨요',
        body: `물풍선은 퀴즈를 맞혀야 생겨요. 정답 하나에 물풍선 ${ARENA.BALLOONS_PER_ANSWER}개! 퀴즈를 푸는 동안 내 아레나는 멈춰 있으니 천천히 풀어도 돼요.`,
        points: [
          `한 번에 ${ARENA.MAX_BALLOONS}개까지 모아 둘 수 있어요`,
          '틀려도 물풍선을 잃지 않아요. 연속 정답만 끊겨요',
          `${RAID.COMBO_STEPS[0].streak}연속 정답부터 한 방이 더 세져요`,
        ],
      },
      {
        title: '물풍선을 놓아 펭귄을 맞혀요',
        body: `방향키로 움직이고 스페이스(폰은 물풍선 버튼)로 물풍선을 놓아요. ${ARENA.BALLOON_FUSE}초 뒤 십자 물줄기가 터져요. 물줄기가 펭귄에 닿으면 ${RAID.BASE_DAMAGE} 데미지! 눈 블록을 부수면 아이템(물약=긴 물줄기·스케이트=빠르게·바늘=갇혀도 바로 탈출)이 나와요. 물풍선은 퀴즈로만 채울 수 있어요.`,
        points: [
          '내 물줄기에 맞아도 갇혀요. 놓고 바로 피하기!',
          '갇히면 물풍선 버튼을 연타해 빨리 빠져나와요. 바늘이 있으면 바로 탈출!',
          '펭귄은 처음엔 가만히 있다가 물보라로 블록을 쓸고 움직여요',
        ],
      },
      {
        title: '스노우몬은 얼려서 깨요',
        body: `펭귄이 떨어뜨린 알에서 스노우몬이 나와요. 물줄기에 맞으면 얼어붙고, 얼어 있는 동안 몸으로 부딪히면 깨져요. 깨면 펭귄 체력도 ${ARENA.SNOWMAN_KILL_DAMAGE} 깎여요.`,
        points: [
          `${ARENA.FREEZE_TIME}초 안에 못 깨면 녹아서 폭주해요(아주 빨라요)`,
          '알은 부화 전에 물줄기로 바로 깰 수 있어요',
          '움직이는 스노우몬에 닿으면 갇혀요',
        ],
      },
      {
        title: '방패와 필살기는 반 전체가 함께',
        body: `펭귄 체력이 ${toPercent(RAID.SHIELD_HP_RATIO)}% 아래면 얼음 방패가 올라와요. 반의 ${toPercent(RAID.SHIELD_REQUIRED_RATIO)}%가 한 번씩 맞혀야 깨져요. ${RAID.SKILL_PERIOD}초마다 펭귄이 ${RAID.SKILL_CHARGE}초 동안 필살기를 모아요 — 그 사이 반의 ${toPercent(RAID.INTERRUPT_REQUIRED_RATIO)}%가 맞히면 끊기고 펭귄이 기절해요(데미지 ${RAID.GROGGY_MULTIPLIER}배).`,
        points: [
          `${RAID_ROLES.warrior.name}는 한 방이 세고, ${RAID_ROLES.mage.name}는 물줄기가 길어요`,
          `${RAID_ROLES.guardian.name}는 보호막이 한 번 막아 줘요`,
          '못 끊으면 보라색으로 예고된 줄에 눈보라 물줄기가 지나가요. 피하면 돼요',
        ],
      },
    ],
  },
  // 숫자는 모두 lib/game/bungeoppang.ts 의 상수에서 가져옵니다. 밸런스가 바뀌면 문구도 함께 바뀝니다.
  bungeoppang: {
    gameMode: 'bungeoppang',
    title: '붕어빵 굽굽!',
    subtitle: '퀴즈를 맞히고 붕어빵을 구운 뒤, 딱 좋은 타이밍에 뒤집어 점수를 얻어요.',
    slides: [
      {
        title: '퀴즈를 맞히면 붕어빵 굽기 찬스!',
        body: '반죽이 틀에 들어가고 굽기 게이지가 차올라요. 틀리면 굽기 없이 다음 문제로 넘어가요.',
      },
      {
        title: '딱 좋은 타이밍에 「뒤집기!」',
        body: `게이지가 ${GRADE_BY_ID.perfect.emoji} 완벽 구간에 있을 때 누르면 ${GRADE_BY_ID.perfect.score}점! 탔어도 ${GRADE_BY_ID.burnt.score}점은 받아요.`,
        points: [
          `${GRADE_BY_ID.underdone.label} ${GRADE_BY_ID.underdone.score} · ${GRADE_BY_ID.tasty.label} ${GRADE_BY_ID.tasty.score} · ${GRADE_BY_ID.perfect.label} ${GRADE_BY_ID.perfect.score} · ${GRADE_BY_ID.crispy.label} ${GRADE_BY_ID.crispy.score} · ${GRADE_BY_ID.burnt.label} ${GRADE_BY_ID.burnt.score}`,
          '스페이스바나 엔터로도 뒤집을 수 있어요',
          '끝까지 안 뒤집으면 저절로 타 버려요',
        ],
      },
      {
        title: '구우면 속이 랜덤으로 공개돼요',
        body: `팥은 기본, 슈크림 ×${FILLING_BY_ID.cream.multiplier}, 치즈 ×${FILLING_BY_ID.cheese.multiplier}. 쌍둥이는 한 번에 2개! 황금 붕어빵은 ×${FILLING_BY_ID.golden.multiplier} 잭팟!`,
        points: [
          `초코 붕어빵이 나오면 다음 게이지가 느려져 완벽 맞히기가 쉬워져요`,
          `황금 붕어빵은 ${Math.round(BUNGEO.GOLDEN_BASE_CHANCE * 100)}% 확률로 나와요`,
        ],
      },
      {
        title: `철판 ${BUNGEO.TRAY_SIZE}칸을 다 채우면 한 판 완성!`,
        body: `붕어빵 하나마다 칸이 하나 채워지고, ${BUNGEO.TRAY_SIZE}개를 채우면 +${BUNGEO.TRAY_BONUS}점 보너스. 그리고 새 판이 시작돼요.`,
      },
      {
        title: `완벽 ${BUNGEO.FIRE_MODE_STREAK}연속이면 불맛 모드!`,
        body: `연속으로 완벽하게 구우면 PERFECT 콤보가 올라가고, ${BUNGEO.FIRE_MODE_STREAK}연속이면 다음 붕어빵 점수가 ${BUNGEO.FIRE_MODE_MULTIPLIER}배! 정답 연속이 아니라 굽기 연속이에요.`,
      },
      {
        title: '랜덤 이벤트와 아이템',
        body: '한파주의보(점수 UP), 화력 폭주(게이지 빨라짐), 버터 타임(완벽 구간 넓어짐), 황금 반죽, 단골손님 미션이 가끔 찾아와요. 따뜻한 장갑 같은 아이템도 랜덤으로 나와요.',
      },
      {
        title: '점수가 가장 높으면 오늘의 붕어빵 장인 👑',
        body: '끝나면 불판의 지배자·붕어빵 부자·황금손·팥 러버 같은 칭호도 받아요. 1등이 아니어도 하나는 꼭!',
      },
    ],
  },
  // 숫자는 lib/game/ramen.ts 의 상수에서 가져옵니다.
  ramen: {
    gameMode: 'ramen',
    title: '퀴즈독의 라면가게',
    subtitle: '퀴즈를 맞히면 손님이 와요. 끓는 타이밍에 파·계란을 넣고 바로 쟁반에 올려 1,000원 라면을 팔아요.',
    slides: [
      {
        title: '퀴즈를 맞히면 손님이 와요',
        body: `정답 하나에 손님 1~${RAMEN.MAX_CUSTOMERS}명이 랜덤으로 와요. 손님 수만큼 냄비가 놓이고, 한 냄비가 라면 한 그릇이에요. 틀리면 손님 없이 다음 문제로.`,
      },
      {
        title: '면·스프 먼저, 물은 나중에',
        body: `면과 스프는 아무 때나 넣어도 돼요. 물을 붓는 순간 타이머가 시작돼요 — ${(RAMEN.HEAT_MS / 1000).toFixed(1)}초 뒤에 끓기 시작하고, 끓고 ${(RAMEN.BOIL_MS / 1000).toFixed(1)}초가 지나면 타 버려요.`,
        points: [
          '냄비를 눌러 고르고, 아래 재료 선반에서 넣어요',
          '키보드: 1·2·3 냄비 선택, Q 면 · W 스프 · E 물 · R 파 · T 계란',
          '물·면·스프 중 하나라도 빠지면 손님이 냄비를 던져요 (0원)',
        ],
      },
      {
        title: '「끓는다!」가 깜빡이면 파·계란 → 바로 쟁반!',
        body: `끓을 때 파와 계란을 넣고 바로 쟁반에 올리면 ${VERDICT_MONEY.perfect.toLocaleString()}원! 끓기 전에 넣으면 고명이 퍼져서 값이 떨어져요.`,
        points: [
          `둘 다 끓을 때 ${VERDICT_MONEY.perfect.toLocaleString()}원 · 하나만 일찍 ${VERDICT_MONEY.good}원 · 둘 다 일찍 ${VERDICT_MONEY.okay}원`,
          `고명 없는 기본 라면 ${VERDICT_MONEY.plain}원 · 덜 익음·많이 익음은 ${VERDICT_MONEY.bad}~${VERDICT_MONEY.plain_plus}원`,
          '탄 냄비는 손님이 거부해요. 0원!',
        ],
      },
      {
        title: '냄비 여러 개를 동시에!',
        body: '손님이 2~3명이면 냄비도 2~3개. 한 냄비에 물을 붓고 끓는 동안 다른 냄비에 면·스프를 넣어 두면 돼요. 손님 인내심이 다 떨어지면 남은 손님은 떠나요.',
        points: [
          '쟁반에 올리면 선택이 다음 냄비로 저절로 넘어가요',
          '냄비 3개를 전부 1,000원으로 팔면 👑 세 냄비 완벽!',
        ],
      },
      {
        title: `${RAMEN.GOAL_MONEY.toLocaleString()}원을 모으면 오늘 장사 성공!`,
        body: `번 돈이 많은 사람이 1등. ${RAMEN.GOAL_MONEY.toLocaleString()}원을 넘길 때마다 축하가 떠요. 끝나면 라면 장인·손님 몰이 사장 같은 칭호도 받아요. 1등이 아니어도 하나는 꼭!`,
      },
    ],
  },
  // 숫자는 lib/game/garden.ts 의 상수에서 가져옵니다.
  garden: {
    gameMode: 'garden',
    title: '블록 텃밭 키우기',
    subtitle: '퀴즈를 맞히면 씨앗을 받아요. 블록 밭에 심고, 키우고, 수확해서 팔아 텃밭 부자가 돼요.',
    slides: [
      {
        title: '퀴즈를 맞히면 카드 3장 중 하나!',
        body: `정답이면 무료 씨앗 카드 ${GARDEN.CHOICES}장이 나와요. 하나를 고르면 밭으로 가요. 틀려도 밭은 계속 자라요.`,
        points: [
          '흔함 → 보통 → 희귀 → 전설 → 신화 순서로 귀해요',
          '귀한 씨앗일수록 오래 자라지만 비싸게 팔려요',
        ],
      },
      {
        title: '심고, 기다리고, 수확!',
        body: `씨앗 가방에서 씨앗을 고르고 빈 칸을 누르면 심겨요. 다 자란 작물을 누르면 수확해서 바로 코인이 돼요. 밭에는 ${Math.round(GARDEN.VISIT_MS / 1000)}초 동안 있을 수 있어요.`,
        points: [
          '딸기·토마토·사과나무는 한 번 심으면 여러 번 열려요',
          '퀴즈를 푸는 동안에도 작물은 자라요',
        ],
      },
      {
        title: '번 돈으로 밭을 키워요',
        body: '씨앗 가게에서 씨앗을 사고, 밭을 넓히고, 스프링클러로 더 빨리 키워요. 씨앗 가게는 문제를 맞힐 때마다 새로 채워져요.',
      },
      {
        title: '황금·무지개 작물은 대박!',
        body: `다 자랄 때 가끔 특별한 작물이 돼요. ✨황금은 ${GARDEN.GOLD_MULT}배, 🌈무지개는 ${GARDEN.RAINBOW_MULT}배! 비가 오면 빨리 자라고 💧촉촉(${GARDEN.WET_MULT}배) 작물이 생길 수도 있어요.`,
      },
      {
        title: '친구 밭에 까마귀를!',
        body: `가끔 까마귀 카드가 나와요. 친구 밭에 보내면, 친구가 ${GARDEN.CROW_SHOO_TAPS}번 톡톡 눌러 쫓지 못할 때 작물 하나가 다시 자라야 해요. 허수아비가 있으면 막아 줘요.`,
        points: [
          '번 돈이 가장 많은 사람이 1등이에요 (씨앗을 사도 번 돈은 줄지 않아요)',
          '끝나면 텃밭 부자·황금 손·수확왕 같은 칭호도 받아요',
        ],
      },
    ],
  },
  // 숫자는 lib/game/survivor.ts 의 상수에서 가져옵니다.
  survivor: {
    gameMode: 'survivor',
    title: '멍멍 서바이벌',
    subtitle: '몰려오는 몬스터를 피해 버티면서, 문제를 맞혀 퀴즈독을 강하게 키워요.',
    slides: [
      {
        title: '움직이기만 하면 공격은 저절로!',
        body: '방향키·WASD로 움직여요. 태블릿·폰은 화면 아무 데나 누르고 끌면 돼요. 퀴즈독은 가진 스킬로 알아서 공격해요.',
        points: [
          '몬스터에 닿으면 체력이 줄어요',
          '몬스터를 물리치면 점수와 파란 경험치 보석이 나와요',
        ],
      },
      {
        title: '레벨 업 = 문제!',
        body: `보석을 모아 레벨이 오르면 내 화면만 멈추고 문제가 나와요. 맞히면 스킬 카드 ${SURVIVOR.CHOICES}장 중 하나를 골라요. 틀려도 카드 1장이 랜덤으로 붙어요.`,
        points: [
          '뼈다귀·빙글빙글 공·멍멍 짖기·번개·원반·간식 폭탄',
          '같은 스킬을 또 고르면 더 세져요 (최대 Lv.5)',
        ],
      },
      {
        title: '쓰러져도 괜찮아요',
        body: '체력이 다 떨어지면 문제가 나와요. 맞히면 그 자리에서 다시 일어나고, 주변 몬스터도 싹 사라져요. 점수는 그대로예요.',
      },
      {
        title: '대왕 슬라임을 물리쳐요',
        body: `${Math.round(SURVIVOR.BOSS_FIRST_MS / 60000 * 10) / 10}분 버틸 때마다 대왕 슬라임이 나타나요. 물리치면 보물 상자가 나오고, 주우면 문제를 하나 더 풀고 스킬을 하나 더 받아요.`,
        points: [
          '몬스터를 많이 물리친 사람이 1등이에요',
          '끝나면 몬스터 사냥꾼·보스 헌터 같은 칭호도 받아요',
        ],
      },
    ],
  },
  // 숫자는 lib/game/boneRush.ts 의 상수에서 가져옵니다.
  bone_rush: {
    gameMode: 'bone_rush',
    title: '뼈다귀 쟁탈전',
    subtitle: '뼈다귀를 모으고, 친구 뼈다귀를 훔치고, 내 뼈다귀는 지켜요.',
    slides: [
      {
        title: '마당을 뛰어다니며 뼈다귀를 주워요',
        body: '방향키·WASD로 움직여요. 태블릿·폰은 화면 아무 데나 누르고 끌면 돼요. 주운 뼈다귀는 꼬리처럼 줄줄이 따라와요 — 그게 내 점수예요.',
        points: [
          `반짝이는 황금 뼈다귀는 ${BONE_RUSH.GOLD_BONE_VALUE}개 값이에요`,
          '뼈다귀는 계속 떨어지니까 쉬지 말고 주워요',
        ],
      },
      {
        title: '보물 상자 = 문제!',
        body: `마당에 보물 상자가 나타나요. 가서 닿으면 내 화면만 멈추고 문제가 나와요. 맞히면 카드 ${BONE_RUSH.CHOICES}장 중 하나를 골라요. 틀려도 기회가 ${BONE_RUSH.CHEST_TRIES}번 있어요 — 다 틀리면 상자가 잠기고 다음 상자를 기다려요(뼈다귀는 안 줄어요).`,
        points: [
          `뼈다귀 보따리: 바로 뼈다귀 ${BONE_RUSH.SACK_BONES}개 (가끔 황금 보따리 ${BONE_RUSH.GOLD_SACK_BONES}개!)`,
          '도둑 고양이 보내기 · 울타리 세우기',
        ],
      },
      {
        title: '도둑 고양이로 친구 뼈다귀를 훔쳐요',
        body: `친구를 고르면 그 친구 마당에 고양이가 들어가 ${Math.round(BONE_RUSH.CAT_CHASE_MS / 1000)}초 동안 쫓아다녀요. 닿을 때마다 뼈다귀 ${BONE_RUSH.CAT_BITE}개씩, 최대 ${BONE_RUSH.CAT_MAX_BITES}번 물어 와요. 물어 온 뼈다귀는 내 마당으로 배달돼요.`,
        points: [
          '친구가 잘 도망치면 빈손으로 돌아올 수도 있어요',
          '뼈다귀가 많은 친구를 노릴까, 복수를 할까?',
        ],
      },
      {
        title: '내 마당에 고양이가 오면 도망쳐요!',
        body: `퀴즈독은 고양이가 가까이 오면 저절로 "멍!" 짖어서 밀어내요. 울타리가 있으면 고양이가 아예 못 들어와요(최대 ${BONE_RUSH.FENCE_MAX}개). 가끔 오는 들고양이는 뼈다귀를 땅에 흩뿌리기만 하니까 다시 주우면 돼요.`,
        points: [
          '끝났을 때 뼈다귀가 가장 많은 사람이 1등이에요',
          '뼈다귀 부자·고양이 조련사·철벽 울타리 같은 칭호도 받아요',
        ],
      },
    ],
  },
  // 숫자는 lib/game/quizpang.ts 의 상수에서 가져옵니다.
  quizpang: {
    gameMode: 'quizpang',
    title: '퀴즈팡팡',
    subtitle: '강아지 블록을 맞춰 팡팡 터뜨리고, 문제를 맞혀 아이템을 모아요.',
    slides: [
      {
        title: '같은 강아지 3마리를 모아요',
        body: `강아지 블록을 끌어서 이웃과 자리를 바꿔요. 같은 강아지 ${QUIZPANG.SPECIAL.cross.match - 1}마리가 가로나 세로로 모이면 팡! 터지고, 위 블록이 떨어져 또 터지면 콤보 점수가 붙어요(최대 ${QUIZPANG.CHAIN_MAX_MULT}배).`,
        points: [
          `${QUIZPANG.SPECIAL.cross.match}마리를 맞추면 줄 폭탄 강아지(터질 때 가로·세로 한 줄씩), ${QUIZPANG.SPECIAL.boom.match}마리·ㄱ자는 대폭탄 강아지`,
          '가능한 짝이 없으면 저절로 섞여요',
        ],
      },
      {
        title: `${QUIZPANG.QUESTION_INTERVAL_MS / 1000}초마다 문제!`,
        body: `퍼즐을 하다 보면 문제가 나와요. 맞히면 아이템 카드 ${QUIZPANG.CHOICES}장 중 하나를 골라 보관함에 넣어요. 틀리면 정답을 보고 한 문제 더 풀어요(아이템은 없어요).`,
        points: [
          '문제를 푸는 동안에도 게임 시간은 흘러요 — 빨리 풀수록 퍼즐할 시간이 많아요',
        ],
      },
      {
        title: '아이템은 원할 때 써요',
        body: `멍멍 폭탄(3×3 제거)·줄줄이 뼈다귀(한 줄 제거)·빙글빙글 셔플(보드 섞기)·점수 2배 간식(${QUIZPANG.ITEMS.double.ms / 1000}초). 보관함은 ${QUIZPANG.INVENTORY_SLOTS}칸이에요.`,
        points: [
          '폭탄·줄 삭제는 보드에서 자리를 눌러서 써요',
          '점수가 가장 높은 사람이 1등! 콤보 마스터·퀴즈 박사 같은 칭호도 받아요',
        ],
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
