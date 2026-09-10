// 간식런 - 3D 원근감 캔버스 렌더러
// Temple Run 스타일 소실점 기반 렌더링
//
// 크기 체계: 모든 오브젝트는 "그 줄의 차선 폭(unit)"에 대한 비율로 그린다.
// 예전에는 강아지 50px, 뼈다귀 10px처럼 절대 픽셀이라 크롬북(1280px)에서는
// 차선이 400px인데 강아지가 40px로 보였다. 이제 화면이 커지면 같이 커진다.

import { type SpriteSet, drawSpriteBottom } from '@/lib/game/간식런Sprites'
import { WORLD_H } from '@/lib/game/간식런'

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
  ghostTrails: { x: number; y: number; alpha: number }[];
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
    ghostTrails: [],
  };
}

// ── 원근 파라미터 ──
const VANISH_RATIO = 0.28;      // 소실점 Y (화면 높이 비율)
export const PLAYER_Y_RATIO = 0.75; // 플레이어가 서 있는 줄 (게임 좌표, 화면 높이 비율)
const UNIT_MAX_H_RATIO = 0.30;  // unit 상한: 화면 높이의 30% (가로로 넓은 크롬북에서 과대 방지)

// 오브젝트 크기 (unit = 그 줄의 차선 폭 기준 비율)
export const SIZE = {
  dog: 0.72,
  cat: 0.7,
  obstacle: 0.86,
  obstacleLow: 0.86,
  obstacleHigh: 0.96,
  bone: 0.44,
  box: 0.58,
  tree: 0.42,
} as const;

// 소실점 Y 좌표
function vanishY(h: number) { return h * VANISH_RATIO; }

// 도로 폭 (t: 0=소실점, 1=화면 하단)
function roadWidthAt(t: number, w: number): number {
  const minW = w * 0.12;
  const maxW = w * 1.1;
  return minW + (maxW - minW) * Math.pow(t, 1.4);
}

export function laneWidthAt(t: number, w: number): number {
  return roadWidthAt(t, w) / 3;
}

/** 게임 y(0=상단 … WORLD_H=하단, 스폰은 -60부터) → 원근 t(0~1). 화면 크기와 무관. */
export function tOf(objY: number): number {
  return Math.max(0, Math.min(1, (objY + 60) / (WORLD_H + 160)));
}

/** 원근 t → 화면 y */
export function screenYOf(t: number, h: number): number {
  const vy = vanishY(h);
  return vy + (h + 40 - vy) * Math.pow(t, 1.2);
}

/** 플레이어 줄 정보. 게임 y, 원근 t, 화면 y, 기준 unit. */
export function playerRow(w: number, h: number) {
  const y = WORLD_H * PLAYER_Y_RATIO;
  const t = tOf(y);
  return { y, t, screenY: screenYOf(t, h), unit: baseUnit(w, h) };
}

/** 플레이어 줄의 unit(차선 폭). 세로가 짧은 가로 화면에서는 높이로 상한. */
export function baseUnit(w: number, h: number): number {
  const t = tOf(WORLD_H * PLAYER_Y_RATIO);
  return Math.min(laneWidthAt(t, w), h * UNIT_MAX_H_RATIO);
}

/** 어떤 줄(t)의 unit. 플레이어 줄에서 baseUnit, 멀어질수록 차선 폭 비율대로 줄어든다. */
export function unitAt(t: number, w: number, h: number): number {
  const tp = tOf(WORLD_H * PLAYER_Y_RATIO);
  return baseUnit(w, h) * (laneWidthAt(t, w) / laneWidthAt(tp, w));
}

/** 오브젝트 y(게임좌표) → 화면 y + 그 줄의 unit */
export function project(objY: number, w: number, h: number): { screenY: number; t: number; unit: number } {
  const t = tOf(objY);
  return { screenY: screenYOf(t, h), t, unit: unitAt(t, w, h) };
}

/** 차선 X 위치 (원근 적용). lane은 소수(보간 중)여도 된다. */
export function laneX(lane: number, t: number, w: number): number {
  const rw = roadWidthAt(t, w);
  const cx = w / 2;
  const laneW = rw / 3;
  return cx - rw / 2 + laneW * lane + laneW / 2;
}

