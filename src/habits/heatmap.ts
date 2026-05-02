import type {
  HabitDayStatus,
  HeatmapCell,
  HeatmapWeek,
  HeatmapMonth,
} from "../utils/types";
import {
  startOfWeek,
  addDays,
  toDateKey,
  isToday,
  isFuture,
  startOfMonth,
  endOfMonth,
} from "../utils/dates";
import { coerceToNumber } from "../utils/validation";

// Build a GitHub-style contribution heatmap for N months back
export function buildHeatmapMonths(
  days: HabitDayStatus[],
  monthsBack = 12,
  firstDay = 1,
): HeatmapMonth[] {
  const statusByKey = new Map<string, HabitDayStatus>();
  for (const d of days) statusByKey.set(d.dateKey, d);

  // Max value for intensity normalization
  const numericValues = days
    .map((d) => coerceToNumber(d.value))
    .filter((v): v is number => v !== null && v > 0);
  const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 1;

  const today = new Date();
  const months: HeatmapMonth[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

    months.push({
      label,
      monthKey,
      weeks: buildMonthWeeks(d.getFullYear(), d.getMonth(), statusByKey, maxVal, firstDay),
    });
  }

  return months;
}

function buildMonthWeeks(
  year: number,
  month: number,
  statusByKey: Map<string, HabitDayStatus>,
  maxVal: number,
  firstDay: number,
): HeatmapWeek[] {
  const first = startOfMonth(new Date(year, month, 1));
  const last = endOfMonth(first);

  const weeks: HeatmapWeek[] = [];
  let cur = startOfWeek(first, firstDay);

  while (cur <= last) {
    const cells: (HeatmapCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const dateKey = toDateKey(cur);
      const inMonth = cur.getMonth() === month;
      if (!inMonth) {
        cells.push(null);
      } else {
        const status = statusByKey.get(dateKey);
        const numVal = status ? coerceToNumber(status.value) : null;
        const rawVal = numVal !== null ? numVal : (status?.isSuccess ? 1 : 0);
        const intensity = maxVal > 0 ? rawVal / maxVal : 0;

        cells.push({
          dateKey,
          date: new Date(cur),
          value: rawVal,
          isSuccess: status?.isSuccess ?? false,
          isTracked: status?.isTracked ?? false,
          isToday: isToday(cur),
          isFuture: isFuture(cur),
        });
      }
      cur = addDays(cur, 1);
    }
    weeks.push({ cells });
    if (cur > last) break;
  }

  return weeks;
}

// Build a compact single-month heatmap (for calendar-style view)
export function buildMonthHeatmap(
  year: number,
  month: number,
  days: HabitDayStatus[],
  firstDay = 1,
): HeatmapMonth {
  const statusByKey = new Map<string, HabitDayStatus>();
  for (const d of days) statusByKey.set(d.dateKey, d);

  const numericValues = days
    .map((d) => coerceToNumber(d.value))
    .filter((v): v is number => v !== null && v > 0);
  const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 1;

  const date = new Date(year, month, 1);
  const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  return {
    label,
    monthKey,
    weeks: buildMonthWeeks(year, month, statusByKey, maxVal, firstDay),
  };
}
