// 좀비를 피해라 밸런스 시뮬레이터 — 예전 규칙(old)과 2026-10-21 개편 규칙(new)을 같은 학생 모델로 비교한다.
//
//   node scripts/zombie-balance-sim.mjs                 예전 vs 새 규칙, 인원·시간 6가지
//   node scripts/zombie-balance-sim.mjs newOnly=1 full=1  새 규칙만, 3~10분 10가지
//   node scripts/zombie-balance-sim.mjs newOnly=1 short=1 SPEED=1.5 ACC_LO=0.35 ACC_HI=0.7   느린 반·어려운 문제
//
// 학생 모델: 문제 하나 6~16초 + 화면 넘김 약 3초(SPEED 배), 정답률 ACC_LO~ACC_HI.
// 좀비 표적: WEAK 비율은 '약해 보이는 인간'(체력 공개 HPVIS=1 이면 체력 최저, 0 이면 방어막 없는 아무나), 나머지는 아무나.
// 기본값은 lib/game/zombie.ts 의 GAME_CONSTANTS · radioGoalCoefficient 와 같다. 거기를 바꾸면 여기도 맞출 것.
// 이 모델은 실제 수업이 아니다. 숫자는 '어느 쪽으로 기우는지' 보는 용도.

const argv = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, Number(v)]))

const NEW = {
  H0: 100, HMAX: 150, HEAL: 25,
  SHIELD_BLOCKS: 1,        // 방어막 = 1회 완전 차단, 최대 1장
  HIDE_SEC: 10,
  SABOTAGE: 3, SABOTAGE_P: 0.25, WEAK: 0.5, HPVIS: 0,
  ZA: 35, ZB: 5, ZMAX: 60, STREAK: 10,
  RADIO_PER_CORRECT: 1, RADIO_REPAIR: 2,
  R: argv.R ?? 3.0,        // 목표 = 시작 인간 수 × 분 × R
  HELI_SEC: 45, RUSH_MUL: 1.5,
  SCAN_CD: 2, SHARE: 0.4,
  DOSES: 3, CURE_HP: 60, RADIOWIN: 1, ACC_LO: 0.5, ACC_HI: 0.9, SPEED: 1, CAL: 1, NORM: 1, STEP: 0, SNORM: 1, C3: 2.0, C5: 2.0, C7: 1.95, C10: 1.8,
  ...argv,
}

function weight(alive, h0) {
  if (NEW.STEP) return alive <= h0 * 0.25 ? 2 : alive <= h0 * 0.5 ? 1.5 : 1
  return NEW.NORM ? h0 / Math.max(1, alive) : 1
}

function rnd(a, b) { return a + Math.random() * (b - a) }

