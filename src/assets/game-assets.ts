export const gameAssets = {
  "joystick": {
    tight: "/assets/tight/joystick.png",
    icon32: "/assets/icons/joystick-32.png",
    icon64: "/assets/icons/joystick-64.png",
    icon128: "/assets/icons/joystick-128.png",
  },
  "mascot_sigol": {
    tight: "/assets/tight/mascot_sigol.png",
    icon32: "/assets/icons/mascot_sigol-32.png",
    icon64: "/assets/icons/mascot_sigol-64.png",
    icon128: "/assets/icons/mascot_sigol-128.png",
  },
  "mascot-pome": {
    tight: "/assets/tight/mascot-pome.png",
    icon32: "/assets/icons/mascot-pome-32.png",
    icon64: "/assets/icons/mascot-pome-64.png",
    icon128: "/assets/icons/mascot-pome-128.png",
  }
} as const;

export type GameAssetKey = keyof typeof gameAssets;
