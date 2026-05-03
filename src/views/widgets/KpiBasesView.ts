import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import type { KpiViewConfig } from "../../utils/types";
import { DEFAULT_KPI_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { formatNumber } from "../../utils/numbers";
import { VIEW_TYPE_KPI } from "../../bases/viewTypes";

export class KpiBasesView extends BasesView {
  readonly type = VIEW_TYPE_KPI;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void { this.render(); }

  private readConfig(): KpiViewConfig {
    return {
      metricField: this.config.getAsPropertyId("metricField") ?? null,
    };
  }

  private render() {
    if (!this.data) return;
    const cfg = this.readConfig();
    const { records } = recordsFromResult(
      this.data, this.allProperties,
      (id) => this.config.getDisplayName(id),
      [cfg.metricField],
    );

    this.containerEl.empty();
    this.containerEl.addClass("odash-dashboard-view");

    if (records.length === 0) {
      const el = this.containerEl.createDiv("odash-empty-state");
      el.createDiv({ cls: "odash-empty-icon", text: "📊" });
      el.createEl("h3", { cls: "odash-empty-title", text: "No records" });
      return;
    }

    const bar = this.containerEl.createDiv("odash-kpi-bar");
    kpi(bar, "📝", "Records", String(records.length));

    if (cfg.metricField) {
      const nums = records
        .map((r) => r.properties[cfg.metricField!])
        .filter((v) => v?.kind === "number")
        .map((v) => (v as { kind: "number"; value: number }).value);
      if (nums.length > 0) {
        const fieldName = this.config.getDisplayName(cfg.metricField);
        const total = nums.reduce((a, b) => a + b, 0);
        kpi(bar, "∑", `Total ${fieldName}`, formatNumber(total));
        kpi(bar, "⌀", `Avg ${fieldName}`, formatNumber(total / nums.length));
        kpi(bar, "↑", `Max ${fieldName}`, formatNumber(Math.max(...nums)));
        kpi(bar, "↓", `Min ${fieldName}`, formatNumber(Math.min(...nums)));
      }
    }
  }
}

function kpi(parent: HTMLElement, icon: string, label: string, value: string) {
  const tile = parent.createDiv("odash-kpi-tile");
  tile.createEl("span", { cls: "odash-kpi-icon", text: icon });
  tile.createEl("span", { cls: "odash-kpi-value", text: value });
  tile.createEl("span", { cls: "odash-kpi-label", text: label });
}

export function kpiViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
  return [{
    type: "group", displayName: "Metric",
    items: [{ key: "metricField", type: "property", displayName: "Metric field (optional)" }],
  }] as BasesAllOptions[];
}
