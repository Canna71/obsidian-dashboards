import { Plugin, Notice, addIcon } from "obsidian";
import { registerAllViews } from "./bases/registerViews";

// ─── Custom icons ─────────────────────────────────────────────────────────────

// 4×3 grid, two square sizes to signal intensity:
//   Large  (22×22, rx=3, op=1.0) → high activity  (fills its slot)
//   Medium (14×14, rx=2, op=0.45) → low activity  (centred in slot with 4px inset)
// Slots are 22×22 with 4px gap, stride=26.
// Cols x: 0, 26, 52, 78  |  Rows y: 13, 39, 65  (vertically centred)
//
// Grid (L=large, M=medium):
//   L  L  M  M
//   L  L  L  M
//   M  L  L  L
const HEATMAP_ICON_SVG = `
  <rect x="0"  y="13" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="26" y="13" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="56" y="17" width="14" height="14" rx="2" fill="currentColor" fill-opacity="0.45"/>
  <rect x="82" y="17" width="14" height="14" rx="2" fill="currentColor" fill-opacity="0.45"/>

  <rect x="0"  y="39" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="26" y="39" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="52" y="39" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="82" y="43" width="14" height="14" rx="2" fill="currentColor" fill-opacity="0.45"/>

  <rect x="4"  y="69" width="14" height="14" rx="2" fill="currentColor" fill-opacity="0.45"/>
  <rect x="26" y="65" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="52" y="65" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
  <rect x="78" y="65" width="22" height="22" rx="3" fill="currentColor" fill-opacity="1"/>
`;

export default class DashboardsPlugin extends Plugin {
  async onload() {
    addIcon("odash-heatmap", HEATMAP_ICON_SVG);

    const registered = this.registerViews();

    if (!registered) {
      new Notice(
        "Dashboards: Bases is not enabled in this vault. " +
        "Enable Bases in the core plugins settings to use chart, calendar, and habit views.",
        8000,
      );
    }

    this.addCommand({
      id: "open-dashboard-help",
      name: "Open Dashboards help",
      callback: () => {
        new Notice(
          "Dashboards adds Chart, Calendar, Habit tracker, and Dashboard views to any Base. " +
          "Open a .base file and click the view selector to switch to a custom view.",
          6000,
        );
      },
    });
  }

  private registerViews(): boolean {
    try {
      registerAllViews(this);
      return true;
    } catch (e) {
      // registerBasesView returns false if Bases is not enabled
      console.warn("Dashboards: could not register Bases views", e);
      return false;
    }
  }

  onunload() {
    // BasesView instances handle their own cleanup via onunload()
  }
}