function run({ n, durMin, rules }) {
  const dur = durMin * 60
  const isNew = rules === 'new'
  const ps = [...Array(n)].map((_, i) => ({
    id: i, role: 'human', orig: 'human', hp: 100, sh: 0, atk: 0, streak: 0,
    acc: rnd(NEW.ACC_LO, NEW.ACC_HI), next: rnd(6, 16) * NEW.SPEED, inf: 0, wasted: 0, acts: 0,
    guardUntil: -1, doses: 0, stunned: false, hits: 0, scanCd: 0, known: new Set(), radio: 0, lastHit: -99, cures: 0,
  }))
  const z0 = Math.max(1, Math.round(n * 0.2))
  ps.slice().sort(() => Math.random() - 0.5).slice(0, z0).forEach((p) => { p.role = 'zombie'; p.orig = 'zombie'; p.atk = NEW.ZA; p.hp = 999 })
  const humans0 = n - z0
  let goal = NEW.CAL ? Infinity : Math.round(humans0 * durMin * NEW.R)
  let firstMinCorrect = 0
  const classKnown = new Set()
  let radio = 0, heliAt = null, t = 0, end = null, winner = null, cures = 0, stuns = 0, sabotages = 0

  const humans = () => ps.filter((p) => p.role === 'human')
  const zombies = () => ps.filter((p) => p.role === 'zombie')

  while (t < dur) {
    t += 0.5
    if (heliAt !== null && t >= heliAt + NEW.HELI_SEC) { end = t; winner = 'heli'; break }
    for (const p of ps) {
      if (t < p.next) continue
      const ok = Math.random() < p.acc
      p.next = t + (rnd(6, 16) + 3) * NEW.SPEED
      if (!ok) { p.streak = 0; if (p.role === 'human') p.scanCd = Math.max(0, p.scanCd - 1); continue }
      p.streak++
      if (p.role === 'human') {
        p.acts++
        if (p.streak % 3 === 0) p.hp = Math.min(150, p.hp + NEW.STREAK)
        if (!isNew) {
          // 지금 규칙: 방어막(25, 최대 50) 먼저, 그다음 치료(20, 최대 150)
          if (p.sh < 50) p.sh = Math.min(50, p.sh + 25)
          else if (p.hp < 150) p.hp = Math.min(150, p.hp + 20)
          else p.wasted++
          continue
        }
        const w = weight(humans().length, humans0)
        radio += NEW.RADIO_PER_CORRECT * w; p.radio += NEW.RADIO_PER_CORRECT
        if (t <= 60) firstMinCorrect++
        // 아이들 같은 선택: 다쳤으면 치료, 최근 맞았거나 가끔 방어막, 정체 아는 좀비 있으면 백신, 가끔 스캔, 나머지 수리
        const knownZ = [...new Set([...p.known, ...classKnown])].map((id) => ps[id]).filter((q) => q.role === 'zombie')
        const recentlyHit = t - p.lastHit < 30
        let action
        if (p.hp < 60 && Math.random() < 0.7) action = 'heal'
        else if (p.sh === 0 && (recentlyHit || Math.random() < 0.35)) action = 'shield'
        else if (knownZ.some((q) => q.orig === 'human') && Math.random() < 0.6) action = 'vaccine'
        else if (p.scanCd === 0 && Math.random() < 0.35) action = 'scan'
        else action = 'repair'
        if (action === 'heal') { if (p.hp >= NEW.HMAX) p.wasted++; p.hp = Math.min(NEW.HMAX, p.hp + NEW.HEAL); p.scanCd = Math.max(0, p.scanCd - 1) }
        if (action === 'shield') { p.sh = NEW.SHIELD_BLOCKS; p.scanCd = Math.max(0, p.scanCd - 1) }
        if (action === 'repair') { radio += NEW.RADIO_REPAIR * weight(humans().length, humans0); p.radio += NEW.RADIO_REPAIR; p.scanCd = Math.max(0, p.scanCd - 1) }
        if (action === 'scan') {
          const unknown = ps.filter((q) => q.id !== p.id && !p.known.has(q.id))
          const tg = unknown[Math.floor(Math.random() * unknown.length)]
          if (tg) { p.known.add(tg.id); if (tg.role === 'zombie' && Math.random() < NEW.SHARE) classKnown.add(tg.id) }
          p.scanCd = NEW.SCAN_CD
        }
        if (action === 'vaccine') {
          const tg = knownZ.filter((q) => q.orig === 'human').sort((a, b) => b.doses - a.doses)[0]
          {
            tg.doses++
            if (tg.doses >= NEW.DOSES) {
              tg.role = 'human'; tg.hp = NEW.CURE_HP; tg.sh = 0; tg.doses = 0; tg.guardUntil = t + NEW.HIDE_SEC; tg.streak = 0
              classKnown.delete(tg.id); ps.forEach((q) => q.known.delete(tg.id)); cures++; p.cures++
            }
          }
          p.scanCd = Math.max(0, p.scanCd - 1)
        }
      } else {
        if (p.streak % 3 === 0) p.atk = Math.min(NEW.ZMAX, p.atk + NEW.ZB)
        if (p.stunned) { p.stunned = false; continue }
        const hs = humans(); if (!hs.length) continue
        const open = isNew ? hs.filter((q) => t >= q.guardUntil) : hs
        if (isNew && (!open.length || Math.random() < NEW.SABOTAGE_P)) {
          if (heliAt === null) radio = Math.max(0, radio - NEW.SABOTAGE * (NEW.SNORM ? z0 / Math.max(1, zombies().length) : 1))
          p.sabotage = (p.sabotage ?? 0) + 1; sabotages++
          continue
        }
        const eff = (q) => (isNew && q.sh > 0 ? 999 : (isNew && !NEW.HPVIS ? 0 : q.hp + q.sh))
        const pool = isNew && !NEW.HPVIS && Math.random() < NEW.WEAK ? (open.filter((q) => q.sh === 0).length ? open.filter((q) => q.sh === 0) : open) : null
        const tg = pool ? pool[Math.floor(Math.random() * pool.length)]
          : Math.random() < (isNew ? NEW.WEAK : 0.5) ? open.reduce((a, b) => (eff(a) <= eff(b) ? a : b)) : open[Math.floor(Math.random() * open.length)]
        let d = p.atk * (isNew && heliAt !== null ? NEW.RUSH_MUL : 1)
        tg.hits++
        if (isNew) {
          tg.guardUntil = t + NEW.HIDE_SEC
          if (tg.sh > 0) { tg.sh = 0; d = 0 }

        } else { const s = Math.min(tg.sh, d); tg.sh -= s; d -= s }
        d = Math.round(d)
        tg.hp -= d; tg.lastHit = t
        if (tg.hp <= 0) { tg.role = 'zombie'; tg.atk = NEW.ZA; tg.sh = 0; tg.hp = 999; tg.doses = 0; p.inf++ }
      }
    }
    if (NEW.CAL && t === 60) goal = Math.round(firstMinCorrect * durMin * ({ 3: NEW.C3, 5: NEW.C5, 7: NEW.C7, 10: NEW.C10 }[durMin] ?? NEW.C7))
    if (isNew && heliAt === null && radio >= goal) heliAt = t
    if (!humans().length) { end = t; winner = 'zombie'; break }
  }
  if (!end) { end = dur; winner = !humans().length ? 'zombie' : (isNew && NEW.RADIOWIN ? (heliAt !== null ? 'heli' : 'fail') : 'time') }
  const hitsSorted = ps.map((p) => p.hits).sort((a, b) => b - a)
  const totalHits = hitsSorted.reduce((a, b) => a + b, 0)
  const hs = humans()
  return {
    winner, endFrac: end / dur, heliFrac: heliAt === null ? null : heliAt / dur,
    survivors: hs.length / humans0, cures, stuns: sabotages,
    topHitShare: totalHits ? hitsSorted[0] / totalHits : 0,
    maxHits: hitsSorted[0],
    wasted: hs.reduce((a, p) => a + p.wasted, 0) / Math.max(1, hs.reduce((a, p) => a + p.acts, 0)),
  }
}

