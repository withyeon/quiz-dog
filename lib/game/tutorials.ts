import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'

export type GameTutorialSlide = {
  title: string
  body: string
  points: string[]
}

export type GameTutorial = {
  gameMode: GameModeId
  title: string
  subtitle: string
  slides: GameTutorialSlide[]
}

const sharedQuizPoint = '퀴즈를 맞히면 게임에 필요한 행동이나 보상이 열립니다.'

export const GAME_TUTORIALS: Record<GameModeId, GameTutorial> = {
  gold_quest: {
    gameMode: 'gold_quest',
    title: '해적왕의 보물찾기',
    subtitle: '퀴즈를 풀어 골드를 모으고 보물을 향해 항해합니다.',
    slides: [
      {
        title: '목표',
        body: '가장 많은 골드와 보물을 모은 플레이어가 앞서갑니다.',
        points: ['정답을 맞히면 골드 획득', '아이템과 공격으로 흐름 뒤집기', '끝까지 점수 유지하기'],
      },
      {
        title: '퀴즈와 보상',
        body: sharedQuizPoint,
        points: ['정답은 바로 보상으로 연결', '연속 정답은 유리한 흐름 생성', '오답이어도 다음 문제로 재도전'],
      },
      {
        title: '승리 기준',
        body: '종료 시점에 보유 골드가 높은 순서로 순위가 정해집니다.',
        points: ['골드 현황 확인', '위험한 상대 견제', '마지막 문제까지 집중'],
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
  fishing: {
    gameMode: 'fishing',
    title: '두근두근 인형뽑기',
    subtitle: '퀴즈를 풀고 뽑기 기회를 얻어 희귀 인형을 노립니다.',
    slides: [
      {
        title: '목표',
        body: '인형을 뽑아 점수를 쌓고 더 좋은 보상을 노립니다.',
        points: ['정답으로 뽑기 기회 획득', '희귀 인형일수록 높은 점수', '기회를 아껴 쓰기'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈와 뽑기가 번갈아 이어지며, 집중력과 운이 함께 필요합니다.',
        points: ['문제 풀기', '뽑기 위치 선택', '획득 점수 확인'],
      },
      {
        title: '승리 기준',
        body: '종료 시점에 뽑기 점수가 높은 플레이어가 앞섭니다.',
        points: ['정답 수 늘리기', '좋은 인형 노리기', '시간 안에 빠르게 판단'],
      },
    ],
  },
  factory: {
    gameMode: 'factory',
    title: '전설의 편의점',
    subtitle: '퀴즈를 풀며 상품을 운영하고 매출을 올리는 경영 게임입니다.',
    slides: [
      {
        title: '목표',
        body: '편의점을 잘 운영해 가장 많은 돈을 모읍니다.',
        points: ['정답으로 운영 자원 확보', '상품과 매출 관리', '꾸준히 수익 올리기'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈 결과가 편의점 운영 흐름에 영향을 줍니다.',
        points: ['문제 풀기', '상품 선택과 판매', '수익 변화 확인'],
      },
      {
        title: '승리 기준',
        body: '종료 시점에 보유 금액이 높은 플레이어가 높은 순위에 오릅니다.',
        points: ['빠른 정답', '좋은 선택', '매출 누적'],
      },
    ],
  },
  cafe: {
    gameMode: 'cafe',
    title: '달콤 바삭 카페',
    subtitle: '퀴즈로 주문을 처리하고 카페 점수를 쌓습니다.',
    slides: [
      {
        title: '목표',
        body: '손님에게 음식을 잘 서빙해 높은 점수를 얻습니다.',
        points: ['정답으로 서빙 진행', '아이템으로 흐름 강화', '점수 꾸준히 누적'],
      },
      {
        title: '플레이 방식',
        body: '문제를 맞히고 카페 운영 선택을 이어갑니다.',
        points: ['주문 확인', '퀴즈 풀이', '보상 또는 아이템 선택'],
      },
      {
        title: '승리 기준',
        body: '종료 시점에 카페 점수가 높은 플레이어가 앞섭니다.',
        points: ['정확도 유지', '아이템 타이밍', '끊기지 않는 운영'],
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
  tower: {
    gameMode: 'tower',
    title: '타워 디펜스',
    subtitle: '퀴즈를 풀어 타워를 설치하고 몰려오는 적을 막습니다.',
    slides: [
      {
        title: '목표',
        body: '방어선을 만들고 적의 진입을 최대한 막습니다.',
        points: ['정답으로 설치 자원 확보', '타워 위치 선택', '웨이브 방어'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈 정답이 타워 설치와 강화의 동력이 됩니다.',
        points: ['문제 풀기', '타워 선택', '맵 상황 확인'],
      },
      {
        title: '승리 기준',
        body: '방어 성과와 점수 누적이 순위에 반영됩니다.',
        points: ['적을 많이 막기', '자원 낭비 줄이기', '웨이브 흐름 읽기'],
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
  poop_dodge: {
    gameMode: 'poop_dodge',
    title: '강아지 대소동',
    subtitle: '퀴즈를 풀고 카드를 뽑아 교실의 대소동을 버팁니다.',
    slides: [
      {
        title: '목표',
        body: '카드 효과를 활용하며 점수를 지키고 높입니다.',
        points: ['정답으로 카드 기회 획득', '공격과 방어 효과 확인', '보너스 라운드까지 집중'],
      },
      {
        title: '플레이 방식',
        body: '퀴즈를 맞힌 뒤 카드 선택으로 상황이 바뀝니다.',
        points: ['문제 풀기', '카드 뽑기', '효과 적용 확인'],
      },
      {
        title: '승리 기준',
        body: '종료 시점의 점수와 생존 흐름이 순위를 결정합니다.',
        points: ['점수 누적', '위험 효과 방어', '마지막 카드까지 활용'],
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
