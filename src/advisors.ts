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

function applyTrustPressure(
  allocation: Partial<Record<Department, number>>,
  context: AdvisorContext,
  magnitude: number
) {
  for (const estate of context.estates) {
    const estateTrust = context.trust.estates[estate.name] ?? 0.5;
    if (estateTrust < 0.4) {
      const pressure = (0.4 - estateTrust) * magnitude;
      allocation[estate.favoredDepartment] =
        (allocation[estate.favoredDepartment] ?? 0) + pressure;
    } else if (estateTrust > 0.75) {
      const relief = (estateTrust - 0.75) * (magnitude / 2);
      allocation[estate.favoredDepartment] =
        (allocation[estate.favoredDepartment] ?? 0) + relief;
    }
  }
}

export class BalancedChancellor implements Advisor {
  public readonly name = "Совет равновесия";
  public readonly description =
    "Раздаёт бюджет по средним значениям, слегка усиливая отстающие ведомства.";

  allocateBudget(context: AdvisorContext): BudgetAllocation {
    const base = 1 / DEPARTMENTS.length;
    const allocation: Partial<Record<Department, number>> = {};
    const maxEfficiency = Math.max(...context.departments.map((d) => d.efficiency));
    const advisorTrust = context.trust.advisor;

    for (const department of context.departments) {
      const efficiencyGap = maxEfficiency - department.efficiency;
      allocation[department.name] = base + efficiencyGap * 0.15;
    }

    applyTrustPressure(allocation, context, 0.12);

    if (advisorTrust < 0.45) {
      const dampening = (0.45 - advisorTrust) * 0.5;
      for (const department of DEPARTMENTS) {
        allocation[department] = (allocation[department] ?? base) * (1 - dampening) + base * dampening;
      }
    } else if (advisorTrust > 0.75) {
      const boost = (advisorTrust - 0.75) * 0.25;
      for (const department of context.departments) {
        if (department.efficiency < maxEfficiency) {
          allocation[department.name] =
            (allocation[department.name] ?? base) + boost * (maxEfficiency - department.efficiency);
        }
      }
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
    applyTrustPressure(allocation, context, 0.15);

    if (unrest > 0) {
      allocation.internal = (allocation.internal ?? 0) + unrest * 0.05;
      allocation.military = (allocation.military ?? 0) + unrest * 0.05;
    }

    const advisorTrust = context.trust.advisor;
    if (advisorTrust < 0.4) {
      allocation.military = (allocation.military ?? 0) * 0.85;
      allocation.internal = (allocation.internal ?? 0) * 0.9;
    } else if (advisorTrust > 0.8) {
      allocation.military = (allocation.military ?? 0) + 0.05 * (advisorTrust - 0.8);
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
    applyTrustPressure(allocation, context, 0.1);

    if (treasuryPressure > 0) {
      allocation.economy = (allocation.economy ?? 0) + treasuryPressure;
      allocation.military = Math.max(0.05, (allocation.military ?? 0) - treasuryPressure / 2);
    }

    const advisorTrust = context.trust.advisor;
    if (advisorTrust < 0.5) {
      const drag = (0.5 - advisorTrust) * 0.3;
      allocation.science = Math.max(0.1, (allocation.science ?? 0) * (1 - drag));
      allocation.economy = (allocation.economy ?? 0) + drag / 2;
    } else if (advisorTrust > 0.8) {
      const bonus = (advisorTrust - 0.8) * 0.4;
      allocation.science = (allocation.science ?? 0) + bonus;
    }

    return normalizeAllocation(allocation);
  }
}
