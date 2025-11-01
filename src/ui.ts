import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { buildBaselineConfig } from "./config";
import { runSimulation } from "./simulation";
import { saveSimulationResult } from "./persistence";

function generateSparkline(values: number[], color = "#38bdf8"): string {
  if (values.length === 0) {
    return "";
  }
  const width = 160;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - ((value - min) / range) * height);
      return `${x},${y}`;
    })
    .join(" ");

  const lastValue = values[values.length - 1];
  const lastY = height - ((lastValue - min) / range) * height;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />
      <circle cx="${width}" cy="${lastY}" r="3" fill="${color}" />
    </svg>
  `;
}

const config = buildBaselineConfig();
const result = runSimulation(config);
const summary = result.kpiSummary;
const reports = result.reports;
const targetDir = join(process.cwd(), "dist");
const saveInfo = saveSimulationResult(result, {
  config,
  label: "dashboard_export",
});

mkdirSync(targetDir, { recursive: true });
const dashboardDir = join(targetDir, "dashboard");
mkdirSync(dashboardDir, { recursive: true });

const kpiRows = reports
  .map((report) => {
    return `
      <tr>
        <td>Q${report.quarter}</td>
        <td>${report.kpis.stability.value.toFixed(1)}</td>
        <td>${report.kpis.economicGrowth.value.toFixed(1)}</td>
        <td>${report.kpis.securityIndex.value.toFixed(1)}</td>
        <td>${report.kpis.activeCrises.value.toFixed(0)}</td>
        <td>${(report.trust.advisor * 100).toFixed(1)}%</td>
        <td>${report.activeThreatLevel.toFixed(2)}</td>
      </tr>
    `;
  })
  .join("");

const eventsBlock = reports
  .map((report) => {
    const entries = report.events
      .map((entry) => {
        const context = [
          entry.event.origin?.regionName ? `Регион: ${entry.event.origin?.regionName}` : "",
          entry.event.origin?.estateName ? `Сословие: ${entry.event.origin?.estateName}` : "",
        ]
          .filter(Boolean)
          .join(" • ");

        const effects = entry.appliedEffects
          .map((effect) => `${effect.type} → ${effect.target}: ${effect.value}`)
          .join("; ");

        return `
          <li class="event-entry">
            <header>
              <span class="pill pill-${entry.status}">${entry.status}</span>
              <strong>${entry.event.title}</strong>
            </header>
            <div class="meta">${entry.event.category} • ${entry.event.severity}</div>
            ${context ? `<div class="context">${context}</div>` : ""}
            <p>${entry.event.description}</p>
            ${entry.selectedOptionId ? `<div class="option">Выбор: ${entry.selectedOptionId}</div>` : ""}
            ${effects ? `<div class="effects">Эффекты: ${effects}</div>` : ""}
          </li>
        `;
      })
      .join("");

    if (!entries) {
      return "";
    }

    return `
      <section class="events">
        <h3>Квартал ${report.quarter}</h3>
        <ul>${entries}</ul>
      </section>
    `;
  })
  .join("");

const estateTrustRows = Object.entries(result.finalState.trust.estates)
  .map(([name, value]) => `<li>${name}: ${(value * 100).toFixed(1)}%</li>`)
  .join("");

const regionMetrics = new Map<
  string,
  { wealth: number[]; loyalty: number[]; infrastructure: number[] }
>();

for (const report of reports) {
  for (const snapshot of report.regions) {
    if (!regionMetrics.has(snapshot.name)) {
      regionMetrics.set(snapshot.name, { wealth: [], loyalty: [], infrastructure: [] });
    }
    const entry = regionMetrics.get(snapshot.name)!;
    entry.wealth.push(snapshot.wealth);
    entry.loyalty.push(snapshot.loyalty);
    entry.infrastructure.push(snapshot.infrastructure);
  }
}

const regionCards = Array.from(regionMetrics.entries())
  .map(([name, metrics]) => {
    const wealthSpark = generateSparkline(metrics.wealth, "#f97316");
    const loyaltySpark = generateSparkline(metrics.loyalty, "#22c55e");
    const infraSpark = generateSparkline(metrics.infrastructure, "#38bdf8");

    const latestIndex = metrics.wealth.length - 1;
    const latestWealth = metrics.wealth[latestIndex].toFixed(1);
    const latestLoyalty = metrics.loyalty[latestIndex].toFixed(1);
    const latestInfra = metrics.infrastructure[latestIndex].toFixed(1);

    return `
      <article class="region-card">
        <h3>${name}</h3>
        <div class="metric">
          <span class="metric-label">Богатство: ${latestWealth}</span>
          <span class="sparkline">${wealthSpark}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Лояльность: ${latestLoyalty}%</span>
          <span class="sparkline">${loyaltySpark}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Инфраструктура: ${latestInfra}</span>
          <span class="sparkline">${infraSpark}</span>
        </div>
      </article>
    `;
  })
  .join("");

const html = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Имперский дашборд</title>
    <style>
      body {
        font-family: "Segoe UI", sans-serif;
        margin: 0;
        background: #0f172a;
        color: #e2e8f0;
      }
      header, main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 24px;
      }
      header h1 {
        margin: 0;
        font-size: 28px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .card {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 18px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);
      }
      .card h2 {
        margin: 0 0 8px;
        font-size: 18px;
        color: #facc15;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        background: rgba(15, 23, 42, 0.7);
        border-radius: 12px;
        overflow: hidden;
      }
      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid rgba(148, 163, 184, 0.15);
      }
      th {
        background: rgba(30, 41, 59, 0.8);
        color: #94a3b8;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.08em;
      }
      .events {
        margin-top: 24px;
      }
      .events h3 {
        margin-bottom: 12px;
        color: #38bdf8;
      }
      .events ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 12px;
      }
      .event-entry {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(88, 28, 135, 0.3);
        border-radius: 12px;
        padding: 14px;
      }
      .event-entry header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .event-entry strong {
        font-size: 16px;
      }
      .meta, .context, .option, .effects, .event-entry p {
        margin: 4px 0;
      }
      .context {
        color: #94a3b8;
        font-size: 13px;
      }
      .pill {
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .pill-resolved {
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.6);
        color: #34d399;
      }
      .pill-failed {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.6);
        color: #f87171;
      }
      .pill-deferred {
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.6);
        color: #60a5fa;
      }
      .regions-grid {
        margin-top: 32px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
      .region-card {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 14px;
        padding: 16px;
      }
      .region-card h3 {
        margin: 0 0 12px;
        color: #bae6fd;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        gap: 12px;
      }
      .metric-label {
        font-size: 14px;
        color: #f1f5f9;
      }
      .sparkline svg {
        border-radius: 6px;
        background: rgba(30, 41, 59, 0.6);
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Сводка по кампании</h1>
      <p>Казна: ${result.finalState.resources.gold.toFixed(1)} золота • Доверие советника: ${(result.finalState.trust.advisor * 100).toFixed(1)}% • Уровень угроз: ${result.finalState.activeThreatLevel.toFixed(2)}</p>
    </header>
    <main>
      <section class="grid">
        <article class="card">
          <h2>Средние KPI</h2>
          <p>Стабильность: ${summary.averages.stability.toFixed(1)}</p>
          <p>Экономический рост: ${summary.averages.economicGrowth.toFixed(1)}</p>
          <p>Индекс безопасности: ${summary.averages.securityIndex.toFixed(1)}</p>
        </article>
        <article class="card">
          <h2>Ресурсы</h2>
          <p>Влияние: ${result.finalState.resources.influence.toFixed(1)}</p>
          <p>Рабочая сила: ${result.finalState.resources.labor.toFixed(1)}</p>
          <p>Совокупные доходы: ${result.totals.incomes.gold.toFixed(1)} золота</p>
        </article>
        <article class="card">
          <h2>Доверие сословий</h2>
          <ul>${estateTrustRows}</ul>
        </article>
      </section>

      <section>
        <h2>Помесячные KPI и угрозы</h2>
        <table>
          <thead>
            <tr>
              <th>Период</th>
              <th>Стабильность</th>
              <th>Рост</th>
              <th>Безопасность</th>
              <th>Кризисы</th>
              <th>Доверие советника</th>
              <th>Уровень угроз</th>
            </tr>
          </thead>
          <tbody>${kpiRows}</tbody>
        </table>
      </section>

      <section>
        <h2>Журнал событий</h2>
        ${eventsBlock || "<p>Кризисов не обнаружено.</p>"}
      </section>

      <section>
        <h2>Динамика регионов</h2>
        <div class="regions-grid">
          ${regionCards}
        </div>
      </section>
    </main>
  </body>
</html>`;

