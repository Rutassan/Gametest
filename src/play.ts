import { createInterface, Interface } from "readline/promises";
import { existsSync, statSync, mkdirSync, writeFileSync } from "fs";
import { stdin as input, stdout as output } from "process";
import { join, resolve } from "path";
import { buildBaselineConfig } from "./config";
import { SimulationSession } from "./simulation";
import {
  CampaignControlMode,
  EventDecisionContext,
  EventInterventionDecision,
  EventInterventionHandler,
  EventInterventionPanel,
  EventInterventionLogEntry,
  KPIEntry,
  QuarterlyReport,
  SimulationResult,
} from "./types";
import { saveSimulationResult, loadSimulationSave } from "./persistence";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTrend(entry: KPIEntry): string {
  const sign = entry.trend > 0 ? "↑" : entry.trend < 0 ? "↓" : "→";
  const prefix = entry.trend > 0 ? "+" : entry.trend < 0 ? "" : "";
  return `${sign} ${prefix}${entry.trend.toFixed(2)}`;
}

function formatEffects(effects: EventInterventionPanel["options"][number]["effects"]): string {
  if (!effects || effects.length === 0) {
    return "нет данных";
  }
  return effects
    .map((effect) => {
      const sign = effect.value > 0 ? "+" : "";
      const duration = effect.duration ? ` на ${effect.duration} хода` : "";
      return `${effect.type} → ${effect.target}: ${sign}${effect.value}${duration}`;
    })
    .join("; ");
}

function formatCost(cost?: EventInterventionPanel["options"][number]["cost"]): string {
  if (!cost) {
    return "без затрат";
  }
  const entries = Object.entries(cost).filter(([, value]) => value && value !== 0);
  if (entries.length === 0) {
    return "без затрат";
  }
  return entries.map(([resource, value]) => `${resource}: ${Number(value ?? 0).toFixed(1)}`).join(", ");
}

class CliInterventionHandler implements EventInterventionHandler {
  constructor(private readonly rl: Interface) {}

  async present(panel: EventInterventionPanel, _context: EventDecisionContext): Promise<EventInterventionDecision> {
    console.log(`\n⚠️  Событие: ${panel.event.title}`);
    console.log(`Категория: ${panel.event.category} • Уровень: ${panel.event.severity}`);
    console.log(`Описание: ${panel.event.description}`);
    if (panel.contextSummary.length > 0) {
      console.log(`Контекст: ${panel.contextSummary.join(" • ")}`);
    }
    console.log(`До провала: ${panel.remainingTime} хода(ов)`);
    if (panel.advisorPreview.optionId) {
      console.log(`Совет прогнозирует: ${panel.advisorPreview.optionId}${panel.advisorPreview.notes ? ` (${panel.advisorPreview.notes})` : ""}`);
    }
    console.log("Варианты вмешательства:");
    panel.options.forEach((option, index) => {
      console.log(` ${index + 1}. ${option.description}`);
      console.log(`    Стоимость: ${formatCost(option.cost)} | Эффекты: ${formatEffects(option.effects)}`);
      if (option.followUps && option.followUps.length > 0) {
        console.log(`    Последующие события: ${option.followUps.join(", ")}`);
      }
    });
    console.log("Введите номер варианта, 'c' — передать совету, 'd' — отложить на следующий ход.");

    while (true) {
      const answerRaw = (await this.rl.question("Ваш выбор: ")).trim().toLowerCase();
      if (answerRaw === "c" || answerRaw === "с") {
        return {
          mode: "council",
          optionId: panel.advisorPreview.optionId ?? null,
          notes: panel.advisorPreview.notes,
        };
      }
      if (answerRaw === "d" || answerRaw === "о" || answerRaw === "delay") {
        return {
          mode: "player",
          optionId: null,
          defer: true,
          notes: "Решение отложено",
        };
      }
      const optionIndex = Number.parseInt(answerRaw, 10);
      if (!Number.isNaN(optionIndex) && optionIndex >= 1 && optionIndex <= panel.options.length) {
        const selected = panel.options[optionIndex - 1];
        const note = (await this.rl.question("Комментарий (пусто если не нужен): ")).trim();
        return {
          mode: "player",
          optionId: selected.id,
          notes: note.length > 0 ? note : undefined,
        };
      }
      console.log("Не удалось распознать команду. Повторите ввод.");
    }
  }

