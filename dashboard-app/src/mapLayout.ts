export interface RegionLayoutEntry {
  name: string;
  label: string;
  centroid: { x: number; y: number };
  radius: number;
  points: Array<[number, number]>;
  connections: string[];
  focuses?: string[];
  labelOffset?: { x: number; y: number };
}

const BASE_LAYOUT: RegionLayoutEntry[] = [
  {
    name: "Столичная марка",
    label: "Столица",
    centroid: { x: 0.54, y: 0.44 },
    radius: 62,
    points: [
      [0.50, 0.22],
      [0.64, 0.30],
      [0.70, 0.44],
      [0.62, 0.60],
      [0.46, 0.66],
      [0.36, 0.50],
      [0.38, 0.32],
    ],
    connections: ["Зерновой пояс", "Кузнечный край"],
    focuses: ["economy", "internal", "administration"],
    labelOffset: { x: 0, y: -28 },
  },
  {
    name: "Зерновой пояс",
    label: "Хлебные земли",
    centroid: { x: 0.30, y: 0.60 },
    radius: 74,
    points: [
      [0.30, 0.38],
      [0.42, 0.54],
      [0.40, 0.72],
      [0.28, 0.82],
      [0.14, 0.72],
      [0.16, 0.52],
    ],
    connections: ["Столичная марка", "Кузнечный край"],
    focuses: ["economy", "internal"],
    labelOffset: { x: 0, y: -26 },
  },
  {
    name: "Кузнечный край",
    label: "Промышленный пояс",
    centroid: { x: 0.74, y: 0.60 },
    radius: 72,
    points: [
      [0.66, 0.34],
      [0.84, 0.34],
      [0.92, 0.50],
      [0.86, 0.72],
      [0.70, 0.82],
      [0.58, 0.62],
    ],
    connections: ["Столичная марка", "Зерновой пояс"],
    focuses: ["military", "science", "economy"],
    labelOffset: { x: 0, y: -28 },
  },
];

export function getRegionLayout(): RegionLayoutEntry[] {
  return BASE_LAYOUT;
}

export function connectionKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}
