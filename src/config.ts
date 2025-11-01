import { ReformistScholar } from "./advisors";
import { councilMembers, departments, estates, initialResources, regions, strategicAgenda } from "./data";
import { SimulationConfig, StrategicAgenda, CouncilMember, ResponsePostureSettings } from "./types";
import { pragmaticDecisionStrategy } from "./strategies";

export function buildBaselineConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const advisor = overrides.advisor ?? new ReformistScholar();
  const decree = overrides.decree ?? {
    name: "Программа обновления инфраструктуры",
    investmentPriority: "infrastructure" as const,
    taxPolicy: "standard" as const,
  };

  const defaultPosture: ResponsePostureSettings = overrides.responsePosture ?? {
    default: "balanced",
    perCategory: {
      "Военные угрозы": "forceful",
      "Дипломатические кризисы": "diplomatic",
      "Социальные потрясения": "balanced",
      "Политические интриги": "covert",
      "Экономический кризис": "balanced",
    },
  };

  const baseAgenda: StrategicAgenda = overrides.agenda
    ? overrides.agenda
    : {
        name: strategicAgenda.name,
        priorities: { ...strategicAgenda.priorities },
        mandates: strategicAgenda.mandates.map((mandate) => ({ ...mandate })),
        projects: strategicAgenda.projects.map((project) => ({ ...project })),
      };

  const baseCouncil: CouncilMember[] = overrides.council
    ? overrides.council
    : councilMembers.map((member) => ({ ...member }));

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
    agenda: baseAgenda,
    council: baseCouncil,
    responsePosture: defaultPosture,
  };
}