const pct = (x) => `${Math.round(x * 100)}%`
const med = (xs) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }
const q10 = (xs) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.1)] : null }

const configs = argv.only ? [[25, 7]] : argv.full ? [[12, 3], [25, 3], [12, 5], [25, 5], [12, 7], [25, 7], [30, 7], [12, 10], [25, 10], [30, 10]] : argv.short ? [[12, 7], [25, 5], [25, 7], [25, 10]] : [[12, 5], [12, 7], [25, 5], [25, 7], [25, 10], [30, 10]]
for (const rules of argv.newOnly ? ['new'] : ['old', 'new']) {
  console.log(`\n=== ${rules === 'old' ? '지금 규칙' : (NEW.CAL ? '새 규칙 (첫 1분 보정)' : `새 규칙 (고정 목표 R=${NEW.R})`)} ===`)
  for (const [n, durMin] of configs) {
    const R = [...Array(400)].map(() => run({ n, durMin, rules }))
    const share = (w) => R.filter((r) => r.winner === w).length / R.length
    const avg = (k) => R.reduce((a, r) => a + (r[k] ?? 0), 0) / R.length
    const heli = R.map((r) => r.heliFrac)
    console.log(
      `${String(n).padStart(2)}명 ${String(durMin).padStart(2)}분 | 좀비 승 ${pct(share('zombie')).padStart(4)} · 헬기 구조 ${pct(share('heli')).padStart(4)} · 시간 종료 생존 ${pct(share('time')).padStart(4)} · 무전기 실패 ${pct(share('fail')).padStart(4)}`
      + ` | 무전기 완성 시점 중앙 ${med(heli) === null ? '-' : pct(med(heli))} (빠른 10% ${q10(heli) === null ? '-' : pct(q10(heli))})`
      + ` | 생존 ${pct(avg('survivors'))} · 백신 치료 ${avg('cures').toFixed(1)}회 · 무전기 방해 ${avg('stuns').toFixed(1)}회`
      + ` | 가장 많이 맞은 1명 몫 ${pct(avg('topHitShare'))}(${avg('maxHits').toFixed(1)}번) · 효과 없는 행동 ${pct(avg('wasted'))}`,
    )
  }
}
