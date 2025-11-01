import { buildBaselineConfig } from "./config";
import { runSimulation } from "./simulation";
import {
  AgendaHighlight,
  CampaignControlMode,
  ControlModeLogEntry,
  CouncilReport,
  KPIEntry,
  KPIReport,
  MandateProgressReport,
  MandateStatus,
  InterventionDecisionMode,
  SimulationEventEffect,
  SimulationEvent,
  ThreatLevel,
} from "./types";
import { saveSimulationResult } from "./persistence";

function formatEffects(effects: SimulationEventEffect[]): string {
  if (effects.length === 0) {
    return "";
  }
  return effects
    .map((effect) => {
      const duration = effect.duration ? ` (на ${effect.duration} хода)` : "";
      const valueSign = effect.value > 0 ? "+" : "";
      return `${effect.type} → ${effect.target}: ${valueSign}${effect.value}${duration}`;
    })
    .join("; ");
}

function describeOption(event: SimulationEvent, optionId: string | null | undefined): string | null {
  if (!optionId) {
    return null;
  }
  const match = event.options.find((candidate) => candidate.id === optionId);
  return match?.description ?? null;
}

function describeResolutionMode(mode: InterventionDecisionMode | undefined): string {
  switch (mode) {
    case "player":
      return "Игрок";
    case "council":
      return "Совет";
    default:
      return "Авто";
  }
}

function describeControlMode(mode: CampaignControlMode): string {
  switch (mode) {
    case "manual":
      return "🎯 ручной";
    case "hybrid":
      return "♟ гибрид";
    case "advisor":
    default:
      return "🧠 совет";
  }
}

function formatControlLogEntry(entry: ControlModeLogEntry): string {
  const time = new Date(entry.timestamp);
  const timeLabel = Number.isNaN(time.getTime())
    ? entry.timestamp
    : new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(time);
  const reason = entry.reason ? ` — ${entry.reason}` : "";
  const triggered = entry.triggeredBy ? ` (${entry.triggeredBy})` : "";
  return `Q${entry.quarter}: ${describeControlMode(entry.mode)}${reason}${triggered} — ${timeLabel}`;
}

function formatTrend(trend: number): string {
  if (trend === 0) {
    return "0";
  }
  const prefix = trend > 0 ? "+" : "";
  const arrow = trend > 0 ? "↑" : "↓";
  return `${arrow} ${prefix}${trend.toFixed(2)}`;
}

