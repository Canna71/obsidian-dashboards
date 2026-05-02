import type {
  BaseRecord,
  AggregationMethod,
  AggregatedPoint,
  AggregatedSeries,
  NormalizedValue,
} from "../utils/types";
import { coerceToNumber } from "../utils/validation";
import { bucketDate, bucketSortKey } from "../utils/dates";
import type { DateBucket } from "../utils/types";

// ─── Single-series aggregation ────────────────────────────────────────────────

function aggregateGroup(
  records: BaseRecord[],
  yField: string | null,
  method: AggregationMethod,
): number {
  if (!yField || method === "count") return records.length;

  if (method === "distinct") {
    const vals = records.map((r) => r.properties[yField] ?? { kind: "null" });
    return new Set(vals.map((v) => JSON.stringify(v))).size;
  }

  const nums = records
    .map((r) => coerceToNumber(r.properties[yField] ?? { kind: "null" }))
    .filter((n): n is number => n !== null);

  if (nums.length === 0) return 0;

  switch (method) {
    case "sum":  return nums.reduce((a, b) => a + b, 0);
    case "avg":  return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":  return Math.min(...nums);
    case "max":  return Math.max(...nums);
    default:     return records.length;
  }
}

// ─── Group by categorical field ───────────────────────────────────────────────

function getLabelForValue(v: NormalizedValue): string {
  if (v.kind === "null") return "(empty)";
  if (v.kind === "boolean") return v.value ? "true" : "false";
  if (v.kind === "number") return String(v.value);
  if (v.kind === "string") return v.value;
  if (v.kind === "date") return v.iso;
  if (v.kind === "list") return v.values.map((x) => getLabelForValue(x)).join(", ");
  return "(unknown)";
}

// ─── Main aggregation pipeline ────────────────────────────────────────────────

export interface AggregateOptions {
  records: BaseRecord[];
  xField: string | null;
  yField: string | null;
  seriesField: string | null;
  aggregation: AggregationMethod;
  dateBucket: DateBucket;
  nullHandling: "skip" | "zero" | "interpolate";
}

export function buildAggregatedSeries(opts: AggregateOptions): AggregatedSeries[] {
  const { records, xField, yField, seriesField, aggregation, dateBucket, nullHandling } = opts;

  // ── Determine x labels ──────────────────────────────────────────────────────
  const xLabelFn = (r: BaseRecord): string => {
    if (!xField) return "(all)";
    const v = r.properties[xField] ?? { kind: "null" as const };
    if (v.kind === "date" && dateBucket !== "none") {
      return bucketDate(v.value, dateBucket);
    }
    return getLabelForValue(v);
  };

  // ── Split by series field ───────────────────────────────────────────────────
  const seriesMap = new Map<string, BaseRecord[]>();

  if (!seriesField) {
    seriesMap.set("value", records);
  } else {
    for (const r of records) {
      const sv = r.properties[seriesField] ?? { kind: "null" as const };
      const key = getLabelForValue(sv);
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      seriesMap.get(key)!.push(r);
    }
  }

  // ── Collect all x labels in sorted order ───────────────────────────────────
  const allXLabels = new Set<string>();
  for (const r of records) allXLabels.add(xLabelFn(r));
  const sortedLabels = Array.from(allXLabels).sort((a, b) =>
    bucketSortKey(a).localeCompare(bucketSortKey(b)),
  );

  // ── Build series ────────────────────────────────────────────────────────────
  const result: AggregatedSeries[] = [];

  for (const [seriesName, seriesRecords] of seriesMap) {
    // Group by x label
    const groups = new Map<string, BaseRecord[]>();
    for (const r of seriesRecords) {
      const label = xLabelFn(r);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(r);
    }

    const points: AggregatedPoint[] = sortedLabels.map((label) => {
      const group = groups.get(label) ?? [];
      if (group.length === 0 && nullHandling === "skip") {
        return { label, value: 0, count: 0, raw: [] };
      }
      const value = group.length === 0 ? 0 : aggregateGroup(group, yField, aggregation);
      return { label, value, count: group.length, raw: group.map((r) => r.properties[yField ?? ""] ?? { kind: "null" as const }) };
    });

    result.push({ name: seriesName, points });
  }

  return result;
}

// ─── Cumulative transform ─────────────────────────────────────────────────────

export function makeCumulative(series: AggregatedSeries[]): AggregatedSeries[] {
  return series.map((s) => {
    let acc = 0;
    return {
      ...s,
      points: s.points.map((p) => {
        acc += p.value;
        return { ...p, value: acc };
      }),
    };
  });
}
