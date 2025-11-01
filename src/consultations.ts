import {
  AdvisorConsultationResponse,
  AdvisorConsultationStance,
  AdvisorConsultationThread,
  AdvisorConsultationQueryType,
  CouncilMemberState,
  CouncilPortfolio,
  Department,
  EventDecisionContext,
  EventOutcome,
  KPIEntry,
  KPIReport,
  SimulationEventEffect,
  ThreatLevel,
} from "./types";

const KPI_LABELS: Record<keyof KPIReport, { label: string; department: Department }> = {
  stability: { label: "Стабильность", department: "internal" },
  economicGrowth: { label: "Экономический рост", department: "economy" },
  securityIndex: { label: "Индекс безопасности", department: "military" },
  activeCrises: { label: "Активные кризисы", department: "internal" },
};

const DEPARTMENT_LABELS: Record<Department, string> = {
  economy: "Экономика",
  diplomacy: "Дипломатия",
  internal: "Внутренняя политика",
  military: "Военное ведомство",
  science: "Наука",
};

const THREAT_VALUE: Record<ThreatLevel, number> = { low: 0, moderate: 1, critical: 2 };

const SEVERITY_WEIGHT: Record<string, number> = { minor: 1, moderate: 2, major: 3 };
const STATUS_WEIGHT: Record<string, number> = { resolved: 2, failed: 3, deferred: 1 };

function formatTrend(entry: KPIEntry): string {
  const value = entry.trend;
  if (value > 0) {
    return `+${value.toFixed(2)}`;
  }
  return value.toFixed(2);
}

function determineKpiStance(entry: KPIEntry): AdvisorConsultationStance {
  if (entry.threatLevel === "critical" || entry.trend < -0.25) {
    return "escalate";
  }
  if (entry.threatLevel === "moderate" || entry.trend < -0.05) {
    return "caution";
  }
  return "support";
}

function determineDepartmentStance(efficiency: number, trend?: number): AdvisorConsultationStance {
  if (efficiency < 0.95 || (trend !== undefined && trend < -0.05)) {
    return "escalate";
  }
  if (efficiency < 1.1) {
    return "caution";
  }
  return "support";
}

function determineEventStance(outcome: EventOutcome): AdvisorConsultationStance {
  if (outcome.status === "failed" || outcome.event.severity === "major") {
    return "escalate";
  }
  if (outcome.event.severity === "moderate" || outcome.status === "deferred") {
    return "caution";
  }
  return "support";
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

function pickAdvisorsForDepartment(
  council: CouncilMemberState[] | undefined,
  department: Department | null,
  limit = 3
): CouncilMemberState[] {
  if (!council || council.length === 0) {
    return [];
  }

  if (!department) {
    return [...council].sort((a, b) => b.competence - a.competence).slice(0, limit);
  }

  const specialized = council
    .filter((member) => portfolioDepartments(member.portfolio).includes(department))
    .sort((a, b) => b.competence - a.competence);

  if (specialized.length >= Math.min(limit, 1)) {
    return specialized.slice(0, limit);
  }

  const fallback = [...council].sort((a, b) => b.competence - a.competence);
  return [...new Set([...specialized, ...fallback])].slice(0, limit);
}

function uniqueStrings(entries: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    seen.add(entry);
  }
  return Array.from(seen);
}

function inferDepartmentFromEffects(effects: SimulationEventEffect[]): Department | null {
  for (const effect of effects) {
    switch (effect.type) {
      case "treasury":
      case "wealth":
      case "infrastructure":
        return "economy";
      case "reputation":
      case "influence":
        return "diplomacy";
      case "loyalty":
      case "stability":
      case "unrest":
        return "internal";
      case "threat":
      case "securityPressure":
        return "military";
      case "science":
        return "science";
      default:
        break;
    }
  }
  return null;
}

function inferDepartmentForOutcome(
  outcome: EventOutcome,
  context: EventDecisionContext
): Department | null {
  const effects: SimulationEventEffect[] = [...(outcome.appliedEffects ?? [])];

  if (outcome.selectedOptionId) {
    const option = outcome.event.options.find((candidate) => candidate.id === outcome.selectedOptionId);
    if (option) {
      effects.push(...(option.effects ?? []));
    }
  }

  const effectDepartment = inferDepartmentFromEffects(effects);
  if (effectDepartment) {
    return effectDepartment;
  }

  if (outcome.event.origin?.estateName) {
    const estate = context.estates.find((entry) => entry.name === outcome.event.origin?.estateName);
    if (estate) {
      return estate.favoredDepartment;
    }
  }

  return null;
}

