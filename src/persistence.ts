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
  SimulationSessionState,
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
  status?: "completed" | "in_progress";
  files: {
    summary: string;
    timeline: string;
  };
  session?: {
    file: string;
    currentQuarter: number;
    totalQuarters: number;
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
  status?: "completed" | "in_progress";
  sessionState?: SimulationSessionState;
}

export interface SaveResult {
  directory: string;
  manifestPath: string;
  summaryPath: string;
  timelinePath: string;
  manifest: SimulationSaveManifest;
  sessionStatePath?: string;
}

interface SummaryFile {
  manifest: SimulationSaveManifest;
  reports: QuarterlyReport[];
  finalState: SimulationResult["finalState"];
  interventions: EventInterventionLogEntry[];
  controlState: CampaignControlState;
  sessionState?: SimulationSessionState;
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
    status: options.status ?? (options.sessionState ? "in_progress" : "completed"),
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
  let sessionStatePath: string | undefined;

  if (options.sessionState) {
    manifest.session = {
      file: "session.json",
      currentQuarter: options.sessionState.currentQuarter,
      totalQuarters: options.sessionState.totalQuarters,
    };
    sessionStatePath = join(saveDirectory, manifest.session.file);
    writeFileSync(sessionStatePath, JSON.stringify(options.sessionState, null, 2), "utf-8");
  }

  const timelinePayload = result.reports.map((report) => JSON.stringify(report)).join("\n");
  writeFileSync(timelinePath, timelinePayload, "utf-8");

  const summaryPayload: SummaryFile = {
    manifest,
    reports: result.reports,
    finalState: result.finalState,
    interventions: result.interventionLog,
    controlState: result.controlState,
    sessionState: options.sessionState,
  };
  writeFileSync(summaryPath, JSON.stringify(summaryPayload, null, 2), "utf-8");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    directory: saveDirectory,
    manifestPath,
    summaryPath,
    timelinePath,
    manifest,
    sessionStatePath,
  };
}

export interface LoadedSimulationSave {
  manifest: SimulationSaveManifest;
  result: SimulationResult;
  sessionState?: SimulationSessionState;
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
    .map((line) => {
      const report = JSON.parse(line) as QuarterlyReport;
      report.departments = report.departments ?? [];
      report.projects = report.projects ?? [];
      report.regions = report.regions.map((region) => ({
        ...region,
        riskScore: region.riskScore ?? 0,
        riskLevel: region.riskLevel ?? "low",
        riskFactors: region.riskFactors ?? ["Данные недоступны"],
      }));
      report.events = report.events.map((event) => ({
        ...event,
        handoffIssued: event.handoffIssued ?? false,
      }));
      report.advisorConsultations = (report.advisorConsultations ?? []).map((thread) => ({
        ...thread,
        handoffIssued: thread.handoffIssued ?? false,
      }));
      return report;
    });

  const historyFallback =
    summary.controlState?.history ?? manifest.controlState?.history ?? [];

  const sessionState: SimulationSessionState | undefined = summary.sessionState
    ? summary.sessionState
    : manifest.session
    ? (JSON.parse(
        readFileSync(join(directory, manifest.session.file), "utf-8")
      ) as SimulationSessionState)
    : undefined;

  return {
    manifest,
    result: {
      reports: timelineRaw,
      kpiSummary: manifest.kpiSummary,
      totals: manifest.totals,
      finalState: summary.finalState,
      interventionLog: (summary.interventions ?? []).map((entry) => ({
        ...entry,
        handoffIssued: entry.handoffIssued ?? false,
      })),
      controlState:
        summary.controlState ??
        manifest.controlState ?? {
          currentMode: summary.finalState.controlMode,
          history: historyFallback,
        },
    },
    sessionState,
  };
}
