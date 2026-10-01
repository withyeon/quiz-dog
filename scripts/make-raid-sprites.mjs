/**
 * 황제 펭귄 레이드 보스 스프라이트 만들기 — 픽셀 맵(문자열)을 sharp로 WebP로 굽는다.
 *
 *   node scripts/make-raid-sprites.mjs            → public/raid/penguin-{guard,knight,general,emperor}.webp
 *   node scripts/make-raid-sprites.mjs --preview out.png  → 네 마리를 한 장에 모은 검토용 PNG
 *
 * 캔버스 32×40, 몸통(24×30)은 (4, 8)에 놓고 장식(투구·왕관·망토·창·방패)을 앞뒤로 겹친다.
 * 8배 확대(최근접 보간)라 픽셀이 뭉개지지 않는다. 화면에서는 image-rendering: pixelated 로 더 키운다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SCALE = 8
const W = 32
const H = 40
const BODY_X = 4
const BODY_Y = 8

const PALETTE = {
  K: '#141b26', // 외곽선
  k: '#232d3b', // 검은 몸통
  h: '#34425a', // 몸통 하이라이트
  W: '#f8fbff', // 흰 배
  w: '#d9e4ee', // 배 그늘
  Y: '#f3d984', // 가슴 노랑
  O: '#f0942c', // 주황(귀 무늬·부리·발)
  o: '#c9701b', // 진한 주황
  E: '#ffffff', // 눈 흰자
  P: '#0b0f14', // 눈동자
  G: '#ffd23f', // 금
  g: '#d19a1a', // 진한 금
  R: '#e03a4f', // 빨강(망토·보석)
  r: '#a3233a', // 진한 빨강
  S: '#b7c8d9', // 강철
  s: '#6f8398', // 진한 강철
  T: '#8b5a2b', // 나무(창대)
  C: '#8fe3ff', // 얼음(장식)
}

// ─── 몸통 24×30 ───
// 5~6번째 줄이 눈이다. 아픈 표정(hurt)은 감은 눈(흰 선 하나)으로 바꾼다.
const BODY = [
  '........KKKKKKKK........',
  '......KKkkkkkkkkKK......',
  '.....KkkhhkkkkkkkkK.....',
  '....KkkhkkkkkkkkkkkK....',
  '....KkkkkkkkkkkkkkkK....',
  '...KkkkEEkkkkkkEEkkkK...',
  '...KkkkEPkkkkkkPEkkkK...',
  '..KkOOkkkkkOOkkkkkOOkK..',
  '..KkOOOkkkoOOokkkOOOkK..',
  '..KkOOOkkkkookkkkOOOkK..',
  '..KkkOkkkkkkkkkkkkOkkK..',
  '..KkkYYYYYYYYYYYYYYkkK..',
  '..KkYYYYYYYYYYYYYYYYkK..',
  '..KkYYWWWWWWWWWWWWYYkK..',
  '.KkkYWWWWWWWWWWWWWWYkkK.',
  '.KkkWWWWWWWWWWWWWWWWkkK.',
  '.KkkWWWWWWWWWWWWWWWWkkK.',
  'KkkkWWWWWWWWWWWWWWWWkkkK',
  'KkkkWWWWWWWWWWWWWWWWkkkK',
  'KkkkWWWWWWWWWWWWWWWWkkkK',
  'KkkkWWWWWWWWWWWWWWWWkkkK',
  '.KkkWWWWWWWWWWWWWWWWkkK.',
  '.KkkWWWWWWWWWWWWWWWWkkK.',
  '.KkkwWWWWWWWWWWWWWWwkkK.',
  '..KkwwWWWWWWWWWWWWwwkK..',
  '..KkkwwwwwwwwwwwwwwkkK..',
  '...KkkwwwwwwwwwwwwkkK...',
  '....KKkkkkkkkkkkkkKK....',
  '...OOOOkkkkkkkkkkOOOO...',
  '..OOOOO........OOOOO....',
]

const HURT_EYES = [
  '...KkkkkkkkkkkkkkkkkK...',
  '...KkkkEEkkkkkkEEkkkK...',
]

function bodyRows(variant) {
  if (variant !== 'hurt') return BODY
  return BODY.map((row, i) => (i === 5 ? HURT_EYES[0] : i === 6 ? HURT_EYES[1] : row))
}

function blank() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => '.'))
}

function stamp(canvas, rows, x0, y0) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx]
      if (ch === '.') continue
      const x = x0 + dx
      const y = y0 + dy
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      canvas[y][x] = ch
    }
  })
}

// ─── 장식 ───

// 왕관 12×6 — 머리 꼭대기(캔버스 y=8)에 걸친다
const CROWN = [
  'G....GG....G',
  'G...GRRG...G',
  'GG..GRRG..GG',
  'GGGGGGGGGGGG',
  'GgGgGgGgGgGg',
  'GGGGGGGGGGGG',
]

// 장군 모자 10×4
const CAP = [
  '..RRRRRR..',
  '.RRRRRRRR.',
  'RGGGGGGGGR',
  'RRRRRRRRRR',
]

// 투구 18×7 — 눈(캔버스 y=13~14)은 가리지 않는다
const HELMET = [
  '.......RRRR.......',
  '......RRRRRR......',
  '.....KSSSSSSK.....',
  '...KKSSSSSSSSKK...',
  '..KSSSSsSSsSSSSK..',
  '.KSSSSSSSSSSSSSSK.',
  '.KsssssssssssssssK',
]

// 기사 투구 볼가리개 (양쪽)
const CHEEK_L = ['KS', 'KS', 'KS', 'KS']
const CHEEK_R = ['SK', 'SK', 'SK', 'SK']

// 방패 6×7
const SHIELD = [
  '.KSSK.',
  'KSRRSK',
  'KRRRRK',
  'KRRRRK',
  'KSRRSK',
  '.KSSK.',
  '..KK..',
]

// 창: 날 + 창대
const SPEAR_TIP = ['.S.', 'SSS', 'SsS', '.s.']
function spear(canvas, x, y0, y1) {
  stamp(canvas, SPEAR_TIP, x - 1, y0)
  for (let y = y0 + 4; y <= y1; y++) canvas[y][x] = 'T'
}

// 망토: 몸 뒤에 먼저 그린다 (몸보다 넓어 옆·아래로 삐져나온 부분만 보인다)
function cape(canvas, { top, bottom, halfTop, halfBottom }) {
  const cx = 15.5
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top)
    const half = halfTop + (halfBottom - halfTop) * t
    const x0 = Math.round(cx - half)
    const x1 = Math.round(cx + half)
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === bottom
      canvas[y][x] = edge ? 'r' : 'R'
    }
  }
}

// 가슴 메달 (금 마름모)
const MEDAL = ['.G.', 'GgG', '.G.']
// 어깨 견장
const EPAULET = ['GGGG', 'gGGg']
// 망토 깃 (목 양쪽)
const COLLAR_L = ['RRR', 'rRR']
const COLLAR_R = ['RRR', 'RRr']

function buildBoss(kind, variant = 'idle') {
  const canvas = blank()

  if (kind === 'general' || kind === 'emperor') {
    cape(canvas, { top: 19, bottom: 37, halfTop: 11, halfBottom: 14 })
  }

  stamp(canvas, bodyRows(variant), BODY_X, BODY_Y)

  if (kind === 'guard') {
    stamp(canvas, HELMET, 7, 6)
    spear(canvas, 28, 8, 37)
  }

  if (kind === 'knight') {
    stamp(canvas, HELMET, 7, 6)
    stamp(canvas, CHEEK_L, 7, 13)
    stamp(canvas, CHEEK_R, 23, 13)
    stamp(canvas, SHIELD, 0, 23)
    spear(canvas, 28, 8, 37)
  }

  if (kind === 'general') {
    stamp(canvas, CAP, 11, 5)
    stamp(canvas, COLLAR_L, 6, 19)
    stamp(canvas, COLLAR_R, 23, 19)
    stamp(canvas, EPAULET, 5, 22)
    stamp(canvas, EPAULET, 23, 22)
    stamp(canvas, MEDAL, 14, 23)
  }

  if (kind === 'emperor') {
    stamp(canvas, CROWN, 10, 3)
    stamp(canvas, COLLAR_L, 6, 19)
    stamp(canvas, COLLAR_R, 23, 19)
    stamp(canvas, MEDAL, 14, 23)
    stamp(canvas, MEDAL, 14, 27)
  }

  return canvas
}

function toSvg(canvas) {
  const rects = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = canvas[y][x]
      if (ch === '.') continue
      const fill = PALETTE[ch]
      if (!fill) throw new Error(`알 수 없는 팔레트 문자: ${ch}`)
      rects.push(`<rect x="${x * SCALE}" y="${y * SCALE}" width="${SCALE}" height="${SCALE}" fill="${fill}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges">${rects.join('')}</svg>`
}

const KINDS = ['guard', 'knight', 'general', 'emperor']
const args = process.argv.slice(2)
const previewIndex = args.indexOf('--preview')
const previewPath = previewIndex >= 0 ? args[previewIndex + 1] : null

const outDir = path.join(process.cwd(), 'public', 'raid')
await fs.mkdir(outDir, { recursive: true })

const pngs = []
for (const kind of KINDS) {
  for (const variant of ['idle', 'hurt']) {
    const svg = Buffer.from(toSvg(buildBoss(kind, variant)))
    const png = await sharp(svg).png().toBuffer()
    if (variant === 'idle') pngs.push(png)
    if (!previewPath) {
      const webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer()
      const file = path.join(outDir, variant === 'idle' ? `penguin-${kind}.webp` : `penguin-${kind}-hurt.webp`)
      await fs.writeFile(file, webp)
      console.log(`✓ ${path.relative(process.cwd(), file)} ${(webp.length / 1024).toFixed(1)}KB`)
    }
  }
}

if (previewPath) {
  const gap = 24
  const sheet = sharp({
    create: {
      width: KINDS.length * (W * SCALE + gap) + gap,
      height: H * SCALE + gap * 2,
      channels: 4,
      background: { r: 190, g: 226, b: 245, alpha: 1 },
    },
  }).composite(pngs.map((input, i) => ({ input, left: gap + i * (W * SCALE + gap), top: gap })))
  await fs.writeFile(previewPath, await sheet.png().toBuffer())
  console.log(`✓ preview ${previewPath}`)
}