  record(entry: EventInterventionLogEntry) {
    const performer = entry.mode === "player" ? "Игрок" : "Совет";
    const option = entry.optionId ?? "отложено";
    console.log(`Журнал: ${performer} → ${entry.eventTitle} → ${option}`);
    if (entry.notes) {
      console.log(`    Заметка: ${entry.notes}`);
    }
  }
}

function renderStatus(session: SimulationSession, lastReport: QuarterlyReport | null) {
  const snapshot = session.getSnapshot();
  const planned = snapshot.totalQuarters > 0 ? snapshot.totalQuarters.toString() : "∞";
  console.log(`\nСтатус кампании: квартал ${snapshot.quarter} из ${planned}`);
  console.log(
    `Казна: золото ${snapshot.resources.gold.toFixed(1)}, влияние ${snapshot.resources.influence.toFixed(1)}, рабочая сила ${snapshot.resources.labor.toFixed(1)}`
  );
  console.log(
    `Доверие: советник ${formatPercent(snapshot.trust.advisor)} • Угрозы ${snapshot.modifiers.threat.toFixed(2)} • Бюджет ${snapshot.modifiers.budget.toFixed(2)} • Режим ${snapshot.controlState.currentMode}`
  );
  if (lastReport) {
    console.log(
      `Последний ход: стабильность ${lastReport.kpis.stability.value.toFixed(1)} (${formatTrend(lastReport.kpis.stability)}), рост ${lastReport.kpis.economicGrowth.value.toFixed(1)} (${formatTrend(lastReport.kpis.economicGrowth)}), безопасность ${lastReport.kpis.securityIndex.value.toFixed(1)} (${formatTrend(lastReport.kpis.securityIndex)})`
    );
  }
  console.log(`Активные кризисы: ${snapshot.activeEvents.length}`);
}

function showActiveEvents(session: SimulationSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.activeEvents.length === 0) {
    console.log("Сейчас нет активных кризисов.");
    return;
  }
  console.log("Активные кризисы:");
  snapshot.activeEvents.forEach((entry, index) => {
    console.log(
      ` ${index + 1}. ${entry.event.title} [${entry.event.severity}] — осталось ${entry.remainingTime} хода(ов)`
    );
    console.log(`    Категория: ${entry.event.category}`);
    if (entry.event.origin?.regionName || entry.event.origin?.estateName) {
      console.log(
        `    Контекст: ${[entry.event.origin?.regionName, entry.event.origin?.estateName].filter(Boolean).join(", ")}`
      );
    }
  });
}

function showInterventionLog(session: SimulationSession, limit = 5) {
  const log = session.getSnapshot().interventionLog;
  if (log.length === 0) {
    console.log("Журнал вмешательств пуст.");
    return;
  }
  console.log(`Последние ${Math.min(limit, log.length)} записей журнала:`);
  for (const entry of log.slice(-limit)) {
    const performer = entry.mode === "player" ? "Игрок" : "Совет";
    console.log(
      ` Q${entry.quarter}: ${performer} → ${entry.eventTitle} → ${entry.optionId ?? "отложено"} (осталось ${entry.remainingTime})`
    );
    if (entry.notes) {
      console.log(`    Заметка: ${entry.notes}`);
    }
  }
}

function showQuarterSummary(report: QuarterlyReport, verbose = false) {
  console.log(`\n--- Квартал ${report.quarter} ---`);
  console.log(
    `Доходы: золото ${report.incomes.gold.toFixed(1)}, влияние ${report.incomes.influence.toFixed(1)}, рабочая сила ${report.incomes.labor.toFixed(1)}`
  );
  console.log(
    `Расходы: всего ${report.expenses.total.toFixed(1)} (армия ${report.expenses.departments.military.toFixed(1)}, экономика ${report.expenses.departments.economy.toFixed(1)}, внутренняя политика ${report.expenses.departments.internal.toFixed(1)})`
  );
  console.log(
    `Казна: золото ${report.treasury.gold.toFixed(1)}, влияние ${report.treasury.influence.toFixed(1)}, рабочая сила ${report.treasury.labor.toFixed(1)}`
  );
  console.log(
    `KPI: стабильность ${report.kpis.stability.value.toFixed(1)} (${formatTrend(report.kpis.stability)}), рост ${report.kpis.economicGrowth.value.toFixed(1)} (${formatTrend(report.kpis.economicGrowth)}), безопасность ${report.kpis.securityIndex.value.toFixed(1)} (${formatTrend(report.kpis.securityIndex)}), кризисы ${report.kpis.activeCrises.value.toFixed(0)}`
  );
  console.log(
    `Доверие советника: ${formatPercent(report.trust.advisor)} • Индекс угроз: ${report.activeThreatLevel.toFixed(2)} • Режим: ${report.controlMode}`
  );

  if (report.events.length === 0) {
    console.log("События: без инцидентов");
    return;
  }

  console.log("События квартала:");
  for (const outcome of report.events) {
    const resolution = outcome.resolutionMode === "player" ? "Игрок" : outcome.resolutionMode === "council" ? "Совет" : "Система";
    const option = outcome.selectedOptionId ? ` → ${outcome.selectedOptionId}` : "";
    console.log(` • [${outcome.event.severity}] ${outcome.event.title}${option} (${outcome.status}, ${resolution})`);
    if (verbose || outcome.notes) {
      if (outcome.notes) {
        console.log(`    Заметка: ${outcome.notes}`);
      }
      if (outcome.appliedEffects.length > 0) {
        console.log(`    Эффекты: ${formatEffects(outcome.appliedEffects)}`);
      }
    }
  }
}

