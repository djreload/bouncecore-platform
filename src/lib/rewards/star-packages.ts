export type StarPackage = {
  id: string;
  label: string;
  stars: number;
  pricePence: number;
};

export const starPackages: StarPackage[] = [
  {
    id: "spark",
    label: "Spark pack",
    pricePence: 99,
    stars: 50
  },
  {
    id: "starter",
    label: "Starter stars",
    pricePence: 199,
    stars: 100
  },
  {
    id: "supporter",
    label: "Supporter stack",
    pricePence: 499,
    stars: 300
  },
  {
    id: "headliner",
    label: "Headliner bundle",
    pricePence: 999,
    stars: 750
  },
  {
    id: "mainstage",
    label: "Mainstage drop",
    pricePence: 1799,
    stars: 1500
  },
  {
    id: "supernova",
    label: "Supernova stack",
    pricePence: 2999,
    stars: 3000
  },
  {
    id: "festival",
    label: "Festival crate",
    pricePence: 5999,
    stars: 7500
  },
  {
    id: "legend",
    label: "Legend vault",
    pricePence: 9999,
    stars: 15000
  }
];

export function getStarPackage(packageId: string) {
  const starPackage = starPackages.find((pack) => pack.id === packageId);

  if (!starPackage) {
    throw new Error("Choose a stars package.");
  }

  return starPackage;
}
