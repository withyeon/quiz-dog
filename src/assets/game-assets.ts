export const gameAssets = {
  "joystick": {
    // 화면에서 48~90px로만 쓰이는데 원본(.png, 350KB~1.2MB)을 그대로 받고 있었다.
    // 표시 크기의 3배인 256px webp로 교체 — 눈에 보이는 차이 없이 수십 배 가볍다.
    tight: "/assets/icons/joystick-256.webp",
    original: "/assets/tight/joystick.png",
    icon32: "/assets/icons/joystick-32.png",
    icon64: "/assets/icons/joystick-64.png",
    icon128: "/assets/icons/joystick-128.png",
  },
  "mascot_sigol": {
    // 화면에서 48~90px로만 쓰이는데 원본(.png, 350KB~1.2MB)을 그대로 받고 있었다.
    // 표시 크기의 3배인 256px webp로 교체 — 눈에 보이는 차이 없이 수십 배 가볍다.
    tight: "/assets/icons/mascot_sigol-256.webp",
    original: "/assets/tight/mascot_sigol.png",
    icon32: "/assets/icons/mascot_sigol-32.png",
    icon64: "/assets/icons/mascot_sigol-64.png",
    icon128: "/assets/icons/mascot_sigol-128.png",
  },
  "mascot-pome": {
    // 화면에서 48~90px로만 쓰이는데 원본(.png, 350KB~1.2MB)을 그대로 받고 있었다.
    // 표시 크기의 3배인 256px webp로 교체 — 눈에 보이는 차이 없이 수십 배 가볍다.
    tight: "/assets/icons/mascot-pome-256.webp",
    original: "/assets/tight/mascot-pome.png",
    icon32: "/assets/icons/mascot-pome-32.png",
    icon64: "/assets/icons/mascot-pome-64.png",
    icon128: "/assets/icons/mascot-pome-128.png",
  }
} as const;

export type GameAssetKey = keyof typeof gameAssets;
