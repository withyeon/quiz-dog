/**
 * 퀴즈팡팡 — 규칙·상수·순수 함수.
 *
 * 애니팡식 3매치 퍼즐에 퀴즈를 붙인 퀴즈독 오리지널 모드다.
 * - 8×8 보드에서 이웃한 강아지 블록 둘을 바꿔 같은 강아지 3개 이상을 가로·세로로 맞추면 팡! 터진다.
 *   터진 자리는 위 블록이 떨어져 채우고, 빈칸은 새 블록이 내려온다. 콤보가 이어질수록 점수 배율이 오른다.
 * - 4개를 맞추면 "줄 폭탄 강아지"(터질 때 가로·세로 한 줄씩), 5개·ㄱ자·T자는 "대폭탄 강아지"(5×5)가 생긴다.
 * - 퍼즐 시간이 QUESTION_INTERVAL_MS 쌓일 때마다 내 화면만 멈추고 문제가 나온다(콤보가 끝난 직후).
 *   정답이면 아이템 카드 3장 중 하나를 골라 보관했다가 원할 때 쓴다.
 *   오답이면 정답을 2초 보여 준 뒤 추가 문제 1개 — 맞든 틀리든 퍼즐로 돌아가고 아이템은 없다.
 * - 점수가 가장 높은 사람이 승리. 게임 전체 제한 시간은 선생님이 정하고, 문제를 푸는 동안에도 계속 흐른다.
 *
 * 보드는 같은 방·같은 판이면 같은 시드(방 코드 + 시작 시각)로 만들어 모든 학생이 같은 판으로 시작한다.
 * 퍼즐 계산은 전부 학생 브라우저에서 하고, DB 에는 점수(players.score)와 저장값(players.item_effects)만 쓴다.
 * 서버(Postgres 트리거, sql/20261029_quizpang_mode.sql)는 "경과 시간 × 초당 상한 + 여유분"을 넘는 점수를 잘라 낸다.
 *
 * 학생별 저장은 players 행 두 칸 (새 컬럼 없음):
 *   players.score        = 점수 — 순위 기준
 *   players.item_effects = QuizpangSave JSON (보드·보관함·통계·퍼즐 시간). 새로고침하면 같은 판을 이어 한다.
 */

import { createSeededRandom, hashStringToSeed } from '@/lib/game/dontlookdown'

// ─── 상수 (수치 조절은 여기서만) ───
export const QUIZPANG = {
  /** 퀴즈 제한 시간(초) */
  QUESTION_TIME_LIMIT: 30,
  /** 문제 팝업 간격(퍼즐을 한 시간 기준, ms). 콤보 중이면 끝난 직후에 뜬다 */
  QUESTION_INTERVAL_MS: 30_000,
  /** 오답 때 정답을 보여 주는 시간(ms) */
  WRONG_REVEAL_MS: 2000,
  /** 정답 배너를 보여 준 뒤 카드 화면으로 넘어가는 시간(ms) */
  CORRECT_SHOW_MS: 1000,
  /** 방에 제한 시간이 없을 때(/dev) 화면이 대신 쓰는 게임 시간(초) */
  DEFAULT_DURATION_SECONDS: 300,

  /** 보드 크기·강아지 종류 수 */
  COLS: 8,
  ROWS: 8,
  KINDS: 6,
  /** 블록 그림(기존 강아지 아바타)과 그 배경색 — KINDS 개수만큼 쓴다 */
  /** 퀴즈팡팡 전용 블록 그림(Codex 생성, public/quizpang/block-N.webp). 파티클 색은 블록 판 색과 맞춘다 */
  DOG_IMAGES: ['/quizpang/block-1.webp', '/quizpang/block-2.webp', '/quizpang/block-3.webp', '/quizpang/block-4.webp', '/quizpang/block-5.webp', '/quizpang/block-6.webp'],
  DOG_COLORS: ['#fb923c', '#38bdf8', '#f472b6', '#a78bfa', '#4ade80', '#facc15'],
  DOG_NAMES: ['시바', '비숑', '푸들', '허스키', '달마시안', '웰시코기'],

  /** 한 줄 매치 점수 — index = 맞춘 개수 (6개 이상은 5개 점수 + 개당 EXTRA_BLOCK_SCORE) */
  MATCH_SCORE: [0, 0, 0, 30, 60, 120],
  /** 매치 밖에서 덤으로 터진 블록 한 개 점수 (폭탄·줄 폭탄·아이템) */
  EXTRA_BLOCK_SCORE: 10,
  /** 콤보 배율: 1콤보 1배, 2콤보 1.5배, … 최대 CHAIN_MAX_MULT 배 */
  CHAIN_STEP: 0.5,
  CHAIN_MAX_MULT: 4,

  /** 스페셜 블록: 몇 개를 맞추면 생기나·터질 때 보너스·대폭탄 반경(5×5 = 2) */
  SPECIAL: {
    cross: { match: 4, bonus: 100 },
    boom: { match: 5, bonus: 200, radius: 2 },
  },

  /** 아이템: 카드에 나올 확률 가중치·효과 수치 */
  ITEMS: {
    bomb: { weight: 30, radius: 1 },
    line: { weight: 30 },
    shuffle: { weight: 15 },
    double: { weight: 25, ms: 10_000, mult: 2 },
  },
  /** 정답 때 고르는 카드 수·보관함 칸 수 (가득 차면 가장 오래된 것과 바꾼다) */
  CHOICES: 3,
  INVENTORY_SLOTS: 4,

  /** 애니메이션(ms) */
  ANIM: {
    SWAP_MS: 150,
    POP_MS: 230,
    FALL_MS_PER_CELL: 55,
    FALL_MIN_MS: 150,
    SHUFFLE_MS: 380,
  },

  /** 서버 점수 상한 — SQL 의 quizpang_max_score_per_second()·quizpang_score_grace() 와 같아야 한다 */
  SERVER: {
    MAX_SCORE_PER_SECOND: 300,
    SCORE_GRACE: 3000,
  },
  /** DB 저장 간격(ms) */
  SAVE_INTERVAL_MS: 2000,
} as const

