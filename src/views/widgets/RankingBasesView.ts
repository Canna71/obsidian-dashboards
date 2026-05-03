import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import type { RankingViewConfig } from "../../utils/types";
import { DEFAULT_RANKING_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildAggregatedSeries } from "../../data/aggregations";
import { getChartColors } from "../../theme/tokens";
import { VIEW_TYPE_RANKING } from "../../bases/viewTypes";

export class RankingBasesView extends BasesView {
  readonly type = VIEW_TYPE_RANKING;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void { this.render(); }

  private readConfig(): RankingViewConfig {
    const cfg = this.config;
    return {
      groupField: cfg.getAsPropertyId("groupField") ?? null,
      metricField: cfg.getAsPropertyId("metricField") ?? null,
      aggregation: (cfg.get("aggregation") as RankingViewConfig["aggregation"]) ?? DEFAULT_RANKING_CONFIG.aggregation,
      topN: (cfg.get("topN") as number) ?? DEFAULT_RANKING_CONFIG.topN,
    };
  }

  private render() {
    if (!this.data) return;
    const cfg = this.readConfig();
    if (!cfg.groupField) {
      renderEmpty(this.containerEl, "odash-dashboard-view", "🏷️", "No group field", "Choose a field to group by in the view options.");
      return;
    }
    const { records } = recordsFromResult(
      this.data, this.allProperties,
      (id) => this.config.getDisplayName(id),
      [cfg.groupField, cfg.metricField],
    );
    if (records.length === 0) {
      renderEmpty(this.containerEl, "odash-dashboard-view", "📋", "No records", "No notes match the current Base query.");
      return;
    }

    const series = buildAggregatedSeries({
      records,
      xField: cfg.groupField,
      yField: cfg.metricField,
      seriesField: null,
      aggregation: cfg.metricField ? cfg.aggregation : "count",
      dateBucket: "none",
      nullHandling: "skip",
    });

    const points = (series[0]?.points ?? [])
      .sort((a, b) => b.value - a.value)
      .slice(0, cfg.topN);

    if (points.length === 0) {
      renderEmpty(this.containerEl, "odash-dashboard-view", "📋", "No data", "No values found for the selected group field.");
      return;
    }

    this.containerEl.empty();
    this.containerEl.addClass("odash-dashboard-view");

    const maxVal = points[0]!.value;
    const colors = getChartColors(points.length);
    const list = this.containerEl.createDiv("odash-dash-ranking");

    points.forEach((p, i) => {
      const row = list.createDiv("odash-ranking-row");
      row.createEl("span", { cls: "odash-ranking-label", text: p.label });
      const barWrap = row.createDiv("odash-ranking-bar-wrap");
      const fill = barWrap.createDiv("odash-ranking-bar-fill");
      fill.style.width = `${Math.round((p.value / maxVal) * 100)}%`;
      fill.style.backgroundColor = colors[i]!;
      row.createEl("span", { cls: "odash-ranking-value", text: String(p.value) });
    });
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

export function rankingViewOptions(config: BasesViewConfig): BasesAllOptions[] {
  const hasMetric = !!config.getAsPropertyId("metricField");
  return [
    {
      type: "group", displayName: "Data",
      items: [
        { key: "groupField", type: "property", displayName: "Group by (required)" },
        { key: "metricField", type: "property", displayName: "Metric field (optional)" },
        {
          key: "aggregation", type: "dropdown", displayName: "Aggregation",
          default: "count",
          options: { count: "Count records", sum: "Sum values", avg: "Average" },
          shouldHide: () => !hasMetric,
        },
        { key: "topN", type: "slider", displayName: "Top N", default: 5, min: 3, max: 20, step: 1 },
      ],
    },
  ] as BasesAllOptions[];
}
