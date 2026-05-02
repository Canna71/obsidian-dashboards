import {
  BasesView,
  type QueryController,
  type BasesViewConfig,
  type BasesAllOptions,
} from "obsidian";

import type { HabitViewConfig, HabitMetricSummary, HeatmapMonth } from "../../utils/types";
import { DEFAULT_HABIT_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildHabitStatusDays, buildHabitMetrics } from "../../habits/completion";
import { buildHeatmapMonths } from "../../habits/heatmap";
import {
  getHeatmapColors,
  getHeatmapColor,
  getTextColor,
  getMutedTextColor,
} from "../../theme/tokens";
import { formatPercent } from "../../utils/numbers";
import { VIEW_TYPE_HABIT } from "../../bases/viewTypes";

export class HabitBasesView extends BasesView {
  readonly type = VIEW_TYPE_HABIT;

  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
  }

  onDataUpdated(): void {
    this.render();
  }

  private readConfig(): HabitViewConfig {
    const cfg = this.config;
    return {
      modelType: (cfg.get("modelType") as HabitViewConfig["modelType"]) ?? DEFAULT_HABIT_CONFIG.modelType,
      dateField: cfg.getAsPropertyId("dateField"),
      habitField: cfg.getAsPropertyId("habitField"),
      habitNameField: cfg.getAsPropertyId("habitNameField") ?? null,
      targetValue: (cfg.get("targetValue") as number) ?? DEFAULT_HABIT_CONFIG.targetValue,
      successRule: (cfg.get("successRule") as HabitViewConfig["successRule"]) ?? DEFAULT_HABIT_CONFIG.successRule,
      summaryPeriod: (cfg.get("summaryPeriod") as HabitViewConfig["summaryPeriod"]) ?? DEFAULT_HABIT_CONFIG.summaryPeriod,
      showStreak: (cfg.get("showStreak") as boolean) ?? DEFAULT_HABIT_CONFIG.showStreak,
      showHeatmap: (cfg.get("showHeatmap") as boolean) ?? DEFAULT_HABIT_CONFIG.showHeatmap,
    };
  }

  private render() {
    if (!this.data) return;

    const viewCfg = this.readConfig();

    if (!viewCfg.dateField) {
      this.renderEmpty("🗓️", "No date field selected", "Open view options and choose the date property for this habit.");
      return;
    }
    if (!viewCfg.habitField) {
      this.renderEmpty("✅", "No habit field selected", "Open view options and choose the property that tracks this habit (checkbox, number, etc.).");
      return;
    }

    const { records } = recordsFromResult(
      this.data,
      this.allProperties,
      (id) => this.config.getDisplayName(id),
      [viewCfg.dateField, viewCfg.habitField],
    );

    if (records.length === 0) {
      this.renderEmpty("📋", "No records found", "No notes match the current Base query. Add notes or adjust the query.");
      return;
    }

    const days = buildHabitStatusDays(records, viewCfg);
    const metrics = buildHabitMetrics(records, viewCfg);

    this.containerEl.empty();
    this.containerEl.addClass("odash-habit-view");

    // ── Header with habit name ──────────────────────────────────────────────
    const header = this.containerEl.createDiv("odash-habit-header");
    const habitName = this.config.name || this.config.getDisplayName(viewCfg.habitField!);
    header.createEl("h3", { cls: "odash-habit-title", text: habitName });
    const subtitle = header.createEl("p", { cls: "odash-habit-subtitle" });
    subtitle.setText(`${metrics.totalDays} tracked days · ${formatPercent(metrics.completionRate)} completion`);

    // ── KPI bar ────────────────────────────────────────────────────────────
    this.renderKPIBar(metrics, viewCfg);

    // ── Heatmap ────────────────────────────────────────────────────────────
    if (viewCfg.showHeatmap) {
      this.renderHeatmap(days, viewCfg);
    }

    // ── Weekly completion bars ─────────────────────────────────────────────
    this.renderWeeklyBars(metrics);
  }

  // ─── KPI tiles ────────────────────────────────────────────────────────────

  private renderKPIBar(metrics: HabitMetricSummary, cfg: HabitViewConfig) {
    const bar = this.containerEl.createDiv("odash-kpi-bar");

    this.kpi(bar, "🔥", "Current streak", `${metrics.streak.current}d`);
    this.kpi(bar, "🏆", "Longest streak", `${metrics.streak.longest}d`);
    this.kpi(bar, "✅", "Completion", formatPercent(metrics.completionRate));
    this.kpi(bar, "📅", "7-day avg", formatPercent(metrics.rollingAvg7));
    this.kpi(bar, "📈", "30-day avg", formatPercent(metrics.rollingAvg30));
  }

  private kpi(parent: HTMLElement, icon: string, label: string, value: string) {
    const tile = parent.createDiv("odash-kpi-tile");
    tile.createEl("span", { cls: "odash-kpi-icon", text: icon });
    tile.createEl("span", { cls: "odash-kpi-value", text: value });
    tile.createEl("span", { cls: "odash-kpi-label", text: label });
  }

  // ─── Contribution heatmap ─────────────────────────────────────────────────

  private renderHeatmap(days: ReturnType<typeof buildHabitStatusDays>, cfg: HabitViewConfig) {
    const section = this.containerEl.createDiv("odash-habit-section");
    section.createEl("h4", { cls: "odash-section-title", text: "Activity" });

    const heatmapEl = section.createDiv("odash-heatmap");
    const colors = getHeatmapColors();

    const months = buildHeatmapMonths(days, 6, 1);

    // Month labels + week columns layout
    const monthsRow = heatmapEl.createDiv("odash-heatmap-months");

    for (const month of months) {
      const monthEl = monthsRow.createDiv("odash-heatmap-month");
      monthEl.createEl("span", { cls: "odash-heatmap-month-label", text: month.label });

      const weeksEl = monthEl.createDiv("odash-heatmap-weeks");

      for (const week of month.weeks) {
        const weekEl = weeksEl.createDiv("odash-heatmap-week");

        for (const cell of week.cells) {
          if (!cell) {
            weekEl.createDiv({ cls: "odash-heatmap-cell odash-heatmap-cell--empty" });
            continue;
          }

          const intensity = cell.isTracked
            ? cell.isSuccess ? Math.max(0.25, cell.value > 0 ? Math.min(1, cell.value) : 0.5) : 0
            : 0;

          const cellEl = weekEl.createDiv({
            cls: [
              "odash-heatmap-cell",
              cell.isToday ? "odash-heatmap-cell--today" : "",
              cell.isFuture ? "odash-heatmap-cell--future" : "",
              cell.isSuccess ? "odash-heatmap-cell--success" : "",
              !cell.isTracked ? "odash-heatmap-cell--untracked" : "",
            ].filter(Boolean).join(" "),
          });

          const bg = getHeatmapColor(intensity, colors);
          cellEl.style.backgroundColor = bg;

          const label = `${cell.dateKey}: ${cell.isTracked ? (cell.isSuccess ? "✓" : "✗") : "—"}`;
          cellEl.setAttribute("title", label);

          // Click to open the note
          const dayRecords = days.filter((d) => d.dateKey === cell.dateKey);
          if (dayRecords.length > 0) {
            cellEl.classList.add("odash-heatmap-cell--clickable");
            cellEl.addEventListener("click", () => {
              this.app.workspace.openLinkText(dayRecords[0]!.date.toISOString(), "", false);
            });
          }
        }
      }
    }

    // Legend
    const legendEl = heatmapEl.createDiv("odash-heatmap-legend");
    legendEl.createEl("span", { cls: "odash-heatmap-legend-label", text: "Less" });
    for (const color of colors) {
      const dot = legendEl.createDiv("odash-heatmap-legend-cell");
      dot.style.backgroundColor = color;
    }
    legendEl.createEl("span", { cls: "odash-heatmap-legend-label", text: "More" });
  }

  // ─── Weekly completion bars ────────────────────────────────────────────────

  private renderWeeklyBars(metrics: HabitMetricSummary) {
    const recent = metrics.weeklyRates.slice(-12);
    if (recent.length === 0) return;

    const section = this.containerEl.createDiv("odash-habit-section");
    section.createEl("h4", { cls: "odash-section-title", text: "Weekly completion" });

    const barsEl = section.createDiv("odash-week-bars");

    const maxRate = Math.max(...recent.map((w) => w.rate), 0.01);

    for (const week of recent) {
      const bar = barsEl.createDiv("odash-week-bar");
      const pct = week.rate / maxRate;
      const fill = bar.createDiv("odash-week-bar-fill");
      fill.style.height = `${Math.round(pct * 100)}%`;
      fill.style.backgroundColor = week.rate >= 0.8
        ? "var(--color-accent)"
        : week.rate >= 0.5
          ? "#f59e0b"
          : "#ef4444";

      bar.setAttribute("title", `${week.label}: ${formatPercent(week.rate)}`);

      const labelEl = bar.createEl("span", { cls: "odash-week-bar-label" });
      // Show last 2 chars of week key as a terse label
      labelEl.setText(week.label.slice(-5));
    }
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  private renderEmpty(icon: string, title: string, body: string) {
    this.containerEl.empty();
    this.containerEl.addClass("odash-habit-view");
    const el = this.containerEl.createDiv("odash-empty-state");
    el.createDiv({ cls: "odash-empty-icon", text: icon });
    el.createEl("h3", { cls: "odash-empty-title", text: title });
    el.createEl("p", { cls: "odash-empty-body", text: body });

    // Wizard hint for model selection
    if (title.includes("date field")) {
      const wizard = this.containerEl.createDiv("odash-habit-wizard");
      wizard.createEl("p", {
        cls: "odash-wizard-intro",
        text: "Two habit modeling strategies are supported:",
      });
      const strategies = wizard.createEl("ul");
      strategies.createEl("li").setText("Daily note model: one note per day with boolean/number properties per habit.");
      strategies.createEl("li").setText("Event log model: one note per completion event, with a date property.");
    }
  }
}