// ─── 타입 ───
export type ItemId = keyof typeof QUIZPANG.ITEMS
export const ITEM_IDS = Object.keys(QUIZPANG.ITEMS) as ItemId[]
export type Special = 'none' | 'cross' | 'boom'
export type LineDir = 'row' | 'col'

export type Block = { id: number; kind: number; special: Special }
export type Cell = { r: number; c: number }
export type Board = (Block | null)[][]

export type ItemInfo = { id: ItemId; label: string; emoji: string; icon: string; needsTarget: boolean; describe: string; short: string }
export const ITEM_INFO: Record<ItemId, ItemInfo> = {
  bomb: { id: 'bomb', label: '멍멍 폭탄', emoji: '💣', icon: '/quizpang/item-bomb.webp', needsTarget: true, describe: '고른 자리 주변 3×3 강아지를 한 번에 팡!', short: '3×3 제거' },
  line: { id: 'line', label: '줄줄이 뼈다귀', emoji: '🦴', icon: '/quizpang/item-line.webp', needsTarget: true, describe: '고른 가로 또는 세로 한 줄을 통째로 팡!', short: '한 줄 제거' },
  shuffle: { id: 'shuffle', label: '빙글빙글 셔플', emoji: '🌀', icon: '/quizpang/item-shuffle.webp', needsTarget: false, describe: '보드 전체를 새로 섞어요. 막혔을 때 딱!', short: '보드 섞기' },
  double: { id: 'double', label: '점수 2배 간식', emoji: '🍖', icon: '/quizpang/item-double.webp', needsTarget: false, describe: `${QUIZPANG.ITEMS.double.ms / 1000}초 동안 얻는 점수가 ${QUIZPANG.ITEMS.double.mult}배!`, short: '10초 2배' },
}

export const SPECIAL_INFO: Record<Exclude<Special, 'none'>, { label: string; emoji: string }> = {
  cross: { label: '줄 폭탄 강아지', emoji: '✚' },
  boom: { label: '대폭탄 강아지', emoji: '★' },
}

export type QuizpangStats = {
  /** 터뜨린 블록 수 */
  cleared: number
  /** 성공한 스왑 수 */
  moves: number
  /** 최고 콤보 */
  maxChain: number
  /** 한 번의 조작으로 얻은 최고 점수 */
  bestMove: number
  /** 만든 스페셜 블록 수 */
  specials: number
  /** 푼 문제·맞힌 문제 */
  questions: number
  correct: number
  /** 쓴 아이템 수 */
  items: number
}

export type QuizpangState = {
  seed: number
  rng: () => number
  nextId: number
  board: Board
  score: number
  /** 퍼즐을 한 시간(ms). 문제 창·멈춤 동안은 흐르지 않는다 */
  playMs: number
  /** 다음 문제가 뜨는 퍼즐 시간 */
  quizDueMs: number
  /** 점수 2배 남은 시간(ms) */
  doubleMsLeft: number
  inventory: ItemId[]
  stats: QuizpangStats
}

export type QuizpangSave = {
  v: 1
  score: number
  playMs: number
  quizDueMs: number
  doubleMsLeft: number
  /** 행 우선 64칸. 값 = kind + specialIndex × 8 */
  board: number[]
  inventory: ItemId[]
  stats: QuizpangStats
}

export type ClearCell = Cell & { id: number; kind: number }
export type Step =
  | { type: 'swap'; a: Cell; b: Cell; back: boolean }
  | {
      type: 'clear'
      cells: ClearCell[]
      /** 이번에 생긴 스페셜 블록 (그 자리 블록은 안 터지고 변신한다) */
      created: Array<{ cell: Cell; id: number; special: Special }>
      /** 이번에 터진 스페셜 블록 */
      triggered: Array<{ cell: Cell; special: Special }>
      chain: number
      score: number
      source: 'match' | 'bomb' | 'line'
    }
  | {
      type: 'fall'
      moves: Array<{ id: number; from: Cell; to: Cell }>
      spawns: Array<{ block: Block; to: Cell; fromRow: number }>
    }
  | { type: 'shuffle' }

export type MoveResult = { valid: boolean; steps: Step[]; score: number; maxChain: number }

export type ItemCard = { item: ItemId }

