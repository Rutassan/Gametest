import {
  Advisor,
  AdvisorContext,
  DEPARTMENTS,
  Department,
  DepartmentState,
  Estate,
  KPIEntry,
  KPIReport,
  QuarterlyReport,
  QuarterlyExpenses,
  Region,
  ResourcePool,
  SimulationConfig,
  InvestmentPriority,
  TaxPolicy,
  SimulationEvent,
  SimulationResult,
  ThreatLevel,
} from "./types";
import {
  createEstateDissatisfactionEvent,
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

const QUARTER_DURATION = 3;

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
  timeMultiplier: number
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

  return scaleResources({ gold, influence, labor }, timeMultiplier);
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
  priority: InvestmentPriority,
  timeMultiplier: number
) {
  for (const department of departments) {
    const spent = spending[department.name] ?? 0;
    department.budget = spent;
    department.cumulativeInvestment += spent;
    const investmentRatio = spent / baseBudget;
    const priorityBonus = priorityBudgetBoost(priority, department.name) - 1;
    const delta =
      (investmentRatio * 0.08 + priorityBonus * 0.02 - 0.01) * timeMultiplier;
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

  const reports: QuarterlyReport[] = [];
  let totalIncomes: ResourcePool = { gold: 0, influence: 0, labor: 0 };
  let totalExpenses: QuarterlyExpenses = {
    departments: Object.fromEntries(DEPARTMENTS.map((department) => [department, 0])) as Record<Department, number>,
    total: 0,
  };

  let previousTotalWealth = regions.reduce((acc, region) => acc + region.wealth, 0);
  let previousStability: number | null = null;
  let previousGrowth: number | null = null;
  let previousSecurity: number | null = null;
  let previousCrises: number | null = null;

  for (let quarter = 1; quarter <= config.quarters; quarter += 1) {
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
          QUARTER_DURATION
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

    const availableBudget = Math.min(config.baseQuarterBudget, resources.gold * 0.6);
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

    resources.gold -= expenses.total;
    if (resources.gold < 0) {
      resources.gold = 0;
    }

    updateDepartmentState(
      departments,
      spending,
      config.baseQuarterBudget,
      config.decree.investmentPriority,
      QUARTER_DURATION
    );
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

    const events: SimulationEvent[] = [...regionEvents, ...estateEvents];
    if (resources.gold < config.baseQuarterBudget * 0.3) {
      events.push(createTreasuryDepletionEvent(resources.gold));
    }

    const averageLoyalty =
      regions.reduce((acc, region) => acc + region.loyalty, 0) / regions.length;
    const totalWealth = regions.reduce((acc, region) => acc + region.wealth, 0);
    const economicGrowth = totalWealth - previousTotalWealth;
    const militarySpend = spending.military ?? 0;
    const militaryShare = (militarySpend / Math.max(1, config.baseQuarterBudget)) * 100;
    const minLoyalty = Math.min(...regions.map((region) => region.loyalty));
    const securityIndex = Math.min(minLoyalty, Math.min(100, militaryShare));
    const activeCrises = events.filter((event) => event.severity !== "minor").length;

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
      events,
      kpis,
    });
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
    },
  };
}
