import { Advisor, AdvisorContext, BudgetAllocation, DEPARTMENTS, Department } from "./types";

function normalizeAllocation(allocation: Partial<Record<Department, number>>): Record<Department, number> {
  const filled: Partial<Record<Department, number>> = {};
  let total = 0;
  for (const department of DEPARTMENTS) {
    const value = allocation[department] ?? 0;
    filled[department] = value;
    total += value;
  }

  if (total <= 0) {
    const equalShare = 1 / DEPARTMENTS.length;
    return Object.fromEntries(DEPARTMENTS.map((d) => [d, equalShare])) as Record<Department, number>;
  }

  return Object.fromEntries(
    DEPARTMENTS.map((department) => [department, (filled[department] ?? 0) / total])
  ) as Record<Department, number>;
}

export class BalancedChancellor implements Advisor {
  public readonly name = "Совет равновесия";
  public readonly description =
    "Раздаёт бюджет по средним значениям, слегка усиливая отстающие ведомства.";

  allocateBudget(context: AdvisorContext): BudgetAllocation {
    const base = 1 / DEPARTMENTS.length;
    const allocation: Partial<Record<Department, number>> = {};
    const maxEfficiency = Math.max(...context.departments.map((d) => d.efficiency));

    for (const department of context.departments) {
      const efficiencyGap = maxEfficiency - department.efficiency;
      allocation[department.name] = base + efficiencyGap * 0.15;
    }

    return normalizeAllocation(allocation);
  }
}

export class MilitaristMarshal implements Advisor {
  public readonly name = "Маршал империи";
  public readonly description =
    "Фокусируется на военном ведомстве и внутреннем порядке в ущерб дипломатии.";

  allocateBudget(context: AdvisorContext): BudgetAllocation {
    const allocation: Partial<Record<Department, number>> = {
      military: 0.45,
      internal: 0.2,
      economy: 0.2,
      diplomacy: 0.05,
      science: 0.1,
    };

    const unrest = context.estates.filter((estate) => estate.satisfaction < 45).length;
    if (unrest > 0) {
      allocation.internal = (allocation.internal ?? 0) + unrest * 0.05;
      allocation.military = (allocation.military ?? 0) + unrest * 0.05;
    }

    return normalizeAllocation(allocation);
  }
}

export class ReformistScholar implements Advisor {
  public readonly name = "Реформист-учёный";
  public readonly description =
    "Инвестирует в экономику и науку, чтобы со временем увеличить общий доход.";

  allocateBudget(context: AdvisorContext): BudgetAllocation {
    const allocation: Partial<Record<Department, number>> = {
      economy: 0.35,
      science: 0.25,
      diplomacy: 0.15,
      internal: 0.15,
      military: 0.1,
    };

    const treasuryPressure = context.resources.gold < 120 ? 0.1 : 0;
    if (treasuryPressure > 0) {
      allocation.economy = (allocation.economy ?? 0) + treasuryPressure;
      allocation.military = Math.max(0.05, (allocation.military ?? 0) - treasuryPressure / 2);
    }

    return normalizeAllocation(allocation);
  }
}
