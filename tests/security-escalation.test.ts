import { describe, expect, it } from "vitest";
import { buildBaselineConfig } from "../src/config";
import { runSimulation } from "../src/simulation";
import { Advisor, AdvisorContext, DEPARTMENTS } from "../src/types";

class NeglectfulAdvisor implements Advisor {
  public readonly name = "Губернатор-пацифист";
  public readonly description = "Инициирует минимум военных расходов, усиливая экономику.";

  allocateBudget(context: AdvisorContext) {
    const allocation: Record<(typeof DEPARTMENTS)[number], number> = {
      economy: 0.5,
      diplomacy: 0.2,
      internal: 0.2,
      military: 0.05,
      science: 0.05,
    };

    // Если армия недовольна, незначительно компенсируем.
    const upset = context.estates.find((estate) => estate.favoredDepartment === "military");
    if (upset && (context.trust.estates[upset.name] ?? 0.5) < 0.4) {
      allocation.military += 0.02;
      allocation.internal += 0.03;
      allocation.economy -= 0.02;
      allocation.diplomacy -= 0.03;
    }

    return allocation;
  }
}

describe("Система эскалации угроз безопасности", () => {
  it("порождает цепочку событий при хронически низком индексе безопасности", () => {
    const advisor = new NeglectfulAdvisor();
    const config = buildBaselineConfig({
      quarters: 6,
      advisor,
      baseQuarterBudget: 480,
    });

    const result = runSimulation(config);
    const uniqueEventIds = new Set(
      result.reports.flatMap((report) => report.events.map((entry) => entry.event.id))
    );

    expect(uniqueEventIds.has("kpi.security.alert")).toBe(true);
    expect(uniqueEventIds.has("security.border.skirmish")).toBe(true);
    expect(uniqueEventIds.has("security.border.crisis")).toBe(true);
  });
});
