import {
  ActiveEvent,
  Advisor,
  AdvisorContext,
  AdvisorOutcomePreview,
  AgendaHighlight,
  CouncilMember,
  CouncilMemberState,
  CouncilReport,
  CouncilPortfolio,
  DEPARTMENTS,
  Department,
  DepartmentState,
  Estate,
  EventDecisionContext,
  EventDecisionStrategy,
  EventInterventionDecision,
  EventInterventionHandler,
  EventInterventionLogEntry,
  EventOutcome,
  EventResolution,
  InterventionDecisionMode,
  CampaignControlMode,
  CampaignControlSettings,
  CampaignControlState,
  ControlModeLogEntry,
  ControlModeTransition,
  KPIEntry,
  KPIReport,
  MandateProgressReport,
  MandateState,
  MandateUrgency,
  MandateGoal,
  MandateStatus,
  QuarterlyReport,
  QuarterlyExpenses,
  Region,
  ResourcePool,
  SimulationConfig,
  InvestmentPriority,
  TaxPolicy,
  SimulationEvent,
  SimulationEventCost,
  SimulationEventOption,
  SimulationEventEffect,
  SimulationResult,
  StrategicAgenda,
  StrategicPriorityLevel,
  StrategicPlanState,
  StrategicProject,
  ThreatLevel,
  TrustLevels,
  ResponsePostureMode,
  ResponsePostureSettings,
} from "./types";
import {
  EventTemplateContext,
  buildEventInterventionPanel,
  createEstateDissatisfactionEvent,
  createEventFromTemplate,
  createInfrastructureMilestoneEvent,
  createLoyaltyDeclineEvent,
  createTreasuryDepletionEvent,
} from "./events";
import {
  priorityBudgetBoost,
  priorityDevelopmentMultiplier,
  taxIncomeModifier,
  taxLoyaltyModifier,
  taxSatisfactionDelta,
} from "./decrees";
import {
  hybridControlDecisionStrategy,
  manualControlDecisionStrategy,
} from "./strategies";

const QUARTER_DURATION = 3;
const SECURITY_ESCALATION_THRESHOLDS = [0.8, 2.6, 4.2];

const PRIORITY_WEIGHTS: Record<StrategicPriorityLevel, number> = {
  neglect: 0.85,
  steady: 1,
  push: 1.2,
};

const URGENCY_WEIGHTS: Record<MandateUrgency, number> = {
  low: 0.04,
  medium: 0.08,
  high: 0.14,
};

interface TimedEffect {
  effect: SimulationEventEffect;
  remaining: number;
  source: string;
}

interface GlobalModifiers {
  stability: number;
  threat: number;
  budget: number;
  reputation: Record<string, number>;
  securityPressure: number;
  securityEscalationStage: number;
  securityRecovery: number;
}

function priorityWeight(level: StrategicPriorityLevel | undefined): number {
  if (!level) {
    return PRIORITY_WEIGHTS.steady;
  }
  return PRIORITY_WEIGHTS[level] ?? PRIORITY_WEIGHTS.steady;
}

function portfolioDepartments(portfolio: CouncilPortfolio): Department[] {
  switch (portfolio) {
    case "economy":
    case "diplomacy":
    case "internal":
    case "military":
    case "science":
      return [portfolio];
    case "navy":
      return ["military"];
    case "intelligence":
      return ["internal", "military"];
    case "logistics":
      return ["economy", "internal"];
    default:
      return [];
  }
}

function initializeStrategicPlan(agenda: StrategicAgenda): StrategicPlanState {
  const priorities: Record<Department, StrategicPriorityLevel> = {} as Record<Department, StrategicPriorityLevel>;
  for (const department of DEPARTMENTS) {
    priorities[department] = agenda.priorities[department] ?? "steady";
  }

  const mandates: MandateState[] = agenda.mandates.map((mandate) => ({
    ...mandate,
    progress: 0,
    status: "not_started",
    confidence: 0.55,
  }));

  const projects: StrategicProject[] = agenda.projects.map((project) => ({ ...project }));

  return {
    priorities,
    mandates,
    projects,
  };
}

function cloneStrategicPlan(plan: StrategicPlanState): StrategicPlanState {
  return {
    priorities: { ...plan.priorities },
    mandates: plan.mandates.map((mandate) => ({ ...mandate })),
    projects: plan.projects.map((project) => ({ ...project })),
  };
}

function initializeCouncilState(council: CouncilMember[]): CouncilMemberState[] {
  return council.map((member) => ({
    ...member,
    stress: 0.3,
    motivation: clamp(0.55 + (member.loyalty - 0.5) * 0.4, 0.35, 0.9),
    assignedMandates: [],
  }));
}

function cloneCouncilState(council: CouncilMemberState[]): CouncilMemberState[] {
  return council.map((member) => ({ ...member, assignedMandates: [...member.assignedMandates] }));
}

function resetCouncilAssignments(council: CouncilMemberState[]) {
  for (const member of council) {
    member.assignedMandates = [];
  }
}

function mandateAssignmentScore(member: CouncilMemberState, mandate: MandateState): number {
  const favored = member.favoredMandates?.includes(mandate.goal) ? 0.15 : 0;
  const cautionPenalty = (member.caution ?? 0.5) * (mandate.urgency === "high" ? 0.15 : 0.05);
  const competence = member.competence;
  const motivationBonus = (member.motivation - 0.5) * 0.2;
  const stressPenalty = member.stress * 0.15;
  return competence + favored + motivationBonus + member.loyalty * 0.1 - cautionPenalty - stressPenalty;
}

function assignMandatesToCouncil(plan: StrategicPlanState, council: CouncilMemberState[]) {
  resetCouncilAssignments(council);

  const activeMandates = plan.mandates.filter((mandate) => mandate.status !== "completed" && mandate.status !== "failed");
  for (const mandate of activeMandates) {
    let best: CouncilMemberState | null = null;
    let bestScore = -Infinity;
    for (const member of council) {
      const departments = portfolioDepartments(member.portfolio);
      if (departments.length === 0) {
        continue;
      }
      const goalDepartments = Object.keys(goalDepartmentImpact(mandate.goal)) as Department[];
      if (goalDepartments.length > 0 && !goalDepartments.some((department) => departments.includes(department))) {
        continue;
      }
      const score = mandateAssignmentScore(member, mandate);
      if (score > bestScore) {
        bestScore = score;
        best = member;
      }
    }

    if (best) {
      best.assignedMandates.push(mandate.id);
    }
  }
}

function goalDepartmentImpact(goal: MandateGoal): Partial<Record<Department, number>> {
  switch (goal) {
    case "stabilize_region":
      return { internal: 1, economy: 0.4, military: 0.3 };
    case "fortify_border":
      return { military: 1.2, internal: 0.4, diplomacy: 0.2 };
    case "boost_economy":
      return { economy: 1.2, science: 0.4, diplomacy: 0.2 };
    case "advance_science":
      return { science: 1.3, economy: 0.3 };
    case "improve_diplomacy":
      return { diplomacy: 1.3, economy: 0.2, internal: 0.2 };
    case "suppress_unrest":
      return { internal: 1.1, military: 0.5 };
    case "expand_influence":
      return { diplomacy: 0.9, economy: 0.4, science: 0.3 };
    default:
      return {};
  }
}

function calculateMandateWeights(plan: StrategicPlanState): Record<Department, number> {
  const weights: Record<Department, number> = {} as Record<Department, number>;
  for (const department of DEPARTMENTS) {
    weights[department] = 1;
  }

  for (const mandate of plan.mandates) {
    if (mandate.status === "completed" || mandate.status === "failed") {
      continue;
    }
    const momentum = 1 - Math.min(0.7, mandate.progress * 0.6);
    const urgency = URGENCY_WEIGHTS[mandate.urgency] ?? 0.04;
    const totalMultiplier = urgency * momentum;
    const impact = goalDepartmentImpact(mandate.goal);
    for (const department of Object.keys(impact) as Department[]) {
      const influence = impact[department] ?? 0;
      weights[department] *= 1 + totalMultiplier * influence;
    }
  }

  return weights;
}