// ─── 시드 ───
/**
 * 이번 판의 보드 시드 — 같은 판의 모든 학생이 같은 보드로 시작한다.
 * 선생님이 시작할 때 rooms.settings.quizpang.seed 를 심는다(buildQuizpangRoomSettings). 그 값이 있으면 그대로 쓴다.
 * 없으면(/dev·체험 방) 방 코드 + 시작 시각으로 만든다. 시작 시각은 교사 방송값과 DB 값이 수백 ms 다를 수 있어
 * 10초 단위로 뭉개서 쓴다.
 */
export function getBoardSeed(roomCode: string, startedAt: string | null | undefined, settings?: unknown): number {
  const fromSettings = readSeedFromSettings(settings)
  if (fromSettings !== null) return fromSettings
  const startedMs = startedAt ? Date.parse(startedAt) : NaN
  const bucket = Number.isFinite(startedMs) ? Math.floor(startedMs / 10_000) : startedAt ?? ''
  return hashStringToSeed(`quizpang:${roomCode}:${bucket}`)
}

function readSeedFromSettings(settings: unknown): number | null {
  if (!settings || typeof settings !== 'object') return null
  const section = (settings as { quizpang?: unknown }).quizpang
  if (!section || typeof section !== 'object') return null
  const seed = (section as { seed?: unknown }).seed
  return typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : null
}

/** 선생님이 시작할 때 rooms.settings 에 넣는 값 — 새 판마다 새 보드 시드 */
export function buildQuizpangRoomSettings(existing: unknown): Record<string, unknown> {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Record<string, unknown>) : {}
  return { ...base, quizpang: { seed: Math.floor(Math.random() * 0xffffffff) >>> 0 } }
}

// ─── 작은 도우미 ───
const SPECIALS: Special[] = ['none', 'cross', 'boom']
const key = (r: number, c: number) => r * 16 + c
const inBoard = (r: number, c: number) => r >= 0 && r < QUIZPANG.ROWS && c >= 0 && c < QUIZPANG.COLS
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

export function chainMultiplier(chain: number): number {
  return Math.min(QUIZPANG.CHAIN_MAX_MULT, 1 + (chain - 1) * QUIZPANG.CHAIN_STEP)
}

export function matchScore(length: number): number {
  const table = QUIZPANG.MATCH_SCORE
  if (length < table.length) return table[length]
  return table[table.length - 1] + (length - (table.length - 1)) * QUIZPANG.EXTRA_BLOCK_SCORE
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
}

function emptyStats(): QuizpangStats {
  return { cleared: 0, moves: 0, maxChain: 0, bestMove: 0, specials: 0, questions: 0, correct: 0, items: 0 }
}

// ─── 보드 생성 ───
function randomKind(rng: () => number): number {
  return Math.floor(rng() * QUIZPANG.KINDS)
}

/** 처음부터 터지는 줄이 없고, 가능한 수가 하나는 있는 보드 */
function generateBoard(state: QuizpangState): Board {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const board: Board = []
    for (let r = 0; r < QUIZPANG.ROWS; r += 1) {
      const row: (Block | null)[] = []
      for (let c = 0; c < QUIZPANG.COLS; c += 1) {
        let kind = randomKind(state.rng)
        let guard = 0
        while (guard < 20 && makesRun(board, row, r, c, kind)) {
          kind = randomKind(state.rng)
          guard += 1
        }
        row.push({ id: state.nextId++, kind, special: 'none' })
      }
      board.push(row)
    }
    if (hasMove(board)) return board
  }
  // 30번 다 실패할 확률은 사실상 0 이지만, 그래도 마지막 보드를 쓴다
  return shuffleKinds(state, state.board.length ? state.board : generateBoardLoose(state))
}

function generateBoardLoose(state: QuizpangState): Board {
  const board: Board = []
  for (let r = 0; r < QUIZPANG.ROWS; r += 1) {
    const row: (Block | null)[] = []
    for (let c = 0; c < QUIZPANG.COLS; c += 1) row.push({ id: state.nextId++, kind: randomKind(state.rng), special: 'none' })
    board.push(row)
  }
  return board
}

/** (r,c) 에 kind 를 놓으면 왼쪽 둘·위 둘과 3줄이 되는가 (생성 중이라 row 는 아직 채우는 중) */
function makesRun(board: Board, row: (Block | null)[], r: number, c: number, kind: number): boolean {
  if (c >= 2 && row[c - 1]?.kind === kind && row[c - 2]?.kind === kind) return true
  if (r >= 2 && board[r - 1][c]?.kind === kind && board[r - 2][c]?.kind === kind) return true
  return false
}

// ─── 매치 찾기 ───
type Run = { cells: Cell[]; kind: number; dir: 'h' | 'v' }
export type MatchGroup = { cells: Cell[]; kind: number; special: Special; pivot: Cell; runs: Run[] }

