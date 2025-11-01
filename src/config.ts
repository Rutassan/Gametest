import { ReformistScholar } from "./advisors";
import { departments, estates, initialResources, regions } from "./data";
import { SimulationConfig } from "./types";
import { pragmaticDecisionStrategy } from "./strategies";

export function buildBaselineConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const advisor = overrides.advisor ?? new ReformistScholar();
  const decree = overrides.decree ?? {
    name: "Программа обновления инфраструктуры",
    investmentPriority: "infrastructure" as const,
    taxPolicy: "standard" as const,
  };

  return {
    quarters: overrides.quarters ?? 4,
    baseQuarterBudget: overrides.baseQuarterBudget ?? 420,
    initialResources: overrides.initialResources ?? { ...initialResources },
    regions: overrides.regions ?? regions.map((region) => ({ ...region })),
    estates: overrides.estates ?? estates.map((estate) => ({ ...estate })),
    departments: overrides.departments ?? departments.map((department) => ({ ...department })),
    advisor,
    decree,
    initialTrust: overrides.initialTrust,
    eventDecisionStrategy: overrides.eventDecisionStrategy ?? pragmaticDecisionStrategy,
  };
}
