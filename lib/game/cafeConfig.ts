export const MAX_CUSTOMERS_IN_LINE = 3

export type CafeQuizQuestion = {
  id: string
  question_text: string
  options: string[]
  answer: string
}

export const CAFE_DUMMY_QUESTIONS: CafeQuizQuestion[] = [
  {
    id: '1',
    question_text: '한국의 수도는?',
    options: ['서울', '부산', '대구', '인천'],
    answer: '서울',
  },
  {
    id: '2',
    question_text: '태양계에서 가장 큰 행성은?',
    options: ['지구', '목성', '토성', '화성'],
    answer: '목성',
  },
  {
    id: '3',
    question_text: '2 + 2는?',
    options: ['3', '4', '5', '6'],
    answer: '4',
  },
  {
    id: '4',
    question_text: '한국의 독립기념일은?',
    options: ['3월 1일', '8월 15일', '10월 3일', '12월 25일'],
    answer: '8월 15일',
  },
  {
    id: '5',
    question_text: '지구의 위성은?',
    options: ['화성', '금성', '달', '태양'],
    answer: '달',
  },
]
