export type ResourceType = "gold" | "influence" | "labor";

export interface ResourcePool {
  gold: number;
  influence: number;
  labor: number;
}

export type Department =
  | "economy"
  | "diplomacy"
  | "internal"
  | "military"
  | "science";

export const DEPARTMENTS: Department[] = [
  "economy",
  "diplomacy",
  "internal",
  "military",
  "science",
];

export interface Region {
  name: string;
  population: number;
  wealth: number;
  loyalty: number;
  infrastructure: number;
  specialization: "trade" | "agriculture" | "industry";
  resourceOutput: ResourcePool;
}

export interface Estate {
  name: string;
  influence: number;
  satisfaction: number;
  favoredDepartment: Department;
}

export interface DepartmentState {
  name: Department;
  efficiency: number;
  budget: number;
  cumulativeInvestment: number;
}

export interface Decree {
  name: string;
  investmentPriority: InvestmentPriority;
  taxPolicy: TaxPolicy;
}

export type InvestmentPriority =
  | "balanced"
  | "infrastructure"
  | "military"
  | "innovation"
  | "stability";

export type TaxPolicy = "low" | "standard" | "high";

export interface AdvisorContext {
  resources: ResourcePool;
  estates: Estate[];
  departments: DepartmentState[];
  decree: Decree;
}

export type BudgetAllocation = Partial<Record<Department, number>>;

export interface Advisor {
  name: string;
  description: string;
  allocateBudget(context: AdvisorContext): BudgetAllocation;
}

export interface QuarterlyExpenses {
  departments: Record<Department, number>;
  total: number;
}

export type EventCategory =
  | "Экономический кризис"
  | "Стихийное бедствие"
  | "Политические интриги"
  | "Социальные потрясения"
  | "Военные угрозы"
  | "Технологические / магические открытия"
  | "Дипломатические кризисы";

export interface SimulationEventCondition {
  metrics?: Record<string, string>;
  flags?: string[];
}

export interface SimulationEventEffect {
  type: string;
  target: string;
  value: number;
  duration?: number;
}

export interface SimulationEventCost {
  gold?: number;
  influence?: number;
  labor?: number;
  [key: string]: number | undefined;
}

export interface SimulationEventOption {
  id: string;
  description: string;
  cost?: SimulationEventCost;
  effects: SimulationEventEffect[];
  followUps?: string[];
  cooldown?: number;
}

export interface SimulationEventFailure {
  timeout: number;
  effects: SimulationEventEffect[];
  description?: string;
}

export interface SimulationEventEscalation {
  chance: number;
  followUp: string;
  description: string;
}

export interface SimulationEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  factions: string[];
  conditions: SimulationEventCondition;
  options: SimulationEventOption[];
  failure: SimulationEventFailure;
  severity: "minor" | "moderate" | "major";
  escalation?: SimulationEventEscalation[];
}

export interface EstateSnapshot {
  name: string;
  satisfaction: number;
  influence: number;
}

export interface RegionSnapshot {
  name: string;
  wealth: number;
  loyalty: number;
  infrastructure: number;
}

export type ThreatLevel = "low" | "moderate" | "critical";

export interface KPIEntry {
  value: number;
  trend: number;
  threatLevel: ThreatLevel;
}

export interface KPIReport {
  stability: KPIEntry;
  economicGrowth: KPIEntry;
  securityIndex: KPIEntry;
  activeCrises: KPIEntry;
}

export interface QuarterlyReport {
  quarter: number;
  incomes: ResourcePool;
  expenses: QuarterlyExpenses;
  treasury: ResourcePool;
  estates: EstateSnapshot[];
  regions: RegionSnapshot[];
  events: SimulationEvent[];
  kpis: KPIReport;
}

export interface SimulationConfig {
  quarters: number;
  /**
   * Базовый бюджет на один квартал (3 месяца) до распределения советником.
   */
  baseQuarterBudget: number;
  initialResources: ResourcePool;
  regions: Region[];
  estates: Estate[];
  departments: DepartmentState[];
  advisor: Advisor;
  decree: Decree;
}

export interface KPIAverages {
  stability: number;
  economicGrowth: number;
  securityIndex: number;
  activeCrises: number;
}

export interface SimulationResult {
  reports: QuarterlyReport[];
  kpiSummary: {
    latest: KPIReport | null;
    averages: KPIAverages;
  };
  totals: {
    incomes: ResourcePool;
    expenses: QuarterlyExpenses;
  };
  finalState: {
    resources: ResourcePool;
    regions: Region[];
    estates: Estate[];
    departments: DepartmentState[];
  };
}