function findRuns(board: Board): Run[] {
  const runs: Run[] = []
  for (let r = 0; r < QUIZPANG.ROWS; r += 1) {
    let start = 0
    for (let c = 1; c <= QUIZPANG.COLS; c += 1) {
      const same = c < QUIZPANG.COLS && board[r][c] && board[r][start] && board[r][c]!.kind === board[r][start]!.kind
      if (!same) {
        if (board[r][start] && c - start >= 3) {
          runs.push({ cells: Array.from({ length: c - start }, (_, i) => ({ r, c: start + i })), kind: board[r][start]!.kind, dir: 'h' })
        }
        start = c
      }
    }
  }
  for (let c = 0; c < QUIZPANG.COLS; c += 1) {
    let start = 0
    for (let r = 1; r <= QUIZPANG.ROWS; r += 1) {
      const same = r < QUIZPANG.ROWS && board[r][c] && board[start][c] && board[r][c]!.kind === board[start][c]!.kind
      if (!same) {
        if (board[start][c] && r - start >= 3) {
          runs.push({ cells: Array.from({ length: r - start }, (_, i) => ({ r: start + i, c })), kind: board[start][c]!.kind, dir: 'v' })
        }
        start = r
      }
    }
  }
  return runs
}

/**
 * 터질 묶음을 찾는다. 가로·세로 줄이 한 칸을 같이 쓰면(ㄱ자·T자) 한 묶음으로 합친다.
 * preferred = 방금 움직인 칸들. 스페셜 블록은 그 자리에 생긴다(없으면 교차점·줄 가운데).
 */
export function findMatches(board: Board, preferred: Cell[] = []): MatchGroup[] {
  const runs = findRuns(board)
  if (runs.length === 0) return []
  const parent = runs.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const cellRun = new Map<number, number>()
  runs.forEach((run, i) => {
    for (const cell of run.cells) {
      const k = key(cell.r, cell.c)
      const other = cellRun.get(k)
      if (other !== undefined) parent[find(i)] = find(other)
      else cellRun.set(k, i)
    }
  })
  const groups = new Map<number, Run[]>()
  runs.forEach((run, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(run)
  })

  const result: MatchGroup[] = []
  for (const groupRuns of groups.values()) {
    const seen = new Map<number, Cell>()
    for (const run of groupRuns) for (const cell of run.cells) seen.set(key(cell.r, cell.c), cell)
    const cells = [...seen.values()]
    const longest = Math.max(...groupRuns.map((run) => run.cells.length))
    const mixed = groupRuns.some((run) => run.dir === 'h') && groupRuns.some((run) => run.dir === 'v')
    let special: Special = 'none'
    if (mixed || longest >= QUIZPANG.SPECIAL.boom.match) special = 'boom'
    else if (longest >= QUIZPANG.SPECIAL.cross.match) special = 'cross'

    let pivot = preferred.find((cell) => seen.has(key(cell.r, cell.c)))
    if (!pivot && mixed) {
      // 교차점: 두 줄에 다 들어 있는 칸
      const counts = new Map<number, number>()
      for (const run of groupRuns) for (const cell of run.cells) counts.set(key(cell.r, cell.c), (counts.get(key(cell.r, cell.c)) ?? 0) + 1)
      for (const [k, count] of counts) if (count > 1) { pivot = seen.get(k); break }
    }
    if (!pivot) {
      const run = groupRuns.find((item) => item.cells.length === longest)!
      pivot = run.cells[Math.floor(run.cells.length / 2)]
    }
    result.push({ cells, kind: groupRuns[0].kind, special, pivot, runs: groupRuns })
  }
  return result
}

/** 둘을 바꾸면 터지는 줄이 생기는가 (보드는 바꾸지 않는다) */
function swapMakesMatch(board: Board, a: Cell, b: Cell): boolean {
  const blockA = board[a.r][a.c]
  const blockB = board[b.r][b.c]
  if (!blockA || !blockB || blockA.kind === blockB.kind) return false
  board[a.r][a.c] = blockB
  board[b.r][b.c] = blockA
  const ok = runThrough(board, a) || runThrough(board, b)
  board[a.r][a.c] = blockA
  board[b.r][b.c] = blockB
  return ok
}

/** 이 칸을 지나는 가로·세로 3줄이 있는가 */
function runThrough(board: Board, cell: Cell): boolean {
  const block = board[cell.r][cell.c]
  if (!block) return false
  let h = 1
  for (let c = cell.c - 1; c >= 0 && board[cell.r][c]?.kind === block.kind; c -= 1) h += 1
  for (let c = cell.c + 1; c < QUIZPANG.COLS && board[cell.r][c]?.kind === block.kind; c += 1) h += 1
  if (h >= 3) return true
  let v = 1
  for (let r = cell.r - 1; r >= 0 && board[r][cell.c]?.kind === block.kind; r -= 1) v += 1
  for (let r = cell.r + 1; r < QUIZPANG.ROWS && board[r][cell.c]?.kind === block.kind; r += 1) v += 1
  return v >= 3
}

export function hasMove(board: Board): boolean {
  return findAnyMove(board) !== null
}

/** 가능한 수 하나 (힌트용). 없으면 null */
export function findAnyMove(board: Board): [Cell, Cell] | null {
  for (let r = 0; r < QUIZPANG.ROWS; r += 1) {
    for (let c = 0; c < QUIZPANG.COLS; c += 1) {
      const here = { r, c }
      if (c + 1 < QUIZPANG.COLS && swapMakesMatch(board, here, { r, c: c + 1 })) return [here, { r, c: c + 1 }]
      if (r + 1 < QUIZPANG.ROWS && swapMakesMatch(board, here, { r: r + 1, c })) return [here, { r: r + 1, c }]
    }
  }
  return null
}

