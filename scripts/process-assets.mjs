import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const projectRoot = process.cwd()
const rawAssetsDir = path.join(projectRoot, 'raw-assets')
const tightDir = path.join(projectRoot, 'public', 'assets', 'tight')
const iconsDir = path.join(projectRoot, 'public', 'assets', 'icons')
const manifestDir = path.join(projectRoot, 'src', 'assets')
const manifestPath = path.join(manifestDir, 'game-assets.ts')

const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const iconSizes = [32, 64, 128]

function toPublicPath(filePath) {
  return `/${path.relative(path.join(projectRoot, 'public'), filePath).split(path.sep).join('/')}`
}

function toLogPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/')
}

function toAssetKey(relativeFilePath) {
  const parsedPath = path.parse(relativeFilePath)
  return path.join(parsedPath.dir, parsedPath.name).split(path.sep).join('/')
}

function formatSize(metadata) {
  const width = metadata.width ?? '?'
  const height = metadata.height ?? '?'
  return `${width}x${height}`
}

function createManifestSource(assets) {
  const entries = assets
    .map(({ key, tightPath, iconPaths }) => {
      const iconLines = iconSizes
        .map((size) => `    icon${size}: ${JSON.stringify(iconPaths[size])},`)
        .join('\n')

      return `  ${JSON.stringify(key)}: {\n    tight: ${JSON.stringify(tightPath)},\n${iconLines}\n  }`
    })
    .join(',\n')

  return `export const gameAssets = {\n${entries}\n} as const;\n\nexport type GameAssetKey = keyof typeof gameAssets;\n`
}

async function ensureDirectories() {
  await Promise.all([
    fs.mkdir(rawAssetsDir, { recursive: true }),
    fs.mkdir(tightDir, { recursive: true }),
    fs.mkdir(iconsDir, { recursive: true }),
    fs.mkdir(manifestDir, { recursive: true }),
  ])
}

async function findRawImages() {
  const imageFiles = []

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (!entry.isFile()) continue
      if (!supportedExtensions.has(path.extname(entry.name).toLowerCase())) continue

      imageFiles.push(path.relative(rawAssetsDir, entryPath))
    }
  }

  await walk(rawAssetsDir)

  return imageFiles.sort((a, b) => a.localeCompare(b))
}

async function processAsset(relativeFilePath) {
  const inputPath = path.join(rawAssetsDir, relativeFilePath)
  const key = toAssetKey(relativeFilePath)
  const outputDir = path.dirname(key)
  const outputName = path.basename(key)
  const tightOutputPath = path.join(tightDir, outputDir, `${outputName}.png`)
  const iconOutputPaths = Object.fromEntries(
    iconSizes.map((size) => [size, path.join(iconsDir, outputDir, `${outputName}-${size}.png`)])
  )

  const originalMetadata = await sharp(inputPath).metadata()
  const tightBuffer = await sharp(inputPath).ensureAlpha().trim().png().toBuffer()
  const tightMetadata = await sharp(tightBuffer).metadata()

  await Promise.all([
    fs.mkdir(path.dirname(tightOutputPath), { recursive: true }),
    ...iconSizes.map((size) => fs.mkdir(path.dirname(iconOutputPaths[size]), { recursive: true })),
  ])

  await fs.writeFile(tightOutputPath, tightBuffer)

  await Promise.all(
    iconSizes.map((size) =>
      sharp(tightBuffer)
        .resize({
          width: size,
          height: size,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          kernel: sharp.kernel.nearest,
        })
        .png()
        .toFile(iconOutputPaths[size])
    )
  )

  const generatedFiles = [
    tightOutputPath,
    ...iconSizes.map((size) => iconOutputPaths[size]),
  ]

  console.log(`\n${relativeFilePath.split(path.sep).join('/')}`)
  console.log(`  original: ${formatSize(originalMetadata)}`)
  console.log(`  trimmed:  ${formatSize(tightMetadata)}`)
  console.log('  generated:')
  generatedFiles.forEach((filePath) => {
    console.log(`    - ${toLogPath(filePath)}`)
  })

  return {
    key,
    tightPath: toPublicPath(tightOutputPath),
    iconPaths: Object.fromEntries(
      iconSizes.map((size) => [size, toPublicPath(iconOutputPaths[size])])
    ),
  }
}

async function main() {
  await ensureDirectories()

  const imageFiles = await findRawImages()

  if (imageFiles.length === 0) {
    await fs.writeFile(manifestPath, createManifestSource([]), 'utf8')
    console.log('raw-assets 폴더에 처리할 이미지가 없습니다.')
    console.log('PNG, JPG, JPEG, WebP 파일을 raw-assets 또는 그 하위 폴더에 넣고 `npm run assets`를 다시 실행하세요.')
    console.log(`빈 manifest를 생성했습니다: ${toLogPath(manifestPath)}`)
    return
  }

  console.log(`Processing ${imageFiles.length} asset(s)...`)

  const processedAssets = []
  const seenKeys = new Set()

  for (const relativeFilePath of imageFiles) {
    const key = toAssetKey(relativeFilePath)

    if (seenKeys.has(key)) {
      console.warn(`\nSkipping ${relativeFilePath}: asset key "${key}"가 이미 처리되었습니다.`)
      continue
    }

    seenKeys.add(key)
    processedAssets.push(await processAsset(relativeFilePath))
  }

  await fs.writeFile(manifestPath, createManifestSource(processedAssets), 'utf8')

  console.log(`\nManifest generated: ${toLogPath(manifestPath)}`)
  console.log('Done.')
}

main().catch((error) => {
  console.error('\nAsset processing failed.')
  console.error(error)
  process.exit(1)
})
