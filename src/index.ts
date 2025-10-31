import { BalancedChancellor, MilitaristMarshal, ReformistScholar } from "./advisors";
import { departments, estates, initialResources, regions } from "./data";
import { runSimulation } from "./simulation";
import { SimulationConfig } from "./types";

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
  if (report.events.length > 0) {
    console.log("События:");
    for (const event of report.events) {
      console.log(` • [${event.severity}] ${event.description}`);
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

console.log("\nИнфраструктура регионов к концу года:");
for (const region of result.finalState.regions) {
  console.log(
    ` - ${region.name}: богатство ${region.wealth.toFixed(1)}, лояльность ${region.loyalty.toFixed(1)}%, инфраструктура ${region.infrastructure.toFixed(1)}`
  );
}
