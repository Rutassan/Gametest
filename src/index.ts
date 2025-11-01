import { buildBaselineConfig } from "./config";
import { runSimulation } from "./simulation";
import {
  KPIEntry,
  KPIReport,
  SimulationEventEffect,
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

const config = buildBaselineConfig();

const result = runSimulation(config);
const saveInfo = saveSimulationResult(result, {
  config,
  label: "baseline_cli_run",
});

console.log("=== Ежеквартальный отчёт ===");
for (const report of result.reports) {
  console.log(`\nКвартал ${report.quarter}`);
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
      if (outcome.selectedOptionId) {
        const chosen = event.options.find((option) => option.id === outcome.selectedOptionId);
        if (chosen) {
          console.log(`   Выбор: ${chosen.description}`);
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

console.log(`\nСохранение симуляции: ${saveInfo.directory}`);
console.log(`Детали сводки: ${saveInfo.summaryPath}`);
