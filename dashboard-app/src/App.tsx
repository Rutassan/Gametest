import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdvisorConsultationStance,
  AdvisorConsultationThread,
  CampaignControlMode,
  ControlModeLogEntry,
  DashboardPayload,
  EventOutcome,
  EventOutcomeStatus,
  EventSeverity,
  KPIEntry,
  KPIReport,
  QuarterlyReport,
  SimulationData,
  LiveCampaignPayload,
  ThreatLevel,
} from "./types";

type SeverityFilter = "all" | EventSeverity;

const DATA_URL = import.meta.env.VITE_DATA_URL ?? "../data.json";
const LIVE_DATA_URL = import.meta.env.VITE_LIVE_DATA_URL ?? "../live.json";

const severityLabels: Record<SeverityFilter, string> = {
  all: "Все уровни",
  minor: "Низкая",
  moderate: "Средняя",
  major: "Критическая",
};

const statusClassMap: Record<EventOutcomeStatus, string> = {
  resolved: "status-resolved",
  failed: "status-failed",
  deferred: "status-deferred",
};

const threatText: Record<ThreatLevel, string> = {
  low: "Стабильно",
  moderate: "Тревожно",
  critical: "Критично",
};

const threatClass: Record<ThreatLevel, string> = {
  low: "threat-pill threat-low",
  moderate: "threat-pill threat-moderate",
  critical: "threat-pill threat-critical",
};

const controlModeLabels: Record<CampaignControlMode, { label: string; description: string; badgeClass: string; toneClass: string }> = {
  manual: {
    label: "Ручной",
    description: "Игрок подтверждает решения",
    badgeClass: "control-pill manual",
    toneClass: "manual",
  },
  advisor: {
    label: "Совет",
    description: "Советник действует автономно",
    badgeClass: "control-pill advisor",
    toneClass: "advisor",
  },
  hybrid: {
    label: "Гибрид",
    description: "Критичные кейсы требуют подтверждения",
    badgeClass: "control-pill hybrid",
    toneClass: "hybrid",
  },
};

const consultationStanceMeta: Record<AdvisorConsultationStance, { label: string; className: string }> = {
  support: { label: "Поддержка", className: "stance-pill support" },
  caution: { label: "Предупреждение", className: "stance-pill caution" },
  escalate: { label: "Эскалация", className: "stance-pill escalate" },
};

const resolutionModeMeta = {
  player: { label: "Игрок решал", className: "resolution-pill player" },
  council: { label: "Совет решал", className: "resolution-pill council" },
} as const;

const departmentLabels: Record<string, string> = {
  economy: "Экономика",
  diplomacy: "Дипломатия",
  internal: "Внутренняя политика",
  military: "Военное ведомство",
  science: "Наука",
  security: "Безопасность",
  administration: "Администрирование",
};

const priorityMeta: Record<"neglect" | "steady" | "push", { label: string; className: string }> = {
  neglect: { label: "Сокращение", className: "priority-pill neglect" },
  steady: { label: "Базовый режим", className: "priority-pill steady" },
  push: { label: "Усиление", className: "priority-pill push" },
};

const mandateStatusMeta = {
  not_started: { label: "Не начато", className: "mandate-pill neutral" },
  in_progress: { label: "В работе", className: "mandate-pill progress" },
  on_track: { label: "В графике", className: "mandate-pill success" },
  at_risk: { label: "Под угрозой", className: "mandate-pill risk" },
  completed: { label: "Завершено", className: "mandate-pill done" },
  failed: { label: "Провалено", className: "mandate-pill failed" },
} as const;

const riskLabels: Record<ThreatLevel, string> = {
  low: "Низкий риск",
  moderate: "Повышенный риск",
  critical: "Критический риск",
};

const riskClassMap: Record<ThreatLevel, string> = {
  low: "risk-pill risk-low",
  moderate: "risk-pill risk-moderate",
  critical: "risk-pill risk-critical",
};