// ─── 섞기 ───
/** 블록(id·스페셜 유지)을 섞어 터지는 줄 없이·가능한 수 있게. 50번 안에 안 되면 새 종류로 다시 채운다 */
function shuffleKinds(state: QuizpangState, board: Board): Board {
  const blocks: Block[] = []
  for (const row of board) for (const block of row) if (block) blocks.push(block)
  for (let attempt = 0; attempt < 50; attempt += 1) {
    for (let i = blocks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(state.rng() * (i + 1))
      ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
    }
    const next: Board = []
    let index = 0
    for (let r = 0; r < QUIZPANG.ROWS; r += 1) {
      const row: (Block | null)[] = []
      for (let c = 0; c < QUIZPANG.COLS; c += 1) row.push(blocks[index++] ?? { id: state.nextId++, kind: randomKind(state.rng), special: 'none' })
      next.push(row)
    }
    if (findRuns(next).length === 0 && hasMove(next)) return next
  }
  return generateBoard(state)
}

// ─── 상태 ───
export function createQuizpangState(seed: number, save?: QuizpangSave | null): QuizpangState {
  const state: QuizpangState = {
    seed,
    // 저장값을 이어 할 때는 난수 흐름을 조금 바꿔(퍼즐 시간 섞기) 똑같은 새 블록이 또 내려오지 않게 한다
    rng: createSeededRandom(save ? (seed ^ Math.floor(save.playMs)) >>> 0 : seed),
    nextId: 1,
    board: [],
    score: save?.score ?? 0,
    playMs: save?.playMs ?? 0,
    quizDueMs: save?.quizDueMs ?? QUIZPANG.QUESTION_INTERVAL_MS,
    doubleMsLeft: save?.doubleMsLeft ?? 0,
    inventory: save ? [...save.inventory] : [],
    stats: save ? { ...emptyStats(), ...save.stats } : emptyStats(),
  }
  const decoded = save ? decodeBoard(state, save.board) : null
  state.board = decoded ?? generateBoard(state)
  return state
}

function decodeBoard(state: QuizpangState, values: number[]): Board | null {
  if (!Array.isArray(values) || values.length !== QUIZPANG.ROWS * QUIZPANG.COLS) return null
  const board: Board = []
  for (let r = 0; r < QUIZPANG.ROWS; r += 1) {
    const row: (Block | null)[] = []
    for (let c = 0; c < QUIZPANG.COLS; c += 1) {
      const value = Math.floor(num(values[r * QUIZPANG.COLS + c]))
      const kind = value % 8
      const special = SPECIALS[Math.floor(value / 8)] ?? 'none'
      if (kind < 0 || kind >= QUIZPANG.KINDS) return null
      row.push({ id: state.nextId++, kind, special })
    }
    board.push(row)
  }
  // 저장 당시 콤보가 끝난 보드라 터지는 줄은 없어야 하지만, 혹시 있으면 섞어서 시작한다
  if (findRuns(board).length > 0 || !hasMove(board)) return shuffleKinds(state, board)
  return board
}

export function toQuizpangSave(state: QuizpangState): QuizpangSave {
  const board: number[] = []
  for (const row of state.board) for (const block of row) board.push(block ? block.kind + SPECIALS.indexOf(block.special) * 8 : 0)
  return {
    v: 1,
    score: Math.max(0, Math.floor(state.score)),
    playMs: Math.floor(state.playMs),
    quizDueMs: Math.floor(state.quizDueMs),
    doubleMsLeft: Math.max(0, Math.floor(state.doubleMsLeft)),
    board,
    inventory: [...state.inventory],
    stats: { ...state.stats },
  }
}

export function parseQuizpangSave(raw: unknown): QuizpangSave | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<QuizpangSave>
  if (value.v !== 1) return null
  const stats = (value.stats ?? {}) as Partial<QuizpangStats>
  const inventory = Array.isArray(value.inventory)
    ? (value.inventory.filter((item): item is ItemId => typeof item === 'string' && (ITEM_IDS as string[]).includes(item)).slice(0, QUIZPANG.INVENTORY_SLOTS))
    : []
  return {
    v: 1,
    score: Math.max(0, Math.floor(num(value.score))),
    playMs: Math.max(0, num(value.playMs)),
    quizDueMs: Math.max(0, num(value.quizDueMs, QUIZPANG.QUESTION_INTERVAL_MS)),
    doubleMsLeft: Math.max(0, num(value.doubleMsLeft)),
    board: Array.isArray(value.board) ? value.board.map((item) => Math.max(0, Math.floor(num(item)))) : [],
    inventory,
    stats: {
      cleared: num(stats.cleared), moves: num(stats.moves), maxChain: num(stats.maxChain), bestMove: num(stats.bestMove),
      specials: num(stats.specials), questions: num(stats.questions), correct: num(stats.correct), items: num(stats.items),
    },
  }
}

// ─── 콤보 처리 ───
/**
 * 터뜨리기 → 떨어뜨리기 → 또 터지면 반복. forced 가 있으면(아이템) 첫 단계에서 그 칸들을 터뜨린다.
 * 점수·통계를 state 에 더하고, 화면이 재생할 단계 목록을 돌려준다.
 */