function aggregateThreadSummary(
  type: AdvisorConsultationQueryType,
  topic: string,
  responses: AdvisorConsultationResponse[]
): string {
  const escalations = responses.filter((response) => response.stance === "escalate").length;
  const cautions = responses.filter((response) => response.stance === "caution").length;

  if (escalations > 0) {
    return `${topic}: требуется вмешательство — ${escalations} советник(ов) требуют немедленных действий.`;
  }
  if (cautions > 0) {
    return `${topic}: совет держит ситуацию под контролем, но просит дополнительного внимания.`;
  }
  return `${topic}: совет подтверждает устойчивость и рекомендует закрепить успех.`;
}

function buildKpiThread(context: EventDecisionContext): AdvisorConsultationThread | null {
  if (!context.kpis) {
    return null;
  }

  const ranked = (Object.keys(KPI_LABELS) as Array<keyof KPIReport>)
    .map((key) => ({ key, entry: context.kpis![key], meta: KPI_LABELS[key] }))
    .sort((a, b) => {
      const diff = THREAT_VALUE[b.entry.threatLevel] - THREAT_VALUE[a.entry.threatLevel];
      if (diff !== 0) {
        return diff;
      }
      return Math.abs(b.entry.trend) - Math.abs(a.entry.trend);
    });

  const focus = ranked[0];
  if (!focus) {
    return null;
  }

  const advisors = pickAdvisorsForDepartment(context.council, focus.meta.department, 3);

  const responses: AdvisorConsultationResponse[] = advisors.map((advisor) => {
    const stance = determineKpiStance(focus.entry);
    const estate = context.estates.find((entry) => entry.favoredDepartment === focus.meta.department);
    const estateTrust = estate ? context.trust.estates[estate.name] ?? 0.5 : null;

    const rationale: string[] = [
      `Значение ${focus.entry.value.toFixed(2)} с трендом ${formatTrend(focus.entry)} и уровнем угрозы ${focus.entry.threatLevel}.`,
      `Ресурсы казны: ${context.resources.gold.toFixed(0)} зол., влияние ${context.resources.influence.toFixed(0)}.`,
    ];

    if (estate && estateTrust !== null) {
      rationale.push(
        `Сословие «${estate.name}» ожидает мер (доверие ${Math.round(estateTrust * 100)}%).`
      );
    }

    const recommendedAction =
      stance === "escalate"
        ? `Немедленно перераспределить бюджет в пользу направления «${DEPARTMENT_LABELS[focus.meta.department]}» и задействовать резервы.`
        : stance === "caution"
        ? `Зафиксировать контрольные точки и выделить до 10% дополнительного финансирования в «${DEPARTMENT_LABELS[focus.meta.department]}».`
        : `Подтвердить текущий курс и закрепить улучшения через проекты «${DEPARTMENT_LABELS[focus.meta.department]}».`;

    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      stance,
      summary: `${advisor.name} оценивает показатель как ${
        stance === "escalate" ? "критический" : stance === "caution" ? "нестабильный" : "стабильный"
      }.`,
      rationale,
      recommendedAction,
      kpiFocus: focus.key,
    };
  });

  const topic = `КПИ: ${focus.meta.label}`;

  return {
    id: `kpi:${focus.key}`,
    type: "kpi",
    topic,
    prompt: `Запросить советы по показателю «${focus.meta.label}».`,
    summary: aggregateThreadSummary("kpi", topic, responses),
    responses,
    recommendations: uniqueStrings(responses.map((response) => response.recommendedAction)),
    handoffTarget: `Координационный штаб: ${DEPARTMENT_LABELS[focus.meta.department]}`,
    handoffIssued: false,
    relatedKpi: focus.key,
    relatedDepartment: focus.meta.department,
  };
}

