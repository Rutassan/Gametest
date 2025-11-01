import {
  CouncilMember,
  DepartmentState,
  Estate,
  Region,
  ResourcePool,
  StrategicAgenda,
} from "./types";

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

export const councilMembers: CouncilMember[] = [
  {
    id: "council_economy",
    name: "Маркиз Лукреций Вальдор",
    portfolio: "economy",
    competence: 0.78,
    loyalty: 0.64,
    traits: ["visionary", "bureaucrat"],
    favoredMandates: ["boost_economy", "advance_science"],
    caution: 0.55,
  },
  {
    id: "council_military",
    name: "Генерал Ирена Крейс",
    portfolio: "military",
    competence: 0.72,
    loyalty: 0.58,
    traits: ["hawkish", "decisive"],
    favoredMandates: ["fortify_border", "suppress_unrest"],
    caution: 0.25,
  },
  {
    id: "council_internal",
    name: "Канцлер Элларион",
    portfolio: "internal",
    competence: 0.81,
    loyalty: 0.71,
    traits: ["administrator", "pious"],
    favoredMandates: ["stabilize_region"],
    caution: 0.6,
  },
  {
    id: "council_diplomacy",
    name: "Посол Селеста Мирран",
    portfolio: "diplomacy",
    competence: 0.69,
    loyalty: 0.77,
    traits: ["silver_tongue", "opportunist"],
    favoredMandates: ["improve_diplomacy", "expand_influence"],
    caution: 0.48,
  },
  {
    id: "council_science",
    name: "Магистр Талия Венр",
    portfolio: "science",
    competence: 0.74,
    loyalty: 0.62,
    traits: ["innovator", "methodical"],
    favoredMandates: ["advance_science", "boost_economy"],
    caution: 0.45,
  },
  {
    id: "council_intelligence",
    name: "Теневой куратор Йорен",
    portfolio: "intelligence",
    competence: 0.68,
    loyalty: 0.52,
    traits: ["discreet", "paranoid"],
    favoredMandates: ["suppress_unrest", "fortify_border"],
    caution: 0.35,
  },
];

export const strategicAgenda: StrategicAgenda = {
  name: "Имперский баланс развития",
  priorities: {
    economy: "push",
    internal: "push",
    diplomacy: "steady",
    military: "steady",
    science: "steady",
  },
  mandates: [
    {
      id: "mandate_capital_stability",
      label: "Стабилизировать Столичную марку",
      goal: "stabilize_region",
      target: { kind: "region", name: "Столичная марка" },
      urgency: "high",
      horizon: 4,
      notes: "Наладить порядок в ключевых кварталах и снизить напряжение",
    },
    {
      id: "mandate_border_fort",
      label: "Усилить северные заставы",
      goal: "fortify_border",
      target: { kind: "global" },
      urgency: "medium",
      horizon: 6,
      notes: "Подготовить оборонительные линии против пограничных набегов",
    },
    {
      id: "mandate_trade_corridor",
      label: "Развить торговый коридор",
      goal: "boost_economy",
      target: { kind: "region", name: "Столичная марка" },
      urgency: "medium",
      horizon: 5,
      notes: "Сфокусироваться на инфраструктуре и логистике торговых гильдий",
    },
  ],
  projects: [
    {
      id: "project_infrastructure_spine",
      name: "Имперский инфраструктурный хребет",
      focus: "economy",
      description: "Связать столичные маршруты с кузнечными мастерскими и зерновым поясом",
      milestones: [0.25, 0.5, 0.75, 1],
      progress: 0,
      ownerAdvisorId: "council_internal",
    },
    {
      id: "project_border_legion",
      name: "Легион пограничной стражи",
      focus: "military",
      description: "Подготовить мобильные силы для реагирования на кризисы и набеги",
      milestones: [0.33, 0.66, 1],
      progress: 0,
      ownerAdvisorId: "council_military",
    },
    {
      id: "project_arcane_college",
      name: "Аркана-коллегия",
      focus: "science",
      description: "Расширить научные лаборатории и магические мастерские",
      milestones: [0.5, 1],
      progress: 0,
      ownerAdvisorId: "council_science",
    },
  ],
};