function calculateAgendaBudgetWeights(
  plan: StrategicPlanState,
  council: CouncilMemberState[]
): Record<Department, number> {
  const weights: Record<Department, number> = {} as Record<Department, number>;
  for (const department of DEPARTMENTS) {
    weights[department] = priorityWeight(plan.priorities[department]);
  }

  const mandateWeights = calculateMandateWeights(plan);
  for (const department of DEPARTMENTS) {
    weights[department] *= mandateWeights[department];
  }

  for (const member of council) {
    const departments = portfolioDepartments(member.portfolio);
    if (departments.length === 0) {
      continue;
    }
    const baseBonus = member.competence * 0.12 + (member.motivation - 0.5) * 0.1;
    const stressPenalty = member.stress * 0.08;
    const modifier = 1 + baseBonus - stressPenalty;
    for (const department of departments) {
      weights[department] *= modifier;
    }
  }

  const total = DEPARTMENTS.reduce((acc, department) => acc + weights[department], 0);
  if (total <= 0) {
    const share = 1 / DEPARTMENTS.length;
    for (const department of DEPARTMENTS) {
      weights[department] = share;
    }
    return weights;
  }

  for (const department of DEPARTMENTS) {
    weights[department] = weights[department] / total;
  }

  return weights;
}

function determineMandateTargetGain(goal: MandateGoal, urgency: MandateUrgency): number {
  const base =
    urgency === "high" ? 1.4 : urgency === "medium" ? 1.0 : 0.6;
  switch (goal) {
    case "stabilize_region":
      return 10 * base;
    case "fortify_border":
      return 14 * base;
    case "boost_economy":
      return 16 * base;
    case "advance_science":
      return 0.28 * base;
    case "improve_diplomacy":
      return 0.25 * base;
    case "suppress_unrest":
      return 9 * base;
    case "expand_influence":
      return 30 * base;
    default:
      return 8 * base;
  }
}

function projectFocusDepartments(focus: StrategicProject["focus"]): Department[] {
  if (focus === "security") {
    return ["military", "internal"];
  }
  if (focus === "administration") {
    return ["internal", "economy"];
  }
  if (DEPARTMENTS.includes(focus as Department)) {
    return [focus as Department];
  }
  return [];
}

function updateProjectsProgress(
  projects: StrategicProject[],
  spending: Record<Department, number>,
  effectiveBudget: number
) {
  if (effectiveBudget <= 0) {
    return;
  }
  for (const project of projects) {
    const focusDepartments = projectFocusDepartments(project.focus);
    if (focusDepartments.length === 0) {
      continue;
    }
    const focusSpend = focusDepartments.reduce((acc, department) => acc + (spending[department] ?? 0), 0);
    const share = focusSpend / effectiveBudget;
    if (share <= 0) {
      continue;
    }
    const milestones = project.milestones.length > 0 ? project.milestones : [1];
    const progressGain = clamp(Number((share * 0.25).toFixed(3)), 0.001, 0.08);
    project.progress = clamp(Number((project.progress + progressGain).toFixed(3)), 0, 1);
    for (const milestone of milestones) {
      if (project.progress >= milestone && project.progress - progressGain < milestone) {
        // milestone reached - no explicit action yet, placeholder for future hooks
      }
    }
  }
}

function computeMandateMetric(
  mandate: MandateState,
  resources: ResourcePool,
  regions: Region[],
  estates: Estate[],
  departments: DepartmentState[],
  kpis: KPIReport | null
): number {
  switch (mandate.goal) {
    case "stabilize_region": {
      const region = mandate.target.kind === "region" ? findRegionByName(regions, mandate.target.name) : undefined;
      return region ? region.loyalty : kpis?.stability.value ?? 50;
    }
    case "fortify_border":
      return kpis?.securityIndex.value ?? 50;
    case "boost_economy": {
      if (mandate.target.kind === "region") {
        const region = findRegionByName(regions, mandate.target.name);
        return region ? region.wealth : 100;
      }
      return resources.gold;
    }
    case "advance_science": {
      const science = departments.find((department) => department.name === "science");
      return science ? science.efficiency : 0.8;
    }
    case "improve_diplomacy": {
      const diplomacy = departments.find((department) => department.name === "diplomacy");
      return diplomacy ? diplomacy.efficiency : 0.9;
    }
    case "suppress_unrest":
      return kpis?.stability.value ?? 50;
    case "expand_influence":
      return resources.influence;
    default:
      return resources.gold;
  }
}

function createMandateCommentary(
  mandate: MandateState,
  metricDelta: number,
  kpi: KPIReport | null
): string {
  const formattedDelta = metricDelta >= 0 ? `+${metricDelta.toFixed(1)}` : metricDelta.toFixed(1);
  switch (mandate.goal) {
    case "stabilize_region":
      return `Лояльность выросла на ${formattedDelta} пунктов`;
    case "fortify_border":
      return `Индекс безопасности изменился на ${formattedDelta}`;
    case "boost_economy":
      return `Финансовые показатели сместились на ${formattedDelta}`;
    case "advance_science":
      return `Эффективность исследований ${formattedDelta}`;
    case "improve_diplomacy":
      return `Дипломатическая эффективность ${formattedDelta}`;
    case "suppress_unrest":
      return `Стабильность страны ${formattedDelta}`;
    case "expand_influence":
      return `Резерв влияния ${formattedDelta}`;
    default:
      return `Прогресс оценки ${formattedDelta}`;
  }
}

function evaluateMandates(
  plan: StrategicPlanState,
  quarter: number,
  resources: ResourcePool,
  regions: Region[],
  estates: Estate[],
  departments: DepartmentState[],
  kpis: KPIReport | null
): MandateProgressReport[] {
  const reports: MandateProgressReport[] = [];

  for (const mandate of plan.mandates) {
    if (mandate.issuedQuarter === undefined) {
      mandate.issuedQuarter = quarter;
    }

    const currentMetric = computeMandateMetric(mandate, resources, regions, estates, departments, kpis);
    if (mandate.baselineValue === undefined) {
      mandate.baselineValue = currentMetric;
      mandate.targetValue = currentMetric + determineMandateTargetGain(mandate.goal, mandate.urgency);
    }

    const baseline = mandate.baselineValue ?? currentMetric;
    const target = mandate.targetValue ?? baseline + 1;
    const direction = target >= baseline ? 1 : -1;
    const progressRange = Math.max(0.001, Math.abs(target - baseline));
    const delta = direction === 1 ? currentMetric - baseline : baseline - currentMetric;
    const normalized = clamp(Number((delta / progressRange).toFixed(3)), 0, 1.4);
    mandate.progress = Math.max(mandate.progress, normalized);

    const elapsed = Math.max(0, quarter - (mandate.issuedQuarter ?? quarter));
    const expectedProgress = mandate.horizon > 0 ? (elapsed + 1) / mandate.horizon : 1;
    let status: MandateStatus = mandate.status;

    if (normalized >= 1) {
      status = "completed";
    } else if (elapsed >= mandate.horizon) {
      status = normalized >= 0.6 ? "completed" : "failed";
    } else if (normalized >= expectedProgress * 0.9) {
      status = "on_track";
    } else if (normalized >= expectedProgress * 0.6) {
      status = "in_progress";
    } else if (normalized <= 0.05 && elapsed === 0) {
      status = "not_started";
    } else {
      status = "at_risk";
    }

    mandate.status = status;
    const confidenceDelta =
      status === "completed" ? 0.08 :
      status === "on_track" ? 0.04 :
      status === "in_progress" ? 0.01 :
      status === "at_risk" ? -0.05 :
      status === "failed" ? -0.1 :
      -0.02;
    mandate.confidence = clamp(Number((mandate.confidence + confidenceDelta).toFixed(3)), 0.2, 0.95);
    const metricDelta = currentMetric - (mandate.baselineValue ?? currentMetric);
    const commentary = createMandateCommentary(mandate, metricDelta, kpis);

    reports.push({
      mandateId: mandate.id,
      label: mandate.label,
      status: mandate.status,
      progress: Number(Math.min(1, mandate.progress).toFixed(3)),
      confidence: Number(mandate.confidence.toFixed(3)),
      commentary,
    });
    mandate.lastReport = commentary;
  }

  return reports;
}