const staticDashboardPath = join(dashboardDir, "static-report.html");
writeFileSync(staticDashboardPath, html, "utf8");

const graphqlPayload = {
  data: {
    simulation: {
      id: saveInfo.manifest.id,
      label: saveInfo.manifest.label,
      createdAt: saveInfo.manifest.createdAt,
      quarters: saveInfo.manifest.quarters,
      config: saveInfo.manifest.config,
      kpiSummary: result.kpiSummary,
      totals: result.totals,
      finalState: result.finalState,
      reports: result.reports,
    },
  },
};

const dataPath = join(dashboardDir, "data.json");
writeFileSync(dataPath, JSON.stringify(graphqlPayload, null, 2), "utf8");

const spaHtml = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Имперский дашборд — интерактив</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
        --accent: #38bdf8;
      }
      body {
        margin: 0;
      }
      header {
        padding: 20px 28px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.85);
        position: sticky;
        top: 0;
        backdrop-filter: blur(10px);
        z-index: 10;
      }
      header h1 {
        font-size: 24px;
        margin: 0 0 6px;
      }
      header .meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 14px;
        color: #94a3b8;
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
        display: grid;
        gap: 24px;
      }
      section {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 14px;
        padding: 20px;
      }
      h2 {
        margin: 0 0 16px;
        font-size: 18px;
        color: var(--accent);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .controls {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 18px;
        align-items: center;
      }
      label {
        font-size: 13px;
        color: #cbd5f5;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      select {
        background: rgba(30, 41, 59, 0.9);
        color: inherit;
        border: 1px solid rgba(148, 163, 184, 0.4);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.15);
        text-align: left;
        font-size: 14px;
      }
      th {
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
      }
      .pill {
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .pill-resolved {
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.6);
        color: #34d399;
      }
      .pill-failed {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.6);
        color: #f87171;
      }
      .pill-deferred {
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.6);
        color: #60a5fa;
      }
      .event-card {
        border: 1px solid rgba(88, 28, 135, 0.35);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        background: rgba(15, 23, 42, 0.6);
      }
      .event-meta {
        color: #94a3b8;
        font-size: 13px;
        margin: 6px 0;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }
      .metric-card {
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 12px;
        padding: 16px;
        background: rgba(15, 23, 42, 0.6);
      }
      .metric-card h3 {
        margin: 0 0 8px;
        color: #bae6fd;
        font-size: 16px;
      }
      .metric-card p {
        margin: 4px 0;
        font-size: 14px;
      }
      @media (max-width: 768px) {
        main {
          padding: 16px;
        }
        header {
          padding: 16px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Имперский дашборд</h1>
      <div class="meta" id="meta-bar"></div>
    </header>
    <main>
      <section>
        <h2>Ключевые показатели</h2>
        <div class="controls">
          <label>
            Квартал
            <select id="quarter-select"></select>
          </label>
          <label>
            Фильтр событий
            <select id="severity-filter">
              <option value="all">Все уровни</option>
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="major">Major</option>
            </select>
          </label>
        </div>
        <div class="grid" id="kpi-grid"></div>
      </section>
      <section>
        <h2>Журнал событий</h2>
        <div id="events-list"></div>
      </section>
      <section>
        <h2>Регионы</h2>
        <div class="grid" id="regions-grid"></div>
      </section>
    </main>
    <script type="module" src="./app.js"></script>
  </body>
</html>`;

const spaIndexPath = join(dashboardDir, "index.html");
writeFileSync(spaIndexPath, spaHtml, "utf8");

const spaScript = `const formatPercent = (value) => \`\${value.toFixed(1)}%\`;

function createPill(status) {
  const pill = document.createElement("span");
  pill.className = \`pill pill-\${status}\`;
  pill.textContent = status;
  return pill;
}

function renderMeta(simulation, manifest) {
  const meta = document.getElementById("meta-bar");
  if (!meta) return;
  meta.innerHTML = [
    \`Серия: \${manifest.label ?? manifest.id}\`,
    \`Кварталов: \${simulation.reports.length}\`,
    \`Финальный трест: \${formatPercent(simulation.finalState.trust.advisor)}\`,
    \`Угроза: \${simulation.finalState.activeThreatLevel.toFixed(2)}\`,
  ].join(" • ");
}

function renderQuarterSelect(reports, onChange) {
  const select = document.getElementById("quarter-select");
  if (!select) return;
  select.innerHTML = reports
    .map((report) => \`<option value="\${report.quarter}">Q\${report.quarter}</option>\`)
    .join("");
  select.value = String(reports[reports.length - 1]?.quarter ?? 1);
  select.addEventListener("change", () => onChange(Number(select.value)));
}

function renderSeverityFilter(onChange) {
  const select = document.getElementById("severity-filter");
  if (!select) return;
  select.addEventListener("change", () => onChange(select.value));
}

function renderKpis(report) {
  const grid = document.getElementById("kpi-grid");
  if (!grid || !report) return;
  const entries = [
    { label: "Стабильность", entry: report.kpis.stability },
    { label: "Экономический рост", entry: report.kpis.economicGrowth },
    { label: "Индекс безопасности", entry: report.kpis.securityIndex },
    { label: "Активные кризисы", entry: report.kpis.activeCrises },
  ];
  grid.innerHTML = entries
    .map(
      ({ label, entry }) => \`
      <article class="metric-card">
        <h3>\${label}</h3>
        <p>Значение: \${entry.value.toFixed(2)}</p>
        <p>Тренд: \${entry.trend > 0 ? "+" : ""}\${entry.trend.toFixed(2)}</p>
        <p>Угроза: \${entry.threatLevel}</p>
      </article>
    \`
    )
    .join("");
}

function renderRegions(report) {
  const container = document.getElementById("regions-grid");
  if (!container || !report) return;
  container.innerHTML = report.regions
    .map(
      (region) => \`
        <article class="metric-card">
          <h3>\${region.name}</h3>
          <p>Богатство: \${region.wealth.toFixed(1)}</p>
          <p>Лояльность: \${region.loyalty.toFixed(1)}%</p>
          <p>Инфраструктура: \${region.infrastructure.toFixed(1)}</p>
        </article>
      \`
    )
    .join("");
}

function renderEvents(report, filter) {
  const container = document.getElementById("events-list");
  if (!container || !report) return;
  const filtered = report.events.filter((event) =>
    filter === "all" ? true : event.event.severity === filter
  );
  if (filtered.length === 0) {
    container.innerHTML = "<p>Нет событий для выбранного фильтра.</p>";
    return;
  }

  container.innerHTML = "";
  for (const entry of filtered) {
    const card = document.createElement("article");
    card.className = "event-card";

    const header = document.createElement("header");
    header.style.display = "flex";
    header.style.gap = "12px";
    header.style.alignItems = "center";

    const title = document.createElement("strong");
    title.textContent = entry.event.title;

    const pill = createPill(entry.status);
    header.appendChild(pill);
    header.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = \`\${entry.event.category} • \${entry.event.severity}\`;

    const description = document.createElement("p");
    description.textContent = entry.event.description;

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(description);

    if (entry.selectedOptionId) {
      const option = document.createElement("p");
      option.textContent = \`Выбор: \${entry.selectedOptionId}\`;
      card.appendChild(option);
    }

    if (entry.appliedEffects.length > 0) {
      const effects = document.createElement("p");
      effects.textContent = \`Эффекты: \${entry.appliedEffects
        .map((effect) => \`\${effect.type} → \${effect.target}: \${effect.value}\`)
        .join("; ")}\`;
      card.appendChild(effects);
    }

    container.appendChild(card);
  }
}

async function bootstrap() {
  const response = await fetch("./data.json");
  const payload = await response.json();
  const simulation = payload.data.simulation;
  const manifest = ${JSON.stringify({
    id: saveInfo.manifest.id,
    label: saveInfo.manifest.label,
  })};

  renderMeta(simulation, manifest);

  let currentQuarter =
    simulation.reports[simulation.reports.length - 1]?.quarter ?? 1;
  let currentFilter = "all";

  const refresh = () => {
    const report = simulation.reports.find((item) => item.quarter === currentQuarter);
    renderKpis(report);
    renderRegions(report);
    renderEvents(report, currentFilter);
  };

  renderQuarterSelect(simulation.reports, (quarter) => {
    currentQuarter = quarter;
    refresh();
  });
  renderSeverityFilter((filter) => {
    currentFilter = filter;
    refresh();
  });

  refresh();
}

bootstrap().catch((error) => {
  const container = document.getElementById("events-list");
  if (container) {
    container.innerHTML =
      "<p>Не удалось загрузить данные симуляции. Детали в консоли.</p>";
  }
  console.error("Ошибка инициализации интерактивного дашборда:", error);
});
`;

const spaScriptPath = join(dashboardDir, "app.js");
writeFileSync(spaScriptPath, spaScript, "utf8");

console.log(`UI дашборд сохранён:`);
console.log(` • Статический отчёт: ${staticDashboardPath}`);
console.log(` • Интерактив: ${spaIndexPath}`);
console.log(` • Данные GraphQL: ${dataPath}`);
