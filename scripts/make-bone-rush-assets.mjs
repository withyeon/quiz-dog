/**
 * 뼈다귀 쟁탈전 그림 굽기 — Codex CLI(gpt-6.1-sol, 내장 이미지 생성)로 만든 1024px PNG(흰 배경)를 게임용 투명 WebP 로 바꾼다.
 *
 *   node scripts/make-bone-rush-assets.mjs <Codex 출력 폴더...>
 *     → public/bone-rush/*.webp, public/title/bone-rush.webp
 *
 * 폴더 안 파일 이름으로 무엇인지 알아본다 (cat.png → cat.webp, title.png → 제목 카드 …).
 * 뼈다귀·자석은 서바이벌 그림(public/survivor/skill-bone.webp·item-magnet.webp)을 같이 쓴다.
 * 그림이 없는 동안에는 components/bone-rush 가 도형·이모지로 대신 그린다.
 *
 * Codex 에 준 요청 (참고 그림: public/survivor/hero.webp·public/garden/crow.webp, 제목은 public/title/survivor.webp·cafe.webp):
 *   공통 — chunky pixel-art game sprite, thick dark outlines, glossy pixel highlights, bright cute colors,
 *          pure white background, single centered subject, no ground shadow, no text
 *   title  — 제목 로고 "뼈다귀 쟁탈전"(두 줄, 글자마다 깨끗하게), 뼈다귀를 든 포메 마스코트와 뒤에서 노리는 검은 고양이
 *   hero   — 뼈다귀를 문 포메 마스코트가 오른쪽으로 달리는 모습
 *   cat    — 빨간 눈가리개를 한 검은 도둑 고양이(자루 멘) / wildcat — 주황 줄무늬 들고양이
 *   fence·sack(뼈다귀 자루)·goldbone(황금 뼈다귀)·chest(뼈다귀 문양 보물 상자)
 * 흰 배경 지우기는 scripts/make-garden-assets.mjs 와 같은 방식(테두리에서 이어진 흰색만)이다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const OUT = 'public/bone-rush'
const TITLE_OUT = 'public/title/bone-rush.webp'
const SPRITE_MAX = 256

const NAME_MAP = {
  hero: 'hero',
  cat: 'cat',
  wildcat: 'wildcat',
  fence: 'fence',
  sack: 'sack',
  goldbone: 'goldbone',
  chest: 'chest',
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
  console.error('usage: node scripts/make-bone-rush-assets.mjs <dir...>')
  process.exit(1)
}

await fs.mkdir(OUT, { recursive: true })
for (const dir of dirs) {
  for (const name of await fs.readdir(dir)) {
    if (!name.endsWith('.png')) continue
    const base = path.basename(name, '.png')
    const isTitle = base === 'title'
    const out = NAME_MAP[base]
    if (!out && !isTitle) continue
    const cleared = await removeWhite(path.join(dir, name))
    const png = await cleared.png().toBuffer()
    const target = isTitle ? TITLE_OUT : path.join(OUT, `${out}.webp`)
    const pipeline = isTitle
      ? sharp(png).trim().resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      : sharp(png).trim().resize(SPRITE_MAX, SPRITE_MAX, { fit: 'inside' })
    await pipeline.webp({ quality: 88, alphaQuality: 100 }).toFile(target)
    const meta = await sharp(target).metadata()
    console.log(`${target} ${meta.width}×${meta.height}`)
  }
}
