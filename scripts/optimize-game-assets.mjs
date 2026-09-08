/**
 * 게임 이미지 최적화 — public/<폴더>의 원본을 표시 크기에 맞는 WebP로 다시 만든다.
 *
 *   node scripts/optimize-game-assets.mjs tower
 *   node scripts/optimize-game-assets.mjs title --dry-run
 *   node scripts/optimize-game-assets.mjs gold-quest --size 512
 *
 * 왜 필요한가:
 * - 디자인 툴에서 "SVG로 내보내기" 한 파일은 벡터가 아니라 PNG를 base64로 감싼 것이라
 *   3~5MB짜리가 되고, Next.js 이미지 최적화(WebP 변환·리사이즈)를 전혀 못 받는다.
 * - 캔버스 게임은 <Image>를 안 쓰고 new Image()로 직접 불러오므로 최적화 경로가 아예 없다.
 *
 * 동작:
 * 1. public/<폴더>의 svg·png·jpg를 raw-assets/<폴더>-original/ 로 백업 (이미 있으면 건너뜀)
 * 2. PRESETS의 크기 규칙에 맞춰 .webp 생성 (원본은 지우지 않는다 — 게임 확인 후 직접 삭제)
 * 3. 결과가 전부 투명하면 렌더링 실패로 보고 중단
 *
 * 새 이미지를 추가했을 때도 같은 명령을 다시 돌리면 된다(이미 변환된 것은 건너뜀).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/**
 * 폴더별 목표 해상도. 화면에 그려지는 크기의 2~3배가 기준이다.
 * 새 폴더를 최적화할 때 여기에 규칙을 추가하면 다음부터 자동 적용된다.
 */
const PRESETS = {
  tower: [
    { match: /^(basic|magic|bomb|laser|slow)\./, size: 192 }, // 캔버스에서 70px로 그림
    { match: /^enemy\//, size: 160 },                         // 50~58px
    { match: /^projectile\//, size: 64 },                     // 20px
    { match: /^ui\//, size: 1672 },                           // 배경: 원본 크기 유지
  ],
  title: [
    { match: /./, size: 768 }, // 가장 크게 쓰는 곳이 선생님 게임 선택 화면 320px
  ],
}

const DEFAULT_SIZE = 1024
const SOURCE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg'])

const [folder, ...flags] = process.argv.slice(2)
if (!folder) {
  console.error('사용법: node scripts/optimize-game-assets.mjs <public 하위 폴더> [--dry-run] [--size N]')
  process.exit(1)
}

const dryRun = flags.includes('--dry-run')
const sizeOverride = flags.includes('--size') ? Number(flags[flags.indexOf('--size') + 1]) : null

const sourceDir = path.join(process.cwd(), 'public', folder)
const backupDir = path.join(process.cwd(), 'raw-assets', `${folder}-original`)
const rules = PRESETS[folder] ?? [{ match: /./, size: DEFAULT_SIZE }]

function targetSize(relativePath) {
  if (sizeOverride) return sizeOverride
  return (rules.find((rule) => rule.match.test(relativePath)) ?? { size: DEFAULT_SIZE }).size
}

async function listSources(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listSources(path.join(dir, entry.name), relativePath)))
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relativePath)
    }
  }
  return files
}

async function exists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)
}

const sources = (await listSources(sourceDir)).sort()
if (sources.length === 0) {
  console.log(`public/${folder}에 변환할 이미지가 없습니다.`)
  process.exit(0)
}

let totalBefore = 0
let totalAfter = 0
let converted = 0
let skipped = 0

for (const relativePath of sources) {
  const inputPath = path.join(sourceDir, relativePath)
  const outputPath = path.join(sourceDir, relativePath.replace(/\.(svg|png|jpe?g)$/i, '.webp'))

  if (inputPath === outputPath) continue // 이미 webp
  if (await exists(outputPath)) {
    skipped += 1
    continue
  }

  const size = targetSize(relativePath)
  const before = (await fs.stat(inputPath)).size

  if (dryRun) {
    console.log(`${relativePath.padEnd(34)} ${(before / 1024 / 1024).toFixed(2)}MB → ${size}px webp (예정)`)
    totalBefore += before
    continue
  }

  // 백업 (원본을 덮어쓰지 않도록 이미 있으면 그대로 둔다)
  const backupPath = path.join(backupDir, relativePath)
  if (!(await exists(backupPath))) {
    await fs.mkdir(path.dirname(backupPath), { recursive: true })
    await fs.copyFile(inputPath, backupPath)
  }

  // SVG는 그대로 렌더링한다(레이어·필터가 여러 개여도 안전).
  // density를 올려야 안에 박힌 비트맵이 목표 크기에서 뭉개지지 않는다.
  const buffer = await sharp(inputPath, { density: 300 })
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 })
    .toBuffer()

  const meta = await sharp(buffer).metadata()
  const stats = await sharp(buffer).stats()
  const alpha = stats.channels[3]
  if (meta.channels === 4 && alpha && alpha.max === 0) {
    throw new Error(`${relativePath}: 결과가 전부 투명함 — 렌더링 실패. 원본을 확인하세요.`)
  }

  await fs.writeFile(outputPath, buffer)
  totalBefore += before
  totalAfter += buffer.length
  converted += 1

  console.log(
    `${relativePath.padEnd(34)} ${(before / 1024 / 1024).toFixed(2)}MB → ${(buffer.length / 1024).toFixed(0)}KB  (${meta.width}x${meta.height})`
  )
}

const mb = (n) => (n / 1024 / 1024).toFixed(2)
console.log('')
if (dryRun) {
  console.log(`[미리보기] ${sources.length}개 중 ${mb(totalBefore)}MB 분량이 변환 대상입니다.`)
} else {
  console.log(`변환 ${converted}개 · 이미 있어서 건너뜀 ${skipped}개`)
  if (converted > 0) {
    console.log(`${mb(totalBefore)}MB → ${mb(totalAfter)}MB (${(100 - (totalAfter / totalBefore) * 100).toFixed(1)}% 감소)`)
    console.log(`원본 백업: raw-assets/${folder}-original/`)
    console.log(`다음: 코드의 경로를 .webp로 바꾸고, 게임 확인 후 원본을 삭제하세요.`)
  }
}
