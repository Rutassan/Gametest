import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CampaignControlMode,
  RegionSnapshot,
  ResourcePool,
  StrategicProjectSnapshot,
} from "./types";
import { getRegionLayout, connectionKey, RegionLayoutEntry } from "./mapLayout";

interface CampaignMapProps {
  regions: RegionSnapshot[];
  highlightRegions?: string[];
  resourcesSummary?: ResourcePool;
  controlMode?: CampaignControlMode;
  statusNote?: string;
  layer?: MapLayer;
  projects?: StrategicProjectSnapshot[];
}

const riskColors: Record<RegionSnapshot["riskLevel"], string> = {
  low: "#38bdf8",
  moderate: "#f97316",
  critical: "#ef4444",
};

const riskHalo: Record<RegionSnapshot["riskLevel"], string> = {
  low: "#38bdf8",
  moderate: "#f97316",
  critical: "#ef4444",
};

const controlModeTitles: Record<CampaignControlMode, string> = {
  manual: "Ручной контроль",
  advisor: "Совет автономно",
  hybrid: "Гибридный режим",
};

const controlModeAccent: Record<CampaignControlMode, string> = {
  manual: "#6366f1",
  advisor: "#22d3ee",
  hybrid: "#f97316",
};

export type MapLayer = "risk" | "infrastructure" | "wealth" | "projects";

const riskLevelLabels: Record<RegionSnapshot["riskLevel"], string> = {
  low: "Низкий риск",
  moderate: "Повышенный риск",
  critical: "Критический риск",
};

type NormalizedLayout = RegionLayoutEntry & {
  pxCentroid: { x: number; y: number };
  pxPoints: Array<{ x: number; y: number }>;
  pxRadius: number;
  labelPosition: { x: number; y: number };
};

function resolveLayout(canvasWidth: number, canvasHeight: number): NormalizedLayout[] {
  const reference = Math.min(canvasWidth, canvasHeight);
  const layout = getRegionLayout();
  return layout.map((entry) => ({
    ...entry,
    pxCentroid: {
      x: entry.centroid.x * canvasWidth,
      y: entry.centroid.y * canvasHeight,
    },
    pxPoints:
      entry.points.length > 0
        ? entry.points.map(([x, y]) => ({
            x: x * canvasWidth,
            y: y * canvasHeight,
          }))
        : [],
    pxRadius: (entry.radius / 900) * reference * 1.25,
    labelPosition: {
      x: entry.centroid.x * canvasWidth + (entry.labelOffset?.x ?? 0),
      y: entry.centroid.y * canvasHeight + (entry.labelOffset?.y ?? -entry.radius * 0.2),
    },
  }));
}

