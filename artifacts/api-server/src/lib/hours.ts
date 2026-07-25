export type DayHours = { open: string; close: string } | null;
export type BusinessHours = Array<DayHours> | null | undefined;

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Whether a store is within its opening hours at `now`. No schedule set → always
 * open (backward compatible). Supports overnight ranges (close < open spills to
 * the next day). Index 0=Sunday..6=Saturday (matches Date.getDay()).
 */
export function isOpenByHours(hours: BusinessHours, now: Date = new Date()): boolean {
  if (!hours || hours.length !== 7) return true;
  const day = now.getDay();
  const cur = now.getHours() * 60 + now.getMinutes();

  const today = hours[day];
  if (today) {
    const o = toMinutes(today.open), c = toMinutes(today.close);
    if (o != null && c != null) {
      if (c > o) { if (cur >= o && cur < c) return true; }
      else if (c < o) { if (cur >= o) return true; } // overnight, part before midnight
    }
  }
  // Overnight spill from the previous day (e.g. 20:00–02:00).
  const prev = hours[(day + 6) % 7];
  if (prev) {
    const o = toMinutes(prev.open), c = toMinutes(prev.close);
    if (o != null && c != null && c < o && cur < c) return true;
  }
  return false;
}
