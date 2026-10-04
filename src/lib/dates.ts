// Даты в приложении — только ISO-строки "YYYY-MM-DD" в локальном времени.
// Через Date проходят только арифметика и форматирование: toISOString() даёт
// UTC и в вечерних часовых поясах легко сдвигает дату на сутки назад, поэтому
// строка собирается вручную из локальных компонент.

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function diffDays(from: string, to: string): number {
  const ms = fromIso(to).getTime() - fromIso(from).getTime();
  return Math.round(ms / 86400000);
}

/** Понедельник недели, в которую попадает дата. */
export function weekStartIso(iso: string = todayIso()): string {
  const date = fromIso(iso);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return toIso(date);
}

/** Индекс дня недели 0..6, где 0 — понедельник. */
export function weekdayIndex(iso: string): number {
  return (fromIso(iso).getDay() + 6) % 7;
}

export function lastWeekStarts(count: number, from: string = todayIso()): string[] {
  const current = weekStartIso(from);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(current, -7 * i));
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatShort(iso: string): string {
  const date = fromIso(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Sep 28 – Oct 4" — подпись недели в хедере. */
export function formatWeekRange(weekStart: string): string {
  return `${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))}`;
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
