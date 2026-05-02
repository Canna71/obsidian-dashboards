import {
  BasesView,
  type QueryController,
  type BasesViewConfig,
  type BasesAllOptions,
  type BasesPropertyId,
} from "obsidian";

import type { HeatmapViewConfig, HabitDayStatus } from "../../utils/types";
import { DEFAULT_HEATMAP_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildHeatmapMonths } from "../../habits/heatmap";
import { getHeatmapColorsByScheme, getHeatmapColor } from "../../theme/tokens";
import { coerceToNumber } from "../../utils/validation";
import { formatNumber, formatPercent } from "../../utils/numbers";
import { VIEW_TYPE_HEATMAP } from "../../bases/viewTypes";

export class HeatmapBasesView extends BasesView {
  readonly type = VIEW_TYPE_HEATMAP;

  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    // Bases gates runQuery on containerEl.isShown(), which returns false for
    // embedded views. Override it so the query runs when the element is connected.
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void {
    this.render();
  }

  private readConfig(): HeatmapViewConfig {
    const cfg = this.config;
    return {
      dateField: cfg.getAsPropertyId("dateField"),
      valueField: cfg.getAsPropertyId("valueField") ?? null,
      aggregation:
        (cfg.get("aggregation") as HeatmapViewConfig["aggregation"]) ??
        DEFAULT_HEATMAP_CONFIG.aggregation,
      monthsBack:
        (cfg.get("monthsBack") as number) ?? DEFAULT_HEATMAP_CONFIG.monthsBack,
      colorScheme:
        (cfg.get("colorScheme") as HeatmapViewConfig["colorScheme"]) ??
        DEFAULT_HEATMAP_CONFIG.colorScheme,
      showStats:
        (cfg.get("showStats") as boolean) ?? DEFAULT_HEATMAP_CONFIG.showStats,
      firstDayOfWeek:
        (cfg.get("firstDayOfWeek") as number) ??
        DEFAULT_HEATMAP_CONFIG.firstDayOfWeek,
    };
  }