function printHelp() {
  console.log(`Доступные команды:
  help              — показать список команд
  status            — краткая сводка по кампании
  next              — перейти к следующему кварталу (с интерактивным решением событий)
  events            — показать активные кризисы и дедлайны
  report            — повторно показать последний квартальный отчёт
  mode <режим> [причина] — сменить режим управления (manual | advisor | hybrid)
  extend <n>        — увеличить длительность кампании ещё на n кварталов
  autosave <on|off> — включить или выключить автосохранение после каждого квартала
  log               — показать последние записи журнала вмешательств
  save [метка]      — сохранить текущее состояние в каталог dist/saves
  load <путь>       — загрузить сохранённую сессию (каталог manifest.json)
  exit              — завершить игру`);
}

function persistLiveDashboard(session: SimulationSession, result: SimulationResult) {
  const snapshot = session.getSnapshot();
  const lastReport = session.getLatestReport();
  const council = snapshot.council.map((member) => ({
    id: member.id,
    name: member.name,
    portfolio: member.portfolio,
    stress: member.stress,
    motivation: member.motivation,
    assignedMandates: [...member.assignedMandates],
    focusDepartment: member.focusDepartment,
    lastQuarterSummary: member.lastQuarterSummary,
  }));

  const payload = {
    session: {
      currentQuarter: snapshot.quarter,
      totalQuarters: snapshot.totalQuarters,
      controlMode: snapshot.controlState.currentMode,
      resources: snapshot.resources,
      trust: snapshot.trust,
      modifiers: snapshot.modifiers,
      averages: result.kpiSummary.averages,
    },
    activeEvents: snapshot.activeEvents.map((entry) => ({
      event: entry.event,
      remainingTime: entry.remainingTime,
      originQuarter: entry.originQuarter,
      escalated: entry.escalated,
    })),
    plan: {
      priorities: snapshot.plan.priorities,
      mandates: lastReport?.mandateProgress ?? [],
      projects: snapshot.plan.projects,
    },
    council,
    lastReport: lastReport ?? null,
    interventionLog: result.interventionLog.slice(-20),
    totals: result.totals,
  };

  const targetDir = join("dist", "dashboard");
  mkdirSync(targetDir, { recursive: true });
  const targetPath = join(targetDir, "live.json");
  writeFileSync(targetPath, JSON.stringify(payload, null, 2), "utf-8");
  return targetPath;
}

