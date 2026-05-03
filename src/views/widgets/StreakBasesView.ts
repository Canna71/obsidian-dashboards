import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import type { StreakViewConfig, HabitViewConfig } from "../../utils/types";
import { DEFAULT_STREAK_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { buildHabitMetrics } from "../../habits/completion";
import { formatPercent } from "../../utils/numbers";
import { VIEW_TYPE_STREAK } from "../../bases/viewTypes";

export class StreakBasesView extends BasesView {
  readonly type = VIEW_TYPE_STREAK;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void { this.render(); }

  private readConfig(): StreakViewConfig {
    const cfg = this.config;
    return {
      dateField: cfg.getAsPropertyId("dateField") ?? null,
      habitField: cfg.getAsPropertyId("habitField") ?? null,
      successRule: (cfg.get("successRule") as StreakViewConfig["successRule"]) ?? DEFAULT_STREAK_CONFIG.successRule,
      targetValue: (cfg.get("targetValue") as number) ?? DEFAULT_STREAK_CONFIG.targetValue,
    };
  }

  private render() {
    if (!this.data) return;
    const cfg = this.readConfig();
    if (!cfg.dateField || !cfg.habitField) {
      renderEmpty(this.containerEl, "odash-habit-view", "✅", "Configure habit fields", "Set the date field and habit field in view options.");
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

    // Build a HabitViewConfig adapter so we can reuse the completion helpers
    const habitCfg: HabitViewConfig = {
      modelType: "daily-note",
      dateField: cfg.dateField,
      habitField: cfg.habitField,
      habitNameField: null,
      successRule: cfg.successRule,
      targetValue: cfg.targetValue,
      summaryPeriod: "month",
      showStreak: true,
      showHeatmap: false,
    };

    const metrics = buildHabitMetrics(records, habitCfg);

    this.containerEl.empty();
    this.containerEl.addClass("odash-habit-view");

    const bar = this.containerEl.createDiv("odash-kpi-bar");
    kpi(bar, "🔥", "Current streak", `${metrics.streak.current}d`);
    kpi(bar, "🏆", "Longest streak", `${metrics.streak.longest}d`);
    kpi(bar, "✅", "Completion", formatPercent(metrics.completionRate));
    kpi(bar, "📅", "7-day avg", formatPercent(metrics.rollingAvg7));
    kpi(bar, "📈", "30-day avg", formatPercent(metrics.rollingAvg30));
  }
}

function kpi(parent: HTMLElement, icon: string, label: string, value: string) {
  const tile = parent.createDiv("odash-kpi-tile");
  tile.createEl("span", { cls: "odash-kpi-icon", text: icon });
  tile.createEl("span", { cls: "odash-kpi-value", text: value });
  tile.createEl("span", { cls: "odash-kpi-label", text: label });
}

function renderEmpty(containerEl: HTMLElement, cls: string, icon: string, title: string, body: string) {
  containerEl.empty();
  containerEl.addClass(cls);
  const el = containerEl.createDiv("odash-empty-state");
  el.createDiv({ cls: "odash-empty-icon", text: icon });
  el.createEl("h3", { cls: "odash-empty-title", text: title });
  el.createEl("p", { cls: "odash-empty-body", text: body });
}

export function streakViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
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
  ] as BasesAllOptions[];
}
