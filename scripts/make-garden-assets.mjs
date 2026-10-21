/**
 * 블록 텃밭 키우기 그림 굽기 — Codex CLI 로 만든 1024px PNG(흰 배경)를 게임용 투명 WebP 로 바꾼다.
 *
 *   node scripts/make-garden-assets.mjs <Codex 출력 폴더...>
 *     → public/garden/*.webp, public/title/garden.webp
 *
 * 폴더 안 파일 이름으로 무엇인지 알아본다 (grass.png → tile-grass.webp, carrot.png → crop-carrot.webp …).
 * - 땅 블록 3장(grass·soil·locked)은 같은 외곽으로 편집해 뽑았으므로 모두 같은 상자로 자른다.
 *   그래야 components/garden/IsoGarden.tsx 의 마름모 좌표(TILE_GEOMETRY)가 세 장에 똑같이 맞는다.
 * - 나머지는 흰 배경을 지운 뒤 투명 여백을 잘라 낸다(작물은 화면에서 아래 가운데에 세운다).
 * 흰 배경 지우기는 scripts/remove-white-bg.mjs 와 같은 방식(테두리에서 이어진 흰색만)이다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const OUT = 'public/garden'
const TITLE_OUT = 'public/title/garden.webp'

/** 땅 블록 공통 자르기 상자 (1024px 원본 기준). 울타리가 위로 솟은 locked 까지 들어가게 위를 넉넉히 */
const TILE_BOX = { left: 15, top: 90, width: 994, height: 807 }
const TILE_WIDTH = 320
const SPRITE_MAX = 384

const NAME_MAP = {
  grass: { out: 'tile-grass', kind: 'tile' },
  soil: { out: 'tile-soil', kind: 'tile' },
  locked: { out: 'tile-locked', kind: 'tile' },
  seed: { out: 'stage-seed', kind: 'sprite' },
  sprout: { out: 'stage-sprout', kind: 'sprite' },
  young: { out: 'stage-young', kind: 'sprite' },
  carrot: { out: 'crop-carrot', kind: 'sprite' },
  strawberry: { out: 'crop-strawberry', kind: 'sprite' },
  blueberry: { out: 'crop-blueberry', kind: 'sprite' },
  tomato: { out: 'crop-tomato', kind: 'sprite' },
  corn: { out: 'crop-corn', kind: 'sprite' },
  watermelon: { out: 'crop-watermelon', kind: 'sprite' },
  pumpkin: { out: 'crop-pumpkin', kind: 'sprite' },
  apple_tree: { out: 'crop-apple_tree', kind: 'sprite' },
  dragonfruit: { out: 'crop-dragonfruit', kind: 'sprite' },
  crow: { out: 'crow', kind: 'sprite' },
  scarecrow: { out: 'scarecrow', kind: 'sprite' },
  farmer: { out: 'farmer', kind: 'sprite' },
  seedpack: { out: 'icon-seedpack', kind: 'sprite' },
  coin: { out: 'icon-coin', kind: 'sprite' },
  sprinkler: { out: 'icon-sprinkler', kind: 'sprite' },
  title: { out: 'title', kind: 'title' },
}

const TH = 232
const SAT = 14
const isBg = (r, g, b) => r >= TH && g >= TH && b >= TH && Math.max(r, g, b) - Math.min(r, g, b) <= SAT

/** 테두리에서 이어진 흰 배경을 투명하게. raw RGBA 버퍼를 돌려준다 */
async function removeWhite(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const bg = new Uint8Array(w * h)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (bg[i]) return
    const p = i * 4
    if (data[p + 3] < 10 || isBg(data[p], data[p + 1], data[p + 2])) {
      bg[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (stack.length) {
    const i = stack.pop()
    const x = i % w
    const y = (i - x) / w
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    if (bg[i]) { data[p + 3] = 0; continue }
    const x = i % w
    const y = (i - x) / w
    const touchesBg = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w])
    if (touchesBg) {
      const lum = Math.min(data[p], data[p + 1], data[p + 2])
      const a = Math.round(255 * Math.min(1, (255 - lum) / 80))
      data[p + 3] = Math.min(data[p + 3], Math.max(a, 64))
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
}

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
  console.error('usage: node scripts/make-garden-assets.mjs <dir...>')
  process.exit(1)
}

await fs.mkdir(OUT, { recursive: true })
for (const dir of dirs) {
  for (const name of await fs.readdir(dir)) {
    if (!name.endsWith('.png')) continue
    const spec = NAME_MAP[path.basename(name, '.png')]
    if (!spec) continue
    const cleared = await removeWhite(path.join(dir, name))
    const png = await cleared.png().toBuffer()
    let pipeline
    let target
    if (spec.kind === 'tile') {
      pipeline = sharp(png).extract(TILE_BOX).resize({ width: TILE_WIDTH })
      target = path.join(OUT, `${spec.out}.webp`)
    } else if (spec.kind === 'title') {
      pipeline = sharp(png).trim().resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      target = TITLE_OUT
    } else {
      pipeline = sharp(png).trim().resize(SPRITE_MAX, SPRITE_MAX, { fit: 'inside' })
      target = path.join(OUT, `${spec.out}.webp`)
    }
    await pipeline.webp({ quality: 88, alphaQuality: 100 }).toFile(target)
    const meta = await sharp(target).metadata()
    console.log(`${target} ${meta.width}×${meta.height}`)
  }
}
