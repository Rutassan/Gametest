import { describe, expect, it } from "vitest";
import { buildBaselineConfig } from "../src/config";
import { ReformistScholar } from "../src/advisors";
import { AdvisorContext, DEPARTMENTS } from "../src/types";

describe("Советники", () => {
  it("реформист инвестирует преимущественно в экономику и науку", () => {
    const config = buildBaselineConfig();
    const advisor = new ReformistScholar();

    const context: AdvisorContext = {
      resources: { ...config.initialResources },
      estates: config.estates.map((estate) => ({ ...estate })),
      departments: config.departments.map((department) => ({ ...department })),
      decree: config.decree,
      trust: {
        advisor: 0.7,
        estates: Object.fromEntries(config.estates.map((estate) => [estate.name, estate.satisfaction / 100])),
      },
    };

    const allocation = advisor.allocateBudget(context);

    const total = DEPARTMENTS.reduce((acc, department) => acc + (allocation[department] ?? 0), 0);
    expect(total).toBeCloseTo(1, 5);
    expect(allocation.economy ?? 0).toBeGreaterThan(allocation.military ?? 0);
    expect(allocation.science ?? 0).toBeGreaterThan(0.2);
  });
});
