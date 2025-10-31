import {
  Advisor,
  AdvisorContext,
  DEPARTMENTS,
  Department,
  DepartmentState,
  Estate,
  MonthlyExpenses,
  MonthlyReport,
  Region,
  ResourcePool,
  SimulationConfig,
  InvestmentPriority,
  TaxPolicy,
  SimulationEvent,
  SimulationResult,
} from "./types";
import {
  priorityBudgetBoost,
  priorityDevelopmentMultiplier,
  taxIncomeModifier,
  taxLoyaltyModifier,
  taxSatisfactionDelta,
} from "./decrees";

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

function calculateRegionIncome(
  region: Region,
  decreeTaxModifier: number,
  economyEfficiency: number,
  scienceEfficiency: number,
  decreePriority: InvestmentPriority
): ResourcePool {
  const loyaltyFactor = clamp(region.loyalty / 100, 0.3, 1.2);
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

  return { gold, influence, labor };
}

function normalizeAllocationWithDecree(
  advisor: Advisor,
  context: AdvisorContext,
  priority: InvestmentPriority
): Record<Department, number> {
  const allocation = advisor.allocateBudget(context);
  const weighted: Record<Department, number> = {} as Record<Department, number>;
  let total = 0;
  for (const department of DEPARTMENTS) {
    const base = allocation[department] ?? 0;
    const boosted = base * priorityBudgetBoost(priority, department);
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
  priority: InvestmentPriority
) {
  for (const department of departments) {
    const spent = spending[department.name] ?? 0;
    department.budget = spent;
    department.cumulativeInvestment += spent;
    const investmentRatio = spent / baseBudget;
    const priorityBonus = priorityBudgetBoost(priority, department.name) - 1;
    const delta = investmentRatio * 0.08 + priorityBonus * 0.02 - 0.01;
    department.efficiency = clamp(department.efficiency + delta, 0.6, 2.5);
  }
}

function updateRegions(
  regions: Region[],
  spending: Record<Department, number>,
  decreePriority: InvestmentPriority,
  loyaltyModifier: number
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const economySpend = spending.economy ?? 0;
  const internalSpend = spending.internal ?? 0;
  const militarySpend = spending.military ?? 0;
  const scienceSpend = spending.science ?? 0;

  for (const region of regions) {
    const infrastructureGain = (economySpend * 0.03 + scienceSpend * 0.01) *
      priorityDevelopmentMultiplier(decreePriority, region.specialization);
    if (infrastructureGain > 0.01) {
      const before = region.infrastructure;
      region.infrastructure = clamp(region.infrastructure + infrastructureGain, 0, 120);
      if (Math.floor(before / 5) !== Math.floor(region.infrastructure / 5)) {
        events.push({
          description: `Инфраструктура региона ${region.name} выросла до ${region.infrastructure.toFixed(1)}`,
          severity: "minor",
        });
      }
    }

    const wealthGain = economySpend * 0.04 * (1 + region.infrastructure / 100);
    region.wealth = Math.max(10, region.wealth + wealthGain - 0.5);

    const loyaltyShift =
      (internalSpend * 0.02 + militarySpend * 0.015) * loyaltyModifier - (economySpend * 0.005);
    region.loyalty = clamp(region.loyalty * loyaltyModifier + loyaltyShift, 20, 100);

    if (region.loyalty < 45) {
      events.push({
        description: `Лояльность региона ${region.name} падает до ${region.loyalty.toFixed(1)}%`,
        severity: "moderate",
      });
    }
  }

  return events;
}

function updateEstates(
  estates: Estate[],
  spending: Record<Department, number>,
  taxPolicy: TaxPolicy
): SimulationEvent[] {
  const events: SimulationEvent[] = [];

  for (const estate of estates) {
    const favoredSpend = spending[estate.favoredDepartment] ?? 0;
    const satisfactionDelta = favoredSpend * 0.1 + taxSatisfactionDelta(taxPolicy, estate.name);
    estate.satisfaction = clamp(estate.satisfaction + satisfactionDelta - 1, 10, 90);

    const influenceDelta = favoredSpend * 0.02 - 0.1;
    estate.influence = clamp(estate.influence + influenceDelta, 5, 40);

    if (estate.satisfaction < 35) {
      events.push({
        description: `${estate.name} недовольно и готовит давление на двор`,
        severity: "major",
      });
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

  const reports: MonthlyReport[] = [];
  let totalIncomes: ResourcePool = { gold: 0, influence: 0, labor: 0 };
  let totalExpenses: MonthlyExpenses = {
    departments: Object.fromEntries(DEPARTMENTS.map((department) => [department, 0])) as Record<Department, number>,
    total: 0,
  };

  for (let month = 1; month <= config.months; month += 1) {
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
          config.decree.investmentPriority
        )
      )
    );

    totalIncomes = addResources(totalIncomes, incomes);
    const newResources = addResources(resources, incomes);
    resources.gold = newResources.gold;
    resources.influence = newResources.influence;
    resources.labor = newResources.labor;

    const advisorContext: AdvisorContext = {
      resources,
      estates,
      departments,
      decree: config.decree,
    };

    const allocation = normalizeAllocationWithDecree(
      config.advisor,
      advisorContext,
      config.decree.investmentPriority
    );

    const availableBudget = Math.min(config.baseMonthlyBudget, resources.gold * 0.6);
    let spending: Record<Department, number> = {} as Record<Department, number>;
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

    const expenses: MonthlyExpenses = {
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

    resources.gold -= expenses.total;
    if (resources.gold < 0) {
      resources.gold = 0;
    }

    updateDepartmentState(departments, spending, config.baseMonthlyBudget, config.decree.investmentPriority);
    const regionEvents = updateRegions(
      regions,
      spending,
      config.decree.investmentPriority,
      loyaltyModifier
    );
    const estateEvents = updateEstates(estates, spending, config.decree.taxPolicy);

    const events: SimulationEvent[] = [...regionEvents, ...estateEvents];
    if (resources.gold < config.baseMonthlyBudget * 0.3) {
      events.push({
        description: "Казна близка к нулю, совет требует пересмотра бюджета",
        severity: "moderate",
      });
    }

    reports.push({
      month,
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
      events,
    });
  }

  return {
    reports,
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
    },
  };
}
