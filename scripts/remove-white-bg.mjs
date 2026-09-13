// 흰 배경 사진(인형 뽑기 인형 등)의 배경을 투명하게 만든다.
// 테두리에서 이어지는 '거의 흰색' 영역만 지우므로 인형 안쪽 흰색(눈 흰자, 배, 막대사탕 막대)은 남는다.
//
//   node scripts/remove-white-bg.mjs public/fishing/7.webp public/fishing/13.webp
//   TH=200 node scripts/remove-white-bg.mjs ...   # 옅은 회색 그림자까지 지울 때 (기본 232)
//
// 원본을 덮어쓴다. git으로 되돌릴 수 있는 파일에만 쓸 것.
import sharp from 'sharp'

const TH = Number(process.env.TH ?? 232)   // 이 밝기 이상이면 배경 후보
const SAT = Number(process.env.SAT ?? 14)  // 채널 차이가 이 이하(무채색)여야 배경
const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/remove-white-bg.mjs <image...>')
  process.exit(1)
}

const isBg = (r, g, b) => r >= TH && g >= TH && b >= TH && Math.max(r, g, b) - Math.min(r, g, b) <= SAT

for (const file of files) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const N = w * h
  const bg = new Uint8Array(N)
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

  let removed = 0
  for (let i = 0; i < N; i++) {
    const p = i * 4
    if (bg[i]) { data[p + 3] = 0; removed++; continue }
    const x = i % w
    const y = (i - x) / w
    const touchesBg = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w])
    if (touchesBg) {
      // 가장자리 픽셀은 밝을수록 더 투명하게 → 흰 테두리(halo) 방지
      const lum = Math.min(data[p], data[p + 1], data[p + 2])
      const a = Math.round(255 * Math.min(1, (255 - lum) / 80))
      data[p + 3] = Math.min(data[p + 3], Math.max(a, 64))
    }
  }

  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer()
  await sharp(out).toFile(file)
  console.log(`${file}: 배경 ${(100 * removed / N).toFixed(1)}% 제거`)
}
