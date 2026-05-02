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
  Filler,
  Tooltip,
} from "chart.js";

import type { DashboardViewConfig, FieldDescriptor } from "../../utils/types";
import { DEFAULT_DASHBOARD_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildAggregatedSeries } from "../../data/aggregations";
import { buildHabitMetrics, buildHabitStatusDays } from "../../habits/completion";
import {
  getChartColors,
  getChartColorAlpha,
  getGridColor,
  getTextColor,
} from "../../theme/tokens";
import { formatNumber, formatPercent } from "../../utils/numbers";
import { getDateFields, getNumericFields, getCategoricalFields } from "../../data/schemaInference";
import { VIEW_TYPE_DASHBOARD } from "../../bases/viewTypes";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export class DashboardBasesView extends BasesView {
  readonly type = VIEW_TYPE_DASHBOARD;

  private containerEl: HTMLElement;
  private sparklineCharts: Chart[] = [];

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
  }

  onDataUpdated(): void {
    this.render();
  }

  private readConfig(): DashboardViewConfig {
    const cfg = this.config;
    return {
      showKpi: (cfg.get("showKpi") as boolean) ?? DEFAULT_DASHBOARD_CONFIG.showKpi,
      showSparkline: (cfg.get("showSparkline") as boolean) ?? DEFAULT_DASHBOARD_CONFIG.showSparkline,
      showStreak: (cfg.get("showStreak") as boolean) ?? DEFAULT_DASHBOARD_CONFIG.showStreak,
      showCalendar: (cfg.get("showCalendar") as boolean) ?? DEFAULT_DASHBOARD_CONFIG.showCalendar,
      dateWindow: (cfg.get("dateWindow") as number) ?? DEFAULT_DASHBOARD_CONFIG.dateWindow,
      topN: (cfg.get("topN") as number) ?? DEFAULT_DASHBOARD_CONFIG.topN,
      primaryMetric: cfg.getAsPropertyId("primaryMetric"),
      groupField: cfg.getAsPropertyId("groupField") ?? null,
    };
  }

  private render() {
    if (!this.data) return;

    // Destroy previous sparklines
    for (const ch of this.sparklineCharts) ch.destroy();
    this.sparklineCharts = [];

    const viewCfg = this.readConfig();
    const { records, schema } = recordsFromResult(
      this.data,
      this.allProperties,
      (id) => this.config.getDisplayName(id),
      [viewCfg.primaryMetric, viewCfg.groupField],
    );

    this.containerEl.empty();
    this.containerEl.addClass("odash-dashboard-view");

    if (records.length === 0) {
      const el = this.containerEl.createDiv("odash-empty-state");
      el.createDiv({ cls: "odash-empty-icon", text: "📊" });
      el.createEl("h3", { cls: "odash-empty-title", text: "No records" });
      return;
    }

    const numFields = getNumericFields(schema);
    const dateFields = getDateFields(schema);
    const catFields = getCategoricalFields(schema);

    // ── KPI cards ─────────────────────────────────────────────────────────
    if (viewCfg.showKpi) {
      const kpiSection = this.containerEl.createDiv("odash-dash-section");
      kpiSection.createEl("h4", { cls: "odash-section-title", text: "Summary" });
      const kpiBar = kpiSection.createDiv("odash-kpi-bar");

      this.kpi(kpiBar, "📝", "Total records", String(records.length));

      if (viewCfg.primaryMetric) {
        const nums = records
          .map((r) => r.properties[viewCfg.primaryMetric!])
          .filter((v) => v?.kind === "number")
          .map((v) => (v as { kind: "number"; value: number }).value);

        if (nums.length > 0) {
          const fieldName = this.config.getDisplayName(viewCfg.primaryMetric!);
          const total = nums.reduce((a, b) => a + b, 0);
          const avg = total / nums.length;
          this.kpi(kpiBar, "∑", `Total ${fieldName}`, formatNumber(total));
          this.kpi(kpiBar, "⌀", `Avg ${fieldName}`, formatNumber(avg));
          this.kpi(kpiBar, "↑", `Max ${fieldName}`, formatNumber(Math.max(...nums)));
        }
      } else if (numFields.length > 0) {
        // Auto-pick first numeric field
        const f = numFields[0]!;
        const nums = records
          .map((r) => r.properties[f.id])
          .filter((v) => v?.kind === "number")
          .map((v) => (v as { kind: "number"; value: number }).value);
        if (nums.length > 0) {
          const total = nums.reduce((a, b) => a + b, 0);
          this.kpi(kpiBar, "∑", `Total ${f.displayName}`, formatNumber(total));
          this.kpi(kpiBar, "⌀", `Avg ${f.displayName}`, formatNumber(total / nums.length));
        }
      }
    }

    // ── Top-N breakdown ───────────────────────────────────────────────────
    if (viewCfg.groupField && catFields.length > 0) {
      const groupField = viewCfg.groupField ?? catFields[0]!.id;
      const series = buildAggregatedSeries({
        records,
        xField: groupField,
        yField: viewCfg.primaryMetric,
        seriesField: null,
        aggregation: "count",
        dateBucket: "none",
        nullHandling: "skip",
      });

      const points = (series[0]?.points ?? [])
        .sort((a, b) => b.value - a.value)
        .slice(0, viewCfg.topN);

      if (points.length > 0) {
        const section = this.containerEl.createDiv("odash-dash-section");
        section.createEl("h4", {
          cls: "odash-section-title",
          text: `Top ${viewCfg.topN} by ${this.config.getDisplayName(groupField)}`,
        });
        const list = section.createDiv("odash-dash-ranking");
        const maxVal = points[0]!.value;
        const colors = getChartColors(points.length);

        points.forEach((p, i) => {
          const row = list.createDiv("odash-ranking-row");
          row.createEl("span", { cls: "odash-ranking-label", text: p.label });
          const bar = row.createDiv("odash-ranking-bar-wrap");
          const fill = bar.createDiv("odash-ranking-bar-fill");
          fill.style.width = `${Math.round((p.value / maxVal) * 100)}%`;
          fill.style.backgroundColor = colors[i]!;
          row.createEl("span", { cls: "odash-ranking-value", text: String(p.value) });
        });
      }
    }

    // ── Sparkline (trend over time) ────────────────────────────────────────
    if (viewCfg.showSparkline && dateFields.length > 0) {
      const dateField = dateFields[0]!.id;
      const series = buildAggregatedSeries({
        records,
        xField: dateField,
        yField: viewCfg.primaryMetric,
        seriesField: null,
        aggregation: viewCfg.primaryMetric ? "sum" : "count",
        dateBucket: "month",
        nullHandling: "zero",
      });

      const points = series[0]?.points ?? [];
      if (points.length > 1) {
        const section = this.containerEl.createDiv("odash-dash-section");
        section.createEl("h4", { cls: "odash-section-title", text: "Trend" });
        const canvas = section.createEl("canvas", { cls: "odash-sparkline" });

        const colors = getChartColors(1);
        const ch = new Chart(canvas, {
          type: "line",
          data: {
            labels: points.map((p) => p.label),
            datasets: [
              {
                data: points.map((p) => p.value),
                borderColor: colors[0]!,
                backgroundColor: getChartColorAlpha(colors[0]!, 0.15),
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2,
              },
            ],
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
        this.sparklineCharts.push(ch);
      }
    }

    // ── Recent records ────────────────────────────────────────────────────
    const section = this.containerEl.createDiv("odash-dash-section");
    section.createEl("h4", { cls: "odash-section-title", text: "Recent records" });

    const recent = [...records]
      .sort((a, b) => {
        if (dateFields.length === 0) return 0;
        const av = a.properties[dateFields[0]!.id];
        const bv = b.properties[dateFields[0]!.id];
        if (av?.kind === "date" && bv?.kind === "date") return bv.value.getTime() - av.value.getTime();
        return 0;
      })
      .slice(0, viewCfg.topN);

    const recentList = section.createDiv("odash-recent-list");
    for (const r of recent) {
      const row = recentList.createDiv("odash-recent-row");
      const link = row.createEl("a", { cls: "odash-recent-link", text: r.title });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.app.workspace.openLinkText(r.file.path, "", false);
      });

      if (dateFields.length > 0) {
        const dv = r.properties[dateFields[0]!.id];
        if (dv?.kind === "date") {
          row.createEl("span", {
            cls: "odash-recent-date",
            text: dv.iso,
          });
        }
      }
    }
  }

  private kpi(parent: HTMLElement, icon: string, label: string, value: string) {
    const tile = parent.createDiv("odash-kpi-tile");
    tile.createEl("span", { cls: "odash-kpi-icon", text: icon });
    tile.createEl("span", { cls: "odash-kpi-value", text: value });
    tile.createEl("span", { cls: "odash-kpi-label", text: label });
  }

  onunload() {
    for (const ch of this.sparklineCharts) ch.destroy();
    this.sparklineCharts = [];
  }
}

// ─── View options ─────────────────────────────────────────────────────────────

export function dashboardViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
  return [
    {
      type: "group",
      displayName: "Metrics",
      items: [
        {
          key: "primaryMetric",
          type: "property",
          displayName: "Primary metric",
          filter: (prop) => prop.startsWith("note."),
        },
        {
          key: "groupField",
          type: "property",
          displayName: "Group by",
        },
        {
          key: "topN",
          type: "slider",
          displayName: "Top N items",
          default: 5,
          min: 3,
          max: 20,
          step: 1,
        },
      ],
    },
    {
      type: "group",
      displayName: "Sections",
      items: [
        {
          key: "showKpi",
          type: "toggle",
          displayName: "Show KPI cards",
          default: true,
        },
        {
          key: "showSparkline",
          type: "toggle",
          displayName: "Show trend chart",
          default: true,
        },
      ],
    },
    {
      type: "group",
      displayName: "Date range",
      items: [
        {
          key: "dateWindow",
          type: "slider",
          displayName: "Days back (0 = all)",
          default: 0,
          min: 0,
          max: 365,
          step: 7,
        },
      ],
    },
  ] as BasesAllOptions[];
}
