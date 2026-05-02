import type { HabitDayStatus, StreakInfo } from "../utils/types";

export function calculateStreaks(days: HabitDayStatus[]): StreakInfo {
  // Sort by date ascending
  const sorted = [...days].sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  let current = 0;
  let longest = 0;
  let tempStreak = 0;
  let lastSuccessDate: string | null = null;

  const today = new Date();
  const todayKey = toKey(today);
  const yesterdayKey = toKey(new Date(today.getTime() - 86400000));

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i]!;
    if (!day.isTracked) continue;

    if (day.isSuccess) {
      tempStreak++;
      if (tempStreak > longest) longest = tempStreak;
      lastSuccessDate = day.dateKey;
    } else {
      tempStreak = 0;
    }
  }

  // Current streak: count backwards from today/yesterday
  current = 0;
  const byKey = new Map(sorted.map((d) => [d.dateKey, d]));

  let checkKey = todayKey;
  // If today has no entry yet, start from yesterday
  const todayEntry = byKey.get(todayKey);
  if (!todayEntry || !todayEntry.isSuccess) {
    checkKey = yesterdayKey;
  }

  while (true) {
    const entry = byKey.get(checkKey);
    if (!entry || !entry.isTracked || !entry.isSuccess) break;
    current++;
    // Go one day back
    const d = new Date(checkKey + "T00:00:00");
    d.setDate(d.getDate() - 1);
    checkKey = toKey(d);
  }

  return { current, longest, lastSuccessDate };
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getConsistencyScore(days: HabitDayStatus[]): number {
  const tracked = days.filter((d) => d.isTracked);
  if (tracked.length === 0) return 0;
  const successes = tracked.filter((d) => d.isSuccess).length;
  return successes / tracked.length;
}

export function getRollingAverage(
  days: HabitDayStatus[],
  window: number,
): number {
  const sorted = [...days]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-window);
  const tracked = sorted.filter((d) => d.isTracked);
  if (tracked.length === 0) return 0;
  return tracked.filter((d) => d.isSuccess).length / tracked.length;
}
