// 간식런 - 3D 원근감 캔버스 렌더러
// Temple Run 스타일 소실점 기반 렌더링

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: string; type: 'dust' | 'sparkle' | 'hit';
}

export interface RenderState {
  stripeOffset: number;
  particles: Particle[];
  treeOffset: number;
  shakeX: number;
  shakeY: number;
  shakeDuration: number;
  cameraPunchFrames: number;
  cameraPunchMax: number;
}

export function createRenderState(): RenderState {
  return {
    stripeOffset: 0,
    particles: [],
    treeOffset: 0,
    shakeX: 0,
    shakeY: 0,
    shakeDuration: 0,
    cameraPunchFrames: 0,
    cameraPunchMax: 1,
  };
}

// 소실점 Y 좌표 (화면 상단 30% 부근)
function vanishY(h: number) { return h * 0.28; }

// 3D 보간: y 위치(0~1, 0=소실점, 1=화면하단)에서의 도로 폭
function roadWidthAt(t: number, w: number): number {
  const minW = w * 0.12;
  const maxW = w * 1.1;
  return minW + (maxW - minW) * Math.pow(t, 1.4);
}

// 오브젝트 y(게임좌표) → 화면 y + 스케일
export function project(objY: number, canvasH: number): { screenY: number; scale: number } {
  const vy = vanishY(canvasH);
  const bottom = canvasH + 40;
  const playerZone = canvasH * 0.75;
  // objY: 0=화면상단 → canvasH=화면하단, 게임에서 -60~canvasH+100 범위
  const t = Math.max(0, Math.min(1, (objY + 60) / (canvasH + 160)));
  const screenY = vy + (bottom - vy) * Math.pow(t, 1.2);
  const scale = 0.15 + 0.85 * Math.pow(t, 1.3);
  return { screenY, scale };
}

// 차선 X 위치 계산 (원근 적용)
export function laneX(lane: number, t: number, w: number): number {
  const rw = roadWidthAt(t, w);
  const cx = w / 2;
  const laneW = rw / 3;
  return cx - rw / 2 + laneW * lane + laneW / 2;
}

// ── 하늘 + 산 배경 ──
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  const vy = vanishY(h);
  // 하늘 그라디언트
  const skyGrad = ctx.createLinearGradient(0, 0, 0, vy + 20);
  skyGrad.addColorStop(0, '#1a1a2e');
  skyGrad.addColorStop(0.4, '#16213e');
  skyGrad.addColorStop(0.7, '#0f3460');
  skyGrad.addColorStop(1, '#533483');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, vy + 20);

  // 별
  const starSeed = 42;
  for (let i = 0; i < 30; i++) {
    const sx = ((starSeed * (i + 1) * 7) % 1000) / 1000 * w;
    const sy = ((starSeed * (i + 1) * 13) % 1000) / 1000 * (vy * 0.7);
    const flicker = 0.4 + 0.6 * Math.sin(elapsed * 0.05 + i * 2.1);
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 산 실루엣
  ctx.fillStyle = '#1a1a3e';
  ctx.beginPath();
  ctx.moveTo(0, vy + 10);
  for (let x = 0; x <= w; x += 20) {
    const mh = Math.sin(x * 0.008) * 35 + Math.sin(x * 0.015 + 1) * 20 + Math.cos(x * 0.003) * 15;
    ctx.lineTo(x, vy - mh);
  }
  ctx.lineTo(w, vy + 10);
  ctx.closePath();
  ctx.fill();
}

