import {
  BasesView,
  type QueryController,
  type BasesViewConfig,
  type BasesAllOptions,
} from "obsidian";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  DoughnutController,
  PieController,
  BarController,
  LineController,
  ScatterController,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  type ChartConfiguration,
  type ChartDataset,
} from "chart.js";

import type { ChartViewConfig, AggregatedSeries } from "../../utils/types";
import { DEFAULT_CHART_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildAggregatedSeries, makeCumulative } from "../../data/aggregations";
import {
  getChartColors,
  getChartColorAlpha,
  getGridColor,
  getTextColor,
  getMutedTextColor,
} from "../../theme/tokens";
import { VIEW_TYPE_CHART } from "../../bases/viewTypes";

// Register Chart.js components (tree-shaken)
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  DoughnutController,
  PieController,
  BarController,
  LineController,
  ScatterController,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
);

export class ChartBasesView extends BasesView {
  readonly type = VIEW_TYPE_CHART;

  private containerEl: HTMLElement;
  private chartInstance: Chart | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private wrapperEl!: HTMLElement;
  private errorEl!: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    this.buildDOM();
  }

  private buildDOM() {
    this.containerEl.empty();
    this.containerEl.addClass("odash-chart-view");

    this.wrapperEl = this.containerEl.createDiv("odash-chart-wrapper");
    this.errorEl = this.containerEl.createDiv("odash-empty-state");
    this.errorEl.hide();
  }

  onDataUpdated(): void {
    this.render();
  }

  private readConfig(): ChartViewConfig {
    const cfg = this.config;
    return {
      chartType: (cfg.get("chartType") as ChartViewConfig["chartType"]) ?? DEFAULT_CHART_CONFIG.chartType,
      xField: cfg.getAsPropertyId("xField"),
      yField: cfg.getAsPropertyId("yField"),
      seriesField: cfg.getAsPropertyId("seriesField") ?? null,
      aggregation: (cfg.get("aggregation") as ChartViewConfig["aggregation"]) ?? DEFAULT_CHART_CONFIG.aggregation,
      dateBucket: (cfg.get("dateBucket") as ChartViewConfig["dateBucket"]) ?? DEFAULT_CHART_CONFIG.dateBucket,
      showLegend: (cfg.get("showLegend") as boolean) ?? DEFAULT_CHART_CONFIG.showLegend,
      cumulative: (cfg.get("cumulative") as boolean) ?? DEFAULT_CHART_CONFIG.cumulative,
      colorScheme: (cfg.get("colorScheme") as string) ?? DEFAULT_CHART_CONFIG.colorScheme,
      showLabels: (cfg.get("showLabels") as boolean) ?? DEFAULT_CHART_CONFIG.showLabels,
      nullHandling: (cfg.get("nullHandling") as ChartViewConfig["nullHandling"]) ?? DEFAULT_CHART_CONFIG.nullHandling,
    };
  }

  private render() {
    const viewCfg = this.readConfig();
    const { records, schema } = recordsFromResult(
      this.data,
      this.allProperties,
      (id) => this.config.getDisplayName(id),
    );

    // ── Validation ─────────────────────────────────────────────────────────
    if (records.length === 0) {
      this.showEmptyState("No records found", "Adjust your Base filters or add notes to your vault.");
      return;
    }

    const isPieOrDonut = viewCfg.chartType === "pie" || viewCfg.chartType === "donut";
    const needsXField = !isPieOrDonut;

    if (needsXField && !viewCfg.xField) {
      this.showEmptyState(
        "X-axis not configured",
        "Open view options and select a property for the X-axis.",
      );
      return;
    }

    if (viewCfg.chartType === "scatter" && (!viewCfg.xField || !viewCfg.yField)) {
      this.showEmptyState(
        "Scatter chart needs X and Y fields",
        "Open view options and select properties for both axes.",
      );
      return;
    }

    this.errorEl.hide();
    this.wrapperEl.show();

    // ── Build aggregated data ──────────────────────────────────────────────
    let series: AggregatedSeries[] = buildAggregatedSeries({
      records,
      xField: viewCfg.xField,
      yField: viewCfg.yField,
      seriesField: viewCfg.seriesField,
      aggregation: viewCfg.aggregation,
      dateBucket: viewCfg.dateBucket,
      nullHandling: viewCfg.nullHandling,
    });

    if (viewCfg.cumulative && !isPieOrDonut) {
      series = makeCumulative(series);
    }

    // ── Build chart config ─────────────────────────────────────────────────
    const labels = series[0]?.points.map((p) => p.label) ?? [];
    const colors = getChartColors(series.length);

    const chartConfig = this.buildChartConfig(viewCfg, series, labels, colors);

    // ── Render chart ───────────────────────────────────────────────────────
    this.destroyChart();
    this.wrapperEl.empty();

    this.canvasEl = this.wrapperEl.createEl("canvas", { cls: "odash-chart-canvas" });
    this.chartInstance = new Chart(this.canvasEl, chartConfig);
  }

  private buildChartConfig(
    viewCfg: ChartViewConfig,
    series: AggregatedSeries[],
    labels: string[],
    colors: string[],
  ): ChartConfiguration {
    const textColor = getTextColor();
    const gridColor = getGridColor();
    const mutedColor = getMutedTextColor();

    const baseScaleOptions = {
      ticks: { color: textColor, font: { size: 11 } },
      grid: { color: gridColor },
    };

    switch (viewCfg.chartType) {
      case "pie":
      case "donut": {
        const vals = series[0]?.points.map((p) => p.value) ?? [];
        const pieLabels = series[0]?.points.map((p) => p.label) ?? [];
        const pieColors = getChartColors(vals.length);
        const isDoughnut = viewCfg.chartType === "donut";
        return {
          type: isDoughnut ? "doughnut" : "pie",
          data: {
            labels: pieLabels,
            datasets: [
              {
                data: vals,
                backgroundColor: pieColors.map((c) => getChartColorAlpha(c, 0.85)),
                borderColor: pieColors,
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: viewCfg.showLegend, labels: { color: textColor } },
              tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.formattedValue}` } },
            },
          },
        };
      }

      case "scatter": {
        const datasets: ChartDataset[] = series.map((s, i) => ({
          type: "scatter" as const,
          label: s.name,
          data: s.points.map((p) => ({ x: parseFloat(p.label) || 0, y: p.value })),
          backgroundColor: getChartColorAlpha(colors[i] ?? "#888", 0.7),
          borderColor: colors[i] ?? "#888",
          pointRadius: 4,
          pointHoverRadius: 6,
        }));

        return {
          type: "scatter",
          data: { datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: viewCfg.showLegend && series.length > 1, labels: { color: textColor } },
              tooltip: { mode: "point" },
            },
            scales: {
              x: { ...baseScaleOptions, type: "linear" },
              y: { ...baseScaleOptions },
            },
          },
        };
      }

      case "line":
      case "area": {
        const datasets: ChartDataset[] = series.map((s, i) => ({
          type: "line" as const,
          label: s.name,
          data: s.points.map((p) => p.value),
          borderColor: colors[i] ?? "#888",
          backgroundColor: viewCfg.chartType === "area"
            ? getChartColorAlpha(colors[i] ?? "#888", 0.25)
            : "transparent",
          fill: viewCfg.chartType === "area",
          tension: 0.3,
          pointRadius: labels.length > 50 ? 0 : 3,
          pointHoverRadius: 5,
        }));

        return {
          type: "line",
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: viewCfg.showLegend && series.length > 1, labels: { color: textColor } },
              tooltip: { mode: "index" },
            },
            scales: {
              x: { ...baseScaleOptions },
              y: { ...baseScaleOptions, beginAtZero: true },
            },
          },
        };
      }

      case "bar":
      case "stacked-bar":
      default: {
        const isStacked = viewCfg.chartType === "stacked-bar";
        const datasets: ChartDataset[] = series.map((s, i) => ({
          type: "bar" as const,
          label: s.name,
          data: s.points.map((p) => p.value),
          backgroundColor: getChartColorAlpha(colors[i] ?? "#888", 0.8),
          borderColor: colors[i] ?? "#888",
          borderWidth: 1,
          borderRadius: isStacked ? 0 : 3,
          datalabels: viewCfg.showLabels ? {} : undefined,
        }));

        return {
          type: "bar",
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                display: viewCfg.showLegend && series.length > 1,
                labels: { color: textColor },
              },
              tooltip: { mode: "index" },
            },
            scales: {
              x: {
                ...baseScaleOptions,
                stacked: isStacked,
              },
              y: {
                ...baseScaleOptions,
                stacked: isStacked,
                beginAtZero: true,
              },
            },
          },
        };
      }
    }
  }

  private showEmptyState(title: string, body: string) {
    this.destroyChart();
    this.wrapperEl.hide();
    this.errorEl.show();
    this.errorEl.empty();

    const icon = this.errorEl.createDiv("odash-empty-icon");
    icon.setText("📊");
    const titleEl = this.errorEl.createEl("h3", { cls: "odash-empty-title", text: title });
    const bodyEl = this.errorEl.createEl("p", { cls: "odash-empty-body", text: body });
  }

  private destroyChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  onunload() {
    this.destroyChart();
  }
}

// ─── View options (displayed by Bases toolbar) ────────────────────────────────

export function chartViewOptions(config: BasesViewConfig): BasesAllOptions[] {
  const chartType = (config.get("chartType") as string) ?? "bar";
  const isPieOrDonut = chartType === "pie" || chartType === "donut";
  const isScatter = chartType === "scatter";
  const isLineOrArea = chartType === "line" || chartType === "area";

  return [
    {
      type: "group",
      displayName: "Chart",
      items: [
        {
          key: "chartType",
          type: "dropdown",
          displayName: "Chart type",
          default: "bar",
          options: {
            bar: "Bar",
            "stacked-bar": "Stacked bar",
            line: "Line",
            area: "Area",
            pie: "Pie",
            donut: "Donut",
            scatter: "Scatter",
          },
        },
      ],
    },
    {
      type: "group",
      displayName: "Data",
      items: [
        {
          key: "xField",
          type: "property",
          displayName: isPieOrDonut ? "Categories" : "X-axis",
          shouldHide: () => isScatter,
        },
        {
          key: "yField",
          type: "property",
          displayName: isPieOrDonut ? "Values" : "Y-axis",
          shouldHide: () => chartType === "bar" || chartType === "stacked-bar",
        },
        {
          key: "aggregation",
          type: "dropdown",
          displayName: "Aggregation",
          default: "count",
          options: {
            count: "Count",
            sum: "Sum",
            avg: "Average",
            min: "Minimum",
            max: "Maximum",
            distinct: "Distinct count",
          },
        },
        {
          key: "seriesField",
          type: "property",
          displayName: "Group by (series)",
          shouldHide: () => isPieOrDonut,
        },
        {
          key: "dateBucket",
          type: "dropdown",
          displayName: "Date bucket",
          default: "none",
          options: {
            none: "None",
            day: "Day",
            week: "Week",
            month: "Month",
            quarter: "Quarter",
            year: "Year",
          },
          shouldHide: () => isPieOrDonut || isScatter,
        },
      ],
    },
    {
      type: "group",
      displayName: "Display",
      items: [
        {
          key: "showLegend",
          type: "toggle",
          displayName: "Show legend",
          default: true,
        },
        {
          key: "showLabels",
          type: "toggle",
          displayName: "Show value labels",
          default: false,
        },
        {
          key: "cumulative",
          type: "toggle",
          displayName: "Cumulative",
          default: false,
          shouldHide: () => !isLineOrArea,
        },
        {
          key: "nullHandling",
          type: "dropdown",
          displayName: "Missing values",
          default: "skip",
          options: {
            skip: "Skip",
            zero: "Show as zero",
          },
        },
      ],
    },
  ] as BasesAllOptions[];
}