export default function CampaignMap({
  regions,
  highlightRegions = [],
  resourcesSummary,
  controlMode,
  statusNote,
  layer = "risk",
  projects = [],
}: CampaignMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 640, height: 360 });

  const regionMap = useMemo(() => {
    const map = new Map<string, RegionSnapshot>();
    regions.forEach((region) => map.set(region.name, region));
    return map;
  }, [regions]);
  const legendItems = useMemo(
    () => buildLegend(layer, highlightRegions.length > 0),
    [layer, highlightRegions.length]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({
          width: Math.max(Math.floor(width), 320),
          height: Math.max(Math.floor(height), 280),
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let animationId = 0;
    const dpr = window.devicePixelRatio || 1;

    const resizeCanvas = () => {
      if (canvas.width !== size.width * dpr || canvas.height !== size.height * dpr) {
        canvas.width = size.width * dpr;
        canvas.height = size.height * dpr;
      }
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const highlightSet = new Set(highlightRegions);

    const render = (timestamp: number) => {
      resizeCanvas();
      const { width, height } = size;
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(15, 23, 42, 0.95)");
      gradient.addColorStop(1, "rgba(15, 23, 42, 0.7)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      drawGrid(ctx, width, height);

      const layout = resolveLayout(width, height);
      drawConnections(ctx, layout);
      drawRegions(ctx, layout, regionMap, highlightSet, timestamp, layer, projects);

      if (resourcesSummary || controlMode || statusNote) {
        drawOverlay(ctx, width, resourcesSummary, controlMode, statusNote);
      }

      animationId = window.requestAnimationFrame(render);
    };

    animationId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationId);
    };
  }, [size, regionMap, highlightRegions, resourcesSummary, controlMode, statusNote, layer, projects]);

  return (
    <div ref={containerRef} className="campaign-map">
      <canvas ref={canvasRef} />
      <div className="campaign-map-legend">
        {legendItems.map((item) => (
          <span key={item.label}>
            <span
              className={["legend-dot", item.className ?? ""].filter(Boolean).join(" ")}
              style={
                item.color
                  ? {
                      background: item.color,
                      boxShadow: `0 0 10px ${withAlpha(item.color, 0.45)}`,
                    }
                  : undefined
              }
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const step = Math.max(Math.round(width / 14), 48);
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step / 2; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = step / 2; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawConnections(ctx: CanvasRenderingContext2D, layout: NormalizedLayout[]) {
  const seen = new Set<string>();
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const entry of layout) {
    for (const target of entry.connections) {
      const key = connectionKey(entry.name, target);
      if (seen.has(key)) {
        continue;
      }
      const targetEntry = layout.find((candidate) => candidate.name === target);
      if (!targetEntry) {
        continue;
      }
      seen.add(key);

      ctx.beginPath();
      ctx.moveTo(entry.pxCentroid.x, entry.pxCentroid.y);
      ctx.lineTo(targetEntry.pxCentroid.x, targetEntry.pxCentroid.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawRegions(
  ctx: CanvasRenderingContext2D,
  layout: NormalizedLayout[],
  regionMap: Map<string, RegionSnapshot>,
  highlightSet: Set<string>,
  timestamp: number,
  layer: MapLayer,
  projects: StrategicProjectSnapshot[]
) {
  ctx.save();
  const pulse = (Math.sin(timestamp / 480) + 1) / 2;

  for (const entry of layout) {
    const region = regionMap.get(entry.name);
    const visuals = resolveLayerVisual(entry, region, layer, projects);
    const haloColor = visuals.haloColor;
    const baseColor = visuals.baseColor;
    const isHighlighted = highlightSet.has(entry.name);
    const pxPoints = entry.pxPoints;
    const center = entry.pxCentroid;
    const radius = entry.pxRadius * (isHighlighted ? 1.04 + pulse * 0.06 : 1);

    if (pxPoints.length === 0) {
      drawFallbackCircle(ctx, center, radius, baseColor, haloColor, isHighlighted, pulse);
      drawRegionLabels(ctx, entry, center, radius, visuals.stats, visuals.subtitle);
      continue;
    }

    const path = () => tracePolygon(ctx, pxPoints);

    if (isHighlighted) {
      ctx.save();
      ctx.fillStyle = withAlpha("#f8fafc", 0.25 + pulse * 0.35);
      path();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = withAlpha(haloColor, 0.85);
    ctx.lineWidth = isHighlighted ? 8 : 6;
    ctx.lineJoin = "round";
    ctx.shadowBlur = isHighlighted ? 18 : 12;
    ctx.shadowColor = withAlpha(haloColor, 0.45);
    path();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const gradient = ctx.createRadialGradient(center.x, center.y, radius * 0.2, center.x, center.y, radius * 1.05);
    gradient.addColorStop(0, "rgba(15, 23, 42, 0.82)");
    gradient.addColorStop(1, baseColor);
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 24;
    ctx.shadowColor = withAlpha(baseColor, 0.45);
    path();
    ctx.fill();
    ctx.restore();

    drawRegionLabels(ctx, entry, center, radius, visuals.stats, visuals.subtitle);
  }

  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  resources: ResourcePool | undefined,
  controlMode: CampaignControlMode | undefined,
  statusNote: string | undefined
) {
  const boxWidth = 240;
  const lineHeight = 20;
  let lines = 0;
  if (controlMode) lines += 1;
  if (resources) lines += 3;
  if (statusNote) lines += 1;
  const boxHeight = 24 + lines * lineHeight;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 1;
  const x = width - boxWidth - 24;
  const y = 24;
  const radius = 12;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + boxWidth - radius, y);
  ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
  ctx.lineTo(x + boxWidth, y + boxHeight - radius);
  ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
  ctx.lineTo(x + radius, y + boxHeight);
  ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
  ctx.stroke();

  let cursorY = 24 + lineHeight;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  if (controlMode) {
    ctx.fillStyle = controlModeAccent[controlMode];
    ctx.font = "600 14px 'Segoe UI', sans-serif";
    ctx.fillText(controlModeTitles[controlMode], width - boxWidth - 12, cursorY);
    cursorY += lineHeight;
  }

  if (resources) {
    ctx.fillStyle = "#cbd5f5";
    ctx.font = "500 13px 'Segoe UI', sans-serif";
    ctx.fillText(`Золото: ${resources.gold.toFixed(1)}`, width - boxWidth - 12, cursorY);
    cursorY += lineHeight;
    ctx.fillText(`Влияние: ${resources.influence.toFixed(1)}`, width - boxWidth - 12, cursorY);
    cursorY += lineHeight;
    ctx.fillText(`Раб. сила: ${resources.labor.toFixed(1)}`, width - boxWidth - 12, cursorY);
    cursorY += lineHeight;
  }

  if (statusNote) {
    ctx.fillStyle = "#38bdf8";
    ctx.font = "500 12px 'Segoe UI', sans-serif";
    ctx.fillText(statusNote, width - boxWidth - 12, cursorY);
  }

  ctx.restore();
}

type CanvasPoint = { x: number; y: number };
interface LayerVisual {
  baseColor: string;
  haloColor: string;
  stats: Array<[string, string]>;
  subtitle?: string;
}

interface LegendItem {
  label: string;
  className?: string;
  color?: string;
}

const projectFocusLabelsMap: Record<string, string> = {
  economy: "Экономика",
  diplomacy: "Дипломатия",
  internal: "Внутренняя политика",
  military: "Армия",
  science: "Наука",
  security: "Безопасность",
  administration: "Администрирование",
};
const NEUTRAL_COLOR = "#475569";

function buildLegend(layer: MapLayer, hasHighlight: boolean): LegendItem[] {
  let items: LegendItem[];
  if (layer === "risk") {
    items = [
      { label: "Стабильно", className: "legend-low" },
      { label: "Нужен контроль", className: "legend-moderate" },
      { label: "Кризис", className: "legend-critical" },
    ];
  } else if (layer === "infrastructure") {
    items = [
      { label: "Высокое развитие", color: "#22c55e" },
      { label: "Средний уровень", color: "#38bdf8" },
      { label: "Уязвимость", color: "#64748b" },
    ];
  } else if (layer === "wealth") {
    items = [
      { label: "Пиковые доходы", color: "#facc15" },
      { label: "Средний достаток", color: "#f97316" },
      { label: "Низкие резервы", color: "#475569" },
    ];
  } else {
    items = [
      { label: "Проекты завершены", color: "#22c55e" },
      { label: "В активной работе", color: "#7c3aed" },
      { label: "Нет прогресса", color: "#334155" },
    ];
  }
  if (hasHighlight) {
    items = [...items, { label: "Активное событие", className: "legend-highlight" }];
  }
  return items;
}

function resolveLayerVisual(
  entry: NormalizedLayout,
  region: RegionSnapshot | undefined,
  layer: MapLayer,
  projects: StrategicProjectSnapshot[]
): LayerVisual {
  if (!region) {
    return { baseColor: NEUTRAL_COLOR, haloColor: NEUTRAL_COLOR, stats: [] };
  }

  const defaultStats: Array<[string, string]> = [
    ["Лояльность", formatPercent(region.loyalty)],
    ["Богатство", formatNumber(region.wealth)],
    ["Инфраструктура", formatNumber(region.infrastructure)],
  ];
  const riskLevel = region.riskLevel;
  const riskLabel = riskLevelLabels[riskLevel];

  if (layer === "risk") {
    const factors =
      region.riskFactors.length > 0 ? region.riskFactors.slice(0, 2).join(" • ") : "нет угроз";
    const scoreText = Number.isFinite(region.riskScore) ? region.riskScore.toFixed(2) : "—";
    return {
      baseColor: riskColors[riskLevel],
      haloColor: riskHalo[riskLevel],
      stats: [
        ["Уровень", riskLabel],
        ["Счёт", scoreText],
        ["Факторы", factors],
      ],
      subtitle: entry.label,
    };
  }

  if (layer === "infrastructure") {
    const ratio = normalize(region.infrastructure, 20, 120);
    const baseColor = interpolateColor("#1f2937", "#22c55e", ratio);
    return {
      baseColor,
      haloColor: baseColor,
      stats: [
        ["Инфраструктура", formatNumber(region.infrastructure)],
        ["Лояльность", formatPercent(region.loyalty)],
        ["Риск", riskLabel],
      ],
      subtitle: entry.label,
    };
  }

  if (layer === "wealth") {
    const ratio = normalize(region.wealth, 80, 320);
    const baseColor = interpolateColor("#1f2937", "#facc15", ratio);
    return {
      baseColor,
      haloColor: baseColor,
      stats: [
        ["Богатство", formatNumber(region.wealth)],
        ["Инфраструктура", formatNumber(region.infrastructure)],
        ["Риск", riskLabel],
      ],
      subtitle: entry.label,
    };
  }

  if (layer === "projects") {
    const project = findProjectForRegion(entry, projects);
    if (!project) {
      return {
        baseColor: interpolateColor("#312e81", "#4338ca", 0.35),
        haloColor: "#4338ca",
        stats: [
          ["Проект", "Нет активных программ"],
          ["Фокус", entry.focuses?.[0] ? projectFocusLabelsMap[entry.focuses[0]!] ?? entry.focuses[0]! : "—"],
          ["Риск", riskLabel],
        ],
        subtitle: entry.label,
      };
    }
    const progress = clamp(project.progress ?? 0, 0, 1);
    const baseColor = interpolateColor("#7c3aed", "#22c55e", progress);
    return {
      baseColor,
      haloColor: baseColor,
      stats: [
        ["Прогресс", formatPercent(progress * 100)],
        ["Фокус", projectFocusLabelsMap[project.focus] ?? project.focus],
        ["Ответственный", project.ownerAdvisorName ?? "—"],
      ],
      subtitle: project.name,
    };
  }

  return { baseColor: NEUTRAL_COLOR, haloColor: NEUTRAL_COLOR, stats: defaultStats };
}

function findProjectForRegion(
  entry: RegionLayoutEntry,
  projects: StrategicProjectSnapshot[]
): StrategicProjectSnapshot | null {
  if (!entry.focuses || entry.focuses.length === 0) {
    return null;
  }
  const candidates = projects.filter((project) => entry.focuses!.includes(project.focus));
  if (candidates.length === 0) {
    return null;
  }
  const sorted = [...candidates].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  return sorted[0] ?? null;
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: CanvasPoint[]) {
  if (points.length === 0) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function drawFallbackCircle(
  ctx: CanvasRenderingContext2D,
  center: CanvasPoint,
  radius: number,
  baseColor: string,
  haloColor: string,
  isHighlighted: boolean,
  pulse: number
) {
  const adjusted = radius * (isHighlighted ? 1.05 + pulse * 0.06 : 1);

  if (isHighlighted) {
    ctx.save();
    ctx.fillStyle = withAlpha("#f8fafc", 0.25 + pulse * 0.35);
    ctx.beginPath();
    ctx.arc(center.x, center.y, adjusted * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = withAlpha(haloColor, 0.25);
  ctx.beginPath();
  ctx.arc(center.x, center.y, adjusted * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  const gradient = ctx.createRadialGradient(center.x, center.y, adjusted * 0.2, center.x, center.y, adjusted);
  gradient.addColorStop(0, "rgba(15, 23, 42, 0.85)");
  gradient.addColorStop(1, baseColor);
  ctx.fillStyle = gradient;
  ctx.shadowColor = withAlpha(baseColor, 0.45);
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(center.x, center.y, adjusted, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRegionLabels(
  ctx: CanvasRenderingContext2D,
  entry: NormalizedLayout,
  center: CanvasPoint,
  radius: number,
  stats: Array<[string, string]>,
  subtitleOverride?: string
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(15, 23, 42, 0.85)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 16px 'Segoe UI', sans-serif";
  ctx.fillText(entry.name, entry.labelPosition.x, entry.labelPosition.y);
  ctx.font = "400 13px 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
  ctx.fillText(subtitleOverride ?? entry.label, entry.labelPosition.x, entry.labelPosition.y + 18);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "500 12px 'Segoe UI', sans-serif";
  const startY = center.y + radius * 0.2;
  if (stats.length === 0) {
    ctx.fillStyle = "rgba(226, 232, 240, 0.6)";
    ctx.fillText("Нет данных", center.x, center.y + radius * 0.2);
  } else {
    stats.forEach(([label, value], index) => {
      const lineY = startY + index * 16;
      ctx.fillStyle = "rgba(226, 232, 240, 0.82)";
      ctx.fillText(`${label}: ${value}`, center.x, lineY);
    });
  }
  ctx.restore();
}

function formatNumber(value: number): string {
  if (Number.isNaN(value)) {
    return "—";
  }
  if (Math.abs(value) >= 1000) {
    return value.toFixed(0);
  }
  return value.toFixed(0);
}

function formatPercent(value: number, fraction = 0): string {
  if (Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(fraction)}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 0;
  }
  return clamp((value - min) / (max - min), 0, 1);
}

function interpolateColor(startColor: string, endColor: string, ratio: number): string {
  const t = clamp(ratio, 0, 1);
  const [sr, sg, sb] = parseColor(startColor);
  const [er, eg, eb] = parseColor(endColor);
  const r = Math.round(sr + (er - sr) * t);
  const g = Math.round(sg + (eg - sg) * t);
  const b = Math.round(sb + (eb - sb) * t);
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const raw = color.slice(1);
    const hex = raw.length === 3 ? raw.replace(/./g, (char) => char + char) : raw;
    const value = Number.parseInt(hex, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return [r, g, b];
  }
  if (color.startsWith("rgba")) {
    const parts = color
      .replace("rgba(", "")
      .replace(")", "")
      .split(",")
      .map((part) => Number.parseFloat(part.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }
  if (color.startsWith("rgb")) {
    const parts = color
      .replace("rgb(", "")
      .replace(")", "")
      .split(",")
      .map((part) => Number.parseFloat(part.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }
  return [71, 85, 105];
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const raw = color.slice(1);
    const bigint = Number.parseInt(raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith("rgba")) {
    const parts = color
      .replace("rgba(", "")
      .replace(")", "")
      .split(",")
      .map((part) => Number.parseFloat(part.trim()));
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith("rgb")) {
    const parts = color
      .replace("rgb(", "")
      .replace(")", "")
      .split(",")
      .map((part) => Number.parseFloat(part.trim()));
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
