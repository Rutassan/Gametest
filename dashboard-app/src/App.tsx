import { useEffect, useMemo, useState } from "react";
import type {
  DashboardPayload,
  EventOutcome,
  EventOutcomeStatus,
  EventSeverity,
  KPIEntry,
  QuarterlyReport,
  SimulationData,
  ThreatLevel,
} from "./types";

type SeverityFilter = "all" | EventSeverity;

const DATA_URL = import.meta.env.VITE_DATA_URL ?? "../data.json";

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

function formatNumber(value: number, fraction = 1): string {
  return value.toFixed(fraction);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
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

  return { data, loading, error, reload: load };
}

export default function App() {
  const { data: simulation, loading, error, reload } = useSimulationData();
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  useEffect(() => {
    if (simulation) {
      const latestQuarter = simulation.reports.at(-1)?.quarter ?? null;
      setSelectedQuarter(latestQuarter);
    }
  }, [simulation]);

  const reportForQuarter = useMemo<QuarterlyReport | null>(() => {
    if (!simulation || selectedQuarter === null) {
      return null;
    }
    return simulation.reports.find((report) => report.quarter === selectedQuarter) ?? null;
  }, [simulation, selectedQuarter]);

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

  const kpiEntries: Array<{ key: keyof KPIEntry; label: string; data: KPIEntry }> =
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

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">Имперский дашборд</h1>
          <div className="app-meta">
            <span>Сохранение: {simulation.label ?? simulation.id}</span>
            <span>Создано: {formatDate(simulation.createdAt)}</span>
            <span>Отчётов: {simulation.reports.length}</span>
            <span>Советник: {simulation.config?.advisor ?? "не задан"}</span>
          </div>
        </div>
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
        </div>
      </header>

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
                  <p>{entry.event.description}</p>
                  {chosen ? <p>Выбор: {chosen}</p> : null}
                  {entry.appliedEffects.length > 0 ? (
                    <p>Эффекты: {renderEffects(entry.appliedEffects)}</p>
                  ) : null}
                  {entry.notes ? <p>Примечание: {entry.notes}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Регионы</h2>
        </div>

        {reportForQuarter ? (
          <div className="region-grid">
            {reportForQuarter.regions.map((region) => (
              <article key={region.name} className="region-card">
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
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Нет данных по регионам.</div>
        )}
      </section>
    </div>
  );
}
