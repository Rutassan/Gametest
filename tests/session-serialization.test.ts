import { describe, expect, it } from "vitest";
import { buildBaselineConfig } from "../src/config";
import { SimulationSession } from "../src/simulation";

describe("SimulationSession serialization", () => {
  it("восстанавливает состояние кампании из снимка", async () => {
    const config = buildBaselineConfig({ quarters: 3 });
    const session = new SimulationSession(config);

    await session.advanceQuarter();
    await session.advanceQuarter();

    const snapshot = session.exportState();
    const baselineResult = session.buildResult();

    const restored = SimulationSession.fromState(config, snapshot);
    const restoredResult = restored.buildResult();

    expect(restored.getCurrentQuarter()).toBe(session.getCurrentQuarter());
    expect(restoredResult.reports.length).toBe(baselineResult.reports.length);
    expect(restoredResult.finalState.resources.gold).toBeCloseTo(
      baselineResult.finalState.resources.gold,
      6
    );
    expect(restored.exportState().interventionLog).toHaveLength(snapshot.interventionLog.length);
  });
});
