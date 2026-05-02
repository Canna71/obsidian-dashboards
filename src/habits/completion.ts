import type {
  BaseRecord,
  HabitDayStatus,
  HabitViewConfig,
  HabitMetricSummary,
  NormalizedValue,
} from "../utils/types";
import { toBooleanSuccess, coerceToNumber } from "../utils/validation";
import { toDateKey, startOfWeek, addDays } from "../utils/dates";
import { calculateStreaks, getRollingAverage, getConsistencyScore } from "./streaks";

function toStatusDays(
  records: BaseRecord[],
  config: HabitViewConfig,
): HabitDayStatus[] {
  const dateField = config.dateField;
  const habitField = config.habitField;
  if (!dateField || !habitField) return [];

  return records
    .filter((r) => {
      const dv = r.properties[dateField];
      return dv?.kind === "date";
    })
    .map((r) => {
      const dv = r.properties[dateField]!;
      const hv: NormalizedValue = r.properties[habitField] ?? { kind: "null" };
      const date = (dv as { kind: "date"; value: Date; iso: string }).value;
      const dateKey = (dv as { kind: "date"; value: Date; iso: string }).iso;
      const isSuccess = hv.kind !== "null" && toBooleanSuccess(hv, config.successRule, config.targetValue);
      const numVal = coerceToNumber(hv);

      return {
        date,
        dateKey,
        value: hv.kind === "number" ? hv : (numVal !== null ? { kind: "number", value: numVal } : hv),
        isSuccess,
        isTracked: hv.kind !== "null",
      } as HabitDayStatus;
    });
}

export function buildHabitStatusDays(
  records: BaseRecord[],
  config: HabitViewConfig,
): HabitDayStatus[] {
  return toStatusDays(records, config);
}

export function buildHabitMetrics(
  records: BaseRecord[],
  config: HabitViewConfig,
): HabitMetricSummary {
  const days = toStatusDays(records, config);
  const tracked = days.filter((d) => d.isTracked);
  const successes = tracked.filter((d) => d.isSuccess);

  const streak = calculateStreaks(days);
  const rollingAvg7 = getRollingAverage(days, 7);
  const rollingAvg30 = getRollingAverage(days, 30);

  // Weekly rates
  const weeklyRates = buildPeriodRates(days, "week");
  const monthlyRates = buildPeriodRates(days, "month");

  return {
    totalDays: tracked.length,
    successDays: successes.length,
    completionRate: tracked.length > 0 ? successes.length / tracked.length : 0,
    streak,
    weeklyRates,
    monthlyRates,
    rollingAvg7,
    rollingAvg30,
  };
}

function buildPeriodRates(
  days: HabitDayStatus[],
  period: "week" | "month",
): { label: string; rate: number }[] {
  const grouped = new Map<string, HabitDayStatus[]>();

  for (const d of days) {
    let key: string;
    if (period === "week") {
      const monday = startOfWeek(d.date, 1);
      key = toDateKey(monday);
    } else {
      key = d.dateKey.slice(0, 7); // YYYY-MM
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, ds]) => {
      const tracked = ds.filter((d) => d.isTracked);
      const rate = tracked.length > 0 ? tracked.filter((d) => d.isSuccess).length / tracked.length : 0;
      return { label, rate };
    });
}
