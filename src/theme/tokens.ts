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
  return getHeatmapColorsByScheme("green");
}

export function getHeatmapColorsByScheme(scheme: string): string[] {
  const empty = isDarkMode()
    ? "var(--color-base-20, #2a2a2a)"
    : "var(--color-base-20, #ebedf0)";

  if (isDarkMode()) {
    switch (scheme) {
      case "blue":   return [empty, "#1e3a5f", "#1d4ed8", "#2563eb", "#3b82f6"];
      case "purple": return [empty, "#3b0764", "#7e22ce", "#9333ea", "#a855f7"];
      case "orange": return [empty, "#7c2d12", "#c2410c", "#ea580c", "#f97316"];
      case "red":    return [empty, "#7f1d1d", "#b91c1c", "#dc2626", "#ef4444"];
      default:       return [empty, "#14532d", "#15803d", "#16a34a", "#22c55e"]; // green
    }
  }
  switch (scheme) {
    case "blue":   return [empty, "#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"];
    case "purple": return [empty, "#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce"];
    case "orange": return [empty, "#ffedd5", "#fdba74", "#f97316", "#c2410c"];
    case "red":    return [empty, "#fee2e2", "#fca5a5", "#ef4444", "#b91c1c"];
    default:       return [empty, "#c6e9b8", "#7bc96f", "#239a3b", "#196127"]; // green
  }
}

export function getHeatmapColor(intensity: number, colors: string[]): string {
  if (intensity <= 0) return colors[0]!;
  const idx = Math.min(Math.ceil(intensity * (colors.length - 1)), colors.length - 1);
  return colors[idx]!;
}