function resolveCascade(
  state: QuizpangState,
  options: { forced?: { cells: Cell[]; source: 'bomb' | 'line' }; preferred?: Cell[] } = {},
): { steps: Step[]; score: number; maxChain: number } {
  const steps: Step[] = []
  const board = state.board
  let chain = 0
  let total = 0
  let forced = options.forced ?? null
  let preferred = options.preferred ?? []

  while (chain < 40) {
    const groups = forced ? [] : findMatches(board, preferred)
    if (!forced && groups.length === 0) break
    chain += 1

    const clear = new Map<number, Cell>()
    const created: Array<{ cell: Cell; id: number; special: Special }> = []
    const createdKeys = new Set<number>()
    let base = 0

    if (forced) {
      for (const cell of forced.cells) if (inBoard(cell.r, cell.c) && board[cell.r][cell.c]) clear.set(key(cell.r, cell.c), cell)
      base += clear.size * QUIZPANG.EXTRA_BLOCK_SCORE
    }
    for (const group of groups) {
      base += group.runs.reduce((sum, run) => sum + matchScore(run.cells.length), 0)
      for (const cell of group.cells) clear.set(key(cell.r, cell.c), cell)
      if (group.special !== 'none') {
        const block = board[group.pivot.r][group.pivot.c]
        if (block) {
          created.push({ cell: group.pivot, id: block.id, special: group.special })
          createdKeys.add(key(group.pivot.r, group.pivot.c))
        }
      }
    }

    // 스페셜 블록이 터지면 주변도 같이 (연달아 터질 수 있다)
    const triggered: Array<{ cell: Cell; special: Special }> = []
    const visited = new Set<number>()
    const queue: Cell[] = []
    for (const cell of clear.values()) {
      const block = board[cell.r][cell.c]
      if (block && block.special !== 'none' && !createdKeys.has(key(cell.r, cell.c))) queue.push(cell)
    }
    while (queue.length > 0) {
      const cell = queue.pop()!
      const k = key(cell.r, cell.c)
      if (visited.has(k)) continue
      visited.add(k)
      const block = board[cell.r][cell.c]
      if (!block || block.special === 'none') continue
      triggered.push({ cell, special: block.special })
      base += QUIZPANG.SPECIAL[block.special].bonus
      const area: Cell[] = []
      if (block.special === 'cross') {
        for (let c = 0; c < QUIZPANG.COLS; c += 1) area.push({ r: cell.r, c })
        for (let r = 0; r < QUIZPANG.ROWS; r += 1) area.push({ r, c: cell.c })
      } else {
        const radius = QUIZPANG.SPECIAL.boom.radius
        for (let r = cell.r - radius; r <= cell.r + radius; r += 1) {
          for (let c = cell.c - radius; c <= cell.c + radius; c += 1) if (inBoard(r, c)) area.push({ r, c })
        }
      }
      for (const target of area) {
        const tk = key(target.r, target.c)
        if (clear.has(tk) || createdKeys.has(tk)) {
          const other = board[target.r][target.c]
          if (other && other.special !== 'none' && !visited.has(tk) && !createdKeys.has(tk)) queue.push(target)
          continue
        }
        const other = board[target.r][target.c]
        if (!other) continue
        clear.set(tk, target)
        base += QUIZPANG.EXTRA_BLOCK_SCORE
        if (other.special !== 'none') queue.push(target)
      }
    }

    const multiplier = chainMultiplier(chain) * (state.doubleMsLeft > 0 ? QUIZPANG.ITEMS.double.mult : 1)
    const score = Math.round(base * multiplier)
    total += score
    state.score += score

    const cells: ClearCell[] = []
    for (const cell of clear.values()) {
      if (createdKeys.has(key(cell.r, cell.c))) continue
      const block = board[cell.r][cell.c]
      if (!block) continue
      cells.push({ r: cell.r, c: cell.c, id: block.id, kind: block.kind })
      board[cell.r][cell.c] = null
    }
    for (const item of created) {
      const block = board[item.cell.r][item.cell.c]
      if (block) block.special = item.special
    }
    state.stats.cleared += cells.length
    state.stats.specials += created.length
    steps.push({ type: 'clear', cells, created, triggered, chain, score, source: forced?.source ?? 'match' })

    steps.push(applyGravity(state))
    forced = null
    preferred = []
  }

  if (chain > 0) {
    state.stats.maxChain = Math.max(state.stats.maxChain, chain)
    state.stats.bestMove = Math.max(state.stats.bestMove, total)
  }
  if (!hasMove(board)) {
    state.board = shuffleKinds(state, board)
    steps.push({ type: 'shuffle' })
  }
  return { steps, score: total, maxChain: chain }
}

