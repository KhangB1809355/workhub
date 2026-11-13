import type { Mode, Repeat } from './types';

// All dates are plain "YYYY-MM-DD" strings, computed in UTC so they never shift with time zones.

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date in the user's local time zone. */
export function today(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

/** Adds months, clamping the day (31/01 + 1 month = 28/02). */
export function addMonths(s: string, n: number): string {
  const d = parse(s);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))));
}

/** Monday of the week containing s. */
export function startOfWeek(s: string): string {
  return addDays(s, -((parse(s).getUTCDay() + 6) % 7));
}

/** ISO-8601 week number. */
export function isoWeek(s: string): number {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

export function ddmm(s: string): string {
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}

export function ddmmyyyy(s: string): string {
  return `${ddmm(s)}/${s.slice(0, 4)}`;
}

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export function weekday(s: string): string {
  return DOW[parse(s).getUTCDay()];
}

export interface Range {
  start: string;
  end: string;
  /** "Tháng 11, 2026" */
  label: string;
  /** "tháng 11" */
  short: string;
}

export function getRange(mode: Mode, anchor: string): Range {
  const d = parse(anchor);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    const w = isoWeek(start);
    return { start, end: addDays(start, 6), label: `Tuần ${w}, ${y}`, short: `tuần ${w}` };
  }
  if (mode === 'month') {
    return {
      start: format(new Date(Date.UTC(y, m, 1))),
      end: format(new Date(Date.UTC(y, m + 1, 0))),
      label: `Tháng ${m + 1}, ${y}`,
      short: `tháng ${m + 1}`,
    };
  }
  const q = Math.floor(m / 3);
  return {
    start: format(new Date(Date.UTC(y, q * 3, 1))),
    end: format(new Date(Date.UTC(y, q * 3 + 3, 0))),
    label: `Quý ${q + 1}, ${y}`,
    short: `quý ${q + 1}/${y}`,
  };
}

export function shiftAnchor(mode: Mode, anchor: string, n: number): string {
  if (mode === 'week') return addDays(anchor, 7 * n);
  const d = parse(anchor);
  const months = mode === 'month' ? n : 3 * n;
  return format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)));
}

export function periodKey(mode: Mode, anchor: string): string {
  if (mode === 'week') return `week:${startOfWeek(anchor)}`;
  if (mode === 'month') return `month:${anchor.slice(0, 7)}`;
  const d = parse(anchor);
  return `quarter:${d.getUTCFullYear()}-${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/** Mondays of every week that overlaps the range. */
export function weeksInRange(r: Pick<Range, 'start' | 'end'>): string[] {
  const out: string[] = [];
  for (let w = startOfWeek(r.start); w <= r.end; w = addDays(w, 7)) out.push(w);
  return out;
}

export function nextOccurrence(date: string, repeat: Repeat): string {
  if (repeat === 'daily') return addDays(date, 1);
  if (repeat === 'weekly') return addDays(date, 7);
  return addMonths(date, 1);
}
