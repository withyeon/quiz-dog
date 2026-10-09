// 상세페이지 렌더: 정적 서버 → 헤드리스 크롬(CDP) → 전체 캡처 → 섹션별로 잘라 저장
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const sharp = require('sharp')

const DIR = path.dirname(new URL(import.meta.url).pathname)
const OUT = path.join(DIR, 'out')
const DEST = path.resolve(DIR, '..')
const PORT = Number(process.env.RENDER_PORT || 8777)
const CDP = Number(process.env.CDP_PORT || 9335)
const DPR = 2
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.js': 'text/javascript' }

const server = http.createServer((req, res) => {
  const p = path.join(DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' })
    res.end(buf)
  })
}).listen(PORT, '127.0.0.1')

const profile = path.join(DIR, `chrome-profile-${CDP}`)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500)
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json`)).json()).find((t) => t.type === 'page') } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value

try {
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 1200, deviceScaleFactor: DPR, mobile: false })
  await send('Page.enable')
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?v=${Date.now()}` })
  await sleep(1500)
  await evaluate(`(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r }))); return 1 })()`)
  const broken = await evaluate(`[...document.images].filter(i => !i.naturalWidth).map(i => i.src)`)
  if (broken.length) console.log('BROKEN', broken)
  const info = await evaluate(`({ h: document.getElementById('page').getBoundingClientRect().height, secs: [...document.querySelectorAll('section')].map(s => { const r = s.getBoundingClientRect(); return { name: s.dataset.name, top: r.top + scrollY, h: r.height } }) })`)
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'sections'), { recursive: true })
  // 크롬 캡처는 한 장에 16384 기기 픽셀까지만 되므로 섹션마다 따로 찍는다
  const parts = []
  for (const s of info.secs) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: s.top, width: 860, height: s.h, scale: 1 } })
    const png = Buffer.from(shot.result.data, 'base64')
    const m = await sharp(png).metadata()
    parts.push({ png, h: m.height })
    await sharp(png).jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(path.join(OUT, 'sections', `${s.name}.jpg`))
    console.log(s.name, m.width, m.height)
  }
  const W = 860 * DPR
  const total = parts.reduce((a, p) => a + p.h, 0)
  let y = 0
  const composite = parts.map((p) => { const c = { input: p.png, left: 0, top: y }; y += p.h; return c })
  const full = await sharp({ create: { width: W, height: total, channels: 3, background: '#d9eef5' }, limitInputPixels: false }).composite(composite).png().toBuffer()
  const png = full
  console.log('full', W, total)
  await sharp(full, { limitInputPixels: false }).resize({ width: 860 }).jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(path.join(OUT, 'quizdog-detail-full-860.jpg'))
  const sectionsDir = path.join(DEST, 'sections')
  fs.mkdirSync(sectionsDir, { recursive: true })
  for (const s of info.secs) {
    fs.copyFileSync(path.join(OUT, 'sections', `${s.name}.jpg`), path.join(sectionsDir, `${s.name}.jpg`))
  }
  fs.copyFileSync(path.join(OUT, 'quizdog-detail-full-860.jpg'), path.join(DEST, 'quizdog-detail-full-860.jpg'))
  const removedSection = path.join(sectionsDir, '03-numbers.jpg')
  if (!info.secs.some(s => s.name === '03-numbers') && fs.existsSync(removedSection)) fs.unlinkSync(removedSection)
  console.log('saved', DEST)
  if (process.env.PREVIEW) {
    await sharp(png, { limitInputPixels: false }).resize({ width: 430 }).png().toFile(path.join(DIR, 'preview.png'))
  }
} finally {
  ws.close()
  chrome.kill()
  server.close()
  await sleep(500)
  fs.rmSync(profile, { recursive: true, force: true })
}