// ─── View options ─────────────────────────────────────────────────────────────

export function habitViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
  return [
    {
      type: "group",
      displayName: "Habit",
      items: [
        {
          key: "dateField",
          type: "property",
          displayName: "Date field",
          filter: (prop) => prop.startsWith("note.") || prop.startsWith("file."),
        },
        {
          key: "habitField",
          type: "property",
          displayName: "Habit field (checkbox or number)",
        },
        {
          key: "modelType",
          type: "dropdown",
          displayName: "Model type",
          default: "daily-note",
          options: {
            "daily-note": "Daily note (one note per day)",
            "event-log": "Event log (one note per completion)",
          },
        },
      ],
    },
    {
      type: "group",
      displayName: "Goal",
      items: [
        {
          key: "successRule",
          type: "dropdown",
          displayName: "Success when",
          default: "any",
          options: {
            any: "Any truthy value",
            "gt-zero": "Greater than zero",
            "gte-target": "At or above target",
          },
        },
        {
          key: "targetValue",
          type: "slider",
          displayName: "Target value",
          default: 1,
          min: 1,
          max: 100,
          step: 1,
        },
      ],
    },
    {
      type: "group",
      displayName: "Display",
      items: [
        {
          key: "showStreak",
          type: "toggle",
          displayName: "Show streak counters",
          default: true,
        },
        {
          key: "showHeatmap",
          type: "toggle",
          displayName: "Show activity heatmap",
          default: true,
        },
        {
          key: "summaryPeriod",
          type: "dropdown",
          displayName: "Summary period",
          default: "month",
          options: {
            week: "Week",
            month: "Month",
            quarter: "Quarter",
            year: "Year",
          },
        },
      ],
    },
  ] as BasesAllOptions[];
}
