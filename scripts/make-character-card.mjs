/**
 * 캐릭터 아바타 카드 만들기 — public/character/<n>.png 원본을 기존 1~20번과 같은 규격의 WebP로 바꾼다.
 *
 *   node scripts/make-character-card.mjs 21 22 23 24
 *   node scripts/make-character-card.mjs 25 --dry-run
 *
 * 기존 20장의 규격(1.webp ~ 20.webp를 실측한 값):
 * - 512×512 캔버스 안에 372×372 카드가 가운데(70,70)에 놓이고, 카드 바깥은 투명
 * - 카드 모서리는 반지름 40px로 둥글게 깎여 있다 (배경색·무늬는 그대로 둔다)
 * - 같은 그림의 256px 축소본이 public/character/webp/ 에 함께 있다 (레거시 .svg 경로용)
 *
 * 원본 PNG는 raw-assets/character-original/ 로 옮긴다. public/ 에 두면 1MB짜리가 그대로 배포된다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const CANVAS = 512
const CARD = 372
const OFFSET = 70
const RADIUS = 40
const SMALL = 256

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'character')
const SMALL_DIR = path.join(PUBLIC_DIR, 'webp')
const BACKUP_DIR = path.join(process.cwd(), 'raw-assets', 'character-original')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const ids = args.filter((a) => !a.startsWith('--'))

if (ids.length === 0) {
  console.error('사용법: node scripts/make-character-card.mjs 21 22 23 [--dry-run]')
  process.exit(1)
}

const mask = Buffer.from(
  `<svg width="${CARD}" height="${CARD}"><rect width="${CARD}" height="${CARD}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`,
)

async function findSource(id) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const file = path.join(PUBLIC_DIR, `${id}.${ext}`)
    try {
      await fs.access(file)
      if (ext === 'webp') continue // 이미 변환된 결과물
      return file
    } catch {}
  }
  return null
}

for (const id of ids) {
  const source = await findSource(id)
  if (!source) {
    console.error(`✗ ${id}: public/character/${id}.png 을 찾지 못했다`)
    continue
  }

  const card = await sharp(source)
    .resize(CARD, CARD, { kernel: 'lanczos3', fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const full = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: card, left: OFFSET, top: OFFSET }])
    .webp({ quality: 88, effort: 6 })
    .toBuffer()

  const small = await sharp(full).resize(SMALL, SMALL).webp({ quality: 85, effort: 6 }).toBuffer()

  if (dryRun) {
    console.log(`· ${id}: ${(full.length / 1024).toFixed(1)}KB / ${(small.length / 1024).toFixed(1)}KB (dry-run)`)
    continue
  }

  await fs.mkdir(SMALL_DIR, { recursive: true })
  await fs.mkdir(BACKUP_DIR, { recursive: true })
  await fs.writeFile(path.join(PUBLIC_DIR, `${id}.webp`), full)
  await fs.writeFile(path.join(SMALL_DIR, `${id}.webp`), small)
  await fs.rename(source, path.join(BACKUP_DIR, path.basename(source)))

  console.log(`✓ ${id}.webp ${(full.length / 1024).toFixed(1)}KB · webp/${id}.webp ${(small.length / 1024).toFixed(1)}KB`)
}
