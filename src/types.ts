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

export type StrategicPriorityLevel = "neglect" | "steady" | "push";

export type CouncilPortfolio =
  | Department
  | "navy"
  | "intelligence"
  | "logistics";

export type ResponsePostureMode = "forceful" | "balanced" | "diplomatic" | "covert";

export interface ResponsePostureSettings {
  default: ResponsePostureMode;
  perCategory?: Partial<Record<EventCategory, ResponsePostureMode>>;
}

export type MandateGoal =
  | "stabilize_region"
  | "fortify_border"
  | "boost_economy"
  | "advance_science"
  | "improve_diplomacy"
  | "suppress_unrest"
  | "expand_influence";

export type MandateUrgency = "low" | "medium" | "high";

export interface StrategicMandate {
  id: string;
  label: string;
  goal: MandateGoal;
  target:
    | { kind: "region"; name: string }
    | { kind: "estate"; name: string }
    | { kind: "global" };
  urgency: MandateUrgency;
  horizon: number;
  notes?: string;
  issuedQuarter?: number;
}

export type MandateStatus =
  | "not_started"
  | "in_progress"
  | "on_track"
  | "at_risk"
  | "completed"
  | "failed";

export interface MandateState extends StrategicMandate {
  progress: number;
  status: MandateStatus;
  confidence: number;
  lastReport?: string;
  baselineValue?: number;
  targetValue?: number;
}

export interface CouncilMember {
  id: string;
  name: string;
  portfolio: CouncilPortfolio;
  competence: number;
  loyalty: number;
  traits: string[];
  favoredMandates?: MandateGoal[];
  caution?: number;
}

export interface CouncilMemberState extends CouncilMember {
  stress: number;
  motivation: number;
  assignedMandates: string[];
  focusDepartment?: Department;
  lastQuarterSummary?: string;
}

export interface StrategicProject {
  id: string;
  name: string;
  focus: Department | "security" | "administration";
  description: string;
  milestones: number[];
  progress: number;
  ownerAdvisorId?: string;
}

export interface StrategicAgenda {
  name: string;
  priorities: Partial<Record<Department, StrategicPriorityLevel>>;
  mandates: StrategicMandate[];
  projects: StrategicProject[];
}

export interface StrategicPlanState {
  priorities: Record<Department, StrategicPriorityLevel>;
  mandates: MandateState[];
  projects: StrategicProject[];
}

export interface CouncilReport {
  advisorId: string;
  advisorName: string;
  portfolio: CouncilPortfolio;
  summary: string;
  confidence: number;
  focusDepartment?: Department;
  alerts?: string[];
}

export interface MandateProgressReport {
  mandateId: string;
  label: string;
  status: MandateStatus;
  progress: number;
  confidence: number;
  commentary: string;
}

export interface AgendaHighlight {
  department: Department;
  priority: StrategicPriorityLevel;
  commentary: string;
}

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

export interface TrustLevels {
  advisor: number;
  estates: Record<string, number>;
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
  trust: TrustLevels;
  agenda?: StrategicPlanState;
  council?: CouncilMemberState[];
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

export interface EventOrigin {
  regionName?: string;
  estateName?: string;
  milestone?: number;
  loyalty?: number;
  satisfaction?: number;
  treasury?: number;
  source?: string;
}

export interface SimulationEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  factions: string[];
  triggers: string[];
  conditions: SimulationEventCondition;
  options: SimulationEventOption[];
  failure: SimulationEventFailure;
  severity: "minor" | "moderate" | "major";
  escalation?: SimulationEventEscalation[];
  origin?: EventOrigin;
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

export interface EventDecisionContext {
  quarter: number;
  resources: ResourcePool;
  estates: Estate[];
  regions: Region[];
  departments: DepartmentState[];
  trust: TrustLevels;
  kpis: KPIReport | null;
  posture: ResponsePostureMode;
  agenda: StrategicPlanState;
  council: CouncilMemberState[];
}

export interface EventResolution {
  optionId: string | null;
  notes?: string;
  defer?: boolean;
}

export type EventDecisionStrategy = (
  event: SimulationEvent,
  context: EventDecisionContext
) => EventResolution;

export type EventOutcomeStatus = "resolved" | "failed" | "deferred";

export interface EventOutcome {
  event: SimulationEvent;
  status: EventOutcomeStatus;
  selectedOptionId?: string | null;
  appliedEffects: SimulationEventEffect[];
  notes?: string;
}

export interface ActiveEvent {
  event: SimulationEvent;
  remainingTime: number;
  originQuarter: number;
  escalated?: boolean;
}

export interface QuarterlyReport {
  quarter: number;
  incomes: ResourcePool;
  expenses: QuarterlyExpenses;
  treasury: ResourcePool;
  estates: EstateSnapshot[];
  regions: RegionSnapshot[];
  events: EventOutcome[];
  kpis: KPIReport;
  trust: TrustLevels;
  activeThreatLevel: number;
  councilReports: CouncilReport[];
  mandateProgress: MandateProgressReport[];
  agendaHighlights: AgendaHighlight[];
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
  initialTrust?: TrustLevels;
  eventDecisionStrategy?: EventDecisionStrategy;
  agenda: StrategicAgenda;
  council: CouncilMember[];
  responsePosture: ResponsePostureSettings;
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
    trust: TrustLevels;
    activeThreatLevel: number;
    council: CouncilMemberState[];
    plan: StrategicPlanState;
  };
}