/** 빈칸 위 블록을 아래로, 맨 위 빈칸은 새 블록으로 */
function applyGravity(state: QuizpangState): Step {
  const board = state.board
  const moves: Array<{ id: number; from: Cell; to: Cell }> = []
  const spawns: Array<{ block: Block; to: Cell; fromRow: number }> = []
  for (let c = 0; c < QUIZPANG.COLS; c += 1) {
    let write = QUIZPANG.ROWS - 1
    for (let r = QUIZPANG.ROWS - 1; r >= 0; r -= 1) {
      const block = board[r][c]
      if (!block) continue
      if (write !== r) {
        board[write][c] = block
        board[r][c] = null
        moves.push({ id: block.id, from: { r, c }, to: { r: write, c } })
      }
      write -= 1
    }
    const empty = write + 1
    for (let r = write; r >= 0; r -= 1) {
      const block: Block = { id: state.nextId++, kind: randomKind(state.rng), special: 'none' }
      board[r][c] = block
      spawns.push({ block, to: { r, c }, fromRow: r - empty })
    }
  }
  return { type: 'fall', moves, spawns }
}

// ─── 조작 ───
/** 이웃한 둘을 바꾼다. 터지는 줄이 없으면 되돌리고(valid=false) 점수는 없다 */
export function trySwap(state: QuizpangState, a: Cell, b: Cell): MoveResult {
  if (!inBoard(a.r, a.c) || !inBoard(b.r, b.c) || !isAdjacent(a, b)) return { valid: false, steps: [], score: 0, maxChain: 0 }
  const board = state.board
  const blockA = board[a.r][a.c]
  const blockB = board[b.r][b.c]
  if (!blockA || !blockB) return { valid: false, steps: [], score: 0, maxChain: 0 }
  board[a.r][a.c] = blockB
  board[b.r][b.c] = blockA
  const groups = findMatches(board, [b, a])
  if (groups.length === 0) {
    board[a.r][a.c] = blockA
    board[b.r][b.c] = blockB
    return { valid: false, steps: [{ type: 'swap', a, b, back: false }, { type: 'swap', a, b, back: true }], score: 0, maxChain: 0 }
  }
  state.stats.moves += 1
  const cascade = resolveCascade(state, { preferred: [b, a] })
  return { valid: true, steps: [{ type: 'swap', a, b, back: false }, ...cascade.steps], score: cascade.score, maxChain: cascade.maxChain }
}

/** 아이템을 쓴다. 보관함에서 빼는 건 부르는 쪽(훅)이 한다 */
export function applyItem(state: QuizpangState, item: ItemId, target?: { cell: Cell; dir?: LineDir }): MoveResult {
  state.stats.items += 1
  if (item === 'bomb') {
    const cell = target?.cell ?? { r: Math.floor(QUIZPANG.ROWS / 2), c: Math.floor(QUIZPANG.COLS / 2) }
    const radius = QUIZPANG.ITEMS.bomb.radius
    const cells: Cell[] = []
    for (let r = cell.r - radius; r <= cell.r + radius; r += 1) for (let c = cell.c - radius; c <= cell.c + radius; c += 1) if (inBoard(r, c)) cells.push({ r, c })
    const cascade = resolveCascade(state, { forced: { cells, source: 'bomb' } })
    return { valid: true, ...cascade }
  }
  if (item === 'line') {
    const cell = target?.cell ?? { r: Math.floor(QUIZPANG.ROWS / 2), c: Math.floor(QUIZPANG.COLS / 2) }
    const dir = target?.dir ?? 'row'
    const cells: Cell[] = dir === 'row'
      ? Array.from({ length: QUIZPANG.COLS }, (_, c) => ({ r: cell.r, c }))
      : Array.from({ length: QUIZPANG.ROWS }, (_, r) => ({ r, c: cell.c }))
    const cascade = resolveCascade(state, { forced: { cells, source: 'line' } })
    return { valid: true, ...cascade }
  }
  if (item === 'shuffle') {
    state.board = shuffleKinds(state, state.board)
    return { valid: true, steps: [{ type: 'shuffle' }], score: 0, maxChain: 0 }
  }
  state.doubleMsLeft = QUIZPANG.ITEMS.double.ms
  return { valid: true, steps: [], score: 0, maxChain: 0 }
}

/** 보관함에 넣기. 가득 차면 가장 오래된 것을 빼고 그 id 를 돌려준다 */
export function addToInventory(state: QuizpangState, item: ItemId): ItemId | null {
  let dropped: ItemId | null = null
  if (state.inventory.length >= QUIZPANG.INVENTORY_SLOTS) dropped = state.inventory.shift() ?? null
  state.inventory.push(item)
  return dropped
}

/** 퍼즐 시간이 흐른다 (문제 창·멈춤 중에는 부르지 않는다). 2배 간식 시간도 여기서 준다 */
export function tickQuizpang(state: QuizpangState, dtMs: number): void {
  state.playMs += dtMs
  if (state.doubleMsLeft > 0) state.doubleMsLeft = Math.max(0, state.doubleMsLeft - dtMs)
}

export function isQuizDue(state: QuizpangState): boolean {
  return state.playMs >= state.quizDueMs
}

export function scheduleNextQuiz(state: QuizpangState): void {
  state.quizDueMs = state.playMs + QUIZPANG.QUESTION_INTERVAL_MS
}

