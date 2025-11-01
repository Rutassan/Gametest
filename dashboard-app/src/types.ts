export type ThreatLevel = "low" | "moderate" | "critical";
export type EventSeverity = "minor" | "moderate" | "major";
export type EventOutcomeStatus = "resolved" | "failed" | "deferred";
export type CampaignControlMode = "manual" | "advisor" | "hybrid";
export type InterventionDecisionMode = "player" | "council";
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
  riskScore: number;
  riskLevel: ThreatLevel;
  riskFactors: string[];
}

export interface DepartmentQuarterSnapshot {
  name: string;
  efficiency: number;
  budget: number;
  cumulativeInvestment: number;
  spendingShare: number;
  agendaPriority: "neglect" | "steady" | "push";
}

export interface StrategicProjectSnapshot {
  id: string;
  name: string;
  focus: string;
  description: string;
  milestones: number[];
  progress: number;
  ownerAdvisorId?: string;
  ownerAdvisorName?: string;
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

export interface AdvisorOutcomePreview {
  optionId: string | null;
  notes?: string;
}

export interface EventOutcome {
  event: SimulationEvent;
  status: EventOutcomeStatus;
  selectedOptionId?: string | null;
  appliedEffects: SimulationEventEffect[];
  notes?: string;
  resolutionMode?: InterventionDecisionMode;
  advisorPreview?: AdvisorOutcomePreview;
  handoffTarget?: string;
  handoffIssued?: boolean;
  handedOffAt?: string;
  handledBy?: string;
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
  handoffIssued?: boolean;
  handedOffAt?: string;
  handoffNotes?: string;
  relatedKpi?: keyof KPIReport;
  relatedEventId?: string;
  relatedDepartment?: string;
}

export interface CouncilReport {
  advisorId: string;
  advisorName: string;
  portfolio: string;
  summary: string;
  confidence: number;
  focusDepartment?: string;
  alerts?: string[];
}

export interface CouncilMemberState {
  id: string;
  name: string;
  portfolio: string;
  stress: number;
  motivation: number;
  assignedMandates: string[];
  focusDepartment?: string;
  lastQuarterSummary?: string;
}

export interface MandateProgressReport {
  mandateId: string;
  label: string;
  status: "not_started" | "in_progress" | "on_track" | "at_risk" | "completed" | "failed";
  progress: number;
  confidence: number;
  commentary: string;
}

export interface AgendaHighlight {
  department: string;
  priority: "neglect" | "steady" | "push";
  commentary: string;
}

export interface EventInterventionLogEntry {
  eventId: string;
  eventTitle: string;
  quarter: number;
  mode: InterventionDecisionMode;
  optionId: string | null;
  notes?: string;
  advisorOptionId?: string | null;
  advisorNotes?: string;
  remainingTime: number;
  timestamp: string;
  handoffTarget?: string;
  handoffIssued?: boolean;
  handoffNotes?: string;
  handledBy?: string;
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
  departments: DepartmentQuarterSnapshot[];
  events: EventOutcome[];
  kpis: KPIReport;
  trust: TrustLevels;
  activeThreatLevel: number;
  councilReports: CouncilReport[];
  mandateProgress: MandateProgressReport[];
  projects: StrategicProjectSnapshot[];
  agendaHighlights: AgendaHighlight[];
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
  interventionLog: EventInterventionLogEntry[];
}

export interface DashboardPayload {
  data: {
    simulation: SimulationData;
  };
}

export interface ActiveEventSnapshot {
  event: SimulationEvent;
  remainingTime: number;
  originQuarter: number;
  escalated?: boolean;
}

export interface LiveCampaignSessionInfo {
  currentQuarter: number;
  totalQuarters: number;
  controlMode: CampaignControlMode;
  resources: ResourcePool;
  trust: TrustLevels;
  modifiers: {
    stability: number;
    threat: number;
    budget: number;
    securityPressure: number;
  };
  averages: KPIAverages;
}

export interface LiveCampaignPayload {
  session: LiveCampaignSessionInfo;
  activeEvents: ActiveEventSnapshot[];
  plan: {
    priorities: Record<string, "neglect" | "steady" | "push">;
    mandates: MandateProgressReport[];
    projects: StrategicProjectSnapshot[];
  };
  council: CouncilMemberState[];
  lastReport?: QuarterlyReport;
  interventionLog: EventInterventionLogEntry[];
  totals: SimulationTotals;
}
