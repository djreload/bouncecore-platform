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
  backgroundColor: "#10151d",
  backgroundImageUrl: "/rave-wars/maps/bazooka-battlefield/rave-arena-background.png",
  height: 1024,
  key: "bazooka-battlefield",
  mapImageUrl: "/rave-wars/maps/bazooka-battlefield/map.png",
  maskImageUrl: "/rave-wars/maps/bazooka-battlefield/mask.png",
  name: "Bazooka Battlefield",
  spawns: [
    {
      facing: "right",
      x: 800,
      y: 643
    },
    {
      facing: "left",
      x: 1840,
      y: 770
    }
  ],
  terrain: {
    sampleStep: 16,
    surfaceY: [
      1018, 1004, 991, 978, 966, 954, 942, 931, 920, 910, 900, 890, 881, 872, 863, 855, 847, 840, 832, 825, 818,
      812, 805, 799, 793, 788, 783, 224, 216, 211, 207, 202, 198, 193, 189, 188, 364, 359, 357, 359, 641, 648,
      617, 676, 710, 639, 618, 639, 666, 627, 643, 665, 639, 622, 623, 611, 599, 614, 680, 631, 650, 630, 657,
      656, 557, 529, 503, 482, 304, 304, 308, 312, 315, 319, 322, 326, 336, 340, 343, 347, 351, 355, 359, 362,
      366, 370, 374, 377, 381, 385, 388, 278, 272, 267, 263, 260, 257, 256, 256, 257, 260, 263, 269, 275, 284,
      294, 307, 323, 343, 695, 706, 718, 730, 743, 756, 770, 784, 799, 815, 831, 848, 866, 884, 903, 923, 944,
      966, 989, 1007
    ]
  },
  theme: "Castle",
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
