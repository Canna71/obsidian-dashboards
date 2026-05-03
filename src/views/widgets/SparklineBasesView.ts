import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip,
} from "chart.js";
import type { SparklineViewConfig } from "../../utils/types";
import { DEFAULT_SPARKLINE_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildAggregatedSeries } from "../../data/aggregations";
import { getChartColors, getChartColorAlpha, getGridColor, getTextColor } from "../../theme/tokens";
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
      renderEmpty(this.containerEl, "odash-chart-view", "🗓️", "No date field", "Choose a date property in the view options.");
      return;
    }
    const { records } = recordsFromResult(
      this.data, this.allProperties,
      (id) => this.config.getDisplayName(id),
      [cfg.dateField, cfg.metricField],
    );
    if (records.length === 0) {
      renderEmpty(this.containerEl, "odash-chart-view", "📋", "No records", "No notes match the current Base query.");
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
      renderEmpty(this.containerEl, "odash-chart-view", "📈", "Not enough data", "Need at least two data points to draw a trend.");
      return;
    }

    this.containerEl.empty();
    this.containerEl.addClass("odash-chart-view");
    const wrapper = this.containerEl.createDiv("odash-chart-wrapper");
    const canvas = wrapper.createEl("canvas", { cls: "odash-chart-canvas" });
    const colors = getChartColors(1);

    this.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          data: points.map((p) => p.value),
          borderColor: colors[0]!,
          backgroundColor: getChartColorAlpha(colors[0]!, 0.15),
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index" } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: getTextColor(), font: { size: 10 }, maxRotation: 0 },
          },
          y: {
            grid: { color: getGridColor() },
            ticks: { color: getTextColor(), font: { size: 10 } },
            beginAtZero: true,
          },
        },
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
