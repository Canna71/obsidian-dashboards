import type { BaseRecord } from "../utils/types";

export function getDateRange(
  records: BaseRecord[],
  dateField: string,
): { start: Date; end: Date } | null {
  const dates: Date[] = [];
  for (const r of records) {
    const v = r.properties[dateField];
    if (v?.kind === "date") dates.push(v.value);
  }
  if (dates.length === 0) return null;
  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

export function recordsByDateKey(
  records: BaseRecord[],
  dateField: string,
): Map<string, BaseRecord[]> {
  const map = new Map<string, BaseRecord[]>();
  for (const r of records) {
    const v = r.properties[dateField];
    if (v?.kind === "date") {
      const key = v.iso;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
  }
  return map;
}
