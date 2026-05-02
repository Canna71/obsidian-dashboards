import type { NormalizedValue, FieldDescriptor } from "./types";

export function isNumericValue(v: NormalizedValue): v is { kind: "number"; value: number } {
  return v.kind === "number";
}

export function isDateValue(v: NormalizedValue): v is { kind: "date"; value: Date; iso: string } {
  return v.kind === "date";
}

export function isStringValue(v: NormalizedValue): v is { kind: "string"; value: string } {
  return v.kind === "string";
}

export function isBooleanValue(v: NormalizedValue): v is { kind: "boolean"; value: boolean } {
  return v.kind === "boolean";
}

export function isNullValue(v: NormalizedValue): v is { kind: "null" } {
  return v.kind === "null";
}

export function isListValue(v: NormalizedValue): v is { kind: "list"; values: NormalizedValue[] } {
  return v.kind === "list";
}

export function getNumericFields(fields: FieldDescriptor[]): FieldDescriptor[] {
  return fields.filter((f) => f.kind === "number");
}

export function getDateFields(fields: FieldDescriptor[]): FieldDescriptor[] {
  return fields.filter((f) => f.kind === "date");
}

export function getCategoricalFields(fields: FieldDescriptor[]): FieldDescriptor[] {
  return fields.filter((f) => f.kind === "string" || f.kind === "boolean");
}

export function toBooleanSuccess(v: NormalizedValue, rule: string, target: number): boolean {
  if (v.kind === "boolean") return v.value;
  if (v.kind === "number") {
    if (rule === "gt-zero") return v.value > 0;
    if (rule === "gte-target") return v.value >= target;
    return v.value > 0;
  }
  if (v.kind === "string") return v.value !== "" && v.value !== "false" && v.value !== "0";
  if (v.kind === "list") return v.values.length > 0;
  return false;
}

export function coerceToNumber(v: NormalizedValue): number | null {
  if (v.kind === "number") return v.value;
  if (v.kind === "boolean") return v.value ? 1 : 0;
  if (v.kind === "string") {
    const n = parseFloat(v.value);
    return isFinite(n) ? n : null;
  }
  return null;
}
