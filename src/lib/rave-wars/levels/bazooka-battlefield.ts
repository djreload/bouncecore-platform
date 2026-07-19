export type RaveWarLevelSpawn = {
  facing: "left" | "right";
  x: number;
  y: number;
};

export type RaveWarLevel = {
  backgroundImageUrl: string;
  backgroundColor: string;
  height: number;
  key: string;
  mapImageUrl: string;
  maskImageUrl: string;
  name: string;
  spawns: [RaveWarLevelSpawn, RaveWarLevelSpawn];
  terrain: {
    sampleStep: number;
    surfaceY: number[];
  };
  theme: string;
  width: number;
};

export const bazookaBattlefieldLevel: RaveWarLevel = {
  backgroundColor: "#07040d",
  backgroundImageUrl: "/rave-wars/maps/bazooka-battlefield/rave-arena-background.png",
  height: 1024,
  key: "bazooka-battlefield",
  mapImageUrl: "/rave-wars/maps/neon-ravine/terrain.png",
  maskImageUrl: "/rave-wars/maps/neon-ravine/terrain.png",
  name: "Neon Ravine",
  spawns: [
    {
      facing: "right",
      x: 560,
      y: 429
    },
    {
      facing: "left",
      x: 1504,
      y: 446
    }
  ],
  terrain: {
    sampleStep: 16,
    surfaceY: [
      571, 571, 572, 573, 573, 573, 573, 571, 571, 571, 570, 512, 507, 504, 430, 418, 415, 414, 414, 412, 414,
      413, 414, 416, 415, 414, 416, 426, 433, 433, 435, 435, 435, 433, 431, 429, 427, 425, 424, 423, 423, 426,
      485, 497, 499, 504, 547, 572, 589, 597, 602, 619, 626, 636, 686, 692, 719, 725, 732, 737, 739, 740, 741,
      745, 790, 811, 816, 816, 812, 787, 785, 784, 783, 780, 768, 738, 732, 713, 652, 645, 641, 639, 636, 604,
      602, 557, 552, 548, 542, 448, 445, 444, 444, 444, 446, 447, 448, 450, 452, 453, 454, 454, 455, 457, 457,
      457, 460, 460, 461, 462, 463, 467, 536, 562, 570, 573, 575, 584, 602, 603, 602, 600, 601, 601, 583, 575,
      572, 570, 571
    ]
  },
  theme: "Neon rave arena",
  width: 2048
};

export const raveWarLevels = {
  [bazookaBattlefieldLevel.key]: bazookaBattlefieldLevel
} as const;

export type RaveWarLevelKey = keyof typeof raveWarLevels;

export function getBuiltInRaveWarLevel(levelKey?: string | null) {
  return raveWarLevels[levelKey as RaveWarLevelKey] ?? bazookaBattlefieldLevel;
}

export const getRaveWarLevel = getBuiltInRaveWarLevel;
