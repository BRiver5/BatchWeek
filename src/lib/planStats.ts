// Статистика по тому, что из планов реально доехало до плиты.
//
// Главная честная грань приложения. План всегда выглядит выполнимым в
// воскресенье вечером; вопрос в том, с какого момента он перестаёт выполняться
// в реальности. Вместо среднего по больнице здесь ищется ПОРОГ УСИЛИЯ:
// сканируются все возможные точки разреза по плановым минутам слота, и
// вердикт выносится только там, где доверительные интервалы Уилсона двух
// сторон разреза НЕ ПЕРЕСЕКАЮТСЯ.
//
// Это шаг дальше привычного для портфеля паттерна "интервал против общей
// средней": там одна группа сравнивалась с числом, посчитанным в том числе по
// ней самой (сравнение с собой же смещено), здесь сравниваются две независимые
// выборки между собой, и порог не задан заранее, а найден перебором. Если ни
// один разрез не разделяет интервалы — честный ответ "разделения нет", а не
// самый эффектный из найденных.

import type { MealKind, SlotStatus } from "./model.ts";

export type SlotRecord = {
  /** Понедельник недели в ISO-формате. */
  weekStart: string;
  day: number;
  meal: MealKind;
  kind: "cook" | "leftover" | "open";
  status: SlotStatus;
  recipeId: string | null;
  /** Плановые активные минуты слота (0 для остатков). */
  minutes: number;
};

export type WilsonInterval = { low: number; high: number; rate: number; n: number };

/**
 * Интервал Уилсона для доли. На малых выборках он, в отличие от обычного
 * нормального интервала, не вылезает за [0,1] и не схлопывается в точку при
 * 0 или 100% — ровно то, что нужно, когда недель всего пять.
 */
export function wilson(successes: number, n: number, z = 1.96): WilsonInterval {
  if (n <= 0) return { low: 0, high: 1, rate: 0, n: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin), rate: p, n };
}

export type EffortThreshold =
  | { kind: "found"; minutes: number; lightRate: number; heavyRate: number; lightN: number; heavyN: number }
  | { kind: "insufficientData"; n: number; needed: number }
  | { kind: "notSeparated"; n: number };

const MIN_TOTAL = 12;
const MIN_SIDE = 5;

/**
 * Найти порог плановых минут, после которого готовка начинает срываться.
 * Перебираются все разрезы между фактически встречающимися значениями минут;
 * засчитывается только разрез, у которого верхняя граница тяжёлой стороны ниже
 * нижней границы лёгкой (интервалы не пересекаются). Из нескольких подходящих
 * берётся самый выраженный по разрыву, а не самый низкий порог.
 */
export function findEffortThreshold(records: SlotRecord[]): EffortThreshold {
  const cooks = records.filter((r) => r.kind === "cook" && r.status !== "planned");
  if (cooks.length < MIN_TOTAL) return { kind: "insufficientData", n: cooks.length, needed: MIN_TOTAL };

  const cuts = [...new Set(cooks.map((r) => r.minutes))].sort((a, b) => a - b);
  let best: EffortThreshold | null = null;
  let bestGap = 0;

  for (const cut of cuts) {
    const light = cooks.filter((r) => r.minutes <= cut);
    const heavy = cooks.filter((r) => r.minutes > cut);
    if (light.length < MIN_SIDE || heavy.length < MIN_SIDE) continue;

    const lightDone = light.filter((r) => r.status === "cooked").length;
    const heavyDone = heavy.filter((r) => r.status === "cooked").length;
    const lightCi = wilson(lightDone, light.length);
    const heavyCi = wilson(heavyDone, heavy.length);
    if (heavyCi.high >= lightCi.low) continue;

    const gap = lightCi.low - heavyCi.high;
    if (gap > bestGap) {
      bestGap = gap;
      best = {
        kind: "found",
        minutes: cut,
        lightRate: lightCi.rate,
        heavyRate: heavyCi.rate,
        lightN: light.length,
        heavyN: heavy.length,
      };
    }
  }

  return best ?? { kind: "notSeparated", n: cooks.length };
}

