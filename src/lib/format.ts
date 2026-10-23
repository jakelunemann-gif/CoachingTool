// Formatting that mirrors the coach's existing Google Docs, e.g.
// "Monday, April 20th, 2026, MSE Field 12 6-7:30pm".

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(date: string): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = date.split("-").map(Number);
  // Use UTC so the weekday never shifts with the server's time zone.
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatDateLong(date: string): string {
  const { y, m, d, weekday } = parseDate(date);
  return `${WEEKDAYS[weekday]}, ${MONTHS[m - 1]} ${ordinal(d)}, ${y}`;
}

export function formatDateShort(date: string): string {
  const { y, m, d } = parseDate(date);
  return `${m}.${d}.${String(y).slice(-2)}`;
}

function toMinutes(time: string): number {
  const [h, min] = time.split(":").map(Number);
  return h * 60 + (min || 0);
}

function clockParts(totalMinutes: number): { h12: number; min: number; pm: boolean } {
  const t = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const min = t % 60;
  return { h12: h % 12 === 0 ? 12 : h % 12, min, pm: h >= 12 };
}

function clockText(h12: number, min: number): string {
  return min === 0 ? `${h12}` : `${h12}:${String(min).padStart(2, "0")}`;
}

/** "6-7:30pm", or "11am-12:30pm" when the range crosses noon. */
export function formatTimeRange(startTime: string, durationMin: number): string {
  const start = toMinutes(startTime);
  const a = clockParts(start);
  const b = clockParts(start + durationMin);
  const end = `${clockText(b.h12, b.min)}${b.pm ? "pm" : "am"}`;
  if (a.pm === b.pm) return `${clockText(a.h12, a.min)}-${end}`;
  return `${clockText(a.h12, a.min)}${a.pm ? "pm" : "am"}-${end}`;
}

/** Clock time `offset` minutes after `startTime`, e.g. "6:25". */
export function clockAt(startTime: string, offset: number): string {
  const p = clockParts(toMinutes(startTime) + offset);
  return `${p.h12}:${String(p.min).padStart(2, "0")}`;
}

export function planHeader(date: string, location: string, startTime: string, durationMin: number): string {
  const loc = location.trim();
  return `${formatDateLong(date)}${loc ? `, ${loc}` : ""} ${formatTimeRange(startTime, durationMin)}`;
}

/** "2026 12U-Blue Softball Practice Plan 4.20.26" */
export function planTitle(date: string, teamName: string, sportName: string): string {
  const year = date.slice(0, 4);
  const team = teamName.trim();
  return `${year} ${team ? `${team} ` : ""}${sportName} Practice Plan ${formatDateShort(date)}`;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
