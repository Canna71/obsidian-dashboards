import { BasesView, type QueryController, type BasesViewConfig, type BasesAllOptions } from "obsidian";
import type { RecentViewConfig } from "../../utils/types";
import { DEFAULT_RECENT_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import { getDateFields } from "../../data/schemaInference";
import { VIEW_TYPE_RECENT } from "../../bases/viewTypes";

export class RecentBasesView extends BasesView {
  readonly type = VIEW_TYPE_RECENT;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void { this.render(); }

  private readConfig(): RecentViewConfig {
    return {
      dateField: this.config.getAsPropertyId("dateField") ?? null,
      topN: (this.config.get("topN") as number) ?? DEFAULT_RECENT_CONFIG.topN,
    };
  }

  private render() {
    if (!this.data) return;
    const cfg = this.readConfig();
    const { records, schema } = recordsFromResult(
      this.data, this.allProperties,
      (id) => this.config.getDisplayName(id),
      [cfg.dateField],
    );

    this.containerEl.empty();
    this.containerEl.addClass("odash-dashboard-view");

    if (records.length === 0) {
      const el = this.containerEl.createDiv("odash-empty-state");
      el.createDiv({ cls: "odash-empty-icon", text: "📋" });
      el.createEl("h3", { cls: "odash-empty-title", text: "No records" });
      return;
    }

    // Pick date field: explicit config first, then first date field in schema
    const dateField = cfg.dateField ?? getDateFields(schema)[0]?.id ?? null;

    const sorted = [...records].sort((a, b) => {
      if (!dateField) return 0;
      const av = a.properties[dateField];
      const bv = b.properties[dateField];
      if (av?.kind === "date" && bv?.kind === "date") return bv.value.getTime() - av.value.getTime();
      return 0;
    }).slice(0, cfg.topN);

    const list = this.containerEl.createDiv("odash-recent-list");
    for (const r of sorted) {
      const row = list.createDiv("odash-recent-row");
      const link = row.createEl("a", { cls: "odash-recent-link", text: r.title });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.app.workspace.openLinkText(r.file.path, "", false);
      });
      if (dateField) {
        const dv = r.properties[dateField];
        if (dv?.kind === "date") {
          row.createEl("span", { cls: "odash-recent-date", text: dv.iso });
        }
      }
    }
  }
}

export function recentViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
  return [{
    type: "group", displayName: "Display",
    items: [
      { key: "dateField", type: "property", displayName: "Date field (for sorting)" },
      { key: "topN", type: "slider", displayName: "Records to show", default: 10, min: 3, max: 25, step: 1 },
    ],
  }] as BasesAllOptions[];
}