  private render() {
    if (!this.data) return;

    const viewCfg = this.readConfig();

    if (!viewCfg.dateField) {
      this.renderEmpty(
        "🗓️",
        "No date field selected",
        "Open view options and choose the date property.",
      );
      return;
    }

    const { records } = recordsFromResult(
      this.data,
      this.allProperties,
      (id) => this.config.getDisplayName(id),
      [viewCfg.dateField, viewCfg.valueField],
    );

    if (records.length === 0) {
      this.renderEmpty(
        "📋",
        "No records found",
        "No notes match the current Base query.",
      );
      return;
    }

    const days = buildHeatmapDays(
      records,
      viewCfg.dateField,
      viewCfg.valueField,
      viewCfg.aggregation,
    );
    const months = buildHeatmapMonths(days, viewCfg.monthsBack, viewCfg.firstDayOfWeek);
    const colors = getHeatmapColorsByScheme(viewCfg.colorScheme);

    // Pre-compute max value for intensity normalization
    const trackedValues = days.filter((d) => d.isTracked).map((d) =>
      d.value.kind === "number" ? d.value.value : 0,
    );
    const maxVal = trackedValues.length > 0 ? Math.max(...trackedValues, 1) : 1;

    // Build a quick lookup: dateKey → records for click handling
    const recordsByDate = new Map<string, typeof records>();
    for (const r of records) {
      const dv = r.properties[viewCfg.dateField!];
      if (dv?.kind !== "date") continue;
      const dk = dv.iso.slice(0, 10);
      if (!recordsByDate.has(dk)) recordsByDate.set(dk, []);
      recordsByDate.get(dk)!.push(r);
    }

    this.containerEl.empty();
    this.containerEl.addClass("odash-heatmap-view");

    // ── Header ──────────────────────────────────────────────────────────────
    const header = this.containerEl.createDiv("odash-heatmap-view-header");
    const title = this.config.name || this.config.getDisplayName(viewCfg.dateField);
    header.createEl("h3", { cls: "odash-section-title", text: title });

    // ── Stats bar ────────────────────────────────────────────────────────────
    if (viewCfg.showStats) {
      this.renderStats(days, viewCfg);
    }

    // ── Heatmap ──────────────────────────────────────────────────────────────
    const heatmapEl = this.containerEl.createDiv("odash-heatmap");
    const monthsRow = heatmapEl.createDiv("odash-heatmap-months");

    for (const month of months) {
      const monthEl = monthsRow.createDiv("odash-heatmap-month");
      monthEl.createEl("span", {
        cls: "odash-heatmap-month-label",
        text: month.label,
      });

      const weeksEl = monthEl.createDiv("odash-heatmap-weeks");
      for (const week of month.weeks) {
        const weekEl = weeksEl.createDiv("odash-heatmap-week");
        for (const cell of week.cells) {
          if (!cell) {
            weekEl.createDiv({
              cls: "odash-heatmap-cell odash-heatmap-cell--empty",
            });
            continue;
          }

          const intensity =
            cell.isTracked && cell.value > 0
              ? Math.min(1, cell.value / maxVal)
              : 0;

          const cls = [
            "odash-heatmap-cell",
            cell.isToday ? "odash-heatmap-cell--today" : "",
            cell.isFuture ? "odash-heatmap-cell--future" : "",
            cell.isSuccess ? "odash-heatmap-cell--success" : "",
            !cell.isTracked ? "odash-heatmap-cell--untracked" : "",
            cell.isTracked && !cell.isFuture ? "odash-heatmap-cell--clickable" : "",
          ].filter(Boolean).join(" ");

          const cellEl = weekEl.createDiv({ cls });
          cellEl.style.backgroundColor = getHeatmapColor(intensity, colors);

          const valueLabel = cell.isTracked
            ? viewCfg.valueField
              ? formatNumber(cell.value)
              : `${cell.value} record${cell.value !== 1 ? "s" : ""}`
            : "—";
          cellEl.setAttribute("title", `${cell.dateKey}: ${valueLabel}`);

          const dayRecords = recordsByDate.get(cell.dateKey) ?? [];
          if (dayRecords.length === 1) {
            cellEl.addEventListener("click", () => {
              this.app.workspace.openLinkText(dayRecords[0]!.file.path, "", false);
            });
          }
        }
      }
    }

    // ── Legend ───────────────────────────────────────────────────────────────
    const legendEl = heatmapEl.createDiv("odash-heatmap-legend");
    legendEl.createEl("span", {
      cls: "odash-heatmap-legend-label",
      text: "Less",
    });
    for (const color of colors) {
      const dot = legendEl.createDiv("odash-heatmap-legend-cell");
      dot.style.backgroundColor = color;
    }
    legendEl.createEl("span", {
      cls: "odash-heatmap-legend-label",
      text: "More",
    });
  }

  private renderStats(days: HabitDayStatus[], cfg: HeatmapViewConfig) {
    const now = new Date();
    const tracked = days.filter((d) => d.isTracked && d.date <= now);
    const bar = this.containerEl.createDiv("odash-kpi-bar");

    this.kpi(bar, "📅", "Active days", String(tracked.length));
    this.kpi(bar, "📝", "Total records", String(this.data?.data?.length ?? 0));

    if (cfg.valueField && tracked.length > 0) {
      const values = tracked
        .map((d) => (d.value.kind === "number" ? d.value.value : 0))
        .filter((v) => v > 0);
      if (values.length > 0) {
        const total = values.reduce((a, b) => a + b, 0);
        this.kpi(bar, "∑", "Total", formatNumber(total));
        this.kpi(bar, "⌀", "Per active day", formatNumber(total / tracked.length));
      }
    }
  }

