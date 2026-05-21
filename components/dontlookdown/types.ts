export type DontLookDownQuestion = {
  id: string
  type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer: string
}

export type QuizFeedback = {
  text: string
  tone: 'good' | 'bad'
}

export type GameParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export type TrailPoint = {
  x: number
  y: number
  life: number
}

export type BackgroundCloud = {
  x: number
  y: number
  w: number
  speed: number
  alpha: number
}

export type BackgroundStar = {
  x: number
  y: number
  size: number
  alpha: number
}
