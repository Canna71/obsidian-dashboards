import type { TFile } from "obsidian";
import type { BasesPropertyId } from "obsidian";

// ─── Normalized value types ──────────────────────────────────────────────────

export type NormalizedValue =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "date"; value: Date; iso: string }
  | { kind: "list"; values: NormalizedValue[] }
  | { kind: "null" }
  | { kind: "error"; message: string };

// ─── Internal record model ───────────────────────────────────────────────────

export interface BaseRecord {
  file: TFile;
  path: string;
  title: string;
  /** keyed by BasesPropertyId string */
  properties: Record<string, NormalizedValue>;
}

// ─── Schema inference ────────────────────────────────────────────────────────

export type FieldKind = "number" | "string" | "boolean" | "date" | "list" | "unknown";

export interface FieldDescriptor {
  id: BasesPropertyId;
  displayName: string;
  kind: FieldKind;
}

// ─── Aggregations ────────────────────────────────────────────────────────────

export type AggregationMethod = "count" | "sum" | "avg" | "min" | "max" | "distinct";

export interface AggregatedPoint {
  label: string;
  value: number;
  count: number;
  raw?: NormalizedValue[];
}

export interface AggregatedSeries {
  name: string;
  points: AggregatedPoint[];
}

// ─── Date bucketing ──────────────────────────────────────────────────────────

export type DateBucket = "day" | "week" | "month" | "quarter" | "year" | "none";

// ─── Chart view config ───────────────────────────────────────────────────────

export type ChartType =
  | "line"
  | "bar"
  | "stacked-bar"
  | "area"
  | "pie"
  | "donut"
  | "scatter";

export interface ChartViewConfig {
  chartType: ChartType;
  xField: BasesPropertyId | null;
  yField: BasesPropertyId | null;
  seriesField: BasesPropertyId | null;
  aggregation: AggregationMethod;
  dateBucket: DateBucket;
  showLegend: boolean;
  cumulative: boolean;
  colorScheme: string;
  showLabels: boolean;
  nullHandling: "skip" | "zero" | "interpolate";
}

export const DEFAULT_CHART_CONFIG: ChartViewConfig = {
  chartType: "bar",
  xField: null,
  yField: null,
  seriesField: null,
  aggregation: "count",
  dateBucket: "none",
  showLegend: true,
  cumulative: false,
  colorScheme: "default",
  showLabels: false,
  nullHandling: "skip",
};

// ─── Calendar view config ────────────────────────────────────────────────────

export type CalendarMode = "month" | "week" | "agenda";

export interface CalendarViewConfig {
  primaryDateField: BasesPropertyId | null;
  endDateField: BasesPropertyId | null;
  colorField: BasesPropertyId | null;
  titleField: BasesPropertyId | null;
  calendarMode: CalendarMode;
  showWeekends: boolean;
  firstDayOfWeek: number; // 0=Sunday, 1=Monday
}

export const DEFAULT_CALENDAR_CONFIG: CalendarViewConfig = {
  primaryDateField: null,
  endDateField: null,
  colorField: null,
  titleField: null,
  calendarMode: "month",
  showWeekends: true,
  firstDayOfWeek: 1,
};

// ─── Calendar internal model ─────────────────────────────────────────────────

export interface CalendarEvent {
  record: BaseRecord;
  title: string;
  start: Date;
  end: Date | null;
  color: string | null;
  isAllDay: boolean;
}

// ─── Habit view config ───────────────────────────────────────────────────────

export type HabitModelType = "daily-note" | "event-log";
export type HabitValueType = "boolean" | "number";
export type HabitSummaryPeriod = "week" | "month" | "quarter" | "year";

export interface HabitViewConfig {
  modelType: HabitModelType;
  dateField: BasesPropertyId | null;
  habitField: BasesPropertyId | null;
  habitNameField: BasesPropertyId | null;
  targetValue: number;
  successRule: "any" | "gte-target" | "gt-zero";
  summaryPeriod: HabitSummaryPeriod;
  showStreak: boolean;
  showHeatmap: boolean;
}

export const DEFAULT_HABIT_CONFIG: HabitViewConfig = {
  modelType: "daily-note",
  dateField: null,
  habitField: null,
  habitNameField: null,
  targetValue: 1,
  successRule: "any",
  summaryPeriod: "month",
  showStreak: true,
  showHeatmap: true,
};

// ─── Habit analytics types ───────────────────────────────────────────────────

export interface HabitDayStatus {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  value: NormalizedValue;
  isSuccess: boolean;
  isTracked: boolean;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastSuccessDate: string | null;
}

export interface HabitMetricSummary {
  totalDays: number;
  successDays: number;
  completionRate: number;
  streak: StreakInfo;
  weeklyRates: { label: string; rate: number }[];
  monthlyRates: { label: string; rate: number }[];
  rollingAvg7: number;
  rollingAvg30: number;
}

// ─── Heatmap types ───────────────────────────────────────────────────────────

export interface HeatmapCell {
  dateKey: string;
  date: Date;
  value: number;
  isSuccess: boolean;
  isTracked: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface HeatmapWeek {
  cells: (HeatmapCell | null)[];
}

export interface HeatmapMonth {
  label: string; // "Jan 2025"
  monthKey: string; // "2025-01"
  weeks: HeatmapWeek[];
}

// ─── Heatmap view config ─────────────────────────────────────────────────────

export type HeatmapColorScheme = "green" | "blue" | "purple" | "orange" | "red";

export interface HeatmapViewConfig {
  dateField: BasesPropertyId | null;
  valueField: BasesPropertyId | null; // null → count records per day
  aggregation: "count" | "sum" | "avg";
  monthsBack: number;
  colorScheme: HeatmapColorScheme;
  showStats: boolean;
  firstDayOfWeek: number; // 0=Sunday, 1=Monday
  minValue: number | null; // null → auto (0)
  maxValue: number | null; // null → auto (data max)
}

export const DEFAULT_HEATMAP_CONFIG: HeatmapViewConfig = {
  dateField: null,
  valueField: null,
  aggregation: "count",
  monthsBack: 6,
  colorScheme: "green",
  showStats: true,
  firstDayOfWeek: 1,
  minValue: null,
  maxValue: null,
};

// ─── Dashboard config ────────────────────────────────────────────────────────

export interface DashboardViewConfig {
  showKpi: boolean;
  showSparkline: boolean;
  showStreak: boolean;
  showCalendar: boolean;
  dateWindow: number; // days
  topN: number;
  primaryMetric: BasesPropertyId | null;
  groupField: BasesPropertyId | null;
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardViewConfig = {
  showKpi: true,
  showSparkline: true,
  showStreak: true,
  showCalendar: true,
  dateWindow: 30,
  topN: 5,
  primaryMetric: null,
  groupField: null,
};
