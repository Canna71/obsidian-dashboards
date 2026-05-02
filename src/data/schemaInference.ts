import type { NormalizedValue, FieldKind, FieldDescriptor } from "../utils/types";
import type { BasesPropertyId } from "obsidian";

export function inferFieldKind(values: NormalizedValue[]): FieldKind {
  const nonNull = values.filter((v) => v.kind !== "null" && v.kind !== "error");
  if (nonNull.length === 0) return "unknown";

  const kinds = new Set(nonNull.map((v) => v.kind));

  if (kinds.has("date")) return "date";
  if (kinds.has("number")) return "number";
  if (kinds.has("boolean")) return "boolean";
  if (kinds.has("list")) return "list";
  if (kinds.has("string")) {
    // Heuristic: if all strings are short, treat as categorical
    return "string";
  }
  return "unknown";
}

export function getNumericFields(schema: FieldDescriptor[]): FieldDescriptor[] {
  return schema.filter((f) => f.kind === "number");
}

export function getDateFields(schema: FieldDescriptor[]): FieldDescriptor[] {
  return schema.filter((f) => f.kind === "date");
}

export function getCategoricalFields(schema: FieldDescriptor[]): FieldDescriptor[] {
  return schema.filter((f) => f.kind === "string" || f.kind === "boolean");
}

export function getBestDateField(
  schema: FieldDescriptor[],
  allProps: BasesPropertyId[],
): BasesPropertyId | null {
  const dateField = schema.find((f) => f.kind === "date");
  if (dateField) return dateField.id;

  // Try common date property names
  const candidates = ["date", "created", "updated", "due", "deadline", "start"];
  for (const name of candidates) {
    const found = allProps.find(
      (p) => p.toLowerCase().includes(name),
    );
    if (found) return found;
  }
  return null;
}

export function getBestNumericField(
  schema: FieldDescriptor[],
): BasesPropertyId | null {
  const f = schema.find((f) => f.kind === "number");
  return f ? f.id : null;
}
