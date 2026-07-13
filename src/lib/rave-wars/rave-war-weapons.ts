import { raveWarWeaponIds, type RaveWarWeaponAmmo, type RaveWarWeaponId } from "@/lib/rave-wars/rave-war-types";

export type RaveWarWeaponDefinition = {
  ammo: number;
  description: string;
  iconUrl: string;
  id: RaveWarWeaponId;
  label: string;
  projectileSize: number;
  projectileUrl: string;
};

export const raveWarWeaponDefinitions: RaveWarWeaponDefinition[] = [
  {
    ammo: 4,
    description: "Reliable long arc with a strong terrain crater.",
    iconUrl: "/rave-wars/assets/hedgehog-bazooka.png",
    id: "bazooka",
    label: "Bazooka",
    projectileSize: 54,
    projectileUrl: "/rave-wars/assets/bazooka-shell.png"
  },
  {
    ammo: 5,
    description: "Chunky lob with a heavier drop and medium blast.",
    iconUrl: "/rave-wars/assets/weapon-grenade.png",
    id: "grenade",
    label: "Grenade",
    projectileSize: 54,
    projectileUrl: "/rave-wars/assets/weapon-grenade.png"
  },
  {
    ammo: 4,
    description: "Fast direct shot with lower terrain damage.",
    iconUrl: "/rave-wars/assets/weapon-shotgun.png",
    id: "shotgun",
    label: "Shotgun",
    projectileSize: 54,
    projectileUrl: "/rave-wars/assets/weapon-shotgun.png"
  },
  {
    ammo: 3,
    description: "Huge speaker bomb with a wide bass shockwave.",
    iconUrl: "/rave-wars/assets/weapon-bass-bomb.svg",
    id: "bass-bomb",
    label: "Bass Bomb",
    projectileSize: 66,
    projectileUrl: "/rave-wars/assets/weapon-bass-bomb.svg"
  },
  {
    ammo: 5,
    description: "Bright rave grenade with a fast drop and clean blast.",
    iconUrl: "/rave-wars/assets/weapon-glow-grenade.svg",
    id: "glow-grenade",
    label: "Glow Grenade",
    projectileSize: 58,
    projectileUrl: "/rave-wars/assets/weapon-glow-grenade.svg"
  },
  {
    ammo: 4,
    description: "Fires a sheep payload with a forgiving hit radius.",
    iconUrl: "/rave-wars/assets/weapon-sheep-launcher.svg",
    id: "sheep-launcher",
    label: "Sheep Launcher",
    projectileSize: 64,
    projectileUrl: "/rave-wars/assets/weapon-sheep-launcher.svg"
  },
  {
    ammo: 2,
    description: "Slow heavy TNT with the biggest terrain crater.",
    iconUrl: "/rave-wars/assets/weapon-tnt-barrel.svg",
    id: "tnt-barrel",
    label: "TNT Barrel",
    projectileSize: 66,
    projectileUrl: "/rave-wars/assets/weapon-tnt-barrel.svg"
  },
  {
    ammo: 4,
    description: "Light stink sock with a quick arc and splash damage.",
    iconUrl: "/rave-wars/assets/weapon-stink-sock.svg",
    id: "stink-sock",
    label: "Stink Sock",
    projectileSize: 60,
    projectileUrl: "/rave-wars/assets/weapon-stink-sock.svg"
  }
];

export const raveWarWeaponDefinitionsById = new Map(
  raveWarWeaponDefinitions.map((weapon) => [weapon.id, weapon] as const)
);

export const defaultRaveWarWeaponAmmo = raveWarWeaponIds.reduce((ammo, weaponId) => {
  ammo[weaponId] = raveWarWeaponDefinitionsById.get(weaponId)?.ammo ?? 0;
  return ammo;
}, {} as RaveWarWeaponAmmo);

export function raveWarWeaponLabel(weaponId: RaveWarWeaponId) {
  return raveWarWeaponDefinitionsById.get(weaponId)?.label ?? "Weapon";
}

export function weaponAmmoOrDefault(ammo: Partial<RaveWarWeaponAmmo> | null | undefined, weaponId: RaveWarWeaponId) {
  return ammo?.[weaponId] ?? defaultRaveWarWeaponAmmo[weaponId] ?? 0;
}
