import { DepartmentState, Estate, Region, ResourcePool } from "./types";

export const initialResources: ResourcePool = {
  gold: 320,
  influence: 85,
  labor: 150,
};

export const regions: Region[] = [
  {
    name: "Столичная марка",
    population: 850_000,
    wealth: 210,
    loyalty: 68,
    infrastructure: 55,
    specialization: "trade",
    resourceOutput: { gold: 42, influence: 6, labor: 10 },
  },
  {
    name: "Зерновой пояс",
    population: 1_200_000,
    wealth: 150,
    loyalty: 60,
    infrastructure: 40,
    specialization: "agriculture",
    resourceOutput: { gold: 28, influence: 4, labor: 18 },
  },
  {
    name: "Кузнечный край",
    population: 620_000,
    wealth: 190,
    loyalty: 52,
    infrastructure: 48,
    specialization: "industry",
    resourceOutput: { gold: 34, influence: 3, labor: 22 },
  },
];

export const estates: Estate[] = [
  { name: "дворянство", influence: 28, satisfaction: 55, favoredDepartment: "military" },
  { name: "духовенство", influence: 22, satisfaction: 58, favoredDepartment: "internal" },
  { name: "буржуазия", influence: 18, satisfaction: 52, favoredDepartment: "economy" },
  { name: "крестьянство", influence: 20, satisfaction: 50, favoredDepartment: "internal" },
  { name: "гильдии", influence: 12, satisfaction: 49, favoredDepartment: "science" },
];

export const departments: DepartmentState[] = [
  { name: "economy", efficiency: 1, budget: 0, cumulativeInvestment: 0 },
  { name: "diplomacy", efficiency: 0.9, budget: 0, cumulativeInvestment: 0 },
  { name: "internal", efficiency: 1, budget: 0, cumulativeInvestment: 0 },
  { name: "military", efficiency: 1.1, budget: 0, cumulativeInvestment: 0 },
  { name: "science", efficiency: 0.8, budget: 0, cumulativeInvestment: 0 },
];
