/**
 * 붕어빵 굽굽! 스프라이트 만들기 — 32×20 픽셀 물고기 모양을 수식으로 그려 sharp 로 WebP 로 굽는다.
 *
 *   node scripts/make-bungeoppang-sprites.mjs
 *     → public/bungeoppang/{dough,underdone,baked,crispy,burnt,golden}.webp (256×160, 8배 최근접 확대)
 *
 * 몸통은 타원, 꼬리는 오른쪽으로 벌어지는 삼각형(가운데 갈라짐), 겉면엔 격자(붕어빵 무늬), 왼쪽에 눈·입.
 * 상태별로 팔레트만 바뀐다. 화면에서는 image-rendering: pixelated 로 더 키운다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const W = 32
const H = 20
const SCALE = 8

// 상태별 팔레트: body(몸), shade(아래 그늘), line(격자), outline(외곽), eye, sparkle
const PALETTES = {
  dough: { body: '#f6e7c9', shade: '#e9d4ab', line: '#e3cba0', outline: '#b89b6a', pupil: '#6b5a44' },
  underdone: { body: '#f3d9a0', shade: '#e6c17c', line: '#dcb36a', outline: '#a67c3d', pupil: '#4a3316' },
  baked: { body: '#e8a94f', shade: '#cf8a3a', line: '#c47d2f', outline: '#7a4a1c', pupil: '#2b1a0a' },
  crispy: { body: '#c9792e', shade: '#a85f20', line: '#9c5518', outline: '#5c3410', pupil: '#1d1006' },
  burnt: { body: '#4a3b32', shade: '#3a2d26', line: '#2f241e', outline: '#1d1612', pupil: '#0b0806' },
  golden: { body: '#ffd54a', shade: '#e8b321', line: '#dba51a', outline: '#8a6200', pupil: '#3a2a00', sparkle: '#fffbe6' },
}

function hex(color) {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
}

/** 몸통(타원) 안인지 */
function inBody(x, y) {
  const cx = 11.5
  const cy = 9.5
  const rx = 11.5
  const ry = 7
  const nx = (x + 0.5 - cx) / rx
  const ny = (y + 0.5 - cy) / ry
  return nx * nx + ny * ny <= 1
}

/** 꼬리(오른쪽으로 벌어지는 삼각형, 가운데가 갈라짐) 안인지 */
function inTail(x, y) {
  if (x < 20 || x > 30) return false
  const dy = Math.abs(y + 0.5 - 9.5)
  const half = 1.2 + (x - 20) * 0.62
  if (dy > half) return false
  // 꼬리 끝 갈라짐
  if (x >= 27 && dy < (x - 26) * 0.95) return false
  return true
}

function inShape(x, y) {
  return inBody(x, y) || inTail(x, y)
}

function render(name, palette) {
  const data = Buffer.alloc(W * H * 4, 0)
  const put = (x, y, color) => {
    const [r, g, b] = hex(color)
    const i = (y * W + x) * 4
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (inShape(x, y)) {
        let color = palette.body
        if (inBody(x, y) && y >= 13) color = palette.shade
        if (inTail(x, y) && y >= 10) color = palette.shade
        // 격자 무늬 — 몸통 가운데에만
        if (inBody(x, y) && x >= 8 && x <= 20 && ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0)) color = palette.line
        // 눈
        if ((x === 5 || x === 6) && (y === 7 || y === 8)) color = '#ffffff'
        if (x === 6 && y === 8) color = palette.pupil
        // 입
        if (x === 1 && y === 10) color = palette.outline
        put(x, y, color)
        continue
      }
      // 외곽선: 4방향 중 하나라도 모양 안이면
      const neighbor = inShape(x - 1, y) || inShape(x + 1, y) || inShape(x, y - 1) || inShape(x, y + 1)
      if (neighbor) put(x, y, palette.outline)
    }
  }

  if (palette.sparkle) {
    for (const [sx, sy] of [[14, 4], [19, 12], [9, 14], [23, 6]]) {
      put(sx, sy, palette.sparkle)
      put(sx - 1, sy, palette.sparkle); put(sx + 1, sy, palette.sparkle)
      put(sx, sy - 1, palette.sparkle); put(sx, sy + 1, palette.sparkle)
    }
  }

  return sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .resize(W * SCALE, H * SCALE, { kernel: 'nearest' })
    .webp({ lossless: true })
    .toBuffer()
    .then((buffer) => fs.writeFile(path.join('public', 'bungeoppang', `${name}.webp`), buffer))
}

await fs.mkdir(path.join('public', 'bungeoppang'), { recursive: true })
for (const [name, palette] of Object.entries(PALETTES)) {
  await render(name, palette)
  console.log('wrote', name)
}
