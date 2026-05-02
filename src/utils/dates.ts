import type { DateBucket } from "./types";

// ─── Parsing ─────────────────────────────────────────────────────────────────

export function parseISODate(iso: string): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfWeek(date: Date, firstDay = 1): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day - firstDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

// ─── Bucketing ───────────────────────────────────────────────────────────────

export function bucketDate(date: Date, bucket: DateBucket): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  switch (bucket) {
    case "day":
      return toDateKey(date);
    case "week": {
      const monday = startOfWeek(date, 1);
      return `Week of ${toDateKey(monday)}`;
    }
    case "month":
      return `${y}-${String(m + 1).padStart(2, "0")}`;
    case "quarter":
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case "year":
      return `${y}`;
    case "none":
      return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
}

export function bucketSortKey(label: string): string {
  // Make week labels sortable
  if (label.startsWith("Week of ")) return label.slice(8);
  // Q labels: 2025-Q1 → sortable as-is
  return label;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatWeekdayShort(dayIndex: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[dayIndex] ?? "";
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isFuture(date: Date): boolean {
  return date > new Date();
}

// ─── Range generation ────────────────────────────────────────────────────────

export function daysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = startOfDay(new Date(start));
  const last = startOfDay(new Date(end));
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function weeksInMonth(year: number, month: number, firstDay = 1): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks: Date[][] = [];
  let cur = startOfWeek(first, firstDay);

  while (cur <= last || weeks.length === 0) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    weeks.push(week);
    if (cur > last) break;
  }
  return weeks;
}

// ─── Week number (ISO) ───────────────────────────────────────────────────────

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
