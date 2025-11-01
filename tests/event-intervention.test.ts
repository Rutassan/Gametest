import { describe, expect, it } from "vitest";
import { buildBaselineConfig } from "../src/config";
import { runSimulation } from "../src/simulation";
import {
  EventDecisionContext,
  EventInterventionDecision,
  EventInterventionHandler,
  EventInterventionPanel,
} from "../src/types";

class ScriptedInterventionHandler implements EventInterventionHandler {
  private resolvedEvents = new Set<string>();

  present(panel: EventInterventionPanel, _context: EventDecisionContext): EventInterventionDecision {
    if (!this.resolvedEvents.has(panel.event.id)) {
      this.resolvedEvents.add(panel.event.id);
      const firstOption = panel.options[0];
      return {
        mode: "player",
        optionId: firstOption?.id ?? null,
        notes: "test-manual-choice",
      };
    }

    return {
      mode: "council",
      optionId: null,
    };
  }
}

describe("Event intervention flow", () => {
  it("фиксирует ручные решения и прогноз совета", async () => {
    const handler = new ScriptedInterventionHandler();
    const config = buildBaselineConfig({
      quarters: 1,
      eventInterventionHandler: handler,
    });

    const result = await runSimulation(config);

    const manualEntry = result.interventionLog.find((entry) => entry.mode === "player");
    expect(manualEntry).toBeDefined();
    expect(manualEntry?.notes).toBe("test-manual-choice");

    const councilEntry = result.interventionLog.find((entry) => entry.mode === "council");
    expect(councilEntry).toBeDefined();

    const reportWithManual = result.reports.find((report) =>
      report.events.some((event) => event.notes === "test-manual-choice")
    );
    expect(reportWithManual).toBeDefined();

    const outcome = reportWithManual!.events.find((event) => event.notes === "test-manual-choice");
    expect(outcome?.resolutionMode).toBe("player");
    expect(outcome?.advisorPreview).toBeDefined();
    expect(outcome?.handoffIssued).toBe(false);

    expect(result.reports[0]?.controlMode).toBe("advisor");
    expect(result.controlState.currentMode).toBe("advisor");
    expect(result.finalState.controlMode).toBe("advisor");
    expect(result.controlState.history.length).toBeGreaterThan(0);
    expect(manualEntry?.handoffIssued).toBe(false);
  });
});
