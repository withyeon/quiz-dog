// 간식런 스프라이트 로더
//
// public/gansik-run/<이름>.webp (없으면 .png)를 한 번만 불러온다.
// 파일이 없으면 해당 항목은 비어 있고, 렌더러가 캔버스 도형으로 대신 그린다.
// 그래서 이미지를 폴더에 넣기만 하면 코드 수정 없이 바로 반영된다.
// 규격은 public/gansik-run/README.md 참고.

export type SpriteKey =
  | 'dog'          // 플레이어 강아지 (달리는 모습, 달리기 1번 프레임)
  | 'dog2'         // 달리기 2번 프레임 (선택)
  | 'dog3'         // 달리기 3번 프레임 (선택)
  | 'dog4'         // 달리기 4번 프레임 (선택)
  | 'dogJump'      // 점프 중 (없으면 dog를 띄워서 사용)
  | 'dogSlide'     // 슬라이드 중 (없으면 dog를 납작하게 사용)
  | 'cat'          // 뒤에서 쫓아오는 고양이 (달리기 1번 프레임)
  | 'cat2'         // 고양이 달리기 2번 프레임 (선택)
  | 'cat3'         // 고양이 달리기 3번 프레임 (선택)
  | 'cat4'         // 고양이 달리기 4번 프레임 (선택)
  | 'bone'         // 뼈다귀 (+1)
  | 'boneGold'     // 황금 뼈다귀 (+10)
  | 'box'          // 아이템 박스
  | 'obstacle'     // 일반 장애물 (차선 바꿔 피함)
  | 'obstacleLow'  // 바닥 장애물 (점프로 피함)
  | 'obstacleHigh' // 공중 장애물 (슬라이드로 피함)
  // ── 배경 (public/gansik-run/bg/) ──
  | 'sky'          // 하늘 (없으면 그라데이션 + 별)
  | 'skyline'      // 지평선 실루엣 (없으면 산 실루엣을 코드로)
  | 'tree'         // 길가 오브젝트 1 (없으면 코드로 나무를 그림)
  | 'tree2'        // 길가 오브젝트 2 (선택)
  | 'tree3'        // 길가 오브젝트 3 (선택)
  | 'prop'         // 길가 소품 1 — 가로등·표지판 등 (나무보다 드물게 나온다)
  | 'prop2'        // 길가 소품 2 (선택)
  | 'prop3'        // 길가 소품 3 (선택)

export const SPRITE_FILES: Record<SpriteKey, string> = {
  dog: 'dog',
  dog2: 'dog-2',
  dog3: 'dog-3',
  dog4: 'dog-4',
  dogJump: 'dog-jump',
  dogSlide: 'dog-slide',
  cat: 'cat',
  cat2: 'cat-2',
  cat3: 'cat-3',
  cat4: 'cat-4',
  bone: 'bone',
  boneGold: 'bone-gold',
  box: 'box',
  obstacle: 'obstacle',
  obstacleLow: 'obstacle-low',
  obstacleHigh: 'obstacle-high',
  sky: 'bg/sky',
  skyline: 'bg/skyline',
  tree: 'bg/tree',
  tree2: 'bg/tree-2',
  tree3: 'bg/tree-3',
  prop: 'bg/prop',
  prop2: 'bg/prop-2',
  prop3: 'bg/prop-3',
}

export const SPRITE_DIR = '/gansik-run'

export type SpriteSet = Partial<Record<SpriteKey, HTMLImageElement>>

/** 기본 그림(dog/cat)이 있을 때만 추가로 찾아보는 변형들 */
const DOG_VARIANT_KEYS: SpriteKey[] = ['dogJump', 'dogSlide', 'dog2', 'dog3', 'dog4']
const CAT_VARIANT_KEYS: SpriteKey[] = ['cat2', 'cat3', 'cat4']
const TREE_VARIANT_KEYS: SpriteKey[] = ['tree2', 'tree3']
const PROP_VARIANT_KEYS: SpriteKey[] = ['prop2', 'prop3']

/** 길가에 번갈아 세울 나무들 (tree-2·3이 없으면 tree 한 종류만) */
export function treeSprites(set: SpriteSet | undefined): HTMLImageElement[] {
  return framesOf(set, ['tree', 'tree2', 'tree3'])
}

/** 길가 소품들(가로등·표지판·덤불). 나무 네 자리에 한 번꼴로 섞인다. */
export function propSprites(set: SpriteSet | undefined): HTMLImageElement[] {
  return framesOf(set, ['prop', 'prop2', 'prop3'])
}