// ── 하늘 + 산 배경 ──
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  const vy = vanishY(h);
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
    const y0 = screenYOf(t0, h);
    const y1 = screenYOf(t1, h);
    const rw0 = roadWidthAt(t0, w);
    const rw1 = roadWidthAt(t1, w);
    const cx = w / 2;

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
      const y = screenYOf(t, h);
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

// ── 도로 양옆 나무 ──
export function drawSideTrees(ctx: CanvasRenderingContext2D, w: number, h: number, offset: number) {
  const treeSpacing = 120;

  for (let i = 0; i < 8; i++) {
    const baseT = ((i * treeSpacing + offset) % (treeSpacing * 8)) / (treeSpacing * 8);
    const t = Math.max(0.05, Math.min(0.95, baseT));
    const y = screenYOf(t, h);
    const rw = roadWidthAt(t, w);
    const cx = w / 2;
    const u = unitAt(t, w, h) * SIZE.tree;
    const treeH = u * 0.9;
    const trunkW = u * 0.14;
    const canopyR = u * 0.36;

    for (const side of [-1, 1]) {
      const x = cx + side * (rw / 2 + u * 0.55);
      ctx.fillStyle = '#3d2914';
      ctx.fillRect(x - trunkW / 2, y - treeH, trunkW, treeH);
      ctx.fillStyle = '#1a5c2a';
      ctx.beginPath();
      ctx.arc(x, y - treeH - canopyR * 0.3, canopyR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#227a3a';
      ctx.beginPath();
      ctx.arc(x + side * canopyR * 0.4, y - treeH + canopyR * 0.2, canopyR * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha: number) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── 강아지 캐릭터 ──
// x: 차선 중앙, feetY: 발이 닿는 화면 y, width: 그릴 가로 폭(px)
export function drawDog(
  ctx: CanvasRenderingContext2D, x: number, feetY: number, width: number,
  frame: number, isBig: boolean, hasShield: boolean, isDrone: boolean, invincible: number,
  jumpProgress = 0, slideProgress = 0,
  sprites?: SpriteSet,
) {
  const dw = width * (isBig ? 1.35 : 1);
  const jumpHeight = Math.sin(jumpProgress * Math.PI) * dw * 1.1;
  const sliding = slideProgress > 0;
  const slideSquash = sliding ? 0.45 + 0.55 * (1 - Math.sin(slideProgress * Math.PI)) : 1;

  ctx.save();

  // 그림자 (점프하면 작아지고 옅어짐)
  const inAir = jumpProgress > 0;
  const shadowScale = inAir ? 1 - Math.sin(jumpProgress * Math.PI) * 0.5 : 1;
  const shadowAlpha = inAir ? 0.12 + 0.15 * (1 - Math.sin(jumpProgress * Math.PI)) : 0.32;
  drawGroundShadow(ctx, x, feetY, dw * 0.42 * shadowScale, shadowAlpha);

  ctx.translate(x, feetY - jumpHeight);

  // 드론 프로펠러
  if (isDrone) {
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = Math.max(2, dw * 0.04);
    const propAngle = frame * 0.5;
    const propY = -dw * 1.35;
    ctx.beginPath();
    ctx.moveTo(-dw * 0.45 * Math.cos(propAngle), propY - dw * 0.05 * Math.sin(propAngle));
    ctx.lineTo(dw * 0.45 * Math.cos(propAngle), propY + dw * 0.05 * Math.sin(propAngle));
    ctx.stroke();
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-dw * 0.03, propY, dw * 0.06, dw * 0.12);
  }

  // 무적 깜빡임
  if (invincible > 0) {
    ctx.globalAlpha = 0.55 + Math.sin(frame * 0.3) * 0.3;
  }

  const sprite = sliding ? (sprites?.dogSlide ?? sprites?.dog) : inAir ? (sprites?.dogJump ?? sprites?.dog) : sprites?.dog;
  if (sprite) {
    // 이미지: 발 기준으로 그린다. 전용 슬라이드 스프라이트가 없으면 납작하게.
    const usingFallbackSlide = sliding && !sprites?.dogSlide;
    ctx.save();
    if (usingFallbackSlide) ctx.scale(1.25, slideSquash);
    const bob = inAir || sliding ? 0 : Math.abs(Math.sin(frame * 0.25)) * dw * 0.04;
    drawSpriteBottom(ctx, sprite, 0, -bob, dw, dw * 1.6);
    ctx.restore();
  } else {
    drawVectorDog(ctx, dw, frame, isBig, sliding ? slideSquash : 1);
  }

  // 방어막
  if (hasShield) {
    const r = dw * 0.72;
    const cy = -dw * 0.6;
    ctx.strokeStyle = 'rgba(6,182,212,0.7)';
    ctx.lineWidth = Math.max(2.5, dw * 0.035);
    ctx.beginPath();
    ctx.arc(0, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(6,182,212,0.1)';
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// 이미지가 없을 때 그리는 강아지 (발 기준 좌표계, dw = 가로 폭)
function drawVectorDog(ctx: CanvasRenderingContext2D, dw: number, frame: number, isBig: boolean, squash: number) {
  // 예전 그림은 s*0.56이 몸통 폭이었다. 폭을 맞추고 발이 y=0에 오게 옮긴다.
  const s = dw / 0.56;
  ctx.save();
  if (squash < 1) {
    ctx.scale(1.3, squash);
  }
  ctx.translate(0, -s * 0.27);
  const bobY = Math.sin(frame * 0.15) * s * 0.03;
  const bodyColor = isBig ? '#c97d30' : '#d4915c';
  const darkColor = isBig ? '#b5702a' : '#c4845a';

  // 다리 (달리는 모션) — 몸통보다 먼저 그려서 뒤에 있게
  const legPhase = frame * 0.2;
  ctx.fillStyle = darkColor;
  for (const side of [-1, 1]) {
    const legX = side * s * 0.15;
    const frontKick = Math.sin(legPhase + side * 0.5) * s * 0.12;
    const backKick = Math.sin(legPhase + Math.PI + side * 0.5) * s * 0.12;
    ctx.fillRect(legX - s * 0.045 + frontKick, s * 0.05 + bobY, s * 0.09, s * 0.22);
    ctx.fillRect(legX - s * 0.045 + backKick, s * 0.1 + bobY, s * 0.09, s * 0.19);
  }

  // 꼬리
  const tailWag = Math.sin(frame * 0.25) * 0.4;
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05 + bobY);
  ctx.quadraticCurveTo(s * 0.22, -s * 0.28 + bobY, s * 0.17 + Math.sin(tailWag) * s * 0.1, -s * 0.42 + bobY);
  ctx.stroke();

  // 몸통
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1 + bobY, s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 빨간 두건 (타이틀 강아지와 맞춤)
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.2 + bobY);
  ctx.lineTo(s * 0.2, -s * 0.2 + bobY);
  ctx.lineTo(0, -s * 0.02 + bobY);
  ctx.closePath();
  ctx.fill();

  // 머리
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.arc(0, -s * 0.36 + bobY, s * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // 귀
  ctx.fillStyle = '#8B5E3C';
  ctx.beginPath();
  ctx.ellipse(-s * 0.17, -s * 0.5 + bobY, s * 0.07, s * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.17, -s * 0.5 + bobY, s * 0.07, s * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-s * 0.08, -s * 0.38 + bobY, s * 0.035, 0, Math.PI * 2);
  ctx.arc(s * 0.08, -s * 0.38 + bobY, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-s * 0.07, -s * 0.39 + bobY, s * 0.012, 0, Math.PI * 2);
  ctx.arc(s * 0.09, -s * 0.39 + bobY, s * 0.012, 0, Math.PI * 2);
  ctx.fill();

  // 코
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(0, -s * 0.3 + bobY, s * 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── 일반 장애물 (바리케이드) ──
export function drawObstacle(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, frame: number, sprites?: SpriteSet) {
  const w = unit * SIZE.obstacle;
  drawGroundShadow(ctx, x, y, w * 0.5, 0.25);
  if (sprites?.obstacle) {
    drawSpriteBottom(ctx, sprites.obstacle, x, y, w, unit * 1.1);
    return;
  }
  const h = w * 0.62;
  ctx.save();
  ctx.translate(x, y);
  // 다리
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(-w * 0.42, -h * 0.55, w * 0.08, h * 0.55);
  ctx.fillRect(w * 0.34, -h * 0.55, w * 0.08, h * 0.55);
  // 가로 판 두 장 (주황/흰 줄무늬)
  for (const [top, hh] of [[-h, h * 0.3], [-h * 0.55, h * 0.22]] as const) {
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-w / 2, top, w, hh);
    ctx.fillStyle = '#fff';
    const stripes = 4;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) continue;
      ctx.fillRect(-w / 2 + (w / stripes) * i, top, w / stripes, hh);
    }
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = Math.max(1.5, w * 0.025);
    ctx.strokeRect(-w / 2, top, w, hh);
  }
  // 경고등
  const blink = Math.sin(frame * 0.2) > 0;
  ctx.fillStyle = blink ? '#fde047' : '#ca8a04';
  ctx.beginPath();
  ctx.arc(0, -h * 1.12, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── 바닥 장애물 (점프로 회피) ──
export function drawObstacleLow(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, frame: number, sprites?: SpriteSet) {
  const w = unit * SIZE.obstacleLow;
  drawGroundShadow(ctx, x, y, w * 0.5, 0.25);
  if (sprites?.obstacleLow) {
    drawSpriteBottom(ctx, sprites.obstacleLow, x, y, w, unit * 0.7);
  } else {
    const h = w * 0.36;
    ctx.save();
    ctx.translate(x, y);
    // 통나무
    ctx.fillStyle = '#7c4a1e';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h, w, h, h * 0.5);
    ctx.fill();
    ctx.strokeStyle = '#4a2c12';
    ctx.lineWidth = Math.max(1.5, w * 0.03);
    ctx.stroke();
    // 나이테
    ctx.fillStyle = '#c08b52';
    ctx.beginPath();
    ctx.ellipse(-w / 2 + h * 0.5, -h / 2, h * 0.32, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c4a1e';
    ctx.beginPath();
    ctx.ellipse(-w / 2 + h * 0.5, -h / 2, h * 0.14, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 가시
    ctx.fillStyle = '#9ca3af';
    for (let i = -2; i <= 2; i++) {
      const sx = i * w * 0.16;
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.04, -h);
      ctx.lineTo(sx, -h - w * 0.16);
      ctx.lineTo(sx + w * 0.04, -h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // 힌트 화살표 (점프)
  drawHintArrow(ctx, x, y - unit * 0.75, unit * 0.22, 'up', frame);
}

// ── 공중 장애물 (슬라이드로 회피) ──
export function drawObstacleHigh(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, frame: number, sprites?: SpriteSet) {
  const w = unit * SIZE.obstacleHigh;
  if (sprites?.obstacleHigh) {
    drawSpriteBottom(ctx, sprites.obstacleHigh, x, y, w, unit * 1.3);
  } else {
    const barY = -unit * 0.62;   // 가로 막대 높이 (강아지 머리 높이)
    const barH = unit * 0.14;
    ctx.save();
    ctx.translate(x, y);
    // 기둥 두 개
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-w / 2, barY, w * 0.08, -barY);
    ctx.fillRect(w / 2 - w * 0.08, barY, w * 0.08, -barY);
    // 가로 판 (노랑/검정 경고 무늬)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-w / 2, barY - barH, w, barH);
    ctx.fillStyle = '#111827';
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) continue;
      ctx.fillRect(-w / 2 + (w / stripes) * i, barY - barH, w / stripes, barH);
    }
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = Math.max(1.5, w * 0.02);
    ctx.strokeRect(-w / 2, barY - barH, w, barH);
    // 아래로 늘어진 덩굴
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = Math.max(2, unit * 0.03);
    const sway = Math.sin(frame * 0.06) * unit * 0.03;
    for (const ox of [-w * 0.25, w * 0.15]) {
      ctx.beginPath();
      ctx.moveTo(ox, barY);
      ctx.quadraticCurveTo(ox + sway, barY + unit * 0.15, ox - sway, barY + unit * 0.28);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 힌트 화살표 (슬라이드)
  drawHintArrow(ctx, x, y + unit * 0.16, unit * 0.22, 'down', frame);
}

function drawHintArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: 'up' | 'down', frame: number) {
  if (size < 6) return;
  const pulse = 0.55 + Math.sin(frame * 0.18) * 0.45;
  const bounce = Math.sin(frame * 0.18) * size * 0.15 * (dir === 'up' ? -1 : 1);
  ctx.save();
  ctx.translate(x, y + bounce);
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.fillStyle = dir === 'up' ? '#4ade80' : '#60a5fa';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = Math.max(1, size * 0.08);
  const s = dir === 'up' ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(0, s * size * 0.5);
  ctx.lineTo(-size * 0.5, -s * size * 0.05);
  ctx.lineTo(-size * 0.2, -s * size * 0.05);
  ctx.lineTo(-size * 0.2, -s * size * 0.5);
  ctx.lineTo(size * 0.2, -s * size * 0.5);
  ctx.lineTo(size * 0.2, -s * size * 0.05);
  ctx.lineTo(size * 0.5, -s * size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ── 뼈다귀 ──
export function drawBone(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, golden: boolean, frame: number, sprites?: SpriteSet) {
  const w = unit * SIZE.bone;
  const hover = Math.sin(frame * 0.1 + x * 0.01) * unit * 0.03;
  const centerY = y - w * 0.32 + hover;
  ctx.save();
  if (golden) {
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = Math.max(6, unit * 0.12);
  }
  const sprite = golden ? (sprites?.boneGold ?? sprites?.bone) : sprites?.bone;
  if (sprite) {
    ctx.translate(x, centerY);
    ctx.rotate(Math.sin(frame * 0.05) * 0.25);
    if (golden && !sprites?.boneGold) ctx.filter = 'sepia(1) saturate(5) hue-rotate(-10deg) brightness(1.05)';
    const h = w * (sprite.naturalHeight / sprite.naturalWidth);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.restore();
    return;
  }

  ctx.translate(x, centerY);
  ctx.rotate(Math.sin(frame * 0.05) * 0.3);
  const s = w / 1.8;
  ctx.fillStyle = golden ? '#fbbf24' : '#f5f0e8';
  ctx.strokeStyle = golden ? '#b45309' : '#8a8172';
  ctx.lineWidth = Math.max(1.5, s * 0.12);
  const boneLen = s * 1.8;
  const knobR = s * 0.35;
  ctx.beginPath();
  ctx.roundRect(-boneLen / 2 + knobR, -s * 0.16, boneLen - knobR * 2, s * 0.32, s * 0.1);
  ctx.fill();
  ctx.stroke();
  for (const dir of [-1, 1]) {
    const kx = dir * (boneLen / 2 - knobR * 0.3);
    ctx.beginPath(); ctx.arc(kx, -knobR * 0.6, knobR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(kx, knobR * 0.6, knobR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ── 아이템 박스 ──
export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  frame: number,
  age = 999,
  sprites?: SpriteSet,
) {
  const w = unit * SIZE.box;
  const landingProgress = Math.min(1, age / 16);
  const dropOffset = age < 16 ? -unit * 1.4 * Math.pow(1 - landingProgress, 2) : 0;
  const rebound = age >= 16 && age < 28 ? Math.sin((age - 16) / 12 * Math.PI) * -unit * 0.25 : 0;
  const hover = Math.sin(frame * 0.12 + x * 0.02) * unit * 0.04;

  ctx.save();
  // 바닥 충격 링
  if (age < 24) {
    const ring = Math.max(0, age / 24);
    ctx.save();
    ctx.globalAlpha = (1 - ring) * 0.7;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(1, unit * 0.06 * (1 - ring));
    ctx.beginPath();
    ctx.ellipse(x, y, w * (0.5 + ring * 1.2), w * (0.14 + ring * 0.3), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawGroundShadow(ctx, x, y, w * 0.45, 0.28);

  ctx.translate(x, y + dropOffset + rebound - hover);

  // 은은한 보상 빛
  const glow = 0.45 + Math.sin(frame * 0.12) * 0.18;
  const aura = ctx.createRadialGradient(0, -w * 0.5, w * 0.2, 0, -w * 0.5, w * 1.3);
  aura.addColorStop(0, `rgba(251,191,36,${0.22 + glow * 0.12})`);
  aura.addColorStop(0.5, `rgba(124,58,237,${0.14 + glow * 0.12})`);
  aura.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, -w * 0.5, w * 1.3, 0, Math.PI * 2);
  ctx.fill();

  if (sprites?.box) {
    ctx.shadowColor = '#8B5CF6';
    ctx.shadowBlur = Math.max(8, unit * 0.15) * (0.6 + glow * 0.6);
    drawSpriteBottom(ctx, sprites.box, 0, 0, w, unit * 0.9);
    ctx.restore();
    return;
  }

  const s = w / 1.3;
  ctx.shadowColor = '#8B5CF6';
  ctx.shadowBlur = (22 + glow * 20) * (unit / 200);

  const boxGrad = ctx.createLinearGradient(-s * 0.6, -s * 0.85, s * 0.7, s * 0.35);
  boxGrad.addColorStop(0, '#a78bfa');
  boxGrad.addColorStop(0.35, '#7c3aed');
  boxGrad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = boxGrad;
  ctx.beginPath();
  ctx.roundRect(-s * 0.65, -s * 1.04, s * 1.3, s * 1.04, s * 0.14);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.stroke();

  // 뚜껑
  const lidGrad = ctx.createLinearGradient(0, -s * 1.2, 0, -s * 0.8);
  lidGrad.addColorStop(0, '#c4b5fd');
  lidGrad.addColorStop(1, '#6d28d9');
  ctx.fillStyle = lidGrad;
  ctx.beginPath();
  ctx.roundRect(-s * 0.75, -s * 1.2, s * 1.5, s * 0.34, s * 0.12);
  ctx.fill();

  // 리본
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-s * 0.1, -s * 1.16, s * 0.2, s * 1.16);
  ctx.fillRect(-s * 0.65, -s * 0.6, s * 1.3, s * 0.14);

  // 물음표
  ctx.fillStyle = `rgba(255,255,255,${0.78 + glow * 0.2})`;
  ctx.font = `900 ${s * 0.7}px DNFBitBitv2, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText('?', 0, -s * 0.45);

  ctx.restore();
}

// ── 추격자 (고양이) ──
// 강아지 "뒤"(카메라 쪽, 화면 아래)에서 올라온다. 거리가 0에 가까울수록 강아지 바로 뒤.
// x: 그릴 차선 중앙, dogFeetY: 강아지 발 y, unit: 플레이어 줄 unit
export function drawChaser(
  ctx: CanvasRenderingContext2D, x: number, dogFeetY: number, unit: number,
  chaserDistance: number, frame: number, sprites?: SpriteSet,
) {
  if (chaserDistance >= 70) return; // 아직 화면 밖

  // 카메라가 위에서 내려다보는 구도라 고양이는 강아지 발보다 아래(화면 하단)에 선다.
  // 바로 뒤(거리 0)여도 머리가 강아지 발 높이까지만 올라와 강아지를 가리지 않는다.
  const closeness = 1 - chaserDistance / 70; // 0=멀다, 1=바로 뒤
  const feetY = dogFeetY + unit * (0.9 + (1 - closeness) * 1.6);
  const w = unit * SIZE.cat;
  const weave = Math.sin(frame * 0.12) * unit * 0.18 * closeness;
  const cx = x + weave;

  ctx.save();
  drawGroundShadow(ctx, cx, feetY, w * 0.45, 0.3);

  if (chaserDistance < 40) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = Math.max(8, unit * 0.15) * ((40 - chaserDistance) / 40);
  }

  if (sprites?.cat) {
    const bob = Math.abs(Math.sin(frame * 0.3)) * w * 0.05;
    drawSpriteBottom(ctx, sprites.cat, cx, feetY - bob, w, unit * 1.4);
  } else {
    drawVectorCat(ctx, cx, feetY, w, frame, chaserDistance);
  }
  ctx.restore();

  // 가까우면 느낌표
  if (chaserDistance < 30) {
    const size = unit * 0.3;
    const bounce = Math.abs(Math.sin(frame * 0.2)) * size * 0.2;
    ctx.save();
    ctx.font = `900 ${size}px DNFBitBitv2, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.strokeText('!', cx, feetY - w * 1.05 - bounce);
    ctx.fillText('!', cx, feetY - w * 1.05 - bounce);
    ctx.restore();
  }
}

function drawVectorCat(ctx: CanvasRenderingContext2D, x: number, feetY: number, w: number, frame: number, distance: number) {
  const s = w / 0.72;
  ctx.save();
  ctx.translate(x, feetY - s * 0.28);
  const bobY = Math.sin(frame * 0.3) * s * 0.03;

  // 다리 (빠른 달리기)
  ctx.fillStyle = '#374151';
  const legPhase = frame * 0.3;
  for (const side of [-1, 1]) {
    const legX = side * s * 0.15;
    const kick = Math.sin(legPhase + side * 0.8) * s * 0.15;
    ctx.fillRect(legX - s * 0.045 + kick, s * 0.05 + bobY, s * 0.09, s * 0.22);
    ctx.fillRect(legX - s * 0.045 - kick, s * 0.1 + bobY, s * 0.09, s * 0.2);
  }
  // 꼬리
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05 + bobY);
  ctx.quadraticCurveTo(-s * 0.3, -s * 0.2 + bobY, -s * 0.2 + Math.sin(frame * 0.2) * s * 0.1, -s * 0.5 + bobY);
  ctx.stroke();
  // 몸통
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1 + bobY, s * 0.32, s * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
  // 줄무늬
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = s * 0.04;
  for (const ox of [-s * 0.12, 0, s * 0.12]) {
    ctx.beginPath();
    ctx.moveTo(ox, -s * 0.3 + bobY);
    ctx.lineTo(ox + s * 0.03, -s * 0.1 + bobY);
    ctx.stroke();
  }
  // 머리
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.arc(0, -s * 0.38 + bobY, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // 귀 (삼각형)
  ctx.fillStyle = '#374151';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.2, -s * 0.52 + bobY);
    ctx.lineTo(side * s * 0.1, -s * 0.74 + bobY);
    ctx.lineTo(side * s * 0.02, -s * 0.5 + bobY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f9a8d4';
    ctx.beginPath();
    ctx.moveTo(side * s * 0.16, -s * 0.53 + bobY);
    ctx.lineTo(side * s * 0.1, -s * 0.68 + bobY);
    ctx.lineTo(side * s * 0.05, -s * 0.52 + bobY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#374151';
  }
  // 눈 (빛나는)
  ctx.fillStyle = distance < 40 ? '#ef4444' : '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(-s * 0.08, -s * 0.4 + bobY, s * 0.045, s * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.08, -s * 0.4 + bobY, s * 0.045, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(-s * 0.08, -s * 0.4 + bobY, s * 0.012, s * 0.05, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.08, -s * 0.4 + bobY, s * 0.012, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // 입
  ctx.strokeStyle = '#111';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.28 + bobY);
  ctx.lineTo(0, -s * 0.24 + bobY);
  ctx.lineTo(s * 0.06, -s * 0.28 + bobY);
  ctx.stroke();
  ctx.restore();
}

// ── 추격자 경고 비네트 ──
const CHASER_WARN_THRESHOLD_RENDER = 25;
export function drawChaserWarning(ctx: CanvasRenderingContext2D, w: number, h: number, chaserDistance: number, frame: number) {
  if (chaserDistance >= CHASER_WARN_THRESHOLD_RENDER) return;

  const intensity = 1 - chaserDistance / CHASER_WARN_THRESHOLD_RENDER;
  const pulse = 0.5 + Math.sin(frame * 0.15) * 0.5;
  const alpha = intensity * 0.35 * pulse;

  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
  grad.addColorStop(0, 'rgba(239,68,68,0)');
  grad.addColorStop(0.7, `rgba(239,68,68,${alpha * 0.3})`);
  grad.addColorStop(1, `rgba(239,68,68,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ── 파티클 시스템 ──
export function spawnParticles(particles: Particle[], x: number, y: number, type: 'dust' | 'sparkle' | 'hit', count: number, sizeScale = 1): Particle[] {
  const newP = [...particles];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (type === 'hit' ? 2 + Math.random() * 3 : 0.5 + Math.random() * 1.5) * sizeScale;
    newP.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (type === 'sparkle' ? 1.5 * sizeScale : 0),
      life: type === 'hit' ? 25 : 20,
      maxLife: type === 'hit' ? 25 : 20,
      size: (type === 'dust' ? 2 + Math.random() * 2 : 3 + Math.random() * 3) * sizeScale,
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
    ctx.fillStyle = p.color;
    if (p.type === 'sparkle') {
      const sz = p.size * alpha;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2;
        const r = j % 2 === 0 ? sz : sz * 0.4;
        const method = j === 0 ? 'moveTo' : 'lineTo';
        ctx[method](p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── 속도 라인 ──
export function drawSpeedLines(ctx: CanvasRenderingContext2D, w: number, h: number, speed: number, frame: number) {
  if (speed <= 1.2) return;
  const intensity = Math.min(1, (speed - 1) * 0.8);
  const vpX = w / 2;
  const vpY = vanishY(h);

  ctx.save();
  for (let i = 0; i < 12; i++) {
    const angle = ((frame * 0.02 + i * (Math.PI * 2 / 12)) % (Math.PI * 2));
    const innerR = 80 + (i % 3) * 30;
    const outerR = innerR + 60 + speed * 25;
    const sx = vpX + Math.cos(angle) * innerR;
    const sy = vpY + Math.sin(angle) * innerR * 0.6;
    const ex = vpX + Math.cos(angle) * outerR;
    const ey = vpY + Math.sin(angle) * outerR * 0.6;

    ctx.strokeStyle = `rgba(255,255,255,${0.04 * intensity + Math.sin(frame * 0.1 + i) * 0.02})`;
    ctx.lineWidth = 1 + intensity;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// ── 터널 비전 ──
export function drawTunnelVision(ctx: CanvasRenderingContext2D, w: number, h: number, speed: number) {
  if (speed <= 1.3) return;
  const intensity = Math.min(0.5, (speed - 1.3) * 0.35);
  const grad = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ── 잔상 효과 ──
export function drawGhostTrail(ctx: CanvasRenderingContext2D, trails: { x: number; y: number; alpha: number }[], width: number) {
  for (const trail of trails) {
    if (trail.alpha <= 0.02) continue;
    ctx.save();
    ctx.globalAlpha = trail.alpha * 0.3;
    ctx.fillStyle = '#d4915c';
    ctx.beginPath();
    ctx.ellipse(trail.x, trail.y - width * 0.45, width * 0.35, width * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── 자석 이펙트 ──
export function drawMagnetField(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, frame: number) {
  const rings = 3;
  for (let i = 0; i < rings; i++) {
    const phase = (frame * 0.04 + i * 0.33) % 1;
    const r = radius * 0.6 + phase * radius * 0.9;
    ctx.strokeStyle = `rgba(99,102,241,${0.35 * (1 - phase)})`;
    ctx.lineWidth = Math.max(1.5, radius * 0.03);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── 플로팅 점수 텍스트 ──
export function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: { text: string; x: number; y: number; color: string; size: number; life: number; maxLife: number }[],
  w: number,
  fontScale = 1,
  yScale = 1,
) {
  if (texts.length === 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ft of texts) {
    const alpha = ft.life / ft.maxLife;
    const pop = 0.85 + Math.min(1, (ft.maxLife - ft.life) / 6) * 0.35;
    ctx.globalAlpha = Math.min(1, alpha * 1.5);
    ctx.font = `900 ${ft.size * fontScale * pop}px DNFBitBitv2, sans-serif`;
    ctx.lineWidth = Math.max(2, ft.size * fontScale * 0.18);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineJoin = 'round';
    ctx.strokeText(ft.text, ft.x * w, ft.y * yScale);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x * w, ft.y * yScale);
  }
  ctx.restore();
}

// ── 콤보 게이지 ──
export function drawComboGauge(ctx: CanvasRenderingContext2D, w: number, combo: number, comboTimer: number, maxTimer: number, top = 56) {
  if (combo < 2) return;

  const barW = Math.min(160, w * 0.4);
  const barH = 6;
  const x = w / 2 - barW / 2;
  const y = top + 18;
  const progress = Math.max(0, Math.min(1, comboTimer / maxTimer));

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, barW + 4, barH + 4, 4);
  ctx.fill();

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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `900 15px DNFBitBitv2, sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(`🔥 ${combo} COMBO`, w / 2, y - 3);
  ctx.fillStyle = combo >= 20 ? '#fbbf24' : combo >= 10 ? '#f97316' : '#a5b4fc';
  ctx.fillText(`🔥 ${combo} COMBO`, w / 2, y - 3);
  ctx.restore();
}