function buildAgendaHighlights(
  plan: StrategicPlanState,
  budgetWeights: Record<Department, number>
): AgendaHighlight[] {
  const sortedDepartments = [...DEPARTMENTS].sort((a, b) => budgetWeights[b] - budgetWeights[a]);
  const highlights: AgendaHighlight[] = [];

  for (const department of sortedDepartments.slice(0, 3)) {
    const priority = plan.priorities[department];
    let commentary = "Бюджет распределён ровно";
    if (priority === "push") {
      commentary = "Приоритетное усиление";
    } else if (priority === "neglect") {
      commentary = "Сокращение финансирования";
    }
    highlights.push({
      department,
      priority,
      commentary,
    });
  }

  return highlights;
}

function adjustCouncilMorale(
  council: CouncilMemberState[],
  mandateReports: MandateProgressReport[]
) {
  const reportMap = new Map<string, MandateProgressReport>();
  for (const report of mandateReports) {
    reportMap.set(report.mandateId, report);
  }

  for (const member of council) {
    let motivationShift = 0;
    let stressShift = 0;
    for (const mandateId of member.assignedMandates) {
      const report = reportMap.get(mandateId);
      if (!report) {
        continue;
      }
      switch (report.status) {
        case "completed":
          motivationShift += 0.06;
          stressShift -= 0.05;
          break;
        case "on_track":
          motivationShift += 0.03;
          stressShift -= 0.02;
          break;
        case "in_progress":
          motivationShift += 0.01;
          break;
        case "at_risk":
          motivationShift -= 0.04;
          stressShift += 0.04;
          break;
        case "failed":
          motivationShift -= 0.07;
          stressShift += 0.06;
          break;
        default:
          break;
      }
    }
    member.motivation = clamp(Number((member.motivation + motivationShift).toFixed(3)), 0.3, 0.95);
    member.stress = clamp(Number((member.stress + stressShift).toFixed(3)), 0, 1);
  }
}

function generateCouncilReports(
  council: CouncilMemberState[],
  mandateReports: MandateProgressReport[],
  budgetWeights: Record<Department, number>
): CouncilReport[] {
  const reportMap = new Map<string, MandateProgressReport>();
  for (const report of mandateReports) {
    reportMap.set(report.mandateId, report);
  }

  return council.map((member) => {
    const departments = portfolioDepartments(member.portfolio);
    const focusDepartment = departments[0];
    const assigned = member.assignedMandates
      .map((mandateId) => reportMap.get(mandateId))
      .filter((report): report is MandateProgressReport => Boolean(report));

    let summary = "Сохраняет стабильное управление";
    const alerts: string[] = [];
    const highlightWeight = focusDepartment ? budgetWeights[focusDepartment] ?? 0 : 0;

    if (assigned.length > 0) {
      const critical = assigned.find((entry) => entry.status === "at_risk" || entry.status === "failed");
      const success = assigned.find((entry) => entry.status === "completed");
      if (critical) {
        summary = `Сигнал тревоги по поручению «${critical.label}»`;
        alerts.push(critical.commentary);
      } else if (success) {
        summary = `Отчитывается об успехе «${success.label}»`;
      } else {
        const progress = assigned.reduce((acc, entry) => acc + entry.progress, 0) / assigned.length;
        summary = `Контролирует поручения (прогресс ${(progress * 100).toFixed(0)}%)`;
      }
    } else if (highlightWeight > 0.3) {
      summary = "Фокусируется на приоритетном направлении";
    }

    member.lastQuarterSummary = summary;

    return {
      advisorId: member.id,
      advisorName: member.name,
      portfolio: member.portfolio,
      summary,
      confidence: Number((member.loyalty * 0.5 + member.motivation * 0.5).toFixed(3)),
      focusDepartment,
      alerts: alerts.length > 0 ? alerts : undefined,
    };
  });
}

function cloneResources(pool: ResourcePool): ResourcePool {
  return { gold: pool.gold, influence: pool.influence, labor: pool.labor };
}

function addResources(target: ResourcePool, income: ResourcePool): ResourcePool {
  return {
    gold: target.gold + income.gold,
    influence: target.influence + income.influence,
    labor: target.labor + income.labor,
  };
}

function subtractResources(target: ResourcePool, cost: ResourcePool): ResourcePool {
  return {
    gold: target.gold - cost.gold,
    influence: target.influence - cost.influence,
    labor: target.labor - cost.labor,
  };
}

