import { Plugin, Notice } from "obsidian";
import { registerAllViews } from "./bases/registerViews";

export default class DashboardsPlugin extends Plugin {
  async onload() {
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
