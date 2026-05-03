import type { Plugin } from "obsidian";
import { ChartBasesView, chartViewOptions } from "../views/charts/ChartBasesView";
import { CalendarBasesView, calendarViewOptions } from "../views/calendar/CalendarBasesView";
import { HeatmapBasesView, heatmapViewOptions } from "../views/heatmap/HeatmapBasesView";
import { KpiBasesView, kpiViewOptions } from "../views/widgets/KpiBasesView";
import { RankingBasesView, rankingViewOptions } from "../views/widgets/RankingBasesView";
import { SparklineBasesView, sparklineViewOptions } from "../views/widgets/SparklineBasesView";
import { RecentBasesView, recentViewOptions } from "../views/widgets/RecentBasesView";
import { StreakBasesView, streakViewOptions } from "../views/widgets/StreakBasesView";
import { WeekBarsBasesView, weekBarsViewOptions } from "../views/widgets/WeekBarsBasesView";
import {
  VIEW_TYPE_CHART,
  VIEW_TYPE_CALENDAR,
  VIEW_TYPE_HEATMAP,
  VIEW_TYPE_KPI,
  VIEW_TYPE_RANKING,
  VIEW_TYPE_SPARKLINE,
  VIEW_TYPE_RECENT,
  VIEW_TYPE_STREAK,
  VIEW_TYPE_WEEK_BARS,
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

  // KPI cards widget
  plugin.registerBasesView(VIEW_TYPE_KPI, {
    name: "KPI cards",
    icon: "hash",
    factory: (controller, containerEl) => {
      const view = new KpiBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => kpiViewOptions(config),
  });

  // Ranking widget
  plugin.registerBasesView(VIEW_TYPE_RANKING, {
    name: "Ranking",
    icon: "list",
    factory: (controller, containerEl) => {
      const view = new RankingBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => rankingViewOptions(config),
  });

  // Sparkline widget
  plugin.registerBasesView(VIEW_TYPE_SPARKLINE, {
    name: "Sparkline",
    icon: "trending-up",
    factory: (controller, containerEl) => {
      const view = new SparklineBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => sparklineViewOptions(config),
  });

  // Recent records widget
  plugin.registerBasesView(VIEW_TYPE_RECENT, {
    name: "Recent",
    icon: "clock",
    factory: (controller, containerEl) => {
      const view = new RecentBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => recentViewOptions(config),
  });

  // Streak widget
  plugin.registerBasesView(VIEW_TYPE_STREAK, {
    name: "Streak",
    icon: "zap",
    factory: (controller, containerEl) => {
      const view = new StreakBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => streakViewOptions(config),
  });

  // Week bars widget
  plugin.registerBasesView(VIEW_TYPE_WEEK_BARS, {
    name: "Week bars",
    icon: "bar-chart",
    factory: (controller, containerEl) => {
      const view = new WeekBarsBasesView(controller, containerEl);
      view.load();
      return view;
    },
    options: (config) => weekBarsViewOptions(config),
  });
}