function scaleResources(pool: ResourcePool, factor: number): ResourcePool {
  return {
    gold: pool.gold * factor,
    influence: pool.influence * factor,
    labor: pool.labor * factor,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function initializeTrustLevels(estates: Estate[], initial?: TrustLevels): TrustLevels {
  const base: TrustLevels = {
    advisor: initial?.advisor ?? 0.6,
    estates: {},
  };

  for (const estate of estates) {
    const existing = initial?.estates?.[estate.name];
    base.estates[estate.name] = existing !== undefined ? existing : clamp(estate.satisfaction / 100, 0.25, 0.85);
  }

  return base;
}

function cloneTrustLevels(trust: TrustLevels): TrustLevels {
  return {
    advisor: trust.advisor,
    estates: Object.fromEntries(Object.entries(trust.estates)) as Record<string, number>,
  };
}

function updateEstateTrust(trust: TrustLevels, estates: Estate[]) {
  for (const estate of estates) {
    const normalized = clamp(estate.satisfaction / 100, 0.1, 0.95);
    trust.estates[estate.name] = normalized;
  }
}

function adjustAdvisorTrust(trust: TrustLevels, delta: number) {
  trust.advisor = clamp(Number((trust.advisor + delta).toFixed(3)), 0.1, 0.95);
}

function adjustEstateTrust(trust: TrustLevels, estateName: string | undefined, delta: number) {
  if (!estateName) {
    return;
  }
  const current = trust.estates[estateName] ?? 0.5;
  trust.estates[estateName] = clamp(Number((current + delta).toFixed(3)), 0.1, 0.95);
}

function severityWeight(event: SimulationEvent): number {
  switch (event.severity) {
    case "major":
      return 0.05;
    case "moderate":
      return 0.03;
    default:
      return 0.015;
  }
}

function canAfford(cost: SimulationEventCost | undefined, resources: ResourcePool): boolean {
  if (!cost) {
    return true;
  }
  if (cost.gold !== undefined && resources.gold < cost.gold) {
    return false;
  }
  if (cost.influence !== undefined && resources.influence < cost.influence) {
    return false;
  }
  if (cost.labor !== undefined && resources.labor < cost.labor) {
    return false;
  }
  return true;
}

function applyCost(cost: SimulationEventCost | undefined, resources: ResourcePool) {
  if (!cost) {
    return;
  }
  if (cost.gold) {
    resources.gold = Math.max(0, resources.gold - cost.gold);
  }
  if (cost.influence) {
    resources.influence = Math.max(0, resources.influence - cost.influence);
  }
  if (cost.labor) {
    resources.labor = Math.max(0, resources.labor - cost.labor);
  }
}

function estimateOptionValue(option: SimulationEventOption): number {
  const costPenalty =
    (option.cost?.gold ?? 0) * 0.8 + (option.cost?.influence ?? 0) * 1.1 + (option.cost?.labor ?? 0) * 0.3;
  const effectScore = option.effects.reduce((acc, effect) => acc + effect.value, 0);
  return effectScore - costPenalty;
}

const defaultDecisionStrategy: EventDecisionStrategy = (event, context) => {
  const affordableOptions = event.options.filter((option) => canAfford(option.cost, context.resources));
  if (affordableOptions.length === 0) {
    return { optionId: null, defer: true, notes: "Недостаточно ресурсов" };
  }

  const prioritized = affordableOptions
    .map((option) => ({ option, score: estimateOptionValue(option) }))
    .sort((a, b) => b.score - a.score);

  const chosen = prioritized[0];
  if (!chosen) {
    return { optionId: null, defer: true };
  }

  return { optionId: chosen.option.id };
};

function findRegionByName(regions: Region[], name: string | undefined): Region | undefined {
  if (!name) {
    return undefined;
  }
  return regions.find((region) => region.name === name);
}

function findEstateByName(estates: Estate[], name: string | undefined): Estate | undefined {
  if (!name) {
    return undefined;
  }
  return estates.find((estate) => estate.name === name);
}

function scheduleTimedEffect(
  timedEffects: TimedEffect[],
  effect: SimulationEventEffect,
  source: string
) {
  if (!effect.duration || effect.duration <= 1) {
    return;
  }
  timedEffects.push({
    effect: { ...effect, duration: undefined },
    remaining: effect.duration - 1,
    source,
  });
}

function applyEventEffect(
  effect: SimulationEventEffect,
  resources: ResourcePool,
  regions: Region[],
  estates: Estate[],
  modifiers: GlobalModifiers,
  timedEffects: TimedEffect[],
  source: string
) {
  const { type, target, value } = effect;
  const normalizedTarget = target?.toLowerCase() ?? "";

  switch (type) {
    case "treasury":
      if (target === "gold") {
        resources.gold = Math.max(0, resources.gold + value);
      } else if (target === "influence") {
        resources.influence = Math.max(0, resources.influence + value);
      } else if (target === "labor") {
        resources.labor = Math.max(0, resources.labor + value);
      }
      break;
    case "infrastructure": {
      const region = findRegionByName(regions, target);
      if (region) {
        region.infrastructure = clamp(region.infrastructure + value, 0, 150);
      } else if (!target || normalizedTarget === "all") {
        for (const r of regions) {
          r.infrastructure = clamp(r.infrastructure + value, 0, 150);
        }
      }
      break;
    }
    case "wealth": {
      if (normalizedTarget === "торговые провинции") {
        for (const region of regions) {
          if (region.specialization === "trade") {
            region.wealth = Math.max(5, region.wealth + value);
          }
        }
      } else {
        const region = findRegionByName(regions, target);
        if (region) {
          region.wealth = Math.max(5, region.wealth + value);
        }
      }
      break;
    }
    case "loyalty": {
      const region = findRegionByName(regions, target);
      if (region) {
        region.loyalty = clamp(region.loyalty + value, 0, 100);
      } else if (!target || normalizedTarget === "империя") {
        for (const r of regions) {
          r.loyalty = clamp(r.loyalty + value, 0, 100);
        }
      }
      break;
    }
    case "influence": {
      resources.influence = Math.max(0, resources.influence + value);
      break;
    }
    case "satisfaction": {
      const estate = findEstateByName(estates, target);
      if (estate) {
        estate.satisfaction = clamp(estate.satisfaction + value, 0, 100);
      }
      break;
    }
    case "stability":
      modifiers.stability += value;
      break;
    case "reputation": {
      const key = normalizedTarget || "empire";
      modifiers.reputation[key] = (modifiers.reputation[key] ?? 0) + value;
      break;
    }
    case "threat":
      modifiers.threat += value;
      break;
    case "securityPressure":
      modifiers.securityPressure = Number(
        Math.max(0, modifiers.securityPressure + value).toFixed(2)
      );
      break;
    case "budget":
      modifiers.budget += value;
      break;
    case "unrest":
      modifiers.stability -= value;
      break;
    default:
      break;
  }

  scheduleTimedEffect(timedEffects, effect, source);
}

function applyTimedEffects(
  timedEffects: TimedEffect[],
  resources: ResourcePool,
  regions: Region[],
  estates: Estate[],
  modifiers: GlobalModifiers
) {
  for (let i = timedEffects.length - 1; i >= 0; i -= 1) {
    const timed = timedEffects[i];
    applyEventEffect(timed.effect, resources, regions, estates, modifiers, [] as TimedEffect[], timed.source);
    timed.remaining -= 1;
    if (timed.remaining <= 0) {
      timedEffects.splice(i, 1);
    }
  }
}

function buildContextFromOrigin(
  origin: SimulationEvent["origin"],
  regions: Region[],
  estates: Estate[]
): EventTemplateContext {
  if (!origin) {
    return {};
  }

  const context: EventTemplateContext = {};
  if (origin.regionName) {
    context.region = findRegionByName(regions, origin.regionName);
  }
  if (origin.estateName) {
    context.estate = findEstateByName(estates, origin.estateName);
  }
  if (origin.milestone !== undefined) {
    context.milestone = origin.milestone;
  }
  if (origin.loyalty !== undefined) {
    context.loyalty = origin.loyalty;
  }
  if (origin.satisfaction !== undefined) {
    context.satisfaction = origin.satisfaction;
  }
  if (origin.treasury !== undefined) {
    context.treasury = origin.treasury;
  }
  if (origin.source) {
    context.source = origin.source;
  }

  return context;
}

function generateKpiEvents(kpis: KPIReport, regions: Region[]): SimulationEvent[] {
  const events: SimulationEvent[] = [];

  if (kpis.stability.threatLevel !== "low") {
    const lowestLoyaltyRegion = [...regions].sort((a, b) => a.loyalty - b.loyalty)[0];
    events.push(
      createEventFromTemplate("kpi.stability.crisis", { region: lowestLoyaltyRegion })
    );
  }

  if (kpis.economicGrowth.value <= 0) {
    events.push(createEventFromTemplate("kpi.economy.recession", {}));
  }

  return events;
}

function evaluateSecurityEscalation(
  kpis: KPIReport,
  regions: Region[],
  modifiers: GlobalModifiers
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  if (regions.length === 0) {
    return events;
  }

  const borderRegion = [...regions].sort((a, b) => a.loyalty - b.loyalty)[0];

  if (kpis.securityIndex.threatLevel === "low") {
    modifiers.securityRecovery = Math.min(modifiers.securityRecovery + 1, 4);
    modifiers.securityPressure = Number(
      Math.max(0, modifiers.securityPressure - 1).toFixed(2)
    );

    while (
      modifiers.securityEscalationStage > 0 &&
      modifiers.securityPressure <
        SECURITY_ESCALATION_THRESHOLDS[modifiers.securityEscalationStage - 1] - 0.7
    ) {
      modifiers.securityEscalationStage -= 1;
    }

    if (modifiers.threat > 0) {
      modifiers.threat = Number(Math.max(0, modifiers.threat - 0.35).toFixed(2));
    }

    return events;
  }

  const pressureGain = kpis.securityIndex.threatLevel === "critical" ? 1.4 : 0.65;
  const threatGain = kpis.securityIndex.threatLevel === "critical" ? 0.5 : 0.25;

  modifiers.securityPressure = Number(
    Math.min(6, modifiers.securityPressure + pressureGain).toFixed(2)
  );
  modifiers.threat = Number((modifiers.threat + threatGain).toFixed(2));
  modifiers.securityRecovery = 0;

  while (
    modifiers.securityEscalationStage < SECURITY_ESCALATION_THRESHOLDS.length &&
    modifiers.securityPressure >=
      SECURITY_ESCALATION_THRESHOLDS[modifiers.securityEscalationStage]
  ) {
    modifiers.securityEscalationStage += 1;
    const stage = modifiers.securityEscalationStage;

    if (stage === 1) {
      events.push(
        createEventFromTemplate("kpi.security.alert", {
          region: borderRegion,
          threatLevel: "moderate",
        })
      );
    } else if (stage === 2) {
      events.push(
        createEventFromTemplate("security.border.skirmish", {
          region: borderRegion,
          threatLevel: "moderate",
        })
      );
    } else if (stage === 3) {
      events.push(
        createEventFromTemplate("security.border.crisis", {
          region: borderRegion,
          threatLevel: "critical",
        })
      );
    }
  }

  return events;
}

function enqueueEvents(
  activeEvents: ActiveEvent[],
  incoming: SimulationEvent[],
  quarter: number
) {
  for (const event of incoming) {
    const timeout = event.failure?.timeout ?? 1;
    const existing = activeEvents.find(
      (entry) =>
        entry.event.id === event.id &&
        entry.event.origin?.regionName === event.origin?.regionName &&
        entry.event.origin?.estateName === event.origin?.estateName
    );
    if (existing) {
      existing.remainingTime = Math.max(existing.remainingTime, timeout);
      continue;
    }

    activeEvents.push({
      event,
      remainingTime: timeout,
      originQuarter: quarter,
      escalated: false,
    });
  }
}

function resolveEventsForQuarter(
  quarter: number,
  activeEvents: ActiveEvent[],
  newEvents: SimulationEvent[],
  decisionStrategy: EventDecisionStrategy,
  buildContext: () => EventDecisionContext,
  resources: ResourcePool,
  regions: Region[],
  estates: Estate[],
  modifiers: GlobalModifiers,
  timedEffects: TimedEffect[],
  trust: TrustLevels,
  postureSettings: ResponsePostureSettings,
  interventionHandler: EventInterventionHandler | undefined,
  interventionLog: EventInterventionLogEntry[] | undefined
): EventOutcome[] {
  const outcomes: EventOutcome[] = [];
  enqueueEvents(activeEvents, newEvents, quarter);

  for (let index = 0; index < activeEvents.length; index += 1) {
    const active = activeEvents[index];
    const context = buildContext();
    context.posture =
      postureSettings.perCategory?.[active.event.category] ?? postureSettings.default;
    const advisorResolution = decisionStrategy(active.event, context);
    const advisorPreview: AdvisorOutcomePreview = {
      optionId: advisorResolution.optionId ?? null,
      notes: advisorResolution.notes,
    };

    let resolution: EventResolution = advisorResolution;
    let resolutionMode: InterventionDecisionMode = "council";

    if (interventionHandler) {
      const panel = buildEventInterventionPanel({
        event: active.event,
        context,
        remainingTime: active.remainingTime,
        quarter,
        advisorPreview,
      });

      const decision: EventInterventionDecision = interventionHandler.present(panel, context);
      resolutionMode = decision.mode;

      if (decision.mode === "player") {
        resolution = {
          optionId: decision.optionId ?? null,
          notes: decision.notes,
          defer: decision.defer,
        };
      } else {
        resolution = advisorResolution;
      }

      const logEntry: EventInterventionLogEntry = {
        eventId: active.event.id,
        eventTitle: active.event.title,
        quarter,
        mode: resolutionMode,
        optionId: resolution.optionId ?? null,
        notes: resolution.notes,
        advisorOptionId: advisorPreview.optionId ?? null,
        advisorNotes: advisorPreview.notes,
        remainingTime: active.remainingTime,
        timestamp: new Date().toISOString(),
      };
      interventionLog?.push(logEntry);
      interventionHandler.record?.(logEntry);
    } else {
      const logEntry: EventInterventionLogEntry = {
        eventId: active.event.id,
        eventTitle: active.event.title,
        quarter,
        mode: resolutionMode,
        optionId: resolution.optionId ?? null,
        notes: resolution.notes,
        advisorOptionId: advisorPreview.optionId ?? null,
        advisorNotes: advisorPreview.notes,
        remainingTime: active.remainingTime,
        timestamp: new Date().toISOString(),
      };
      interventionLog?.push(logEntry);
    }

    if (resolution.defer || resolution.optionId === null) {
      active.remainingTime -= 1;
      outcomes.push({
        event: active.event,
        status: "deferred",
        selectedOptionId: null,
        appliedEffects: [],
        notes: resolution.notes,
        resolutionMode,
        advisorPreview,
      });

      if (active.remainingTime <= 0) {
        const failureEffects = active.event.failure.effects ?? [];
        for (const effect of failureEffects) {
          applyEventEffect(effect, resources, regions, estates, modifiers, timedEffects, active.event.id);
        }
        outcomes.push({
          event: active.event,
          status: "failed",
          selectedOptionId: null,
          appliedEffects: failureEffects,
          notes: "Провал из-за истечения времени",
          resolutionMode,
          advisorPreview,
        });
        adjustAdvisorTrust(trust, -severityWeight(active.event));
        adjustEstateTrust(trust, active.event.origin?.estateName, -0.03);
        activeEvents.splice(index, 1);
        index -= 1;
      }
      continue;
    }

    const option = active.event.options.find((candidate) => candidate.id === resolution.optionId);
    if (!option || !canAfford(option.cost, resources)) {
      active.remainingTime -= 1;
      outcomes.push({
        event: active.event,
        status: "deferred",
        selectedOptionId: option?.id ?? null,
        appliedEffects: [],
        notes: !option ? "Опция не найдена" : "Недостаточно ресурсов для выбранной опции",
        resolutionMode,
        advisorPreview,
      });

      if (active.remainingTime <= 0) {
        const failureEffects = active.event.failure.effects ?? [];
        for (const effect of failureEffects) {
          applyEventEffect(effect, resources, regions, estates, modifiers, timedEffects, active.event.id);
        }
        outcomes.push({
          event: active.event,
          status: "failed",
          selectedOptionId: option?.id ?? null,
          appliedEffects: failureEffects,
          notes: "Провал из-за истечения времени",
          resolutionMode,
          advisorPreview,
        });
        adjustAdvisorTrust(trust, -severityWeight(active.event));
        adjustEstateTrust(trust, active.event.origin?.estateName, -0.035);
        activeEvents.splice(index, 1);
        index -= 1;
      }
      continue;
    }

    applyCost(option.cost, resources);
    const appliedEffects: SimulationEventEffect[] = [];
    for (const effect of option.effects) {
      applyEventEffect(effect, resources, regions, estates, modifiers, timedEffects, active.event.id);
      appliedEffects.push(effect);
    }

    const followUps: SimulationEvent[] = [];
    if (option.followUps && option.followUps.length > 0) {
      const baseContext = buildContextFromOrigin(active.event.origin, regions, estates);
      baseContext.treasury = resources.gold;
      baseContext.loyalty = baseContext.region?.loyalty ?? baseContext.loyalty;
      baseContext.satisfaction = baseContext.estate?.satisfaction ?? baseContext.satisfaction;

      for (const followUpId of option.followUps) {
        try {
          followUps.push(createEventFromTemplate(followUpId as any, baseContext));
        } catch (error) {
          // ignore unknown templates for now
        }
      }
    }

    if (active.event.escalation) {
      const baseContext = buildContextFromOrigin(active.event.origin, regions, estates);
      baseContext.treasury = resources.gold;
      for (const escalation of active.event.escalation) {
        if (Math.random() < escalation.chance) {
          try {
            followUps.push(createEventFromTemplate(escalation.followUp as any, baseContext));
          } catch (error) {
            // ignore unknown templates
          }
        }
      }
    }

    if (followUps.length > 0) {
      enqueueEvents(activeEvents, followUps, quarter);
    }

    outcomes.push({
      event: active.event,
      status: "resolved",
      selectedOptionId: option.id,
      appliedEffects,
      notes: resolution.notes,
      resolutionMode,
      advisorPreview,
    });

    adjustAdvisorTrust(trust, severityWeight(active.event));
    adjustEstateTrust(trust, active.event.origin?.estateName, 0.025);

    activeEvents.splice(index, 1);
    index -= 1;
  }

  return outcomes;
}

interface ControlRuntimeState {
  currentMode: CampaignControlMode;
  currentStrategy: EventDecisionStrategy;
  strategies: Record<CampaignControlMode, EventDecisionStrategy>;
  pendingTransitions: ControlModeTransition[];
  history: ControlModeLogEntry[];
}

function buildControlStrategies(
  settings: CampaignControlSettings | undefined,
  fallback: EventDecisionStrategy
): Record<CampaignControlMode, EventDecisionStrategy> {
  return {
    manual: settings?.strategies?.manual ?? manualControlDecisionStrategy,
    advisor: settings?.strategies?.advisor ?? fallback,
    hybrid: settings?.strategies?.hybrid ?? hybridControlDecisionStrategy,
  };
}

function initializeControlRuntimeState(
  settings: CampaignControlSettings | undefined,
  fallback: EventDecisionStrategy
): ControlRuntimeState {
  const strategies = buildControlStrategies(settings, fallback);
  const initialMode: CampaignControlMode = settings?.initialMode ?? "advisor";
  const pendingTransitions = [...(settings?.transitions ?? [])]
    .map((transition) => ({ ...transition }))
    .sort((a, b) => a.quarter - b.quarter);

  return {
    currentMode: initialMode,
    currentStrategy: strategies[initialMode] ?? fallback,
    strategies,
    pendingTransitions,
    history: [],
  };
}

function logControlModeChange(
  state: ControlRuntimeState,
  quarter: number,
  reason?: string,
  triggeredBy?: string
): ControlModeLogEntry {
  const entry: ControlModeLogEntry = {
    quarter,
    mode: state.currentMode,
    timestamp: new Date().toISOString(),
    reason,
    triggeredBy,
  };
  state.history.push(entry);
  return entry;
}

function setControlMode(
  state: ControlRuntimeState,
  mode: CampaignControlMode,
  quarter: number,
  reason?: string,
  triggeredBy?: string
) {
  if (state.currentMode === mode) {
    return false;
  }

  state.currentMode = mode;
  state.currentStrategy = state.strategies[mode] ?? state.currentStrategy;
  logControlModeChange(state, quarter, reason, triggeredBy);
  return true;
}

function applyScheduledTransitions(state: ControlRuntimeState, quarter: number) {
  if (state.pendingTransitions.length === 0) {
    return;
  }

  while (state.pendingTransitions.length > 0 && state.pendingTransitions[0].quarter <= quarter) {
    const transition = state.pendingTransitions.shift()!;
    setControlMode(
      state,
      transition.mode,
      quarter,
      transition.reason,
      transition.triggeredBy ?? "расписание"
    );
  }
}

type KPIMetric = keyof KPIReport;

function determineThreatLevel(metric: KPIMetric, value: number): ThreatLevel {
  switch (metric) {
    case "stability":
      if (value < 50) {
        return "critical";
      }
      if (value < 65) {
        return "moderate";
      }
      return "low";
    case "economicGrowth":
      if (value < -8) {
        return "critical";
      }
      if (value < 0) {
        return "moderate";
      }
      return "low";
    case "securityIndex":
      if (value < 40) {
        return "critical";
      }
      if (value < 60) {
        return "moderate";
      }
      return "low";
    case "activeCrises":
      if (value >= 3) {
        return "critical";
      }
      if (value >= 1) {
        return "moderate";
      }
      return "low";
    default:
      return "low";
  }
}

function createKPIEntry(
  metric: KPIMetric,
  value: number,
  previous: number | null
): KPIEntry {
  const normalizedValue = Number(value.toFixed(2));
  const trend = previous === null ? 0 : Number((value - previous).toFixed(2));
  const threatLevel = determineThreatLevel(metric, normalizedValue);
  return { value: normalizedValue, trend, threatLevel };
}

function calculateRegionIncome(
  region: Region,
  decreeTaxModifier: number,
  economyEfficiency: number,
  scienceEfficiency: number,
  decreePriority: InvestmentPriority,
  timeMultiplier: number,
  stabilityModifier: number
): ResourcePool {
  const loyaltyFactor = clamp(region.loyalty / 100 + stabilityModifier * 0.01, 0.3, 1.3);
  const infrastructureFactor = 1 + region.infrastructure / 120;
  const specializationFactor = priorityDevelopmentMultiplier(
    decreePriority,
    region.specialization
  );
  const wealthContribution = region.wealth * 0.015 * (1 + economyEfficiency * 0.05);
  const gold =
    (region.resourceOutput.gold * infrastructureFactor * loyaltyFactor + wealthContribution) *
    decreeTaxModifier *
    specializationFactor;

  const influence =
    (region.resourceOutput.influence * loyaltyFactor + scienceEfficiency * 1.2) *
    specializationFactor;

  const labor =
    region.resourceOutput.labor * (1 + region.population / 2_000_000) * specializationFactor;

  return scaleResources({ gold, influence, labor }, timeMultiplier);
}

function normalizeAllocationWithDecree(
  advisor: Advisor,
  context: AdvisorContext,
  priority: InvestmentPriority,
  agendaWeights?: Record<Department, number>
): Record<Department, number> {
  const allocation = advisor.allocateBudget(context);
  const weighted: Record<Department, number> = {} as Record<Department, number>;
  let total = 0;
  for (const department of DEPARTMENTS) {
    const base = allocation[department] ?? 0;
    const agendaWeight = agendaWeights?.[department] ?? 1;
    const boosted = base * priorityBudgetBoost(priority, department) * agendaWeight;
    weighted[department] = boosted;
    total += boosted;
  }

  if (total <= 0) {
    const share = 1 / DEPARTMENTS.length;
    for (const department of DEPARTMENTS) {
      weighted[department] = share;
    }
    return weighted;
  }

  for (const department of DEPARTMENTS) {
    weighted[department] = weighted[department] / total;
  }

  return weighted;
}

function updateDepartmentState(
  departments: DepartmentState[],
  spending: Record<Department, number>,
  baseBudget: number,
  priority: InvestmentPriority,
  timeMultiplier: number,
  plan: StrategicPlanState,
  council: CouncilMemberState[]
) {
  for (const department of departments) {
    const spent = spending[department.name] ?? 0;
    department.budget = spent;
    department.cumulativeInvestment += spent;
    const investmentRatio = spent / baseBudget;
    const priorityBonus = priorityBudgetBoost(priority, department.name) - 1;
    const strategicBonus = priorityWeight(plan.priorities[department.name]) - 1;
    const councilSupport = council
      .filter((member) => portfolioDepartments(member.portfolio).includes(department.name))
      .reduce((acc, member) => acc + member.competence * 0.02 + (member.motivation - 0.5) * 0.015 - member.stress * 0.01, 0);
    const delta =
      (investmentRatio * 0.08 + priorityBonus * 0.02 + strategicBonus * 0.015 + councilSupport - 0.01) *
      timeMultiplier;
    department.efficiency = clamp(department.efficiency + delta, 0.6, 2.5);
  }
}

function updateRegions(
  regions: Region[],
  spending: Record<Department, number>,
  decreePriority: InvestmentPriority,
  loyaltyModifier: number,
  timeMultiplier: number
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const economySpend = spending.economy ?? 0;
  const internalSpend = spending.internal ?? 0;
  const militarySpend = spending.military ?? 0;
  const scienceSpend = spending.science ?? 0;

  for (const region of regions) {
    const infrastructureGain =
      (economySpend * 0.03 + scienceSpend * 0.01) *
      priorityDevelopmentMultiplier(decreePriority, region.specialization) *
      timeMultiplier;
    if (infrastructureGain > 0.01) {
      const before = region.infrastructure;
      region.infrastructure = clamp(region.infrastructure + infrastructureGain, 0, 120);
      if (Math.floor(before / 5) !== Math.floor(region.infrastructure / 5)) {
        events.push(
          createInfrastructureMilestoneEvent(region, region.infrastructure)
        );
      }
    }

    const wealthGain =
      economySpend * 0.04 * (1 + region.infrastructure / 100) * timeMultiplier;
    region.wealth = Math.max(10, region.wealth + wealthGain - 0.5 * timeMultiplier);

    const loyaltyShift =
      ((internalSpend * 0.02 + militarySpend * 0.015) * loyaltyModifier -
        economySpend * 0.005) * timeMultiplier;
    const loyaltyBase = region.loyalty * Math.pow(loyaltyModifier, timeMultiplier);
    region.loyalty = clamp(loyaltyBase + loyaltyShift, 20, 100);

    if (region.loyalty < 45) {
      events.push(createLoyaltyDeclineEvent(region, region.loyalty));
    }
  }

  return events;
}

function updateEstates(
  estates: Estate[],
  spending: Record<Department, number>,
  taxPolicy: TaxPolicy,
  timeMultiplier: number
): SimulationEvent[] {
  const events: SimulationEvent[] = [];

  for (const estate of estates) {
    const favoredSpend = spending[estate.favoredDepartment] ?? 0;
    const satisfactionDelta =
      (favoredSpend * 0.1 + taxSatisfactionDelta(taxPolicy, estate.name)) *
      timeMultiplier;
    estate.satisfaction = clamp(
      estate.satisfaction + satisfactionDelta - timeMultiplier,
      10,
      90
    );

    const influenceDelta = (favoredSpend * 0.02 - 0.1) * timeMultiplier;
    estate.influence = clamp(estate.influence + influenceDelta, 5, 40);

    if (estate.satisfaction < 35) {
      events.push(createEstateDissatisfactionEvent(estate, estate.satisfaction));
    }
  }

  return events;
}

function snapshotEstates(estates: Estate[]) {
  return estates.map((estate) => ({
    name: estate.name,
    satisfaction: Number(estate.satisfaction.toFixed(1)),
    influence: Number(estate.influence.toFixed(1)),
  }));
}

function snapshotRegions(regions: Region[]) {
  return regions.map((region) => ({
    name: region.name,
    wealth: Number(region.wealth.toFixed(1)),
    loyalty: Number(region.loyalty.toFixed(1)),
    infrastructure: Number(region.infrastructure.toFixed(1)),
  }));
}

function sumResourcePools(values: ResourcePool[]): ResourcePool {
  return values.reduce<ResourcePool>(
    (acc, value) => ({
      gold: acc.gold + value.gold,
      influence: acc.influence + value.influence,
      labor: acc.labor + value.labor,
    }),
    { gold: 0, influence: 0, labor: 0 }
  );
}

export function runSimulation(config: SimulationConfig): SimulationResult {
  const resources = cloneResources(config.initialResources);
  const regions: Region[] = config.regions.map((region) => ({ ...region }));
  const estates: Estate[] = config.estates.map((estate) => ({ ...estate }));
  const departments: DepartmentState[] = config.departments.map((department) => ({ ...department }));
  const trust = initializeTrustLevels(estates, config.initialTrust);
  const modifiers: GlobalModifiers = {
    stability: 0,
    threat: 0,
    budget: 0,
    reputation: {},
    securityPressure: 0,
    securityEscalationStage: 0,
    securityRecovery: 0,
  };
  const timedEffects: TimedEffect[] = [];
  const activeEvents: ActiveEvent[] = [];
  const planState = initializeStrategicPlan(config.agenda);
  const councilState = initializeCouncilState(config.council);
  const responsePosture = config.responsePosture;

  const reports: QuarterlyReport[] = [];
  let totalIncomes: ResourcePool = { gold: 0, influence: 0, labor: 0 };
  let totalExpenses: QuarterlyExpenses = {
    departments: Object.fromEntries(DEPARTMENTS.map((department) => [department, 0])) as Record<Department, number>,
    total: 0,
  };
  const interventionLog: EventInterventionLogEntry[] = [];

  let previousTotalWealth = regions.reduce((acc, region) => acc + region.wealth, 0);
  let previousStability: number | null = null;
  let previousGrowth: number | null = null;
  let previousSecurity: number | null = null;
  let previousCrises: number | null = null;
  let latestKPI: KPIReport | null = null;

  const fallbackDecisionStrategy: EventDecisionStrategy =
    config.eventDecisionStrategy ?? defaultDecisionStrategy;
  const controlRuntime = initializeControlRuntimeState(
    config.controlSettings,
    fallbackDecisionStrategy
  );
  if (config.quarters > 0) {
    logControlModeChange(controlRuntime, 1, "Стартовый режим кампании", "initial");
  }

  for (let quarter = 1; quarter <= config.quarters; quarter += 1) {
    applyScheduledTransitions(controlRuntime, quarter);
    applyTimedEffects(timedEffects, resources, regions, estates, modifiers);

    const decreeTaxModifier = taxIncomeModifier(config.decree.taxPolicy);
    const loyaltyModifier = taxLoyaltyModifier(config.decree.taxPolicy);
    const economyEfficiency = departments.find((d) => d.name === "economy")?.efficiency ?? 1;
    const scienceEfficiency = departments.find((d) => d.name === "science")?.efficiency ?? 1;

    const incomes = sumResourcePools(
      regions.map((region) =>
        calculateRegionIncome(
          region,
          decreeTaxModifier,
          economyEfficiency,
          scienceEfficiency,
          config.decree.investmentPriority,
          QUARTER_DURATION,
          modifiers.stability
        )
      )
    );

    totalIncomes = addResources(totalIncomes, incomes);
    const newResources = addResources(resources, incomes);
    resources.gold = newResources.gold;
    resources.influence = newResources.influence;
    resources.labor = newResources.labor;

    assignMandatesToCouncil(planState, councilState);
    const agendaWeights = calculateAgendaBudgetWeights(planState, councilState);

    const advisorContext: AdvisorContext = {
      resources,
      estates,
      departments,
      decree: config.decree,
      trust: cloneTrustLevels(trust),
      agenda: cloneStrategicPlan(planState),
      council: cloneCouncilState(councilState),
    };

    const allocation = normalizeAllocationWithDecree(
      config.advisor,
      advisorContext,
      config.decree.investmentPriority,
      agendaWeights
    );

    const effectiveBaseBudget = Math.max(60, config.baseQuarterBudget + modifiers.budget);
    const availableBudget = Math.min(effectiveBaseBudget, resources.gold * 0.7);
    const spending: Record<Department, number> = {} as Record<Department, number>;
    let plannedTotal = 0;

    for (const department of DEPARTMENTS) {
      const value = allocation[department] * availableBudget;
      spending[department] = value;
      plannedTotal += value;
    }

    if (plannedTotal > resources.gold) {
      const ratio = resources.gold / plannedTotal;
      for (const department of DEPARTMENTS) {
        spending[department] *= ratio;
      }
      plannedTotal = resources.gold;
    }

    const expenses: QuarterlyExpenses = {
      departments: Object.fromEntries(
        DEPARTMENTS.map((department) => [department, Number(spending[department].toFixed(2))])
      ) as Record<Department, number>,
      total: Number(plannedTotal.toFixed(2)),
    };

    totalExpenses.total += expenses.total;
    for (const department of DEPARTMENTS) {
      totalExpenses.departments[department] =
        (totalExpenses.departments[department] ?? 0) + expenses.departments[department];
    }

    resources.gold = Math.max(0, resources.gold - expenses.total);

    updateDepartmentState(
      departments,
      spending,
      effectiveBaseBudget,
      config.decree.investmentPriority,
      QUARTER_DURATION,
      planState,
      councilState
    );

    updateProjectsProgress(planState.projects, spending, effectiveBaseBudget);

    const regionEvents = updateRegions(
      regions,
      spending,
      config.decree.investmentPriority,
      loyaltyModifier,
      QUARTER_DURATION
    );
    const estateEvents = updateEstates(
      estates,
      spending,
      config.decree.taxPolicy,
      QUARTER_DURATION
    );

    const generatedEvents: SimulationEvent[] = [...regionEvents, ...estateEvents];
    if (resources.gold < effectiveBaseBudget * 0.3) {
      generatedEvents.push(createTreasuryDepletionEvent(resources.gold));
    }

    const quarterEvents = resolveEventsForQuarter(
      quarter,
      activeEvents,
      generatedEvents,
      controlRuntime.currentStrategy,
      () => ({
        quarter,
        resources: { ...resources },
        estates: estates.map((estate) => ({ ...estate })),
        regions: regions.map((region) => ({ ...region })),
        departments: departments.map((department) => ({ ...department })),
        trust: cloneTrustLevels(trust),
        kpis: latestKPI,
        posture: responsePosture.default,
        agenda: cloneStrategicPlan(planState),
        council: cloneCouncilState(councilState),
      }),
      resources,
      regions,
      estates,
      modifiers,
      timedEffects,
      trust,
      responsePosture,
      config.eventInterventionHandler,
      interventionLog
    );

    const averageLoyaltyRaw =
      regions.reduce((acc, region) => acc + region.loyalty, 0) / regions.length;
    const averageLoyalty = clamp(averageLoyaltyRaw + modifiers.stability, 0, 100);
    const totalWealth = regions.reduce((acc, region) => acc + region.wealth, 0);
    const economicGrowth = totalWealth - previousTotalWealth;
    const militarySpend = spending.military ?? 0;
    const militaryShare = (militarySpend / Math.max(1, effectiveBaseBudget)) * 100;
    const minLoyalty = Math.min(...regions.map((region) => region.loyalty));
    const threatPenalty = Math.max(0, modifiers.threat) * 5;
    const securityIndex = clamp(
      Math.min(minLoyalty, Math.min(100, militaryShare)) - threatPenalty,
      0,
      100
    );
    const activeCrises =
      activeEvents.filter((event) => event.event.severity !== "minor").length;

    const kpis: KPIReport = {
      stability: createKPIEntry("stability", averageLoyalty, previousStability),
      economicGrowth: createKPIEntry("economicGrowth", economicGrowth, previousGrowth),
      securityIndex: createKPIEntry("securityIndex", securityIndex, previousSecurity),
      activeCrises: createKPIEntry("activeCrises", activeCrises, previousCrises),
    };

    previousTotalWealth = totalWealth;
    previousStability = kpis.stability.value;
    previousGrowth = kpis.economicGrowth.value;
    previousSecurity = kpis.securityIndex.value;
    previousCrises = kpis.activeCrises.value;
    latestKPI = kpis;

    const kpiTriggeredEvents = [
      ...generateKpiEvents(kpis, regions),
      ...evaluateSecurityEscalation(kpis, regions, modifiers),
    ];
    if (kpiTriggeredEvents.length > 0) {
      enqueueEvents(activeEvents, kpiTriggeredEvents, quarter);
      for (const event of kpiTriggeredEvents) {
        quarterEvents.push({
          event,
          status: "deferred",
          selectedOptionId: null,
          appliedEffects: [],
          notes: "Сформировано системой раннего предупреждения",
        });
      }
    }

    const mandateReports = evaluateMandates(
      planState,
      quarter,
      resources,
      regions,
      estates,
      departments,
      kpis
    );
    adjustCouncilMorale(councilState, mandateReports);
    const councilReports = generateCouncilReports(councilState, mandateReports, agendaWeights);
    const agendaHighlights = buildAgendaHighlights(planState, agendaWeights);

    updateEstateTrust(trust, estates);

    const hasFailures = quarterEvents.some((entry) => entry.status === "failed");
    if (hasFailures) {
      adjustAdvisorTrust(trust, -0.02);
    } else if (quarterEvents.some((entry) => entry.status === "resolved" && entry.event.severity !== "minor")) {
      adjustAdvisorTrust(trust, 0.01);
    }

    if (kpis.stability.trend > 0) {
      adjustAdvisorTrust(trust, 0.005);
    } else if (kpis.stability.trend < 0) {
      adjustAdvisorTrust(trust, -0.005);
    }

    const trustSnapshot = cloneTrustLevels(trust);

    reports.push({
      quarter,
      incomes: {
        gold: Number(incomes.gold.toFixed(2)),
        influence: Number(incomes.influence.toFixed(2)),
        labor: Number(incomes.labor.toFixed(2)),
      },
      expenses,
      treasury: {
        gold: Number(resources.gold.toFixed(2)),
        influence: Number(resources.influence.toFixed(2)),
        labor: Number(resources.labor.toFixed(2)),
      },
      estates: snapshotEstates(estates),
      regions: snapshotRegions(regions),
      events: quarterEvents,
      kpis,
      trust: trustSnapshot,
      activeThreatLevel: Number(modifiers.threat.toFixed(2)),
      councilReports,
      mandateProgress: mandateReports,
      agendaHighlights,
      controlMode: controlRuntime.currentMode,
    });

    modifiers.stability = Number((modifiers.stability * 0.85).toFixed(2));
    modifiers.threat = Number((modifiers.threat * 0.9).toFixed(2));
    modifiers.budget = Number((modifiers.budget * 0.75).toFixed(2));
    modifiers.securityPressure = Number(
      Math.max(0, modifiers.securityPressure * 0.92).toFixed(2)
    );
    for (const key of Object.keys(modifiers.reputation)) {
      modifiers.reputation[key] = Number((modifiers.reputation[key] * 0.9).toFixed(2));
    }
  }

  const kpiAverages = reports.reduce(
    (acc, report) => {
      acc.stability += report.kpis.stability.value;
      acc.economicGrowth += report.kpis.economicGrowth.value;
      acc.securityIndex += report.kpis.securityIndex.value;
      acc.activeCrises += report.kpis.activeCrises.value;
      return acc;
    },
    { stability: 0, economicGrowth: 0, securityIndex: 0, activeCrises: 0 }
  );

  if (reports.length > 0) {
    kpiAverages.stability = Number((kpiAverages.stability / reports.length).toFixed(2));
    kpiAverages.economicGrowth = Number((kpiAverages.economicGrowth / reports.length).toFixed(2));
    kpiAverages.securityIndex = Number((kpiAverages.securityIndex / reports.length).toFixed(2));
    kpiAverages.activeCrises = Number((kpiAverages.activeCrises / reports.length).toFixed(2));
  }

  return {
    reports,
    kpiSummary: {
      latest: reports[reports.length - 1]?.kpis ?? null,
      averages: kpiAverages,
    },
    totals: {
      incomes: {
        gold: Number(totalIncomes.gold.toFixed(2)),
        influence: Number(totalIncomes.influence.toFixed(2)),
        labor: Number(totalIncomes.labor.toFixed(2)),
      },
      expenses: {
        departments: Object.fromEntries(
          DEPARTMENTS.map((department) => [
            department,
            Number((totalExpenses.departments[department] ?? 0).toFixed(2)),
          ])
        ) as Record<Department, number>,
        total: Number(totalExpenses.total.toFixed(2)),
      },
    },
    finalState: {
      resources: {
        gold: Number(resources.gold.toFixed(2)),
        influence: Number(resources.influence.toFixed(2)),
        labor: Number(resources.labor.toFixed(2)),
      },
      regions,
      estates,
      departments,
      trust: cloneTrustLevels(trust),
      activeThreatLevel: Number(modifiers.threat.toFixed(2)),
      council: cloneCouncilState(councilState),
      plan: cloneStrategicPlan(planState),
      controlMode: controlRuntime.currentMode,
    },
    interventionLog: interventionLog.map((entry) => ({ ...entry })),
    controlState: {
      currentMode: controlRuntime.currentMode,
      history: controlRuntime.history.map((entry) => ({ ...entry })),
    },
  };
}
