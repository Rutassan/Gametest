import { BalancedChancellor, MilitaristMarshal, ReformistScholar } from "./advisors";
import { departments, estates, initialResources, regions } from "./data";
import { runSimulation } from "./simulation";
import {
  KPIEntry,
  KPIReport,
  SimulationConfig,
  SimulationEventCost,
  SimulationEventEffect,
  SimulationEventEscalation,
  ThreatLevel,
} from "./types";

function formatCost(cost: SimulationEventCost | undefined): string {
  if (!cost) {
    return "";
  }
  const entries = Object.entries(cost).filter(([, value]) => value !== undefined);
  return entries
    .map(([resource, value]) => `${resource}: ${value}`)
    .join(", ");
}

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

function formatFollowUps(followUps: string[] | undefined): string {
  if (!followUps || followUps.length === 0) {
    return "";
  }
  return followUps.join(", ");
}

function formatEscalations(escalations: SimulationEventEscalation[] | undefined): string {
  if (!escalations || escalations.length === 0) {
    return "";
  }
  return escalations
    .map((escalation) => `${Math.round(escalation.chance * 100)}% → ${escalation.followUp}: ${escalation.description}`)
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

const advisor = new ReformistScholar();

const decree = {
  name: "Программа обновления инфраструктуры",
  investmentPriority: "infrastructure" as const,
  taxPolicy: "standard" as const,
};

const config: SimulationConfig = {
  quarters: 4,
  baseQuarterBudget: 420,
  initialResources,
  regions,
  estates,
  departments,
  advisor,
  decree,
};

const result = runSimulation(config);

console.log("=== Ежемесячный отчёт ===");
for (const report of result.reports) {
  console.log(`\nМесяц ${report.month}`);
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
  if (report.events.length > 0) {
    console.log("События:");
    for (const event of report.events) {
      console.log(` • [${event.severity}] (${event.category}) ${event.title}`);
      console.log(`   ${event.description}`);
      if (event.factions.length > 0) {
        console.log(`   Фракции: ${event.factions.join(", ")}`);
      }
      const metricConditions = event.conditions.metrics ?? {};
      const metricEntries = Object.entries(metricConditions);
      if (metricEntries.length > 0) {
        console.log(
          `   Условия: ${metricEntries
            .map(([metric, value]) => `${metric} ${value}`)
            .join(", ")}`
        );
      }
      if (event.conditions.flags && event.conditions.flags.length > 0) {
        console.log(`   Флаги: ${event.conditions.flags.join(", ")}`);
      }
      if (event.options.length > 0) {
        console.log("   Опции:");
        for (const option of event.options) {
          console.log(`     - (${option.id}) ${option.description}`);
          const formattedCost = formatCost(option.cost);
          if (formattedCost) {
            console.log(`       Стоимость: ${formattedCost}`);
          }
          const formattedEffects = formatEffects(option.effects);
          if (formattedEffects) {
            console.log(`       Эффекты: ${formattedEffects}`);
          }
          const formattedFollowUps = formatFollowUps(option.followUps);
          if (formattedFollowUps) {
            console.log(`       Последующие события: ${formattedFollowUps}`);
          }
          if (option.cooldown !== undefined) {
            console.log(`       Перезарядка: ${option.cooldown} ход(а)`);
          }
        }
      }
      const escalationSummary = formatEscalations(event.escalation);
      if (escalationSummary) {
        console.log(`   Эскалации: ${escalationSummary}`);
      }
      const failureIntro = event.failure.description
        ? `${event.failure.description} Через ${event.failure.timeout} ход(а) автоматически:`
        : `Через ${event.failure.timeout} ход(а) автоматически:`;
      console.log(`   Провал: ${failureIntro}`);
      const failureEffects = formatEffects(event.failure.effects);
      if (failureEffects) {
        console.log(`   Последствия провала: ${failureEffects}`);
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
