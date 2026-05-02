export function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

export function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function formatNumber(n: number, decimals = 1): string {
  if (Math.abs(n) >= 1_000_000) return `${round(n / 1_000_000, 1)}M`;
  if (Math.abs(n) >= 1_000) return `${round(n / 1_000, 1)}K`;
  return round(n, decimals).toString();
}

export function formatPercent(rate: number, decimals = 0): string {
  return `${round(rate * 100, decimals)}%`;
}
