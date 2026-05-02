// Read CSS variables from the document for theme-aware colors

export function getCSSVar(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

export function isDarkMode(): boolean {
  return document.body.classList.contains("theme-dark");
}

// Base palette that maps to Obsidian's CSS variables where possible
export function getChartColors(n: number): string[] {
  const accent = getCSSVar("--color-accent") || "#7c3aed";
  const palette = [
    accent,
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#84cc16",
    "#ec4899",
  ];
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    result.push(palette[i % palette.length]!);
  }
  return result;
}

export function getChartColorAlpha(color: string, alpha: number): string {
  // Convert hex to rgba if needed
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export function getGridColor(): string {
  return getCSSVar("--color-base-30") || (isDarkMode() ? "#3f3f3f" : "#e0e0e0");
}

export function getTextColor(): string {
  return getCSSVar("--color-base-100") || (isDarkMode() ? "#dcddde" : "#1a1a1a");
}

export function getMutedTextColor(): string {
  return getCSSVar("--color-base-60") || (isDarkMode() ? "#888" : "#777");
}

export function getSurfaceColor(): string {
  return getCSSVar("--color-base-10") || (isDarkMode() ? "#1e1e1e" : "#f5f5f5");
}

// Heatmap color scale from "no activity" to "max activity"
export function getHeatmapColors(): string[] {
  if (isDarkMode()) {
    return [
      "var(--color-base-20, #2a2a2a)",
      "#1e3a5f",
      "#1d4ed8",
      "#2563eb",
      "#3b82f6",
    ];
  }
  return [
    "var(--color-base-20, #ebedf0)",
    "#c6e9b8",
    "#7bc96f",
    "#239a3b",
    "#196127",
  ];
}

export function getHeatmapColor(intensity: number, colors: string[]): string {
  if (intensity <= 0) return colors[0]!;
  const idx = Math.min(Math.ceil(intensity * (colors.length - 1)), colors.length - 1);
  return colors[idx]!;
}