const projectFocusLabels: Record<string, string> = {
  economy: "Экономика",
  diplomacy: "Дипломатия",
  internal: "Внутренняя политика",
  military: "Армия",
  science: "Наука",
  security: "Безопасность",
  administration: "Администрирование",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function LiveCampaignView({
  data,
  error,
  onRefresh,
}: {
  data: LiveCampaignPayload | null;
  error: string | null;
  onRefresh: () => void;
}) {
  if (error) {
    return (
      <div className="live-view">
        <div className="error">
          <strong>{error}</strong>
          <button onClick={onRefresh}>Попробовать снова</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="live-view">
        <div className="empty-state">
          Данные живой кампании пока не получены. Запустите интерактивный режим `npm run play` и выполните автосохранение.
        </div>
      </div>
    );
  }

  const lastReport = data.lastReport ?? null;
  const priorities = Object.entries(
    data.plan.priorities ?? {}
  ) as Array<[string, "neglect" | "steady" | "push"]>;

  return (
    <div className="live-view">
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Активные кризисы</h2>
          <button onClick={onRefresh}>Обновить</button>
        </div>
        {data.activeEvents.length === 0 ? (
          <div className="empty-state">Кризисов не обнаружено.</div>
        ) : (
          <div className="live-events">
            {data.activeEvents.map((entry) => (
              <article key={`${entry.event.id}-${entry.originQuarter}`} className="live-event-card">
                <header>
                  <h3>{entry.event.title}</h3>
                  <span className="event-pill">{entry.event.severity}</span>
                </header>
                <div className="live-event-meta">
                  <span>{entry.event.category}</span>
                  <span>Осталось ходов: {entry.remainingTime}</span>
                  {entry.event.origin?.regionName ? <span>Регион: {entry.event.origin.regionName}</span> : null}
                  {entry.event.origin?.estateName ? <span>Сословие: {entry.event.origin.estateName}</span> : null}
                </div>
                <p>{entry.event.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Последний квартал</h2>
          {lastReport ? <span className="badge">Q{lastReport.quarter}</span> : null}
        </div>
        {lastReport ? (
          <div className="live-report">
            <div className="live-report-metrics">
              <article>
                <h4>KPI</h4>
                <ul>
                  <li>
                    Стабильность: {lastReport.kpis.stability.value.toFixed(1)} ({describeTrend(lastReport.kpis.stability).text})
                  </li>
                  <li>
                    Экономический рост: {lastReport.kpis.economicGrowth.value.toFixed(1)} ({describeTrend(lastReport.kpis.economicGrowth).text})
                  </li>
                  <li>
                    Безопасность: {lastReport.kpis.securityIndex.value.toFixed(1)} ({describeTrend(lastReport.kpis.securityIndex).text})
                  </li>
                </ul>
              </article>
              <article>
                <h4>Финансы</h4>
                <ul>
                  <li>Доходы: {formatNumber(lastReport.incomes.gold, 1)} зол.</li>
                  <li>Казна: {formatNumber(lastReport.treasury.gold, 1)} зол.</li>
                  <li>Уровень угроз: {lastReport.activeThreatLevel.toFixed(2)}</li>
                </ul>
              </article>
            </div>
            <div className="live-report-events">
              <h4>Решённые события</h4>
              {lastReport.events.length === 0 ? (
                <div className="empty-state">События не обрабатывались.</div>
              ) : (
                <ul>
                  {lastReport.events.slice(0, 4).map((event, index) => (
                    <li key={`${event.event.id}-${index}`}>
                      <strong>{event.event.title}</strong> — {event.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">Квартальных отчётов пока нет.</div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Совет и повестка</h2>
        </div>
        {data.council.length === 0 ? (
          <div className="empty-state">Нет данных о членах совета.</div>
        ) : (
          <div className="council-grid">
            {data.council.map((member) => (
              <article key={member.id} className="council-card">
                <h4>{member.name}</h4>
                <span className="council-role">{member.portfolio}</span>
                <div className="council-metric">
                  <span>Мотивация</span>
                  <span>{formatPercent(member.motivation * 100)}</span>
                </div>
                <div className="council-metric">
                  <span>Стресс</span>
                  <span>{formatPercent(member.stress * 100)}</span>
                </div>
                {member.lastQuarterSummary ? (
                  <p className="council-note">{member.lastQuarterSummary}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {priorities.length > 0 ? (
          <div className="plan-priorities">
            <h4>Приоритеты</h4>
            <ul>
              {priorities.map(([department, priority]) => (
                <li key={department}>
                  <span>{departmentLabel(department)}</span>
                  <span className={`priority-pill ${priority}`}>{priorityMeta[priority].label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatNumber(value: number, fraction = 1): string {
  return value.toFixed(fraction);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatShare(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function departmentLabel(name: string): string {
  return departmentLabels[name] ?? name;
}

function projectFocusLabel(focus: string): string {
  return projectFocusLabels[focus] ?? focus;
}

function describeTrend(entry: KPIEntry): { text: string; css: string } {
  if (entry.trend > 0.05) {
    return { text: `↑ +${entry.trend.toFixed(2)}`, css: "trend-positive" };
  }
  if (entry.trend < -0.05) {
    return { text: `↓ ${entry.trend.toFixed(2)}`, css: "trend-negative" };
  }
  return { text: "→ 0.00", css: "trend-neutral" };
}

function renderEffects(effects: EventOutcome["appliedEffects"]) {
  if (effects.length === 0) {
    return null;
  }
  const chunks = effects.map(
    (effect) =>
      `${effect.type} → ${effect.target || "империя"}: ${effect.value}${
        effect.duration ? ` (на ${effect.duration} хода)` : ""
      }`
  );
  return chunks.join("; ");
}

function findChosenOption(outcome: EventOutcome): string | null {
  if (!outcome.selectedOptionId) {
    return null;
  }
  const option = outcome.event.options.find(
    (entry) => entry.id === outcome.selectedOptionId
  );
  return option?.description ?? outcome.selectedOptionId ?? null;
}

function formatControlLogEntry(entry: ControlModeLogEntry): { title: string; details: string } {
  const modeInfo = controlModeLabels[entry.mode];
  const time = new Date(entry.timestamp);
  const timestamp = Number.isNaN(time.getTime())
    ? entry.timestamp
    : new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(time);
  const parts: string[] = [timestamp];
  if (entry.reason) {
    parts.push(entry.reason);
  }
  if (entry.triggeredBy) {
    parts.push(`Источник: ${entry.triggeredBy}`);
  }
  return {
    title: `Q${entry.quarter} • ${modeInfo.label}`,
    details: parts.join(" • "),
  };
}

function useSimulationData() {
  const [data, setData] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);

    fetch(DATA_URL, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as DashboardPayload;
        setData(payload.data.simulation);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return { data, loading, error, reload: load, setData };
}

export default function App() {
  const { data: simulation, loading, error, reload, setData } = useSimulationData();
  const [liveData, setLiveData] = useState<LiveCampaignPayload | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "live">("summary");
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [handoffLog, setHandoffLog] = useState<Array<{ id: string; message: string; timestamp: string }>>([]);

  useEffect(() => {
    if (simulation) {
      const latestQuarter = simulation.reports.at(-1)?.quarter ?? null;
      setSelectedQuarter(latestQuarter);
    }
  }, [simulation]);

  const refreshLiveData = useCallback(() => {
    fetch(LIVE_DATA_URL, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as LiveCampaignPayload;
      })
      .then((payload) => {
        setLiveData(payload);
        setLiveError(null);
      })
      .catch(() => {
        setLiveData(null);
        setLiveError("Live данные недоступны. Запустите интерактивный режим и автосохранение.");
      });
  }, []);

  useEffect(() => {
    refreshLiveData();
    const intervalId = window.setInterval(refreshLiveData, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshLiveData]);

  const reportForQuarter = useMemo<QuarterlyReport | null>(() => {
    if (!simulation || selectedQuarter === null) {
      return null;
    }
    return simulation.reports.find((report) => report.quarter === selectedQuarter) ?? null;
  }, [simulation, selectedQuarter]);

  useEffect(() => {
    const consultations = reportForQuarter?.advisorConsultations ?? [];
    if (consultations.length === 0) {
      setSelectedConsultationId(null);
      return;
    }
    setSelectedConsultationId((previous) => {
      if (previous && consultations.some((entry) => entry.id === previous)) {
        return previous;
      }
      return consultations[0]?.id ?? null;
    });
  }, [reportForQuarter]);

  const consultationsForQuarter = reportForQuarter?.advisorConsultations ?? [];

  const selectedConsultation = useMemo<AdvisorConsultationThread | null>(() => {
    if (consultationsForQuarter.length === 0) {
      return null;
    }
    if (!selectedConsultationId) {
      return consultationsForQuarter[0] ?? null;
    }
    return (
      consultationsForQuarter.find((entry) => entry.id === selectedConsultationId) ??
      consultationsForQuarter[0] ??
      null
    );
  }, [consultationsForQuarter, selectedConsultationId]);

  const consultationByKpi = useMemo<Partial<Record<keyof KPIReport, AdvisorConsultationThread>>>(() => {
    const map: Partial<Record<keyof KPIReport, AdvisorConsultationThread>> = {};
    for (const thread of consultationsForQuarter) {
      if (thread.relatedKpi) {
        map[thread.relatedKpi] = thread;
      }
    }
    return map;
  }, [consultationsForQuarter]);

  const consultationsByEvent = useMemo(() => {
    const map = new Map<string, AdvisorConsultationThread>();
    for (const thread of consultationsForQuarter) {
      if (thread.relatedEventId) {
        map.set(thread.relatedEventId, thread);
      }
    }
    return map;
  }, [consultationsForQuarter]);

  const currentHandoff = useMemo(() => {
    if (!selectedConsultation) {
      return null;
    }
    return handoffLog.find((entry) => entry.id === selectedConsultation.id) ?? null;
  }, [handoffLog, selectedConsultation]);

  const handleHandoff = useCallback(() => {
    if (!selectedConsultation || selectedQuarter === null || !reportForQuarter) {
      return;
    }

    if (selectedConsultation.handoffIssued) {
      const timestamp = new Date().toISOString();
      const message = `${selectedConsultation.topic}: уже передано исполнение.`;
      setHandoffLog((previous) => [
        { id: selectedConsultation.id, message, timestamp },
        ...previous.filter((entry) => entry.id !== selectedConsultation.id),
      ].slice(0, 5));
      return;
    }

    const target = selectedConsultation.handoffTarget ?? "Совет";
    const timestamp = new Date().toISOString();
    const relatedEventTitle = selectedConsultation.relatedEventId
      ? reportForQuarter.events.find((event) => event.event.id === selectedConsultation.relatedEventId)?.event.title ?? selectedConsultation.topic
      : selectedConsultation.topic;

    setData((previous) => {
      if (!previous) {
        return previous;
      }

      const reports = previous.reports.map((report) => {
        if (report.quarter !== selectedQuarter) {
          return report;
        }

        const updatedConsultations = report.advisorConsultations.map((thread) =>
          thread.id === selectedConsultation.id
            ? {
                ...thread,
                handoffIssued: true,
                handedOffAt: timestamp,
                handoffNotes: `Передано на ${target}`,
              }
            : thread
        );

        const updatedEvents = report.events.map((eventOutcome) => {
          if (eventOutcome.event.id !== selectedConsultation.relatedEventId) {
            return eventOutcome;
          }
          return {
            ...eventOutcome,
            handoffIssued: true,
            handoffTarget: target,
            handedOffAt: timestamp,
            handledBy: target,
          };
        });

        return {
          ...report,
          advisorConsultations: updatedConsultations,
          events: updatedEvents,
        };
      });

      const interventionLog = [...(previous.interventionLog ?? [])];
      if (selectedConsultation.relatedEventId) {
        interventionLog.push({
          eventId: selectedConsultation.relatedEventId,
          eventTitle: relatedEventTitle,
          quarter: selectedQuarter,
          mode: "player",
          optionId: null,
          notes: `Передача исполнения: ${target}`,
          advisorOptionId: null,
          advisorNotes: undefined,
          remainingTime: 0,
          timestamp,
          handoffIssued: true,
          handoffTarget: target,
          handoffNotes: "Отметка из дашборда",
          handledBy: target,
        });
      }

      return {
        ...previous,
        reports,
        interventionLog,
      };
    });

    const message = `${selectedConsultation.topic}: передано исполнение (${target})`;
    setHandoffLog((previous) => [
      { id: selectedConsultation.id, message, timestamp },
      ...previous.filter((entry) => entry.id !== selectedConsultation.id),
    ].slice(0, 5));
  }, [selectedConsultation, selectedQuarter, reportForQuarter, setData]);

  const filteredEvents = useMemo<EventOutcome[]>(() => {
    if (!reportForQuarter) {
      return [];
    }
    if (severityFilter === "all") {
      return reportForQuarter.events;
    }
    return reportForQuarter.events.filter(
      (entry) => entry.event.severity === severityFilter
    );
  }, [reportForQuarter, severityFilter]);

  if (loading) {
    return (
      <div className="loading">
        <strong>Загружаем данные симуляции…</strong>
        <span>Убедитесь, что выполнен скрипт `npm run dashboard:prepare`.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <strong>Не удалось загрузить данные дашборда</strong>
        <span>Причина: {error}</span>
        <button onClick={reload}>Повторить попытку</button>
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="error">
        <strong>Данные дашборда не найдены</strong>
        <span>Сначала сгенерируйте отчёт командой `npm run dashboard:prepare`.</span>
        <button onClick={reload}>Проверить снова</button>
      </div>
    );
  }

  const quarterOptions = simulation.reports.map((report) => ({
    value: report.quarter,
    label: `Квартал ${report.quarter}`,
  }));

  const averages = simulation.kpiSummary.averages;
  const finalState = simulation.finalState;
  const controlState = simulation.controlState;
  const controlInfo = controlModeLabels[controlState.currentMode];

  const kpiEntries: Array<{ key: keyof KPIReport; label: string; data: KPIEntry }> =
    reportForQuarter
      ? [
          { key: "stability", label: "Стабильность", data: reportForQuarter.kpis.stability },
          {
            key: "economicGrowth",
            label: "Экономический рост",
            data: reportForQuarter.kpis.economicGrowth,
          },
          {
            key: "securityIndex",
            label: "Индекс безопасности",
            data: reportForQuarter.kpis.securityIndex,
          },
          {
            key: "activeCrises",
            label: "Активные кризисы",
            data: reportForQuarter.kpis.activeCrises,
          },
        ]
      : [];

  const estateTrustEntries = reportForQuarter
    ? Object.entries(reportForQuarter.trust.estates)
    : Object.entries(finalState.trust.estates);

  const departments = reportForQuarter?.departments ?? [];
  const mandates = reportForQuarter?.mandateProgress ?? [];
  const projects = reportForQuarter?.projects ?? [];
  const agendaHighlights = reportForQuarter?.agendaHighlights ?? [];
  const councilReports = reportForQuarter?.councilReports ?? [];
  const estates = reportForQuarter?.estates ?? [];
  const regions = reportForQuarter?.regions ?? [];

  const liveSession = liveData?.session ?? null;
  const liveControlInfo = liveSession ? controlModeLabels[liveSession.controlMode] : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-bar">
          <div>
            <h1 className="app-title">Имперский дашборд</h1>
            <div className="app-meta">
              <span>Сохранение: {simulation.label ?? simulation.id}</span>
              <span>Создано: {formatDate(simulation.createdAt)}</span>
              <span>Отчётов: {simulation.reports.length}</span>
              <span>Советник: {simulation.config?.advisor ?? "не задан"}</span>
            </div>
          </div>
          <div className="tab-toggle">
            <button
              type="button"
              className={activeTab === "summary" ? "tab active" : "tab"}
              onClick={() => setActiveTab("summary")}
            >
              Отчёт
            </button>
            <button
              type="button"
              className={activeTab === "live" ? "tab active" : "tab"}
              onClick={() => setActiveTab("live")}
            >
              Живая кампания
            </button>
          </div>
        </div>
        {activeTab === "summary" ? (
          <div className="summary-grid">
            <article className="metric-card">
              <h3>Казна</h3>
              <span className="value">{formatNumber(finalState.resources.gold, 1)} зол.</span>
              <span className="subtitle">
                Влияние: {formatNumber(finalState.resources.influence, 1)} • Раб. сила:{" "}
                {formatNumber(finalState.resources.labor, 1)}
              </span>
            </article>
            <article className="metric-card">
              <h3>Доверие советника</h3>
              <span className="value">{formatPercent(finalState.trust.advisor * 100)}</span>
              <span className="subtitle">
                Сословия:{" "}
                {estateTrustEntries
                  .map(([name, trust]) => `${name}: ${formatPercent(trust * 100)}`)
                  .join(" • ")}
              </span>
            </article>
            <article className="metric-card">
              <h3>Угроза</h3>
              <span className="value">{finalState.activeThreatLevel.toFixed(2)}</span>
              <span className="subtitle">
                {simulation.kpiSummary.latest?.securityIndex
                  ? threatText[simulation.kpiSummary.latest.securityIndex.threatLevel]
                  : "Нет оценки"}
              </span>
            </article>
            <article className="metric-card">
              <h3>Средние KPI</h3>
              <span className="value">{averages.stability.toFixed(1)} стабильность</span>
              <span className="subtitle">
                Рост {averages.economicGrowth.toFixed(1)} • Безопасность {averages.securityIndex.toFixed(1)}
              </span>
            </article>
            <article className="metric-card control-mode-card">
              <h3>Режим кампании</h3>
              <span className={`value ${controlInfo.badgeClass}`}>{controlInfo.label}</span>
              <span className="subtitle">{controlInfo.description}</span>
            </article>
          </div>
        ) : liveSession ? (
          <div className="summary-grid live-summary-grid">
            <article className="metric-card">
              <h3>Квартал</h3>
              <span className="value">
                Q{liveSession.currentQuarter} / {liveSession.totalQuarters > 0 ? liveSession.totalQuarters : "∞"}
              </span>
              <span className="subtitle">
                Средняя стабильность: {liveSession.averages.stability.toFixed(1)}
              </span>
            </article>
            <article className="metric-card">
              <h3>Казна</h3>
              <span className="value">{formatNumber(liveSession.resources.gold, 1)} зол.</span>
              <span className="subtitle">
                Влияние: {formatNumber(liveSession.resources.influence, 1)} • Раб. сила:{" "}
                {formatNumber(liveSession.resources.labor, 1)}
              </span>
            </article>
            <article className="metric-card">
              <h3>Доверие советника</h3>
              <span className="value">{formatPercent(liveSession.trust.advisor * 100)}</span>
              <span className="subtitle">Активных кризисов: {liveData?.activeEvents.length ?? 0}</span>
            </article>
            <article className="metric-card control-mode-card">
              <h3>Режим кампании</h3>
              <span className={`value ${liveControlInfo?.badgeClass ?? ""}`}>{liveControlInfo?.label ?? "?"}</span>
              <span className="subtitle">{liveControlInfo?.description ?? "Нет данных"}</span>
            </article>
            <article className="metric-card">
              <h3>Уровень угроз</h3>
              <span className="value">{liveSession.modifiers.threat.toFixed(2)}</span>
              <span className="subtitle">Бюджетный модификатор: {liveSession.modifiers.budget.toFixed(2)}</span>
            </article>
          </div>
        ) : (
          <div className="live-placeholder">
            {liveError ?? "Live данные пока не загружены. Запустите интерактивную сессию."}
          </div>
        )}
      </header>

      {activeTab === "summary" ? (
        <>
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Ключевые показатели</h2>
          <div className="controls">
            <label>
              Квартал
              <select
                value={selectedQuarter ?? undefined}
                onChange={(event) => setSelectedQuarter(Number(event.target.value))}
              >
                {quarterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={reload}>Обновить данные</button>
          </div>
        </div>

        {reportForQuarter ? (
          <>
            <div className="kpi-grid">
              {kpiEntries.map((item) => {
                const trend = describeTrend(item.data);
                const kpiConsultation = consultationByKpi[item.key];
                return (
                  <article key={item.key} className="kpi-card">
                    <h4>{item.label}</h4>
                    <div className="kpi-value">{item.data.value.toFixed(2)}</div>
                    <div className="kpi-meta">
                      <span className={trend.css}>{trend.text}</span>
                      <span className={threatClass[item.data.threatLevel]}>
                        {threatText[item.data.threatLevel]}
                      </span>
                    </div>
                    {kpiConsultation ? (
                      <div className="consultation-note">Совет: {kpiConsultation.summary}</div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <table className="budget-table">
              <thead>
                <tr>
                  <th>Метрика</th>
                  <th>Золото</th>
                  <th>Влияние</th>
                  <th>Раб. сила</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Доходы</td>
                  <td>{formatNumber(reportForQuarter.incomes.gold)}</td>
                  <td>{formatNumber(reportForQuarter.incomes.influence)}</td>
                  <td>{formatNumber(reportForQuarter.incomes.labor)}</td>
                </tr>
                <tr>
                  <td>Казна</td>
                  <td>{formatNumber(reportForQuarter.treasury.gold)}</td>
                  <td>{formatNumber(reportForQuarter.treasury.influence)}</td>
                  <td>{formatNumber(reportForQuarter.treasury.labor)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <div className="empty-state">Нет данных по выбранному кварталу.</div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Ведомства</h2>
        </div>

        {reportForQuarter ? (
          departments.length === 0 ? (
            <div className="empty-state">Нет данных по ведомствам.</div>
          ) : (
            <div className="department-grid">
              {departments.map((department) => {
                const priorityInfo = priorityMeta[department.agendaPriority];
                return (
                  <article key={department.name} className="department-card">
                    <header className="department-header">
                      <h3>{departmentLabel(department.name)}</h3>
                      <span className={priorityInfo.className}>{priorityInfo.label}</span>
                    </header>
                    <dl className="department-stats">
                      <div>
                        <dt>Эффективность</dt>
                        <dd>{department.efficiency.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Бюджет</dt>
                        <dd>{formatNumber(department.budget, 1)}</dd>
                      </div>
                      <div>
                        <dt>Доля расхода</dt>
                        <dd>{formatShare(department.spendingShare)}</dd>
                      </div>
                    </dl>
                    <div className="progress-bar">
                      <span style={{ width: `${Math.min(100, department.spendingShare * 100)}%` }} />
                    </div>
                    <p className="department-investment">
                      Инвестиции за кампанию: {formatNumber(department.cumulativeInvestment, 1)}
                    </p>
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <div className="empty-state">Нет данных по ведомствам.</div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Совет и приоритеты</h2>
        </div>

        {agendaHighlights.length === 0 && councilReports.length === 0 ? (
          <div className="empty-state">Совет не предоставил отчёт за выбранный квартал.</div>
        ) : (
          <div className="agenda-layout">
            <div className="agenda-column">
              <h3>Приоритеты повестки</h3>
              {agendaHighlights.length === 0 ? (
                <div className="empty-state compact">Нет изменений приоритетов.</div>
              ) : (
                <ul className="agenda-list">
                  {agendaHighlights.map((highlight) => {
                    const priorityInfo = priorityMeta[highlight.priority];
                    return (
                      <li key={`${highlight.department}-${highlight.commentary}`}>
                        <span className="agenda-title">{departmentLabel(highlight.department)}</span>
                        <span className={priorityInfo.className}>{priorityInfo.label}</span>
                        <p>{highlight.commentary}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="council-column">
              <h3>Сводки советников</h3>
              {councilReports.length === 0 ? (
                <div className="empty-state compact">Нет сообщений совета.</div>
              ) : (
                <ul className="council-list">
                  {councilReports.map((report) => (
                    <li key={report.advisorId} className="council-card">
                      <header>
                        <span className="council-name">{report.advisorName}</span>
                        <span className="council-confidence">
                          Уверенность {formatConfidence(report.confidence)}
                        </span>
                      </header>
                      <p>{report.summary}</p>
                      {report.alerts ? (
                        <ul className="council-alerts">
                          {report.alerts.map((alert, index) => (
                            <li key={index}>⚠ {alert}</li>
                          ))}
                        </ul>
                      ) : null}
                      {report.focusDepartment ? (
                        <span className="council-focus">
                          Фокус: {departmentLabel(report.focusDepartment)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Поручения и проекты</h2>
        </div>

        {reportForQuarter ? (
          <div className="mandate-project-grid">
            <div className="mandate-column">
              <h3>Поручения правителя</h3>
              {mandates.length === 0 ? (
                <div className="empty-state compact">Новые поручения не выдавались.</div>
              ) : (
                <ul className="mandate-list">
                  {mandates.map((mandate) => {
                    const statusMeta = mandateStatusMeta[mandate.status];
                    return (
                      <li key={mandate.mandateId} className="mandate-card">
                        <header>
                          <span className="mandate-title">{mandate.label}</span>
                          <span className={statusMeta.className}>{statusMeta.label}</span>
                        </header>
                        <div className="progress-bar">
                          <span style={{ width: `${Math.min(100, mandate.progress * 100)}%` }} />
                        </div>
                        <div className="mandate-meta">
                          <span>Прогресс {Math.round(mandate.progress * 100)}%</span>
                          <span>Уверенность {formatConfidence(mandate.confidence)}</span>
                        </div>
                        <p>{mandate.commentary}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="project-column">
              <h3>Проекты</h3>
              {projects.length === 0 ? (
                <div className="empty-state compact">Проекты в этом квартале не обновлялись.</div>
              ) : (
                <ul className="project-list">
                  {projects.map((project) => (
                    <li key={project.id} className="project-card">
                      <header>
                        <span className="project-title">{project.name}</span>
                        <span className="project-focus">{projectFocusLabel(project.focus)}</span>
                      </header>
                      <div className="progress-bar">
                        <span style={{ width: `${Math.min(100, project.progress * 100)}%` }} />
                      </div>
                      <div className="project-meta">
                        <span>Прогресс {Math.round(project.progress * 100)}%</span>
                        {project.ownerAdvisorName ? (
                          <span>Куратор: {project.ownerAdvisorName}</span>
                        ) : null}
                      </div>
                      <p>{project.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">Нет данных по текущему кварталу.</div>
        )}
      </section>

      <section className="section consultation-section">
        <div className="section-header">
          <h2 className="section-title">Консультации советников</h2>
        </div>

        {consultationsForQuarter.length === 0 || !selectedConsultation ? (
          <div className="empty-state">Советники не направили консультации в этом квартале.</div>
        ) : (
          <>
            <form className="consultation-form">
              <label>
                Тема
                <select
                  value={selectedConsultationId ?? selectedConsultation.id}
                  onChange={(event) => setSelectedConsultationId(event.target.value)}
                >
                  {consultationsForQuarter.map((thread) => (
                    <option key={thread.id} value={thread.id}>
                      {thread.topic}
                    </option>
                  ))}
                </select>
              </label>
              <span className="consultation-prompt">{selectedConsultation.prompt}</span>
            </form>
            <p className="consultation-summary-main">{selectedConsultation.summary}</p>
            <div className="consultation-layout">
              <aside className="consultation-advisors">
                <h3>Ответы советников</h3>
                <ul className="consultation-responses">
                  {selectedConsultation.responses.map((response) => {
                    const stanceMeta = consultationStanceMeta[response.stance];
                    return (
                      <li key={response.advisorId} className="consultation-response">
                        <div className="consultation-response-header">
                          <span className="advisor-name">{response.advisorName}</span>
                          <span className={stanceMeta.className}>{stanceMeta.label}</span>
                        </div>
                        <p className="consultation-response-summary">{response.summary}</p>
                        {response.rationale.length > 0 ? (
                          <ul className="consultation-rationale">
                            {response.rationale.map((line, index) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                        {response.recommendedAction ? (
                          <div className="consultation-action">
                            Рекомендация: {response.recommendedAction}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </aside>
              <div className="consultation-recommendations">
                <h3>Итоговые рекомендации</h3>
                {selectedConsultation.recommendations.length > 0 ? (
                  <ul>
                    {selectedConsultation.recommendations.map((recommendation, index) => (
                      <li key={index}>{recommendation}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">Дополнительных указаний нет.</div>
                )}
                <button
                  type="button"
                  className="handoff-button"
                  onClick={handleHandoff}
                  disabled={!selectedConsultation || selectedConsultation.handoffIssued}
                >
                  Передать исполнение
                </button>
                {selectedConsultation.handoffTarget ? (
                  <span className="handoff-meta">{selectedConsultation.handoffTarget}</span>
                ) : null}
                {selectedConsultation.handoffIssued ? (
                  <span className="handoff-feedback">
                    Передано {selectedConsultation.handedOffAt ? formatDate(selectedConsultation.handedOffAt) : "успешно"}
                  </span>
                ) : currentHandoff ? (
                  <span className="handoff-feedback">{currentHandoff.message}</span>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Журнал управления</h2>
        </div>

        {handoffLog.length > 0 ? (
          <div className="handoff-history">
            {handoffLog.slice(0, 3).map((entry) => (
              <span key={`${entry.id}-${entry.timestamp}`}>{`${formatDate(entry.timestamp)} — ${entry.message}`}</span>
            ))}
          </div>
        ) : null}

        {controlState.history.length === 0 ? (
          <div className="empty-state">Переключения режима не зафиксированы.</div>
        ) : (
          <ul className="control-log">
            {controlState.history.map((entry) => {
              const formatted = formatControlLogEntry(entry);
              const modeClass = controlModeLabels[entry.mode].toneClass;
              return (
                <li
                  key={`${entry.quarter}-${entry.timestamp}`}
                  className={`control-log-entry ${modeClass}`}
                >
                  <span className="log-title">{formatted.title}</span>
                  <span className="log-details">{formatted.details}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Журнал событий</h2>
          <div className="controls">
            <label>
              Серьёзность
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
              >
                {Object.entries(severityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="empty-state">События выбранного типа отсутствуют.</div>
        ) : (
          <div className="events-list">
            {filteredEvents.map((entry, index) => {
              const chosen = findChosenOption(entry);
              const contextParts: string[] = [];
              if (entry.event.origin?.regionName) {
                contextParts.push(`Регион: ${entry.event.origin.regionName}`);
              }
              if (entry.event.origin?.estateName) {
                contextParts.push(`Сословие: ${entry.event.origin.estateName}`);
              }
              const eventConsultation = consultationsByEvent.get(entry.event.id);
              const resolutionInfo = entry.resolutionMode
                ? resolutionModeMeta[entry.resolutionMode]
                : null;
              const handoffInfo = entry.handoffIssued && entry.handoffTarget ? entry.handoffTarget : null;
              return (
                <article
                  key={`${entry.event.id}-${entry.status}-${index}`}
                  className="event-card"
                >
                  <div className="event-header">
                    <h3 className="event-title">{entry.event.title}</h3>
                    <span className={`event-badge ${statusClassMap[entry.status]}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="event-meta">
                    <span>{entry.event.category}</span>
                    <span className="event-badge severity-pill">{entry.event.severity}</span>
                    {contextParts.length > 0 ? <span>{contextParts.join(" • ")}</span> : null}
                  </div>
                  {resolutionInfo ? (
                    <div className="event-resolution">
                      <span className={resolutionInfo.className}>{resolutionInfo.label}</span>
                      {handoffInfo ? <span className="handoff-note">Передано: {handoffInfo}</span> : null}
                    </div>
                  ) : null}
                  <p>{entry.event.description}</p>
                  {chosen ? <p>Выбор: {chosen}</p> : null}
                  {entry.appliedEffects.length > 0 ? (
                    <p>Эффекты: {renderEffects(entry.appliedEffects)}</p>
                  ) : null}
                  {entry.notes ? <p>Примечание: {entry.notes}</p> : null}
                  {eventConsultation ? (
                    <div className="consultation-note">Совет: {eventConsultation.summary}</div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Сословия</h2>
        </div>

        {estates.length === 0 ? (
          <div className="empty-state">Нет данных о сословиях в выбранном квартале.</div>
        ) : (
          <div className="estate-grid">
            {estates.map((estate) => (
              <article key={estate.name} className="estate-card">
                <h4>{estate.name}</h4>
                <div className="estate-metric">
                  <span>Удовлетворённость</span>
                  <span>{formatPercent(estate.satisfaction)}</span>
                </div>
                <div className="estate-metric">
                  <span>Влияние</span>
                  <span>{formatNumber(estate.influence, 1)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

     <section className="section">
        <div className="section-header">
          <h2 className="section-title">Регионы</h2>
        </div>

        {regions.length === 0 ? (
          <div className="empty-state">Нет данных по регионам.</div>
        ) : (
          <div className="region-grid">
            {regions.map((region) => (
              <article key={region.name} className={`region-card region-${region.riskLevel}`}>
                <h4>{region.name}</h4>
                <div className="region-metric">
                  <span>Богатство</span>
                  <span>{formatNumber(region.wealth, 1)}</span>
                </div>
                <div className="region-metric">
                  <span>Лояльность</span>
                  <span>{formatPercent(region.loyalty)}</span>
                </div>
                <div className="region-metric">
                  <span>Инфраструктура</span>
                  <span>{formatNumber(region.infrastructure, 1)}</span>
                </div>
                <div className="region-risk">
                  <span className={riskClassMap[region.riskLevel]}>
                    {riskLabels[region.riskLevel]}
                  </span>
                  <span className="region-risk-factors">{region.riskFactors.join(" • ")}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
        </>
      ) : (
        <LiveCampaignView data={liveData} error={liveError} onRefresh={refreshLiveData} />
      )}
    </div>
  );
}
