/**
 * 박수 치는 마스코트 애니메이션 만들기 — 두 장면(앞발 벌림 / 앞발 모음)을 이어 움직이는 WebP로.
 *
 *   node scripts/make-clap-animation.mjs <벌린 장면.png> <모은 장면.png> <이름>
 *   예) node scripts/make-clap-animation.mjs raw-assets/mascot-clap/pome-1.png raw-assets/mascot-clap/pome-2.png mascot-pome-clap
 *
 * 결과
 * - public/assets/icons/<이름>-320.webp  사이트용 (투명 배경, 무한 반복)
 * - raw-assets/mascot-clap/<이름>.gif     공유·미리보기용
 *
 * 왜 그냥 두 장을 번갈아 붙이지 않나:
 * AI로 뽑은 두 장면은 몸통 테두리 색이 한두 픽셀씩 달라서, 그대로 번갈아 보이면 털 가장자리가 지글거린다.
 * 그래서 첫 장면을 바탕으로 두고, 두 장면이 크게 다른 덩어리(= 움직이는 앞발)만 둘째 장면에서 가져와 붙인다.
 *
 * 움직인 곳이 제대로 잡혔는지 보려면 DEBUG_MASK=<저장할 png 경로> 를 붙여 실행한다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const [, , openPath, closedPath, name] = process.argv
if (!openPath || !closedPath || !name) {
  console.error('사용법: node scripts/make-clap-animation.mjs <벌린 장면.png> <모은 장면.png> <이름>')
  process.exit(1)
}

const OUTPUT_SIZE = 320 // 화면에서 최대 150px 정도로 그린다 → 2배 밀도
const DIFF_THRESHOLD = 120 // 픽셀의 RGBA 차이 합이 이보다 크면 "달라진 픽셀"
const BLOCK = 16 // 이 크기 칸으로 나눠 본다 (픽셀아트 한 칸이 20px 안팎)
const BLOCK_FILL = 0.45 // 칸 안에서 달라진 픽셀이 이 비율 이상이면 "움직인 칸" — 테두리 잡음은 칸의 일부만 차지해 걸러진다
const MIN_BLOB_BLOCKS = 8 // 이보다 작은 덩어리는 잡음으로 본다
// 박수 박자: 짝·짝·짝 하고 잠깐 쉰다 (ms)
const TIMELINE = [
  ['open', 190],
  ['closed', 150],
  ['open', 190],
  ['closed', 150],
  ['open', 190],
  ['closed', 150],
  ['open', 520],
]

async function readRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

const open = await readRgba(openPath)
const closed = await readRgba(closedPath)
if (open.width !== closed.width || open.height !== closed.height) {
  throw new Error(`두 장면 크기가 달라요: ${open.width}x${open.height} vs ${closed.width}x${closed.height}`)
}
const { width, height } = open
const pixelCount = width * height

// 1) 칸마다 달라진 픽셀 비율
const cols = Math.ceil(width / BLOCK)
const rows = Math.ceil(height / BLOCK)
const changed = new Float32Array(cols * rows)
const total = new Float32Array(cols * rows)
for (let p = 0; p < pixelCount; p += 1) {
  const i = p * 4
  let diff = 0
  for (let c = 0; c < 4; c += 1) diff += Math.abs(open.data[i + c] - closed.data[i + c])
  const block = Math.floor(Math.floor(p / width) / BLOCK) * cols + Math.floor((p % width) / BLOCK)
  total[block] += 1
  if (diff > DIFF_THRESHOLD) changed[block] += 1
}
const movedBlock = new Uint8Array(cols * rows)
for (let b = 0; b < movedBlock.length; b += 1) movedBlock[b] = changed[b] / total[b] >= BLOCK_FILL ? 1 : 0

// 2) 작은 덩어리는 버리고, 남은 덩어리는 한 칸씩 넓혀 앞발 가장자리까지 덮는다
const keep = new Uint8Array(cols * rows)
const seen = new Uint8Array(cols * rows)
for (let start = 0; start < movedBlock.length; start += 1) {
  if (!movedBlock[start] || seen[start]) continue
  const blob = []
  const queue = [start]
  seen[start] = 1
  while (queue.length) {
    const b = queue.pop()
    blob.push(b)
    const bx = b % cols
    const by = Math.floor(b / cols)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = bx + dx
      const ny = by + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const n = ny * cols + nx
      if (movedBlock[n] && !seen[n]) {
        seen[n] = 1
        queue.push(n)
      }
    }
  }
  if (blob.length >= MIN_BLOB_BLOCKS) blob.forEach((b) => (keep[b] = 1))
}
const maskBlocks = new Uint8Array(cols * rows)
for (let b = 0; b < keep.length; b += 1) {
  if (!keep[b]) continue
  const bx = b % cols
  const by = Math.floor(b / cols)
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = bx + dx
      const ny = by + dy
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) maskBlocks[ny * cols + nx] = 1
    }
  }
}
// 덩어리 안쪽 구멍(두 장면 색이 우연히 같은 칸)도 메워 한 장면에서 통째로 가져오게 한다
const outside = new Uint8Array(cols * rows)
const borderQueue = []
for (let b = 0; b < maskBlocks.length; b += 1) {
  const bx = b % cols
  const by = Math.floor(b / cols)
  const onBorder = bx === 0 || by === 0 || bx === cols - 1 || by === rows - 1
  if (onBorder && !maskBlocks[b]) {
    outside[b] = 1
    borderQueue.push(b)
  }
}
while (borderQueue.length) {
  const b = borderQueue.pop()
  const bx = b % cols
  const by = Math.floor(b / cols)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = bx + dx
    const ny = by + dy
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
    const n = ny * cols + nx
    if (!maskBlocks[n] && !outside[n]) {
      outside[n] = 1
      borderQueue.push(n)
    }
  }
}
for (let b = 0; b < maskBlocks.length; b += 1) if (!outside[b]) maskBlocks[b] = 1

const mask = new Uint8Array(pixelCount)
for (let p = 0; p < pixelCount; p += 1) {
  mask[p] = maskBlocks[Math.floor(Math.floor(p / width) / BLOCK) * cols + Math.floor((p % width) / BLOCK)]
}
if (process.env.DEBUG_MASK) {
  await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width, height, channels: 1 } })
    .png()
    .toFile(process.env.DEBUG_MASK)
}

// 3) 첫 장면 위에 앞발만 둘째 장면으로
const merged = Buffer.from(open.data)
let movedPixels = 0
for (let p = 0; p < pixelCount; p += 1) {
  if (!mask[p]) continue
  movedPixels += 1
  closed.data.copy(merged, p * 4, p * 4, p * 4 + 4)
}
if (movedPixels === 0) throw new Error('두 장면이 거의 같아요 — 움직이는 부분을 찾지 못했어요')
console.log(`움직이는 부분: 전체의 ${((movedPixels / pixelCount) * 100).toFixed(1)}%`)

// 4) 두 장면을 모두 담는 투명 여백 밖 영역을 잘라 정사각형으로
let minX = width
let minY = height
let maxX = -1
let maxY = -1
for (const frame of [open.data, merged]) {
  for (let p = 0; p < pixelCount; p += 1) {
    if (frame[p * 4 + 3] < 10) continue
    const x = p % width
    const y = Math.floor(p / width)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
}
const side = Math.max(maxX - minX + 1, maxY - minY + 1)

async function squareFrame(data) {
  const cropped = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer()
  return sharp(cropped)
    .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .png()
    .toBuffer()
}

const frames = { open: await squareFrame(open.data), closed: await squareFrame(merged) }
const sequence = TIMELINE.map(([key]) => frames[key])
const delay = TIMELINE.map(([, ms]) => ms)

const webpOut = path.join('public/assets/icons', `${name}-${OUTPUT_SIZE}.webp`)
const gifOut = path.join('raw-assets/mascot-clap', `${name}.gif`)
await fs.mkdir(path.dirname(gifOut), { recursive: true })

await sharp(sequence, { join: { animated: true } })
  .webp({ loop: 0, delay, quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(webpOut)
await sharp(sequence, { join: { animated: true } }).gif({ loop: 0, delay }).toFile(gifOut)

for (const file of [webpOut, gifOut]) {
  const { size } = await fs.stat(file)
  console.log(`${file}  ${(size / 1024).toFixed(1)}KB`)
}
