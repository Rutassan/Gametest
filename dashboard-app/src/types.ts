export type ThreatLevel = "low" | "moderate" | "critical";
export type EventSeverity = "minor" | "moderate" | "major";
export type EventOutcomeStatus = "resolved" | "failed" | "deferred";
export type CampaignControlMode = "manual" | "advisor" | "hybrid";
export type AdvisorConsultationQueryType = "kpi" | "event" | "department";
export type AdvisorConsultationStance = "support" | "caution" | "escalate";

export interface ResourcePool {
  gold: number;
  influence: number;
  labor: number;
}

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

export interface KPIAverages {
  stability: number;
  economicGrowth: number;
  securityIndex: number;
  activeCrises: number;
}

export interface TreasurySnapshot extends ResourcePool {}

export interface DepartmentBreakdown {
  economy: number;
  diplomacy: number;
  internal: number;
  military: number;
  science: number;
  [key: string]: number;
}

export interface QuarterlyExpenses {
  departments: DepartmentBreakdown;
  total: number;
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

export interface SimulationEventEffect {
  type: string;
  target: string;
  value: number;
  duration?: number;
}

export interface SimulationEventOption {
  id: string;
  description: string;
}

export interface SimulationEventOrigin {
  regionName?: string;
  estateName?: string;
  source?: string;
}

export interface SimulationEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: EventSeverity;
  options: SimulationEventOption[];
  origin?: SimulationEventOrigin;
}

export interface EventOutcome {
  event: SimulationEvent;
  status: EventOutcomeStatus;
  selectedOptionId?: string | null;
  appliedEffects: SimulationEventEffect[];
  notes?: string;
}

export interface AdvisorConsultationResponse {
  advisorId: string;
  advisorName: string;
  stance: AdvisorConsultationStance;
  summary: string;
  rationale: string[];
  recommendedAction?: string;
  kpiFocus?: keyof KPIReport;
}

export interface AdvisorConsultationThread {
  id: string;
  type: AdvisorConsultationQueryType;
  topic: string;
  prompt: string;
  summary: string;
  responses: AdvisorConsultationResponse[];
  recommendations: string[];
  handoffTarget?: string;
  relatedKpi?: keyof KPIReport;
  relatedEventId?: string;
  relatedDepartment?: string;
}

export interface ControlModeLogEntry {
  quarter: number;
  mode: CampaignControlMode;
  timestamp: string;
  reason?: string;
  triggeredBy?: string;
}

export interface ControlStateSnapshot {
  currentMode: CampaignControlMode;
  history: ControlModeLogEntry[];
}

export interface TrustLevels {
  advisor: number;
  estates: Record<string, number>;
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
  controlMode: CampaignControlMode;
  advisorConsultations: AdvisorConsultationThread[];
}

export interface SimulationTotals {
  incomes: ResourcePool;
  expenses: QuarterlyExpenses;
}

export interface SimulationFinalState {
  resources: ResourcePool;
  regions: RegionSnapshot[];
  estates: EstateSnapshot[];
  departments: any[];
  trust: TrustLevels;
  activeThreatLevel: number;
  controlMode: CampaignControlMode;
}

export interface SimulationConfigSummary {
  quarters: number;
  baseQuarterBudget: number;
  advisor: string;
  initialResources: ResourcePool;
  decree: {
    name: string;
    investmentPriority: string;
    taxPolicy: string;
  };
  controlMode?: {
    initialMode: CampaignControlMode;
    transitions?: Array<{
      quarter: number;
      mode: CampaignControlMode;
      reason?: string;
      triggeredBy?: string;
    }>;
  };
}

export interface SimulationData {
  id: string;
  label?: string;
  createdAt: string;
  quarters: number;
  config?: SimulationConfigSummary;
  kpiSummary: {
    latest: KPIReport | null;
    averages: KPIAverages;
  };
  totals: SimulationTotals;
  finalState: SimulationFinalState;
  reports: QuarterlyReport[];
  controlState: ControlStateSnapshot;
}

export interface DashboardPayload {
  data: {
    simulation: SimulationData;
  };
}
