import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import type { WeekBarsViewConfig, HabitViewConfig } from "../../utils/types";
import { DEFAULT_WEEK_BARS_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildHabitMetrics } from "../../habits/completion";
import { formatPercent } from "../../utils/numbers";
import { VIEW_TYPE_WEEK_BARS } from "../../bases/viewTypes";

export class WeekBarsBasesView extends BasesView {
  readonly type = VIEW_TYPE_WEEK_BARS;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void { this.render(); }

  private readConfig(): WeekBarsViewConfig {
    const cfg = this.config;
    return {
      dateField: cfg.getAsPropertyId("dateField") ?? null,
      habitField: cfg.getAsPropertyId("habitField") ?? null,
      successRule: (cfg.get("successRule") as WeekBarsViewConfig["successRule"]) ?? DEFAULT_WEEK_BARS_CONFIG.successRule,
      targetValue: (cfg.get("targetValue") as number) ?? DEFAULT_WEEK_BARS_CONFIG.targetValue,
      weeksBack: (cfg.get("weeksBack") as number) ?? DEFAULT_WEEK_BARS_CONFIG.weeksBack,
    };
  }

  private render() {
    if (!this.data) return;
    const cfg = this.readConfig();
    if (!cfg.dateField || !cfg.habitField) {
      renderEmpty(this.containerEl, "odash-habit-view", "📊", "Configure habit fields", "Set the date field and habit field in view options.");
      return;
    }
    const { records } = recordsFromResult(
      this.data, this.allProperties,
      (id) => this.config.getDisplayName(id),
      [cfg.dateField, cfg.habitField],
    );
    if (records.length === 0) {
      renderEmpty(this.containerEl, "odash-habit-view", "📋", "No records", "No notes match the current Base query.");
      return;
    }

    const habitCfg: HabitViewConfig = {
      modelType: "daily-note",
      dateField: cfg.dateField,
      habitField: cfg.habitField,
      habitNameField: null,
      successRule: cfg.successRule,
      targetValue: cfg.targetValue,
      summaryPeriod: "month",
      showStreak: false,
      showHeatmap: false,
    };

    const metrics = buildHabitMetrics(records, habitCfg);
    const weeks = metrics.weeklyRates.slice(-cfg.weeksBack);

    if (weeks.length === 0) {
      renderEmpty(this.containerEl, "odash-habit-view", "📊", "No weekly data", "Not enough data to show weekly bars.");
      return;
    }

    this.containerEl.empty();
    this.containerEl.addClass("odash-habit-view");

    const barsEl = this.containerEl.createDiv("odash-week-bars");
    const maxRate = Math.max(...weeks.map((w) => w.rate), 0.01);

    for (const week of weeks) {
      const bar = barsEl.createDiv("odash-week-bar");
      const pct = week.rate / maxRate;
      const fill = bar.createDiv("odash-week-bar-fill");
      fill.style.height = `${Math.round(pct * 100)}%`;
      fill.style.backgroundColor = week.rate >= 0.8
        ? "var(--color-accent)"
        : week.rate >= 0.5 ? "#f59e0b" : "#ef4444";
      bar.setAttribute("title", `${week.label}: ${formatPercent(week.rate)}`);
      bar.createEl("span", { cls: "odash-week-bar-label", text: week.label.slice(-5) });
    }
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

export function weekBarsViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
  return [
    {
      type: "group", displayName: "Habit",
      items: [
        { key: "dateField", type: "property", displayName: "Date field" },
        { key: "habitField", type: "property", displayName: "Habit field" },
      ],
    },
    {
      type: "group", displayName: "Goal",
      items: [
        {
          key: "successRule", type: "dropdown", displayName: "Success when",
          default: "any",
          options: { any: "Any truthy value", "gt-zero": "Greater than zero", "gte-target": "At or above target" },
        },
        { key: "targetValue", type: "slider", displayName: "Target value", default: 1, min: 1, max: 100, step: 1 },
      ],
    },
    {
      type: "group", displayName: "Display",
      items: [
        { key: "weeksBack", type: "slider", displayName: "Weeks to show", default: 12, min: 4, max: 52, step: 1 },
      ],
    },
  ] as BasesAllOptions[];
}