/** 달리기 프레임 순서. 1번 그림 한 장만 있으면 한 장짜리 애니메이션이 된다. */
const DOG_RUN_KEYS: SpriteKey[] = ['dog', 'dog2', 'dog3', 'dog4']
const CAT_RUN_KEYS: SpriteKey[] = ['cat', 'cat2', 'cat3', 'cat4']

/**
 * 한 걸음(프레임 전체를 한 바퀴)에 걸리는 틱. 게임은 60Hz라 24틱 = 0.4초.
 * 프레임 장수로 나눠 쓰므로, 2장이든 4장이든 달리는 속도감은 같다.
 * (2장짜리를 4장처럼 빨리 돌리면 달리는 게 아니라 깜빡여 보인다.)
 * 고양이는 강아지를 쫓아오는 쪽이라 한 걸음이 조금 더 빠르다.
 */
export const DOG_RUN_CYCLE_TICKS = 24
export const CAT_RUN_CYCLE_TICKS = 20

function framesOf(set: SpriteSet | undefined, keys: SpriteKey[]): HTMLImageElement[] {
  if (!set) return []
  const frames: HTMLImageElement[] = []
  for (const key of keys) {
    const img = set[key]
    if (img) frames.push(img)
  }
  return frames
}

function pickFrame(frames: HTMLImageElement[], frame: number, cycleTicks: number) {
  if (frames.length <= 1) return frames[0]
  const ticksPerFrame = cycleTicks / frames.length
  return frames[Math.floor(frame / ticksPerFrame) % frames.length]
}

/** 지금 화면에 깔린 달리기 프레임 목록 (2~4번이 없으면 1번 한 장) */
export function dogRunFrames(set: SpriteSet | undefined) { return framesOf(set, DOG_RUN_KEYS) }
export function catRunFrames(set: SpriteSet | undefined) { return framesOf(set, CAT_RUN_KEYS) }

/** frameCount에 맞는 달리기 프레임. 한 장뿐이면 늘 그 한 장. */
export function dogRunFrame(set: SpriteSet | undefined, frame: number) {
  return pickFrame(dogRunFrames(set), frame, DOG_RUN_CYCLE_TICKS)
}
export function catRunFrame(set: SpriteSet | undefined, frame: number) {
  return pickFrame(catRunFrames(set), frame, CAT_RUN_CYCLE_TICKS)
}

let cache: SpriteSet | null = null

function loadOne(set: SpriteSet, key: SpriteKey, onLoaded?: () => void) {
  const base = `${SPRITE_DIR}/${SPRITE_FILES[key]}`
  const candidates = [`${base}.webp`, `${base}.png`]

  const tryNext = (index: number) => {
    if (index >= candidates.length) return
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (img.naturalWidth > 0) {
        set[key] = img
        onLoaded?.()
      }
    }
    img.onerror = () => tryNext(index + 1)
    img.src = candidates[index]
  }

  tryNext(0)
}

/** 스프라이트 로딩을 시작하고(한 번만) 살아있는 세트를 돌려준다. 로드가 끝난 항목만 채워진다. */
export function loadSprites(): SpriteSet {
  if (cache) return cache
  cache = {}
  if (typeof window === 'undefined') return cache
  const set = cache
  for (const key of Object.keys(SPRITE_FILES) as SpriteKey[]) {
    // 변형(점프·슬라이드·달리기 프레임)은 기본 그림이 있을 때만 찾는다 (없는 파일 요청을 줄임)
    if (DOG_VARIANT_KEYS.includes(key) || CAT_VARIANT_KEYS.includes(key)
      || TREE_VARIANT_KEYS.includes(key) || PROP_VARIANT_KEYS.includes(key)) continue
    const variants = key === 'dog' ? DOG_VARIANT_KEYS
      : key === 'cat' ? CAT_VARIANT_KEYS
      : key === 'tree' ? TREE_VARIANT_KEYS
      : key === 'prop' ? PROP_VARIANT_KEYS
      : null
    loadOne(set, key, variants ? () => {
      for (const variant of variants) loadOne(set, variant)
    } : undefined)
  }
  return cache
}

/** 이미지를 바닥 중앙 기준으로 그린다. 가로 폭을 주면 비율대로 세로를 정한다. */
export function drawSpriteBottom(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  bottomY: number,
  width: number,
  maxHeight?: number,
) {
  let w = width
  let h = width * (img.naturalHeight / img.naturalWidth)
  if (maxHeight && h > maxHeight) {
    h = maxHeight
    w = h * (img.naturalWidth / img.naturalHeight)
  }
  ctx.drawImage(img, x - w / 2, bottomY - h, w, h)
  return { w, h }
}
