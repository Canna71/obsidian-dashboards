import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip,
} from "chart.js";
import type { SparklineViewConfig } from "../../utils/types";
import { DEFAULT_SPARKLINE_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildAggregatedSeries } from "../../data/aggregations";
import { getChartColors, getChartColorAlpha } from "../../theme/tokens";
import { VIEW_TYPE_SPARKLINE } from "../../bases/viewTypes";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export class SparklineBasesView extends BasesView {
  readonly type = VIEW_TYPE_SPARKLINE;
  private containerEl: HTMLElement;
  private chart: Chart | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void { this.render(); }

  private readConfig(): SparklineViewConfig {
    const cfg = this.config;
    return {
      dateField: cfg.getAsPropertyId("dateField") ?? null,
      metricField: cfg.getAsPropertyId("metricField") ?? null,
      aggregation: (cfg.get("aggregation") as SparklineViewConfig["aggregation"]) ?? DEFAULT_SPARKLINE_CONFIG.aggregation,
      dateBucket: (cfg.get("dateBucket") as SparklineViewConfig["dateBucket"]) ?? DEFAULT_SPARKLINE_CONFIG.dateBucket,
    };
  }

  private render() {
    if (!this.data) return;
    this.chart?.destroy();
    this.chart = null;
    const cfg = this.readConfig();
    if (!cfg.dateField) {
      renderEmpty(this.containerEl, "odash-sparkline-view", "🗓️", "No date field", "Choose a date property in the view options.");
      return;
    }
    const { records } = recordsFromResult(
      this.data, this.allProperties,
      (id) => this.config.getDisplayName(id),
      [cfg.dateField, cfg.metricField],
    );
    if (records.length === 0) {
      renderEmpty(this.containerEl, "odash-sparkline-view", "📋", "No records", "No notes match the current Base query.");
      return;
    }

    const series = buildAggregatedSeries({
      records,
      xField: cfg.dateField,
      yField: cfg.metricField,
      seriesField: null,
      aggregation: cfg.metricField ? cfg.aggregation : "count",
      dateBucket: cfg.dateBucket,
      nullHandling: "zero",
    });

    const points = series[0]?.points ?? [];
    if (points.length < 2) {
      renderEmpty(this.containerEl, "odash-sparkline-view", "📈", "Not enough data", "Need at least two data points to draw a trend.");
      return;
    }

    this.containerEl.empty();
    this.containerEl.addClass("odash-sparkline-view");

    // ── stat bar ──────────────────────────────────────────────────────────────
    const values = points.map((p) => p.value ?? 0);
    const last = values[values.length - 1]!;
    const prev = values[values.length - 2]!;
    const delta = last - prev;
    const trend = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
    const trendCls = delta > 0 ? "odash-spark-up" : delta < 0 ? "odash-spark-down" : "odash-spark-flat";
    const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1);

    const statBar = this.containerEl.createDiv("odash-spark-stat");
    statBar.createSpan({ cls: "odash-spark-value", text: fmt(last) });
    statBar.createSpan({ cls: `odash-spark-trend ${trendCls}`, text: ` ${trend} ${fmt(Math.abs(delta))}` });
    statBar.createSpan({ cls: "odash-spark-label", text: points[points.length - 1]!.label });

    // ── mini chart ────────────────────────────────────────────────────────────
    const canvasWrapper = this.containerEl.createDiv("odash-spark-canvas-wrapper");
    const canvas = canvasWrapper.createEl("canvas");
    const colors = getChartColors(1);

    this.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          data: points.map((p) => p.value),
          borderColor: colors[0]!,
          backgroundColor: getChartColorAlpha(colors[0]!, 0.12),
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            callbacks: { title: (items) => items[0]?.label ?? "" },
          },
        },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: false },
        },
        layout: { padding: { left: 2, right: 2, top: 4, bottom: 4 } },
      },
    });
  }

  onunload() {
    this.chart?.destroy();
    this.chart = null;
  }
}

function renderEmpty(containerEl: HTMLElement, cls: string, icon: string, title: string, body: string) {
  containerEl.empty();
  containerEl.addClass(cls);
  const el = containerEl.createDiv("odash-empty-state");
  el.createDiv({ cls: "odash-empty-icon", text: icon });
  el.createEl("h3", { cls: "odash-empty-title", text: title });
  el.createEl("p", { cls: "odash-empty-body", text: body });
}

export function sparklineViewOptions(config: BasesViewConfig): BasesAllOptions[] {
  const hasMetric = !!config.getAsPropertyId("metricField");
  return [
    {
      type: "group", displayName: "Data",
      items: [
        { key: "dateField", type: "property", displayName: "Date field" },
        { key: "metricField", type: "property", displayName: "Metric field (optional)" },
        {
          key: "aggregation", type: "dropdown", displayName: "Aggregation",
          default: "count",
          options: { count: "Count records", sum: "Sum values", avg: "Average" },
          shouldHide: () => !hasMetric,
        },
        {
          key: "dateBucket", type: "dropdown", displayName: "Group by",
          default: "month",
          options: { week: "Week", month: "Month", quarter: "Quarter" },
        },
      ],
    },
  ] as BasesAllOptions[];
}
