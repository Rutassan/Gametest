import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  CampaignControlMode,
  CampaignControlState,
  ControlModeTransition,
  EventInterventionLogEntry,
  QuarterlyReport,
  SimulationConfig,
  SimulationResult,
} from "./types";

export interface ConfigSummary {
  quarters: number;
  baseQuarterBudget: number;
  advisor: string;
  decree: SimulationConfig["decree"];
  initialResources: SimulationConfig["initialResources"];
  agenda: SimulationConfig["agenda"];
  council: SimulationConfig["council"];
  responsePosture: SimulationConfig["responsePosture"];
  controlMode?: {
    initialMode: CampaignControlMode;
    transitions?: ControlModeTransition[];
  };
}

export interface SimulationSaveManifest {
  id: string;
  createdAt: string;
  label?: string;
  quarters: number;
  files: {
    summary: string;
    timeline: string;
  };
  config?: ConfigSummary;
  finalSnapshot: {
    treasury: SimulationResult["finalState"]["resources"];
    trust: SimulationResult["finalState"]["trust"]["advisor"];
    threatLevel: SimulationResult["finalState"]["activeThreatLevel"];
    controlMode: SimulationResult["finalState"]["controlMode"];
  };
  totals: SimulationResult["totals"];
  kpiSummary: SimulationResult["kpiSummary"];
  controlState?: CampaignControlState;
}

export interface SaveOptions {
  baseDir?: string;
  id?: string;
  label?: string;
  config?: SimulationConfig;
}

export interface SaveResult {
  directory: string;
  manifestPath: string;
  summaryPath: string;
  timelinePath: string;
  manifest: SimulationSaveManifest;
}

interface SummaryFile {
  manifest: SimulationSaveManifest;
  reports: QuarterlyReport[];
  finalState: SimulationResult["finalState"];
  interventions: EventInterventionLogEntry[];
  controlState: CampaignControlState;
}

function ensureDirectory(path: string) {
  mkdirSync(path, { recursive: true });
}

function buildConfigSummary(config: SimulationConfig | undefined): ConfigSummary | undefined {
  if (!config) {
    return undefined;
  }
  return {
    quarters: config.quarters,
    baseQuarterBudget: config.baseQuarterBudget,
    advisor: config.advisor.name ?? "Неизвестный советник",
    decree: config.decree,
    initialResources: config.initialResources,
    agenda: {
      name: config.agenda.name,
      priorities: { ...config.agenda.priorities },
      mandates: config.agenda.mandates.map((mandate) => ({ ...mandate })),
      projects: config.agenda.projects.map((project) => ({ ...project })),
    },
    council: config.council.map((member) => ({ ...member })),
    responsePosture: {
      default: config.responsePosture.default,
      perCategory: config.responsePosture.perCategory ? { ...config.responsePosture.perCategory } : undefined,
    },
    controlMode: config.controlSettings
      ? {
          initialMode: config.controlSettings.initialMode,
          transitions: config.controlSettings.transitions?.map((transition) => ({ ...transition })),
        }
      : undefined,
  };
}

export function saveSimulationResult(result: SimulationResult, options: SaveOptions = {}): SaveResult {
  const baseDirectory = resolve(process.cwd(), options.baseDir ?? join("dist", "saves"));
  ensureDirectory(baseDirectory);

  const generatedId =
    options.id ??
    [
      new Date().toISOString().replace(/[:.]/g, "-"),
      Math.random().toString(36).slice(2, 8),
    ].join("-");
  const saveDirectory = join(baseDirectory, generatedId);
  ensureDirectory(saveDirectory);

  const manifest: SimulationSaveManifest = {
    id: generatedId,
    createdAt: new Date().toISOString(),
    label: options.label,
    quarters: result.reports.length,
    files: {
      summary: "summary.json",
      timeline: "timeline.ndjson",
    },
    config: buildConfigSummary(options.config),
    finalSnapshot: {
      treasury: result.finalState.resources,
      trust: result.finalState.trust.advisor,
      threatLevel: result.finalState.activeThreatLevel,
      controlMode: result.finalState.controlMode,
    },
    totals: result.totals,
    kpiSummary: result.kpiSummary,
    controlState: result.controlState,
  };

  const timelinePath = join(saveDirectory, manifest.files.timeline);
  const summaryPath = join(saveDirectory, manifest.files.summary);
  const manifestPath = join(saveDirectory, "manifest.json");

  const timelinePayload = result.reports.map((report) => JSON.stringify(report)).join("\n");
  writeFileSync(timelinePath, timelinePayload, "utf-8");

  const summaryPayload: SummaryFile = {
    manifest,
    reports: result.reports,
    finalState: result.finalState,
    interventions: result.interventionLog,
    controlState: result.controlState,
  };
  writeFileSync(summaryPath, JSON.stringify(summaryPayload, null, 2), "utf-8");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    directory: saveDirectory,
    manifestPath,
    summaryPath,
    timelinePath,
    manifest,
  };
}

export interface LoadedSimulationSave {
  manifest: SimulationSaveManifest;
  result: SimulationResult;
}

export function loadSimulationSave(pathToSave: string): LoadedSimulationSave {
  const directory = resolve(pathToSave);
  const manifest: SimulationSaveManifest = JSON.parse(
    readFileSync(join(directory, "manifest.json"), "utf-8")
  );
  const summary: SummaryFile = JSON.parse(
    readFileSync(join(directory, manifest.files.summary), "utf-8")
  );

  const timelineRaw = readFileSync(join(directory, manifest.files.timeline), "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as QuarterlyReport);

  const historyFallback =
    summary.controlState?.history ?? manifest.controlState?.history ?? [];

  return {
    manifest,
    result: {
      reports: timelineRaw,
      kpiSummary: manifest.kpiSummary,
      totals: manifest.totals,
      finalState: summary.finalState,
      interventionLog: summary.interventions ?? [],
      controlState:
        summary.controlState ??
        manifest.controlState ?? {
          currentMode: summary.finalState.controlMode,
          history: historyFallback,
        },
    },
  };
}