  private kpi(parent: HTMLElement, icon: string, label: string, value: string) {
    const tile = parent.createDiv("odash-kpi-tile");
    tile.createEl("span", { cls: "odash-kpi-icon", text: icon });
    tile.createEl("span", { cls: "odash-kpi-value", text: value });
    tile.createEl("span", { cls: "odash-kpi-label", text: label });
  }

  private renderEmpty(icon: string, title: string, body: string) {
    this.containerEl.empty();
    this.containerEl.addClass("odash-heatmap-view");
    const el = this.containerEl.createDiv("odash-empty-state");
    el.createDiv({ cls: "odash-empty-icon", text: icon });
    el.createEl("h3", { cls: "odash-empty-title", text: title });
    el.createEl("p", { cls: "odash-empty-body", text: body });
  }
}

// ─── Data builder ─────────────────────────────────────────────────────────────

function buildHeatmapDays(
  records: ReturnType<typeof import("../../data/adapter").recordsFromResult>["records"],
  dateField: BasesPropertyId,
  valueField: BasesPropertyId | null,
  aggregation: "count" | "sum" | "avg",
): HabitDayStatus[] {
  // Group records by date key
  const byDate = new Map<string, { date: Date; nums: number[] }>();

  for (const r of records) {
    const dv = r.properties[dateField];
    if (dv?.kind !== "date") continue;

    const dateKey = dv.iso.slice(0, 10); // YYYY-MM-DD
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { date: dv.value, nums: [] });
    }

    if (valueField) {
      const vv = r.properties[valueField];
      const n = coerceToNumber(vv);
      if (n !== null) byDate.get(dateKey)!.nums.push(n);
    } else {
      byDate.get(dateKey)!.nums.push(1); // count mode
    }
  }

  return Array.from(byDate.entries()).map(([dateKey, { date, nums }]) => {
    let agg = 0;
    if (nums.length > 0) {
      if (aggregation === "count") agg = nums.length;
      else if (aggregation === "sum") agg = nums.reduce((a, b) => a + b, 0);
      else agg = nums.reduce((a, b) => a + b, 0) / nums.length;
    }

    return {
      date,
      dateKey,
      value: { kind: "number" as const, value: agg },
      isSuccess: agg > 0,
      isTracked: nums.length > 0,
    } as HabitDayStatus;
  });
}

// ─── View options ─────────────────────────────────────────────────────────────

export function heatmapViewOptions(config: BasesViewConfig): BasesAllOptions[] {
  const hasValueField = !!config.getAsPropertyId("valueField");

  return [
    {
      type: "group",
      displayName: "Data",
      items: [
        {
          key: "dateField",
          type: "property",
          displayName: "Date field",
        },
        {
          key: "valueField",
          type: "property",
          displayName: "Value field (optional)",
        },
        {
          key: "aggregation",
          type: "dropdown",
          displayName: "Aggregation",
          default: "count",
          options: {
            count: "Count records",
            sum: "Sum values",
            avg: "Average",
          },
          shouldHide: () => !hasValueField,
        },
        {
          key: "monthsBack",
          type: "slider",
          displayName: "Months to show",
          default: 6,
          min: 1,
          max: 12,
          step: 1,
        },
      ],
    },
    {
      type: "group",
      displayName: "Display",
      items: [
        {
          key: "colorScheme",
          type: "dropdown",
          displayName: "Color scheme",
          default: "green",
          options: {
            green: "Green",
            blue: "Blue",
            purple: "Purple",
            orange: "Orange",
            red: "Red",
          },
        },
        {
          key: "showStats",
          type: "toggle",
          displayName: "Show stats",
          default: true,
        },
        {
          key: "firstDayOfWeek",
          type: "dropdown",
          displayName: "First day of week",
          default: "1",
          options: {
            "1": "Monday",
            "0": "Sunday",
          },
        },
      ],
    },
  ] as BasesAllOptions[];
}