async function main() {
  const config = buildBaselineConfig();
  let session = new SimulationSession(config);
  const rl = createInterface({ input, output, terminal: true });
  const handler = new CliInterventionHandler(rl);

  console.log("Имперская кампания запущена. Введите 'help' для списка команд.");

  let running = true;
  let lastReport: QuarterlyReport | null = null;
  let autoSaveEnabled = false;

  rl.on("SIGINT", () => {
    running = false;
  });

  renderStatus(session, lastReport);
  persistLiveDashboard(session, session.buildResult());

  while (running) {
    const raw = (await rl.question("\nкоманда> ")).trim();
    if (!raw) {
      continue;
    }
    const [command, ...rest] = raw.split(/\s+/);
    const lower = command.toLowerCase();

    try {
      switch (lower) {
        case "help":
        case "?":
          printHelp();
          break;
        case "status":
          renderStatus(session, lastReport);
          break;
        case "events":
          showActiveEvents(session);
          break;
        case "log":
          showInterventionLog(session);
          break;
        case "report":
          if (lastReport) {
            showQuarterSummary(lastReport, true);
          } else {
            console.log("Отчётов ещё нет. Используйте команду next.");
          }
          break;
        case "mode": {
          const mode = rest[0] as CampaignControlMode | undefined;
          if (!mode || !["manual", "advisor", "hybrid"].includes(mode)) {
            console.log("Укажите режим: manual | advisor | hybrid");
            break;
          }
          const reason = rest.slice(1).join(" ") || "Переключение через CLI";
          session.setControlMode(mode, reason, "cli");
          console.log(`Режим управления изменён на ${mode}.`);
          break;
        }
        case "extend": {
          const amount = Number(rest[0]);
          if (!Number.isFinite(amount) || amount <= 0) {
            console.log("Укажите, сколько кварталов добавить. Пример: extend 4");
            break;
          }
          session.extendCampaign(amount);
          console.log(`Новый лимит кампании: ${session.getTotalQuarters()}`);
          break;
        }
        case "autosave": {
          const mode = rest[0]?.toLowerCase();
          if (mode === "on") {
            autoSaveEnabled = true;
            console.log("Автосохранение включено. После каждого квартала будет создана запись.");
          } else if (mode === "off") {
            autoSaveEnabled = false;
            console.log("Автосохранение выключено.");
          } else {
            console.log("Использование: autosave on|off");
          }
          break;
        }
        case "load": {
          const target = rest[0];
          if (!target) {
            console.log("Укажите путь к каталогу сохранения или файлу manifest.json.");
            break;
          }
          let resolved = resolve(target);
          if (!existsSync(resolved)) {
            console.log("Указанный путь не найден.");
            break;
          }
          const stats = statSync(resolved);
          if (stats.isFile()) {
            resolved = resolve(resolved, "..");
          }
          const loaded = loadSimulationSave(resolved);
          if (!loaded.sessionState) {
            console.log("В сохранении нет состояния активной кампании.");
            break;
          }
          session = SimulationSession.fromState(config, loaded.sessionState);
          lastReport = session.getLatestReport();
          console.log(
            `Загружена сессия ${loaded.manifest.id}: квартал ${loaded.sessionState.currentQuarter} из ${loaded.sessionState.totalQuarters > 0 ? loaded.sessionState.totalQuarters : "∞"}`
          );
          renderStatus(session, lastReport);
          if (loaded.result) {
            const livePath = persistLiveDashboard(session, loaded.result);
            console.log(`Live-дэшборд обновлён: ${livePath}`);
          } else {
            const livePath = persistLiveDashboard(session, session.buildResult());
            console.log(`Live-дэшборд обновлён: ${livePath}`);
          }
          break;
        }
        case "save": {
          const label = rest.join(" ") || undefined;
          const result = session.buildResult();
          const sessionState = session.exportState();
          const save = saveSimulationResult(result, {
            config,
            label: label?.trim().length ? label : undefined,
            status: session.isComplete() ? "completed" : "in_progress",
            sessionState,
          });
          console.log(`Сохранено в ${save.directory}`);
          if (save.sessionStatePath) {
            console.log(`Снимок сессии: ${save.sessionStatePath}`);
          }
          const livePath = persistLiveDashboard(session, result);
          console.log(`Live-дэшборд обновлён: ${livePath}`);
          break;
        }
        case "next":
        case "n":
          if (session.isComplete()) {
            console.log(
              "Достигнут лимит кампании. Используйте extend <n>, чтобы добавить кварталы, или exit для выхода."
            );
            break;
          }
          lastReport = await session.advanceQuarter({ interventionHandler: handler });
          showQuarterSummary(lastReport);
          renderStatus(session, lastReport);
          const liveResult = session.buildResult();
          const livePath = persistLiveDashboard(session, liveResult);
          console.log(`Live-дэшборд обновлён: ${livePath}`);
          if (autoSaveEnabled) {
            const autoState = session.exportState();
            const save = saveSimulationResult(liveResult, {
              config,
              label: `autosave-q${session.getCurrentQuarter()}`,
              baseDir: join("dist", "saves", "autosave"),
              status: session.isComplete() ? "completed" : "in_progress",
              sessionState: autoState,
            });
            console.log(`Автосохранение выполнено: ${save.directory}`);
          }
          break;
        case "exit":
        case "quit":
        case "q":
          running = false;
          break;
        default:
          console.log(`Неизвестная команда "${command}". Введите help для подсказки.`);
      }
    } catch (error) {
      console.error("Ошибка выполнения команды:", error);
    }
  }

  await rl.close();
  console.log("Сеанс завершён. До встречи!");
}

main().catch((error) => {
  console.error("Критическая ошибка интерактивного режима:", error);
  process.exitCode = 1;
});
