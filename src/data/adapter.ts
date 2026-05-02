import type {
  BasesEntry,
  BasesQueryResult,
  BasesPropertyId,
  Value,
} from "obsidian";
import {
  BooleanValue,
  NumberValue,
  StringValue,
  DateValue,
  ListValue,
  NullValue,
} from "obsidian";
import type { BaseRecord, FieldDescriptor, NormalizedValue } from "../utils/types";
import { parseISODate } from "../utils/dates";
import { inferFieldKind } from "./schemaInference";

// ─── Value normalization ──────────────────────────────────────────────────────

export function normalizeValue(val: Value | null): NormalizedValue {
  if (val === null || val === undefined) return { kind: "null" };
  if (val instanceof NullValue) return { kind: "null" };

  if (val instanceof BooleanValue) {
    // PrimitiveValue stores .value; fall back to isTruthy()
    const v = (val as unknown as { value: boolean }).value ?? val.isTruthy();
    return { kind: "boolean", value: v };
  }

  if (val instanceof NumberValue) {
    const raw = (val as unknown as { value: number }).value;
    const v = typeof raw === "number" && isFinite(raw) ? raw : parseFloat(val.toString());
    return isFinite(v) ? { kind: "number", value: v } : { kind: "null" };
  }

  if (val instanceof DateValue) {
    const iso = val.dateOnly().toString();
    const date = parseISODate(iso);
    if (!date) return { kind: "null" };
    return { kind: "date", value: date, iso };
  }

  if (val instanceof ListValue) {
    const items: NormalizedValue[] = [];
    for (let i = 0; i < val.length(); i++) {
      items.push(normalizeValue(val.get(i)));
    }
    return { kind: "list", values: items };
  }

  if (val instanceof StringValue) {
    const raw = (val as unknown as { value: string }).value ?? val.toString();
    return { kind: "string", value: raw };
  }

  // fallback – unknown value type, stringify it
  try {
    const s = val.toString();
    return { kind: "string", value: s };
  } catch {
    return { kind: "error", message: "Failed to normalize value" };
  }
}

// ─── Record extraction ────────────────────────────────────────────────────────

export function entryToRecord(
  entry: BasesEntry,
  allProperties: BasesPropertyId[],
): BaseRecord {
  const properties: Record<string, NormalizedValue> = {};

  for (const propId of allProperties) {
    properties[propId] = normalizeValue(entry.getValue(propId));
  }

  // always include the file-level name property
  const nameId = "file.name" as BasesPropertyId;
  if (!(nameId in properties)) {
    properties[nameId] = normalizeValue(entry.getValue(nameId));
  }

  return {
    file: entry.file,
    path: entry.file.path,
    title: entry.file.basename,
    properties,
  };
}

export function recordsFromResult(
  result: BasesQueryResult,
  allProperties: BasesPropertyId[],
  getDisplayName: (id: BasesPropertyId) => string,
): { records: BaseRecord[]; schema: FieldDescriptor[] } {
  const records = result.data.map((e) => entryToRecord(e, allProperties));

  const schema: FieldDescriptor[] = allProperties.map((id) => {
    const values = records.map((r) => r.properties[id] ?? { kind: "null" as const });
    return {
      id,
      displayName: getDisplayName(id),
      kind: inferFieldKind(values),
    };
  });

  return { records, schema };
}
