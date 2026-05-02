import {
  BasesView,
  type QueryController,
  type BasesViewConfig,
  type BasesAllOptions,
} from "obsidian";

import type { CalendarViewConfig, CalendarEvent } from "../../utils/types";
import { DEFAULT_CALENDAR_CONFIG } from "../../utils/types";
import { recordsFromResult } from "../../data/adapter";
import {
  weeksInMonth,
  formatMonthYear,
  formatWeekdayShort,
  isToday,
  isSameDay,
  addDays,
  startOfWeek,
  formatShortDate,
} from "../../utils/dates";
import { getChartColors } from "../../theme/tokens";
import { VIEW_TYPE_CALENDAR } from "../../bases/viewTypes";

type CalendarMode = "month" | "week" | "agenda";

export class CalendarBasesView extends BasesView {
  readonly type = VIEW_TYPE_CALENDAR;

  private containerEl: HTMLElement;
  private currentDate: Date = new Date();
  private mode: CalendarMode = "month";

  // Map color-field values → colors (cached per render)
  private colorMap: Map<string, string> = new Map();

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    (containerEl as any).isShown = () => containerEl.isConnected;
  }

  onDataUpdated(): void {
    this.render();
  }

  private readConfig(): CalendarViewConfig {
    const cfg = this.config;
    return {
      primaryDateField: cfg.getAsPropertyId("primaryDateField"),
      endDateField: cfg.getAsPropertyId("endDateField") ?? null,
      colorField: cfg.getAsPropertyId("colorField") ?? null,
      titleField: cfg.getAsPropertyId("titleField") ?? null,
      calendarMode: (cfg.get("calendarMode") as CalendarMode) ?? DEFAULT_CALENDAR_CONFIG.calendarMode,
      showWeekends: (cfg.get("showWeekends") as boolean) ?? DEFAULT_CALENDAR_CONFIG.showWeekends,
      firstDayOfWeek: (cfg.get("firstDayOfWeek") as number) ?? DEFAULT_CALENDAR_CONFIG.firstDayOfWeek,
    };
  }

  private render() {
    if (!this.data) return;

    const viewCfg = this.readConfig();
    this.mode = viewCfg.calendarMode;

    if (!viewCfg.primaryDateField) {
      this.renderEmpty(
        "📅",
        "No date field selected",
        "Open view options and choose the date property to use as the event date.",
      );
      return;
    }

    const { records } = recordsFromResult(
      this.data,
      this.allProperties,
      (id) => this.config.getDisplayName(id),
      [viewCfg.primaryDateField, viewCfg.endDateField, viewCfg.colorField, viewCfg.titleField],
    );

    // Build events
    const events: CalendarEvent[] = [];
    const colorValues = new Set<string>();

    for (const record of records) {
      const dateVal = record.properties[viewCfg.primaryDateField!];
      if (!dateVal || dateVal.kind !== "date") continue;

      const endVal = viewCfg.endDateField ? record.properties[viewCfg.endDateField] : null;
      const colorVal = viewCfg.colorField ? record.properties[viewCfg.colorField] : null;
      const titleVal = viewCfg.titleField ? record.properties[viewCfg.titleField] : null;

      const colorStr = colorVal && colorVal.kind === "string" ? colorVal.value : null;
      if (colorStr) colorValues.add(colorStr);

      const title = titleVal && titleVal.kind === "string"
        ? titleVal.value
        : record.title;

      events.push({
        record,
        title,
        start: dateVal.value,
        end: endVal?.kind === "date" ? endVal.value : null,
        color: colorStr,
        isAllDay: true,
      });
    }

    // Build color map
    const colorList = getChartColors(colorValues.size);
    let ci = 0;
    for (const v of colorValues) {
      this.colorMap.set(v, colorList[ci++ % colorList.length]!);
    }

    // Render
    this.containerEl.empty();
    this.containerEl.addClass("odash-calendar-view");

    this.renderToolbar(viewCfg);

    if (this.mode === "month") {
      this.renderMonth(viewCfg, events);
    } else if (this.mode === "week") {
      this.renderWeek(viewCfg, events);
    } else {
      this.renderAgenda(viewCfg, events);
    }
  }

  // ─── Toolbar ──────────────────────────────────────────────────────────────

  private renderToolbar(cfg: CalendarViewConfig) {
    const toolbar = this.containerEl.createDiv("odash-cal-toolbar");

    const navLeft = toolbar.createEl("button", { cls: "odash-cal-nav", text: "‹" });
    navLeft.addEventListener("click", () => {
      this.navigateBack(cfg);
      this.render();
    });

    const titleEl = toolbar.createEl("span", { cls: "odash-cal-title" });
    titleEl.setText(this.getTitle());

    const navRight = toolbar.createEl("button", { cls: "odash-cal-nav", text: "›" });
    navRight.addEventListener("click", () => {
      this.navigateForward(cfg);
      this.render();
    });

    const todayBtn = toolbar.createEl("button", { cls: "odash-cal-today", text: "Today" });
    todayBtn.addEventListener("click", () => {
      this.currentDate = new Date();
      this.render();
    });
  }

  private getTitle(): string {
    if (this.mode === "month") {
      return formatMonthYear(this.currentDate);
    }
    if (this.mode === "week") {
      const monday = startOfWeek(this.currentDate, 1);
      const sunday = addDays(monday, 6);
      return `${formatShortDate(monday)} – ${formatShortDate(sunday)}`;
    }
    return formatMonthYear(this.currentDate);
  }

  private navigateBack(cfg: CalendarViewConfig) {
    if (this.mode === "month") {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else if (this.mode === "week") {
      this.currentDate = addDays(this.currentDate, -7);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    }
  }

  private navigateForward(cfg: CalendarViewConfig) {
    if (this.mode === "month") {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else if (this.mode === "week") {
      this.currentDate = addDays(this.currentDate, 7);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    }
  }

  // ─── Month view ───────────────────────────────────────────────────────────

  private renderMonth(cfg: CalendarViewConfig, events: CalendarEvent[]) {
    const grid = this.containerEl.createDiv("odash-cal-grid-month");
    const firstDay = cfg.firstDayOfWeek;
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // ── Weekday headers ──
    const headerRow = grid.createDiv("odash-cal-header-row");
    for (let i = 0; i < 7; i++) {
      const dayIdx = (firstDay + i) % 7;
      const skip = !cfg.showWeekends && (dayIdx === 0 || dayIdx === 6);
      if (!skip) {
        headerRow.createDiv({ cls: "odash-cal-header-cell", text: formatWeekdayShort(dayIdx) });
      }
    }

    const weeks = weeksInMonth(year, month, firstDay);

    for (const week of weeks) {
      const weekRow = grid.createDiv("odash-cal-week-row");

      for (let i = 0; i < 7; i++) {
        const day = week[i]!;
        const dayIdx = day.getDay();
        const isWeekend = dayIdx === 0 || dayIdx === 6;

        if (!cfg.showWeekends && isWeekend) continue;

        const inMonth = day.getMonth() === month;
        const today = isToday(day);

        const cell = weekRow.createDiv({
          cls: [
            "odash-cal-cell",
            !inMonth ? "odash-cal-cell--other-month" : "",
            today ? "odash-cal-cell--today" : "",
            isWeekend ? "odash-cal-cell--weekend" : "",
          ].filter(Boolean).join(" "),
        });

        // Day number
        const dayNum = cell.createDiv("odash-cal-day-num");
        if (today) {
          dayNum.createEl("span", { cls: "odash-cal-today-badge", text: String(day.getDate()) });
        } else {
          dayNum.setText(String(day.getDate()));
        }

        // Events
        const dayEvents = events.filter((e) => isSameDay(e.start, day));
        const eventsEl = cell.createDiv("odash-cal-events");

        const MAX_VISIBLE = 3;
        const visible = dayEvents.slice(0, MAX_VISIBLE);
        const overflow = dayEvents.length - MAX_VISIBLE;

        for (const evt of visible) {
          this.renderEventChip(eventsEl, evt);
        }

        if (overflow > 0) {
          const more = eventsEl.createEl("span", {
            cls: "odash-cal-more",
            text: `+${overflow} more`,
          });
        }

        // Click to add new entry
        if (inMonth) {
          cell.addEventListener("click", (e) => {
            if ((e.target as HTMLElement).closest(".odash-cal-event")) return;
            this.handleDayClick(day);
          });
        }
      }
    }
  }

  // ─── Week view ────────────────────────────────────────────────────────────

  private renderWeek(cfg: CalendarViewConfig, events: CalendarEvent[]) {
    const monday = startOfWeek(this.currentDate, cfg.firstDayOfWeek);
    const grid = this.containerEl.createDiv("odash-cal-grid-week");
    const headerRow = grid.createDiv("odash-cal-header-row");

    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      const dayIdx = day.getDay();
      if (!cfg.showWeekends && (dayIdx === 0 || dayIdx === 6)) continue;

      const cell = headerRow.createDiv({
        cls: ["odash-cal-header-cell", isToday(day) ? "odash-cal-header-cell--today" : ""].filter(Boolean).join(" "),
      });
      cell.createEl("span", { text: formatWeekdayShort(dayIdx), cls: "odash-cal-wday" });
      cell.createEl("span", { text: String(day.getDate()), cls: "odash-cal-wdate" });
    }

    const bodyRow = grid.createDiv("odash-cal-week-body");
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      const dayIdx = day.getDay();
      if (!cfg.showWeekends && (dayIdx === 0 || dayIdx === 6)) continue;

      const col = bodyRow.createDiv({
        cls: ["odash-cal-week-col", isToday(day) ? "odash-cal-week-col--today" : ""].filter(Boolean).join(" "),
      });

      const dayEvents = events.filter((e) => isSameDay(e.start, day));
      for (const evt of dayEvents) {
        this.renderEventChip(col, evt);
      }
    }
  }

  // ─── Agenda view ──────────────────────────────────────────────────────────

  private renderAgenda(cfg: CalendarViewConfig, events: CalendarEvent[]) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthEvents = events.filter(
      (e) => e.start.getFullYear() === year && e.start.getMonth() === month,
    );
    monthEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    const container = this.containerEl.createDiv("odash-cal-agenda");

    if (monthEvents.length === 0) {
      container.createEl("p", {
        cls: "odash-cal-agenda-empty",
        text: "No events this month.",
      });
      return;
    }

    let lastDay = "";
    for (const evt of monthEvents) {
      const dayKey = evt.start.toDateString();
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        const dayHeader = container.createDiv("odash-cal-agenda-day-header");
        dayHeader.setText(formatShortDate(evt.start));
      }
      const row = container.createDiv("odash-cal-agenda-row");
      this.renderEventChip(row, evt);
    }
  }

  // ─── Event chip ───────────────────────────────────────────────────────────

  private renderEventChip(parent: HTMLElement, evt: CalendarEvent) {
    const color = evt.color
      ? (this.colorMap.get(evt.color) ?? evt.color)
      : "var(--color-accent)";

    const chip = parent.createEl("div", { cls: "odash-cal-event", text: evt.title });
    chip.style.setProperty("--evt-color", color);

    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.app.workspace.openLinkText(evt.record.file.path, "", false);
    });

    chip.setAttribute("title", evt.title);
  }

  // ─── Day click (quick-add) ────────────────────────────────────────────────

  private handleDayClick(day: Date) {
    const dateStr = day.toISOString().slice(0, 10);
    const primaryField = this.readConfig().primaryDateField;
    if (!primaryField) return;

    const fieldName = primaryField.split(".").pop() ?? "date";

    this.createFileForView(undefined, (fm) => {
      fm[fieldName] = dateStr;
    });
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  private renderEmpty(icon: string, title: string, body: string) {
    this.containerEl.empty();
    this.containerEl.addClass("odash-calendar-view");
    const el = this.containerEl.createDiv("odash-empty-state");
    el.createDiv({ cls: "odash-empty-icon", text: icon });
    el.createEl("h3", { cls: "odash-empty-title", text: title });
    el.createEl("p", { cls: "odash-empty-body", text: body });
  }
}

// ─── View options ─────────────────────────────────────────────────────────────

export function calendarViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
  return [
    {
      type: "group",
      displayName: "Calendar",
      items: [
        {
          key: "calendarMode",
          type: "dropdown",
          displayName: "View mode",
          default: "month",
          options: { month: "Month", week: "Week", agenda: "Agenda" },
        },
        {
          key: "primaryDateField",
          type: "property",
          displayName: "Date field",
        },
        {
          key: "endDateField",
          type: "property",
          displayName: "End date (optional)",
        },
      ],
    },
    {
      type: "group",
      displayName: "Display",
      items: [
        {
          key: "titleField",
          type: "property",
          displayName: "Title field (overrides note name)",
        },
        {
          key: "colorField",
          type: "property",
          displayName: "Color by",
        },
        {
          key: "showWeekends",
          type: "toggle",
          displayName: "Show weekends",
          default: true,
        },
        {
          key: "firstDayOfWeek",
          type: "dropdown",
          displayName: "First day of week",
          default: "1",
          options: { "0": "Sunday", "1": "Monday" },
        },
      ],
    },
  ] as BasesAllOptions[];
}