function formatTrust(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function describeThreat(level: ThreatLevel): string {
  switch (level) {
    case "critical":
      return "⚠️ критично";
    case "moderate":
      return "⚠ умеренно";
    default:
      return "✅ стабильно";
  }
}

function summarizeKPI(label: string, entry: KPIEntry): string {
  return `${label}: ${entry.value.toFixed(2)} (${formatTrend(entry.trend)}, ${describeThreat(entry.threatLevel)})`;
}

function logKPIBlock(report: KPIReport) {
  console.log("KPI:");
  console.log(` • ${summarizeKPI("Стабильность", report.stability)}`);
  console.log(` • ${summarizeKPI("Экономический рост", report.economicGrowth)}`);
  console.log(` • ${summarizeKPI("Индекс безопасности", report.securityIndex)}`);
  console.log(` • ${summarizeKPI("Активные кризисы", report.activeCrises)}`);
}

function formatMandateStatus(status: MandateStatus): string {
  switch (status) {
    case "completed":
      return "завершено";
    case "on_track":
      return "в графике";
    case "in_progress":
      return "в работе";
    case "at_risk":
      return "под угрозой";
    case "failed":
      return "провалено";
    case "not_started":
    default:
      return "не начато";
  }
}

function logCouncilReports(reports: CouncilReport[]) {
  if (reports.length === 0) {
    return;
  }
  console.log("Советники:");
  for (const report of reports) {
    const confidence = (report.confidence * 100).toFixed(1);
    const focus = report.focusDepartment ? `, фокус: ${report.focusDepartment}` : "";
    console.log(` • ${report.advisorName}${focus} — ${report.summary} (уверенность ${confidence}%)`);
    if (report.alerts && report.alerts.length > 0) {
      for (const alert of report.alerts) {
        console.log(`   ⚠ ${alert}`);
      }
    }
  }
}

function logMandateProgress(entries: MandateProgressReport[]) {
  if (entries.length === 0) {
    return;
  }
  console.log("Поручения правителя:");
  for (const entry of entries) {
    const progress = (entry.progress * 100).toFixed(0);
    console.log(` • ${entry.label} — ${formatMandateStatus(entry.status)} (${progress}%, уверенность ${(entry.confidence * 100).toFixed(0)}%)`);
    console.log(`   ${entry.commentary}`);
  }
}

function logAgendaHighlights(highlights: AgendaHighlight[]) {
  if (highlights.length === 0) {
    return;
  }
  console.log("Приоритеты совета:");
  for (const highlight of highlights) {
    console.log(` • ${highlight.department}: ${highlight.commentary} (режим ${highlight.priority})`);
  }
}

async function main() {
  const config = buildBaselineConfig();

  const result = await runSimulation(config);
  const saveInfo = saveSimulationResult(result, {
    config,
    label: "baseline_cli_run",
  });

  console.log(`Режим кампании: ${describeControlMode(result.controlState.currentMode)}`);
  if (result.controlState.history.length > 0) {
    console.log("Журнал переключений режима:");
    for (const entry of result.controlState.history) {
      console.log(` • ${formatControlLogEntry(entry)}`);
    }
  }

  console.log("=== Ежеквартальный отчёт ===");
  for (const report of result.reports) {
  console.log(`\nКвартал ${report.quarter}`);
  console.log(`Режим управления: ${describeControlMode(report.controlMode)}`);
  console.log(
    `Доходы: золото ${report.incomes.gold.toFixed(1)}, влияние ${report.incomes.influence.toFixed(1)}, рабочая сила ${report.incomes.labor.toFixed(1)}`
  );
  console.log(
    `Расходы: золото ${report.expenses.total.toFixed(1)} (экономика ${report.expenses.departments.economy.toFixed(
      1
    )}, внутренняя политика ${report.expenses.departments.internal.toFixed(1)}, военное ведомство ${report.expenses.departments.military.toFixed(
      1
    )})`
  );
  console.log(
    `Казна: золото ${report.treasury.gold.toFixed(1)}, влияние ${report.treasury.influence.toFixed(1)}, рабочая сила ${report.treasury.labor.toFixed(1)}`
  );
  console.log(
    "Сословия:",
    report.estates
      .map((estate) => `${estate.name}: удовлетворённость ${estate.satisfaction}`)
      .join(", ")
  );
  logKPIBlock(report.kpis);
  console.log(
    `Доверие советника: ${formatTrust(report.trust.advisor)}, индекс угроз: ${report.activeThreatLevel.toFixed(2)}`
  );
  const estatesTrustLine = Object.entries(report.trust.estates)
    .map(([name, value]) => `${name}: ${formatTrust(value)}`)
    .join(", ");
  if (estatesTrustLine) {
    console.log(`Доверие сословий: ${estatesTrustLine}`);
  }

  if (report.events.length > 0) {
    console.log("События:");
    for (const outcome of report.events) {
      const event = outcome.event;
      console.log(` • [${event.severity}] (${event.category}) ${event.title}`);
      console.log(
        `   Статус: ${outcome.status}${outcome.selectedOptionId ? " → " + outcome.selectedOptionId : ""}`
      );
      const contextDetails: string[] = [];
      if (event.origin?.regionName) {
        contextDetails.push(`регион ${event.origin.regionName}`);
      }
      if (event.origin?.estateName) {
        contextDetails.push(`сословие ${event.origin.estateName}`);
      }
      if (contextDetails.length > 0) {
        console.log(`   Контекст: ${contextDetails.join(", ")}`);
      }
      console.log(`   Описание: ${event.description}`);
      if (outcome.resolutionMode) {
        console.log(`   Режим вмешательства: ${describeResolutionMode(outcome.resolutionMode)}`);
      }
      if (outcome.selectedOptionId) {
        const chosenDescription = describeOption(event, outcome.selectedOptionId);
        if (chosenDescription) {
          console.log(`   Выбор: ${chosenDescription}`);
        }
      }
      if (outcome.resolutionMode === "player" && outcome.advisorPreview?.optionId) {
        const previewDescription = describeOption(event, outcome.advisorPreview.optionId);
        if (
          previewDescription &&
          outcome.advisorPreview.optionId !== outcome.selectedOptionId
        ) {
          console.log(`   Совет ожидал: ${previewDescription}`);
        }
        if (outcome.advisorPreview.notes) {
          console.log(`   Комментарий совета: ${outcome.advisorPreview.notes}`);
        }
      } else if (outcome.resolutionMode === "council" && outcome.advisorPreview?.optionId) {
        const previewDescription = describeOption(event, outcome.advisorPreview.optionId);
        if (previewDescription) {
          console.log(`   Совет выбрал: ${previewDescription}`);
        }
        if (outcome.advisorPreview.notes) {
          console.log(`   Обоснование: ${outcome.advisorPreview.notes}`);
        }
      }
      if (outcome.appliedEffects.length > 0) {
        console.log(`   Эффекты: ${formatEffects(outcome.appliedEffects)}`);
      }
      if (outcome.notes) {
        console.log(`   Примечание: ${outcome.notes}`);
      }
      if (outcome.status === "failed") {
        const failureEffects = formatEffects(event.failure.effects);
        if (failureEffects) {
          console.log(`   Последствия провала: ${failureEffects}`);
        }
      }
    }
  }

  logCouncilReports(report.councilReports);
  logMandateProgress(report.mandateProgress);
    logAgendaHighlights(report.agendaHighlights);
  }

  console.log("\n=== Итоги года ===");
  console.log(
    `Совокупный доход: золото ${result.totals.incomes.gold.toFixed(1)}, влияние ${result.totals.incomes.influence.toFixed(
      1
    )}, рабочая сила ${result.totals.incomes.labor.toFixed(1)}`
  );
  console.log(
    `Совокупные расходы: золото ${result.totals.expenses.total.toFixed(1)} (экономика ${result.totals.expenses.departments.economy.toFixed(
      1
    )}, дипломатия ${result.totals.expenses.departments.diplomacy.toFixed(1)}, внутренняя политика ${result.totals.expenses.departments.internal.toFixed(
      1
    )}, военное ведомство ${result.totals.expenses.departments.military.toFixed(1)}, наука ${result.totals.expenses.departments.science.toFixed(1)})`
  );
  console.log(
    `Финальное состояние казны: золото ${result.finalState.resources.gold.toFixed(1)}, влияние ${result.finalState.resources.influence.toFixed(
      1
    )}, рабочая сила ${result.finalState.resources.labor.toFixed(1)}`
  );
  console.log(
    `Доверие советника: ${formatTrust(result.finalState.trust.advisor)}, активный уровень угроз: ${result.finalState.activeThreatLevel.toFixed(2)}`
  );
  const finalEstateTrust = Object.entries(result.finalState.trust.estates)
    .map(([name, value]) => `${name}: ${formatTrust(value)}`)
    .join(", ");
  if (finalEstateTrust) {
    console.log(`Доверие сословий к финалу: ${finalEstateTrust}`);
  }

  console.log("\nKPI-сводка за период:");
  if (result.kpiSummary.latest) {
    logKPIBlock(result.kpiSummary.latest);
  }
  console.log(
    `Средние значения: стабильность ${result.kpiSummary.averages.stability.toFixed(
      2
    )}, экономический рост ${result.kpiSummary.averages.economicGrowth.toFixed(2)}, индекс безопасности ${result.kpiSummary.averages.securityIndex.toFixed(
      2
    )}, активные кризисы ${result.kpiSummary.averages.activeCrises.toFixed(2)}`
  );

  console.log("\nИнфраструктура регионов к концу года:");
  for (const region of result.finalState.regions) {
    console.log(
      ` - ${region.name}: богатство ${region.wealth.toFixed(1)}, лояльность ${region.loyalty.toFixed(1)}%, инфраструктура ${region.infrastructure.toFixed(1)}`
    );
  }

  console.log("\nСовет при правителе:");
  for (const councilor of result.finalState.council) {
    const motivation = (councilor.motivation * 100).toFixed(0);
    const stress = (councilor.stress * 100).toFixed(0);
    console.log(
      ` - ${councilor.name} (${councilor.portfolio}): мотивация ${motivation}%, стресс ${stress}%`
    );
    if (councilor.lastQuarterSummary) {
      console.log(`   ${councilor.lastQuarterSummary}`);
    }
  }

  console.log("\nСтратегическая повестка:");
  for (const [department, priority] of Object.entries(result.finalState.plan.priorities)) {
    console.log(` - ${department}: режим ${priority}`);
  }

  if (result.finalState.plan.projects.length > 0) {
    console.log("Проекты:");
    for (const project of result.finalState.plan.projects) {
      console.log(
        ` • ${project.name}: ${(project.progress * 100).toFixed(0)}% (${project.focus})`
      );
    }
  }

  console.log(`\nСохранение симуляции: ${saveInfo.directory}`);
  console.log(`Детали сводки: ${saveInfo.summaryPath}`);
}

main().catch((error) => {
  console.error("Ошибка исполнения симуляции", error);
  process.exitCode = 1;
});