// ─── 아이템 카드 ───
/** 확률 가중치로 서로 다른 카드 n 장 (Math.random — 검수 드라이버가 값을 강제할 수 있게) */
export function drawItemCards(count: number = QUIZPANG.CHOICES, random: () => number = Math.random): ItemCard[] {
  const pool = ITEM_IDS.map((id) => ({ id, weight: QUIZPANG.ITEMS[id].weight }))
  const cards: ItemCard[] = []
  while (cards.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
    let roll = random() * total
    let index = 0
    for (; index < pool.length - 1; index += 1) {
      roll -= pool[index].weight
      if (roll < 0) break
    }
    cards.push({ item: pool[index].id })
    pool.splice(index, 1)
  }
  return cards
}

// ─── 서버 상한 (클라이언트도 같은 식으로 미리 잘라 둔다) ───
export function maxPlausibleScore(elapsedSeconds: number): number {
  return QUIZPANG.SERVER.SCORE_GRACE + QUIZPANG.SERVER.MAX_SCORE_PER_SECOND * Math.max(0, elapsedSeconds)
}

// ─── 결과·칭호 ───
export type QuizpangTitle = { id: string; emoji: string; label: string; description: string }
type TitlePlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown; score?: number | null }

const TITLES: Record<string, QuizpangTitle> = {
  champion: { id: 'champion', emoji: '👑', label: '팡팡 챔피언', description: '점수가 가장 높았어요' },
  chain: { id: 'chain', emoji: '🔥', label: '콤보 마스터', description: '가장 긴 콤보를 만들었어요' },
  popper: { id: 'popper', emoji: '🐶', label: '강아지 폭죽왕', description: '강아지를 가장 많이 터뜨렸어요' },
  brain: { id: 'brain', emoji: '🧠', label: '퀴즈 박사', description: '문제를 가장 많이 맞혔어요' },
  special: { id: 'special', emoji: '✨', label: '스페셜 장인', description: '스페셜 강아지를 가장 많이 만들었어요' },
  itemist: { id: 'itemist', emoji: '🎒', label: '아이템 마스터', description: '아이템을 가장 많이 썼어요' },
  bigmove: { id: 'bigmove', emoji: '💥', label: '한 방의 달인', description: '한 번의 조작으로 가장 큰 점수를 냈어요' },
  steady: { id: 'steady', emoji: '🌱', label: '꾸준한 팡팡이', description: '끝까지 차근차근 맞춰 나갔어요' },
}

function favoriteTitle(save: QuizpangSave): QuizpangTitle {
  if (save.stats.maxChain >= 3) return TITLES.chain
  if (save.stats.correct >= 3) return TITLES.brain
  if (save.stats.specials >= 2) return TITLES.special
  return TITLES.steady
}

/** 모든 참가자에게 칭호를 하나 이상 준다 — 1등이 아니어도 뭔가 받는다 */
export function assignQuizpangTitles(players: TitlePlayer[]): Map<string, QuizpangTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const saveById = new Map(active.map((player) => [player.id, parseQuizpangSave(player.item_effects) ?? emptySave(num(player.score))]))
  const result = new Map<string, QuizpangTitle[]>(active.map((player) => [player.id, []]))
  const rules: Array<[string, (save: QuizpangSave) => number]> = [
    ['champion', (save) => save.score],
    ['chain', (save) => save.stats.maxChain - 1],
    ['popper', (save) => save.stats.cleared],
    ['brain', (save) => save.stats.correct],
    ['special', (save) => save.stats.specials],
    ['itemist', (save) => save.stats.items],
    ['bigmove', (save) => save.stats.bestMove],
  ]
  for (const [id, value] of rules) {
    let best = 0
    for (const save of saveById.values()) best = Math.max(best, value(save))
    if (best <= 0) continue
    for (const [playerId, save] of saveById) if (value(save) === best) result.get(playerId)!.push(TITLES[id])
  }
  for (const [playerId, save] of saveById) {
    const titles = result.get(playerId)!
    if (titles.length === 0) titles.push(favoriteTitle(save))
  }
  return result
}

function emptySave(score: number): QuizpangSave {
  return { v: 1, score, playMs: 0, quizDueMs: 0, doubleMsLeft: 0, board: [], inventory: [], stats: emptyStats() }
}

export function summarizeQuizpang(save: QuizpangSave): Array<{ label: string; value: string }> {
  return [
    { label: '터뜨린 강아지', value: `${save.stats.cleared.toLocaleString()}마리` },
    { label: '최고 콤보', value: `${save.stats.maxChain}콤보` },
    { label: '한 방 최고 점수', value: save.stats.bestMove.toLocaleString() },
    { label: '맞힌 문제', value: `${save.stats.correct} / ${save.stats.questions}` },
  ]
}

/** 콤보 수에 따른 환호 문구 — 화면 가운데 노란 배너. 문구는 여기서만 고치면 된다 */
export const CHAIN_CHEERS: Record<number, string> = {
  2: '2콤보! 멍!',
  3: '3콤보! 멍멍!',
  4: '4콤보! 대박!',
  5: '5콤보! 굉장해!',
  6: '6콤보! 최고야!',
}
/** CHAIN_CHEERS 에 없는 더 긴 콤보 */
export const CHAIN_CHEER_MAX = (chain: number) => `${chain}콤보! 전설이다!!`

export function chainCheer(chain: number): string | null {
  if (chain < 2) return null
  return CHAIN_CHEERS[chain] ?? CHAIN_CHEER_MAX(chain)
}

export function formatPlayTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
