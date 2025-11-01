import { describe, expect, it } from "vitest";
import { buildBaselineConfig } from "../src/config";
import { runSimulation } from "../src/simulation";

describe("Quarterly report enrichment", () => {
  it("включает ведомства, проекты и оценки рисков", async () => {
    const config = buildBaselineConfig({ quarters: 1 });
    const result = await runSimulation(config);

    expect(result.reports.length).toBeGreaterThan(0);
    const report = result.reports[0]!;

    expect(report.departments.length).toBeGreaterThan(0);
    const shareSum = report.departments.reduce((acc, department) => acc + department.spendingShare, 0);
    expect(shareSum).toBeGreaterThan(0.99);
    expect(shareSum).toBeLessThanOrEqual(1.01);

    report.departments.forEach((department) => {
      expect(department.efficiency).toBeGreaterThan(0);
      expect(department.cumulativeInvestment).toBeGreaterThanOrEqual(0);
    });

    expect(report.projects.length).toBe(config.agenda.projects.length);
    report.projects.forEach((project) => {
      expect(project.progress).toBeGreaterThanOrEqual(0);
      expect(project.progress).toBeLessThanOrEqual(1.01);
    });

    report.regions.forEach((region) => {
      expect(region.riskScore).toBeGreaterThanOrEqual(0);
      expect(region.riskScore).toBeLessThanOrEqual(1);
      expect(region.riskFactors.length).toBeGreaterThan(0);
    });

    expect(report.advisorConsultations.length).toBeGreaterThan(0);
    report.advisorConsultations.forEach((thread) => {
      expect(thread.handoffIssued).toBe(false);
    });
  });
});