function buildEventThread(
  context: EventDecisionContext,
  events: EventOutcome[]
): AdvisorConsultationThread | null {
  if (events.length === 0) {
    return null;
  }

  const prioritized = [...events]
    .filter((entry) => entry.event)
    .sort((a, b) => {
      const severity = (SEVERITY_WEIGHT[b.event.severity] ?? 0) - (SEVERITY_WEIGHT[a.event.severity] ?? 0);
      if (severity !== 0) {
        return severity;
      }
      return (STATUS_WEIGHT[b.status] ?? 0) - (STATUS_WEIGHT[a.status] ?? 0);
    });

  const focus = prioritized[0];
  if (!focus) {
    return null;
  }

  const relatedDepartment = inferDepartmentForOutcome(focus, context);
  const advisors = pickAdvisorsForDepartment(context.council, relatedDepartment, 3);
  const stance = determineEventStance(focus);

  const responses: AdvisorConsultationResponse[] = advisors.map((advisor) => {
    const rationale: string[] = [
      `Событие ${focus.event.severity} серьёзности со статусом «${focus.status}».`,
    ];

    if (focus.event.origin?.regionName) {
      rationale.push(`Регион: ${focus.event.origin.regionName}.`);
    }
    if (focus.event.origin?.estateName) {
      rationale.push(`Задействовано сословие: ${focus.event.origin.estateName}.`);
    }
    if (focus.notes) {
      rationale.push(`Заметка: ${focus.notes}.`);
    }

    const recommendedAction =
      stance === "escalate"
        ? `Эскалировать инцидент и назначить оперативный штаб «${
            relatedDepartment ? DEPARTMENT_LABELS[relatedDepartment] : "советника"
          }».`
        : stance === "caution"
        ? `Поручить мониторинг и подготовить план реагирования для «${
            relatedDepartment ? DEPARTMENT_LABELS[relatedDepartment] : "совета"
          }».`
        : `Закрепить результат и распространить успешные практики через «${
            relatedDepartment ? DEPARTMENT_LABELS[relatedDepartment] : "совет"
          }».`;

    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      stance,
      summary: `${advisor.name} предлагает ${
        stance === "escalate" ? "немедленное вмешательство" : stance === "caution" ? "усиленный контроль" : "поддержание курса"
      }.`,
      rationale,
      recommendedAction,
    };
  });

  const topic = `Событие: ${focus.event.title}`;

  return {
    id: `event:${focus.event.id}`,
    type: "event",
    topic,
    prompt: `Собрать советы по событию «${focus.event.title}».`,
    summary: aggregateThreadSummary("event", topic, responses),
    responses,
    recommendations: uniqueStrings(responses.map((response) => response.recommendedAction)),
    handoffTarget:
      relatedDepartment !== null
        ? `Передать исполнение: ${DEPARTMENT_LABELS[relatedDepartment]}`
        : focus.event.origin?.regionName,
    handoffIssued: false,
    relatedEventId: focus.event.id,
    relatedDepartment: relatedDepartment ?? undefined,
  };
}

function buildDepartmentThread(context: EventDecisionContext): AdvisorConsultationThread | null {
  if (!context.departments || context.departments.length === 0) {
    return null;
  }

  const sorted = [...context.departments].sort((a, b) => a.efficiency - b.efficiency);
  const focus = sorted[0];
  if (!focus) {
    return null;
  }

  const advisors = pickAdvisorsForDepartment(context.council, focus.name, 3);
  const stance = determineDepartmentStance(focus.efficiency);

  const responses: AdvisorConsultationResponse[] = advisors.map((advisor) => {
    const rationale: string[] = [
      `Текущая эффективность ${focus.efficiency.toFixed(2)}, бюджет квартала ${focus.budget.toFixed(1)} золота.`,
      `Совокупные инвестиции: ${focus.cumulativeInvestment.toFixed(1)} золота.`,
    ];

    const estate = context.estates.find((entry) => entry.favoredDepartment === focus.name);
    if (estate) {
      rationale.push(
        `Сословие «${estate.name}» оценивает ситуацию на уровне ${Math.round(estate.satisfaction)} ед.`
      );
    }

    const recommendedAction =
      stance === "escalate"
        ? `Назначить кризисную команду и усилить финансирование «${DEPARTMENT_LABELS[focus.name]}».`
        : stance === "caution"
        ? `Провести аудит процессов и сохранить дополнительный резерв для «${DEPARTMENT_LABELS[focus.name]}».`
        : `Зафиксировать рост эффективности и расширить программы «${DEPARTMENT_LABELS[focus.name]}».`;

    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      stance,
      summary: `${advisor.name} ${
        stance === "escalate" ? "просит вмешательства" : stance === "caution" ? "предупреждает о рисках" : "поддерживает текущую стратегию"
      }.`,
      rationale,
      recommendedAction,
    };
  });

  const topic = `Ведомство: ${DEPARTMENT_LABELS[focus.name]}`;

  return {
    id: `department:${focus.name}`,
    type: "department",
    topic,
    prompt: `Уточнить план действий для ведомства «${DEPARTMENT_LABELS[focus.name]}».`,
    summary: aggregateThreadSummary("department", topic, responses),
    responses,
    recommendations: uniqueStrings(responses.map((response) => response.recommendedAction)),
    handoffTarget: `Передать исполнение: ${DEPARTMENT_LABELS[focus.name]}`,
    handoffIssued: false,
    relatedDepartment: focus.name,
  };
}

export function generateAdvisorConsultations(
  context: EventDecisionContext,
  events: EventOutcome[]
): AdvisorConsultationThread[] {
  const threads: AdvisorConsultationThread[] = [];

  const kpiThread = buildKpiThread(context);
  if (kpiThread) {
    threads.push(kpiThread);
  }

  const eventThread = buildEventThread(context, events);
  if (eventThread) {
    threads.push(eventThread);
  }

  const departmentThread = buildDepartmentThread(context);
  if (departmentThread) {
    threads.push(departmentThread);
  }

  return threads;
}