// ── 3D 도로 ──
export function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, stripeOffset: number) {
  const vy = vanishY(h);
  const steps = 40;

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const y0 = vy + (h + 40 - vy) * Math.pow(t0, 1.2);
    const y1 = vy + (h + 40 - vy) * Math.pow(t1, 1.2);
    const rw0 = roadWidthAt(t0, w);
    const rw1 = roadWidthAt(t1, w);
    const cx = w / 2;

    // 도로 본체
    const brightness = Math.floor(25 + t0 * 20);
    ctx.fillStyle = `rgb(${brightness},${brightness + 2},${brightness + 5})`;
    ctx.beginPath();
    ctx.moveTo(cx - rw0 / 2, y0);
    ctx.lineTo(cx + rw0 / 2, y0);
    ctx.lineTo(cx + rw1 / 2, y1);
    ctx.lineTo(cx - rw1 / 2, y1);
    ctx.closePath();
    ctx.fill();

    // 도로 가장자리 (주황)
    const edgeW = 3 + t0 * 5;
    ctx.fillStyle = `rgba(251,191,36,${0.3 + t0 * 0.5})`;
    ctx.fillRect(cx - rw0 / 2 - edgeW, y0, edgeW, y1 - y0);
    ctx.fillRect(cx + rw0 / 2, y0, edgeW, y1 - y0);
  }

  // 차선 구분선 (대시)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  for (let laneIdx = 1; laneIdx < 3; laneIdx++) {
    ctx.beginPath();
    let dashOn = false;
    const dashLen = 15;
    let accum = stripeOffset % (dashLen * 2);

    for (let i = 0; i < 200; i++) {
      const t = i / 200;
      const y = vy + (h + 40 - vy) * Math.pow(t, 1.2);
      const rw = roadWidthAt(t, w);
      const cx = w / 2;
      const x = cx - rw / 2 + (rw / 3) * laneIdx;
      const lw = 1 + t * 2.5;

      accum += (h / 200) * 0.15;
      dashOn = (accum % (dashLen * 2)) < dashLen;
      if (dashOn) {
        ctx.lineWidth = lw;
        if (i === 0 || !dashOn) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
}

// ── 도로 양옆 나무/기둥 ──
export function drawSideTrees(ctx: CanvasRenderingContext2D, w: number, h: number, offset: number) {
  const vy = vanishY(h);
  const treeSpacing = 120;

  for (let i = 0; i < 8; i++) {
    const baseT = ((i * treeSpacing + offset) % (treeSpacing * 8)) / (treeSpacing * 8);
    const t = Math.max(0.05, Math.min(0.95, baseT));
    const y = vy + (h + 40 - vy) * Math.pow(t, 1.2);
    const rw = roadWidthAt(t, w);
    const cx = w / 2;
    const scale = 0.15 + 0.85 * Math.pow(t, 1.3);
    const treeH = 40 * scale;
    const trunkW = 4 * scale;
    const canopyR = 12 * scale;

    // 왼쪽 나무
    const lx = cx - rw / 2 - 20 * scale;
    ctx.fillStyle = '#3d2914';
    ctx.fillRect(lx - trunkW / 2, y - treeH, trunkW, treeH);
    ctx.fillStyle = '#1a5c2a';
    ctx.beginPath();
    ctx.arc(lx, y - treeH - canopyR * 0.3, canopyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#227a3a';
    ctx.beginPath();
    ctx.arc(lx - canopyR * 0.4, y - treeH + canopyR * 0.2, canopyR * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 오른쪽 나무
    const rx = cx + rw / 2 + 20 * scale;
    ctx.fillStyle = '#3d2914';
    ctx.fillRect(rx - trunkW / 2, y - treeH, trunkW, treeH);
    ctx.fillStyle = '#1a5c2a';
    ctx.beginPath();
    ctx.arc(rx, y - treeH - canopyR * 0.3, canopyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#227a3a';
    ctx.beginPath();
    ctx.arc(rx + canopyR * 0.4, y - treeH + canopyR * 0.2, canopyR * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── 강아지 캐릭터 그리기 ──
export function drawDog(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number,
  frame: number, isBig: boolean, hasShield: boolean, isDrone: boolean, invincible: number
) {
  const s = size * (isBig ? 1.4 : 1);
  ctx.save();
  ctx.translate(x, y);

  // 무적 깜빡임
  if (invincible > 0) {
    ctx.globalAlpha = 0.5 + Math.sin(frame * 0.3) * 0.3;
  }

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.35, s * 0.35, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // 드론 프로펠러
  if (isDrone) {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    const propAngle = frame * 0.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3 * Math.cos(propAngle), -s * 0.6 - s * 0.05 * Math.sin(propAngle));
    ctx.lineTo(s * 0.3 * Math.cos(propAngle), -s * 0.6 + s * 0.05 * Math.sin(propAngle));
    ctx.stroke();
  }

  // 몸통
  const bobY = Math.sin(frame * 0.15) * 2;
  ctx.fillStyle = isBig ? '#c97d30' : '#d4915c';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1 + bobY, s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 머리
  ctx.fillStyle = isBig ? '#b5702a' : '#c4845a';
  ctx.beginPath();
  ctx.arc(0, -s * 0.35 + bobY, s * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 귀
  ctx.fillStyle = '#8B5E3C';
  ctx.beginPath();
  ctx.ellipse(-s * 0.15, -s * 0.48 + bobY, s * 0.06, s * 0.1, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.15, -s * 0.48 + bobY, s * 0.06, s * 0.1, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-s * 0.07, -s * 0.37 + bobY, s * 0.03, 0, Math.PI * 2);
  ctx.arc(s * 0.07, -s * 0.37 + bobY, s * 0.03, 0, Math.PI * 2);
  ctx.fill();

  // 코
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(0, -s * 0.3 + bobY, s * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // 다리 (달리는 모션)
  const legPhase = frame * 0.2;
  ctx.fillStyle = isBig ? '#b5702a' : '#c4845a';
  for (const side of [-1, 1]) {
    const legX = side * s * 0.15;
    const frontKick = Math.sin(legPhase + side * 0.5) * s * 0.12;
    const backKick = Math.sin(legPhase + Math.PI + side * 0.5) * s * 0.12;
    // 앞다리
    ctx.fillRect(legX - s * 0.04 + frontKick, s * 0.05 + bobY, s * 0.07, s * 0.2);
    // 뒷다리
    ctx.fillRect(legX - s * 0.04 + backKick, s * 0.1 + bobY, s * 0.07, s * 0.18);
  }

  // 꼬리
  const tailWag = Math.sin(frame * 0.25) * 0.4;
  ctx.strokeStyle = isBig ? '#b5702a' : '#c4845a';
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05 + bobY);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.25 + bobY, s * 0.15 + Math.sin(tailWag) * s * 0.1, -s * 0.4 + bobY);
  ctx.stroke();

  // 방어막
  if (hasShield) {
    ctx.strokeStyle = 'rgba(6,182,212,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -s * 0.1 + bobY, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(6,182,212,0.08)';
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── 장애물 그리기 ──
export function drawObstacle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number) {
  const s = 20 * scale;
  ctx.save();
  ctx.translate(x, y);

  if (variant % 3 === 0) {
    // 바리케이드
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(-s, -s * 0.6, s * 2, s * 0.3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-s * 0.7, -s * 0.6, s * 0.5, s * 0.3);
    ctx.fillRect(s * 0.2, -s * 0.6, s * 0.5, s * 0.3);
    // 지지대
    ctx.fillStyle = '#888';
    ctx.fillRect(-s * 0.8, -s * 0.3, s * 0.1, s * 0.6);
    ctx.fillRect(s * 0.7, -s * 0.3, s * 0.1, s * 0.6);
  } else if (variant % 3 === 1) {
    // 돌덩이
    ctx.fillStyle = '#5a5a6e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, 0);
    ctx.lineTo(-s * 0.5, -s * 0.7);
    ctx.lineTo(s * 0.3, -s * 0.8);
    ctx.lineTo(s * 0.8, -s * 0.3);
    ctx.lineTo(s * 0.6, s * 0.1);
    ctx.lineTo(-s * 0.3, s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6e6e82';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.2);
    ctx.lineTo(s * 0.1, -s * 0.5);
    ctx.lineTo(s * 0.4, -s * 0.1);
    ctx.closePath();
    ctx.fill();
  } else {
    // 나무 상자
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(-s * 0.6, -s * 0.7, s * 1.2, s * 0.9);
    ctx.strokeStyle = '#6B4F0A';
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeRect(-s * 0.6, -s * 0.7, s * 1.2, s * 0.9);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(0, s * 0.2);
    ctx.moveTo(-s * 0.6, -s * 0.25);
    ctx.lineTo(s * 0.6, -s * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

// ── 뼈다귀 그리기 ──
export function drawBone(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, golden: boolean, frame: number) {
  const s = 10 * scale;
  ctx.save();
  ctx.translate(x, y);
  const rot = Math.sin(frame * 0.05) * 0.3;
  ctx.rotate(rot);

  if (golden) {
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12 * scale;
  }

  ctx.fillStyle = golden ? '#fbbf24' : '#f5f0e8';
  ctx.strokeStyle = golden ? '#d4a017' : '#ccc5b5';
  ctx.lineWidth = 1 * scale;

  // 뼈다귀 모양
  const boneLen = s * 1.8;
  const knobR = s * 0.35;
  ctx.beginPath();
  ctx.moveTo(-boneLen / 2 + knobR, -s * 0.12);
  ctx.lineTo(boneLen / 2 - knobR, -s * 0.12);
  ctx.lineTo(boneLen / 2 - knobR, s * 0.12);
  ctx.lineTo(-boneLen / 2 + knobR, s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 양쪽 둥근 끝
  for (const dir of [-1, 1]) {
    const kx = dir * (boneLen / 2 - knobR * 0.3);
    ctx.beginPath(); ctx.arc(kx, -knobR * 0.6, knobR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(kx, knobR * 0.6, knobR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── 아이템 박스 그리기 ──
export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  frame: number,
  age = 999,
) {
  const landingProgress = Math.min(1, age / 16);
  const dropOffset = age < 16 ? -34 * scale * Math.pow(1 - landingProgress, 2) : 0;
  const rebound = age >= 16 && age < 28 ? Math.sin((age - 16) / 12 * Math.PI) * -6 * scale : 0;
  const closeShake = scale > 0.58 ? Math.sin(frame * 0.9 + x * 0.03) * (scale - 0.58) * 8 : 0;
  const s = 20 * scale;
  ctx.save();
  ctx.translate(x + closeShake, y + dropOffset + rebound);

  // 바닥 충격 링
  if (age < 24) {
    const ring = Math.max(0, age / 24);
    ctx.save();
    ctx.globalAlpha = (1 - ring) * 0.7;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(1, 3 * scale * (1 - ring));
    ctx.beginPath();
    ctx.ellipse(
      -closeShake,
      s * 0.38 - dropOffset - rebound,
      s * (0.55 + ring * 1.4),
      s * (0.16 + ring * 0.32),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  // 은은한 보상 빛
  const glow = 0.45 + Math.sin(frame * 0.12) * 0.18;
  const aura = ctx.createRadialGradient(0, -s * 0.15, s * 0.2, 0, -s * 0.1, s * 1.9);
  aura.addColorStop(0, `rgba(251,191,36,${0.28 + glow * 0.12})`);
  aura.addColorStop(0.45, `rgba(124,58,237,${0.18 + glow * 0.14})`);
  aura.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 1.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = '#8B5CF6';
  ctx.shadowBlur = (22 + glow * 20) * scale;

  // 입체 상자
  const boxGrad = ctx.createLinearGradient(-s * 0.6, -s * 0.85, s * 0.7, s * 0.35);
  boxGrad.addColorStop(0, '#a78bfa');
  boxGrad.addColorStop(0.35, '#7c3aed');
  boxGrad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = boxGrad;
  ctx.beginPath();
  ctx.roundRect(-s * 0.65, -s * 0.72, s * 1.3, s * 1.04, s * 0.14);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, 1.8 * scale);
  ctx.stroke();

  // 뚜껑
  const lidGrad = ctx.createLinearGradient(0, -s * 0.9, 0, -s * 0.42);
  lidGrad.addColorStop(0, '#c4b5fd');
  lidGrad.addColorStop(1, '#6d28d9');
  ctx.fillStyle = lidGrad;
  ctx.beginPath();
  ctx.roundRect(-s * 0.75, -s * 0.86, s * 1.5, s * 0.34, s * 0.12);
  ctx.fill();

  // 물음표
  ctx.fillStyle = `rgba(255,255,255,${0.78 + glow * 0.2})`;
  ctx.font = `900 ${s * 0.76}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4 * scale;
  ctx.fillText('?', 0, -s * 0.12);

  // 리본
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-s * 0.1, -s * 0.82, s * 0.2, s * 1.12);
  ctx.fillRect(-s * 0.65, -s * 0.28, s * 1.3, s * 0.14);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillRect(-s * 0.06, -s * 0.82, s * 0.05, s * 1.12);

  ctx.restore();
}

// ── 파티클 시스템 ──
export function spawnParticles(particles: Particle[], x: number, y: number, type: 'dust' | 'sparkle' | 'hit', count: number): Particle[] {
  const newP = [...particles];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'hit' ? 2 + Math.random() * 3 : 0.5 + Math.random() * 1.5;
    newP.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (type === 'sparkle' ? 1.5 : 0),
      life: type === 'hit' ? 25 : 20,
      maxLife: type === 'hit' ? 25 : 20,
      size: type === 'dust' ? 2 + Math.random() * 2 : 3 + Math.random() * 3,
      color: type === 'dust' ? '#a0845c' : type === 'sparkle' ? '#fbbf24' : '#ff4444',
      type,
    });
  }
  return newP;
}

export function updateParticles(particles: Particle[]): Particle[] {
  return particles
    .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.05, life: p.life - 1 }))
    .filter(p => p.life > 0);
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    if (p.type === 'sparkle') {
      ctx.fillStyle = p.color;
      const sz = p.size * alpha;
      ctx.beginPath();
      // 4-point star
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2;
        const r = j % 2 === 0 ? sz : sz * 0.4;
        const method = j === 0 ? 'moveTo' : 'lineTo';
        ctx[method](p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── 속도 라인 (스피드감) ──
export function drawSpeedLines(ctx: CanvasRenderingContext2D, w: number, h: number, speed: number, frame: number) {
  if (speed <= 1.2) return;
  const intensity = Math.min(1, (speed - 1) * 0.8);
  ctx.strokeStyle = `rgba(255,255,255,${0.06 * intensity})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const sx = ((frame * 7 + i * 137) % w);
    const sy = ((frame * 3 + i * 89) % (h * 0.5)) + h * 0.3;
    const len = 30 + speed * 15;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy + len);
    ctx.stroke();
  }
}

// ── 자석 이펙트 ──
export function drawMagnetField(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, frame: number) {
  const rings = 3;
  for (let i = 0; i < rings; i++) {
    const phase = (frame * 0.04 + i * 0.33) % 1;
    const r = size * 0.5 + phase * size * 0.6;
    ctx.strokeStyle = `rgba(99,102,241,${0.3 * (1 - phase)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── 플로팅 점수 텍스트 ──
export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: { text: string; x: number; y: number; color: string; size: number; life: number; maxLife: number }[], w: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ft of texts) {
    const alpha = ft.life / ft.maxLife;
    const scale = 0.8 + alpha * 0.4;
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${ft.size * scale}px BMJUA, sans-serif`;
    ctx.fillStyle = ft.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, ft.x * w, ft.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

// ── 콤보 게이지 (캔버스 내) ──
export function drawComboGauge(ctx: CanvasRenderingContext2D, w: number, combo: number, comboTimer: number, maxTimer: number) {
  if (combo < 2) return;

  const barW = 120;
  const barH = 6;
  const x = w / 2 - barW / 2;
  const y = 52;
  const progress = comboTimer / maxTimer;

  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, barW + 4, barH + 4, 4);
  ctx.fill();

  // 게이지 바
  const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
  if (combo >= 20) {
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(1, '#ef4444');
  } else if (combo >= 10) {
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(1, '#f59e0b');
  } else {
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#8b5cf6');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, barW * progress, barH, 3);
  ctx.fill();

  // 콤보 텍스트
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `bold 14px BMJUA, sans-serif`;
  ctx.fillStyle = combo >= 20 ? '#fbbf24' : combo >= 10 ? '#f97316' : '#818cf8';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText(`🔥 ${combo} COMBO`, w / 2, y - 2);
  ctx.shadowBlur = 0;
}
