import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { describe, expect, it, afterAll } from "vitest";
import { buildBaselineConfig } from "../src/config";
import { runSimulation } from "../src/simulation";
import { loadSimulationSave, saveSimulationResult } from "../src/persistence";

const tempRoot = mkdtempSync(join(tmpdir(), "gametest-save-"));

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("Persistence pipeline", () => {
  it("сохраняет и загружает отчёт симуляции", () => {
    const config = buildBaselineConfig({ quarters: 2 });
    const result = runSimulation(config);

    const save = saveSimulationResult(result, {
      baseDir: tempRoot,
      config,
      label: "test-run",
      id: "test-save",
    });

    expect(existsSync(save.manifestPath)).toBe(true);
    expect(existsSync(save.summaryPath)).toBe(true);
    expect(existsSync(save.timelinePath)).toBe(true);

    const loaded = loadSimulationSave(save.directory);

    expect(loaded.manifest.id).toBe("test-save");
    expect(loaded.result.reports).toHaveLength(result.reports.length);
    expect(loaded.result.kpiSummary.latest?.securityIndex.value).toBeCloseTo(
      result.kpiSummary.latest?.securityIndex.value ?? 0,
      2
    );
    expect(loaded.result.finalState.resources.gold).toBeCloseTo(
      result.finalState.resources.gold,
      2
    );
  });
});
