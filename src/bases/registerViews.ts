import type { Plugin } from "obsidian";
import { ChartBasesView, chartViewOptions } from "../views/charts/ChartBasesView";
import { CalendarBasesView, calendarViewOptions } from "../views/calendar/CalendarBasesView";
import { HabitBasesView, habitViewOptions } from "../views/habits/HabitBasesView";
import { DashboardBasesView, dashboardViewOptions } from "../views/dashboard/DashboardBasesView";
import { HeatmapBasesView, heatmapViewOptions } from "../views/heatmap/HeatmapBasesView";
import {
  VIEW_TYPE_CHART,
  VIEW_TYPE_CALENDAR,
  VIEW_TYPE_HABIT,
  VIEW_TYPE_DASHBOARD,
  VIEW_TYPE_HEATMAP,
} from "./viewTypes";

export function registerAllViews(plugin: Plugin): void {
  // Chart view
  plugin.registerBasesView(VIEW_TYPE_CHART, {
    name: "Chart",
    icon: "bar-chart-2",
    factory: (controller, containerEl) => {
      const view = new ChartBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => chartViewOptions(config),
  });

  // Calendar view
  plugin.registerBasesView(VIEW_TYPE_CALENDAR, {
    name: "Calendar",
    icon: "calendar",
    factory: (controller, containerEl) => {
      const view = new CalendarBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => calendarViewOptions(config),
  });

  // Habit tracker view
  plugin.registerBasesView(VIEW_TYPE_HABIT, {
    name: "Habit tracker",
    icon: "check-circle-2",
    factory: (controller, containerEl) => {
      const view = new HabitBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => habitViewOptions(config),
  });

  // Dashboard view
  plugin.registerBasesView(VIEW_TYPE_DASHBOARD, {
    name: "Dashboard",
    icon: "layout-dashboard",
    factory: (controller, containerEl) => {
      const view = new DashboardBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => dashboardViewOptions(config),
  });

  // Heatmap view
  plugin.registerBasesView(VIEW_TYPE_HEATMAP, {
    name: "Heatmap",
    icon: "odash-heatmap",
    factory: (controller, containerEl) => {
      const view = new HeatmapBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => heatmapViewOptions(config),
  });
}
