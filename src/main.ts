import { Plugin, Notice, addIcon } from "obsidian";
import { registerAllViews } from "./bases/registerViews";

// ─── Custom icons ─────────────────────────────────────────────────────────────

// 5×4 grid of rounded squares with a diagonal intensity gradient —
// represents a heatmap / contribution graph. viewBox is 0 0 100 100.
const HEATMAP_ICON_SVG = `
  <rect x="3"  y="13" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.15"/>
  <rect x="22" y="13" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.35"/>
  <rect x="41" y="13" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.6"/>
  <rect x="60" y="13" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>
  <rect x="79" y="13" width="17" height="17" rx="2" fill="currentColor" fill-opacity="1"/>

  <rect x="3"  y="32" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.35"/>
  <rect x="22" y="32" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.6"/>
  <rect x="41" y="32" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>
  <rect x="60" y="32" width="17" height="17" rx="2" fill="currentColor" fill-opacity="1"/>
  <rect x="79" y="32" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>

  <rect x="3"  y="51" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.6"/>
  <rect x="22" y="51" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>
  <rect x="41" y="51" width="17" height="17" rx="2" fill="currentColor" fill-opacity="1"/>
  <rect x="60" y="51" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>
  <rect x="79" y="51" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.6"/>

  <rect x="3"  y="70" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>
  <rect x="22" y="70" width="17" height="17" rx="2" fill="currentColor" fill-opacity="1"/>
  <rect x="41" y="70" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.85"/>
  <rect x="60" y="70" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.6"/>
  <rect x="79" y="70" width="17" height="17" rx="2" fill="currentColor" fill-opacity="0.35"/>
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