export type WeekBreakdown = {
  weekStart: string;
  cooked: number;
  leftovers: number;
  skipped: number;
};

/** Последние weeks недель: что было приготовлено, доедено и сорвано. */
export function weekBreakdowns(records: SlotRecord[], weeks = 8): WeekBreakdown[] {
  const byWeek = new Map<string, WeekBreakdown>();
  for (const record of records) {
    if (record.kind === "open") continue;
    let row = byWeek.get(record.weekStart);
    if (!row) {
      row = { weekStart: record.weekStart, cooked: 0, leftovers: 0, skipped: 0 };
      byWeek.set(record.weekStart, row);
    }
    if (record.status === "skipped") row.skipped += 1;
    else if (record.status === "cooked") {
      if (record.kind === "leftover") row.leftovers += 1;
      else row.cooked += 1;
    }
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-weeks);
}

/** Фактические активные минуты по дням недели (для столбчатого графика). */
export function minutesByWeekday(records: SlotRecord[]): number[] {
  const minutes = new Array(7).fill(0);
  for (const record of records) {
    if (record.kind !== "cook" || record.status !== "cooked") continue;
    minutes[record.day] += record.minutes;
  }
  return minutes;
}

export type FollowThrough = {
  planned: number;
  cooked: number;
  skipped: number;
  rate: number;
  interval: WilsonInterval;
};

export function followThrough(records: SlotRecord[]): FollowThrough {
  const decided = records.filter((r) => r.kind !== "open" && r.status !== "planned");
  const cooked = decided.filter((r) => r.status === "cooked").length;
  return {
    planned: records.filter((r) => r.kind !== "open").length,
    cooked,
    skipped: decided.length - cooked,
    rate: decided.length ? cooked / decided.length : 0,
    interval: wilson(cooked, decided.length),
  };
}

/** Сколько активных минут сэкономила готовка впрок за всю историю. */
export function leftoverPayoff(records: SlotRecord[], averageCookMinutes: number): number {
  const eatenLeftovers = records.filter((r) => r.kind === "leftover" && r.status === "cooked").length;
  return Math.round(eatenLeftovers * averageCookMinutes);
}

export type HeatCell = { key: string; intensity: number };

/**
 * Активность готовки по дням за последние weeks недель. Интенсивность —
 * минуты дня, нормированные на самый загруженный день периода.
 */
export function cookingHeatmap(records: SlotRecord[], weekStarts: string[]): HeatCell[] {
  const byDate = new Map<string, number>();
  for (const record of records) {
    if (record.kind !== "cook" || record.status !== "cooked") continue;
    const key = record.weekStart + ":" + record.day;
    byDate.set(key, (byDate.get(key) ?? 0) + record.minutes);
  }
  const max = Math.max(1, ...byDate.values());
  const cells: HeatCell[] = [];
  for (const weekStart of weekStarts) {
    for (let day = 0; day < 7; day++) {
      const key = weekStart + ":" + day;
      cells.push({ key, intensity: (byDate.get(key) ?? 0) / max });
    }
  }
  return cells;
}

/** Рецепты, которые чаще всего доезжают до плиты (и те, что чаще срываются). */
export type RecipeReliability = {
  recipeId: string;
  cooked: number;
  total: number;
  rate: number;
};

export function recipeReliability(records: SlotRecord[], minTotal = 3): RecipeReliability[] {
  const byRecipe = new Map<string, { cooked: number; total: number }>();
  for (const record of records) {
    if (record.kind !== "cook" || record.status === "planned" || !record.recipeId) continue;
    const row = byRecipe.get(record.recipeId) ?? { cooked: 0, total: 0 };
    row.total += 1;
    if (record.status === "cooked") row.cooked += 1;
    byRecipe.set(record.recipeId, row);
  }
  return [...byRecipe.entries()]
    .filter(([, row]) => row.total >= minTotal)
    .map(([recipeId, row]) => ({ recipeId, cooked: row.cooked, total: row.total, rate: row.cooked / row.total }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}
