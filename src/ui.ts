import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { buildBaselineConfig } from "./config";
import { runSimulation } from "./simulation";

const config = buildBaselineConfig();
const result = runSimulation(config);

const summary = result.kpiSummary;
const reports = result.reports;
const targetDir = join(process.cwd(), "dist");

mkdirSync(targetDir, { recursive: true });

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
    </main>
  </body>
</html>`;

const targetPath = join(targetDir, "dashboard.html");
writeFileSync(targetPath, html, "utf8");

console.log(`UI дашборд сохранён в ${targetPath}`);
