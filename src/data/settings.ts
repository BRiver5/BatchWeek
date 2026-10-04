// Настройки недели. Хранятся как плоские строки в таблице settings —
// отдельная таблица на семь полей была бы дороже, чем этот слой разбора.

import { DEFAULT_CONFIG, DEFAULT_WEIGHTS, type PlanConfig, type SlotKey } from "../lib/model";
import { loadSettingsRaw, saveSettingRaw } from "./repo";

export type AppSettings = {
  servingsPerMeal: number;
  weekdayMinutes: number;
  weekendMinutes: number;
  allowBatch: boolean;
  minRepeatGap: number;
  leftoverMaxAge: number;
  /** Сколько походов в магазин планировать: 1 или 2. */
  tripCount: number;
  /** Планировать ли обеды, или только ужины. */
  planLunches: boolean;
  /** Дни недели, которые вообще нужно закрывать (0 — понедельник). */
  activeDays: number[];
  /**
   * 1..5 — чем выше, тем сильнее план тянет к разным блюдам; чем ниже, тем
   * сильнее к короткому списку покупок. Это настоящий компромисс движка, а не
   * косметика: на минимуме честный оптимум — сварить дважды и доедать неделю.
   */
  varietyBias: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  servingsPerMeal: DEFAULT_CONFIG.servingsPerMeal,
  weekdayMinutes: DEFAULT_CONFIG.weekdayMinutes,
  weekendMinutes: DEFAULT_CONFIG.weekendMinutes,
  allowBatch: DEFAULT_CONFIG.allowBatch,
  minRepeatGap: DEFAULT_CONFIG.minRepeatGap,
  leftoverMaxAge: DEFAULT_CONFIG.leftoverMaxAge,
  tripCount: 2,
  planLunches: false,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  varietyBias: 3,
};

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await loadSettingsRaw();
  return {
    servingsPerMeal: parseNumber(raw.servingsPerMeal, DEFAULT_SETTINGS.servingsPerMeal),
    weekdayMinutes: parseNumber(raw.weekdayMinutes, DEFAULT_SETTINGS.weekdayMinutes),
    weekendMinutes: parseNumber(raw.weekendMinutes, DEFAULT_SETTINGS.weekendMinutes),
    allowBatch: raw.allowBatch ? raw.allowBatch === "1" : DEFAULT_SETTINGS.allowBatch,
    minRepeatGap: parseNumber(raw.minRepeatGap, DEFAULT_SETTINGS.minRepeatGap),
    leftoverMaxAge: parseNumber(raw.leftoverMaxAge, DEFAULT_SETTINGS.leftoverMaxAge),
    tripCount: parseNumber(raw.tripCount, DEFAULT_SETTINGS.tripCount),
    planLunches: raw.planLunches ? raw.planLunches === "1" : DEFAULT_SETTINGS.planLunches,
    activeDays: raw.activeDays
      ? raw.activeDays
          .split(",")
          .map(Number)
          .filter((n) => n >= 0 && n <= 6)
      : DEFAULT_SETTINGS.activeDays,
    varietyBias: parseNumber(raw.varietyBias, DEFAULT_SETTINGS.varietyBias),
  };
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  await saveSettingRaw("servingsPerMeal", String(settings.servingsPerMeal));
  await saveSettingRaw("weekdayMinutes", String(settings.weekdayMinutes));
  await saveSettingRaw("weekendMinutes", String(settings.weekendMinutes));
  await saveSettingRaw("allowBatch", settings.allowBatch ? "1" : "0");
  await saveSettingRaw("minRepeatGap", String(settings.minRepeatGap));
  await saveSettingRaw("leftoverMaxAge", String(settings.leftoverMaxAge));
  await saveSettingRaw("tripCount", String(settings.tripCount));
  await saveSettingRaw("planLunches", settings.planLunches ? "1" : "0");
  await saveSettingRaw("activeDays", settings.activeDays.join(","));
  await saveSettingRaw("varietyBias", String(settings.varietyBias));
}

/** Слоты недели, которые нужно закрыть, из настроек пользователя. */
export function slotsFromSettings(settings: AppSettings): SlotKey[] {
  const slots: SlotKey[] = [];
  for (const day of [...settings.activeDays].sort((a, b) => a - b)) {
    if (settings.planLunches) slots.push({ day, meal: "lunch" });
    slots.push({ day, meal: "dinner" });
  }
  return slots;
}

export function configFromSettings(settings: AppSettings): PlanConfig {
  // Ползунок Variety перераспределяет вес между "разные блюда" и "короткий
  // список покупок" — середина (3) оставляет веса такими, как в DEFAULT_WEIGHTS.
  const bias = Math.min(5, Math.max(1, settings.varietyBias));
  const towardsVariety = bias / 3;
  const towardsShortList = (6 - bias) / 3;
  return {
    slots: slotsFromSettings(settings),
    servingsPerMeal: settings.servingsPerMeal,
    weekdayMinutes: settings.weekdayMinutes,
    weekendMinutes: settings.weekendMinutes,
    allowBatch: settings.allowBatch,
    minRepeatGap: settings.minRepeatGap,
    leftoverMaxAge: settings.leftoverMaxAge,
    weights: {
      ...DEFAULT_WEIGHTS,
      ingredient: DEFAULT_WEIGHTS.ingredient * towardsShortList,
      eatRepeat: DEFAULT_WEIGHTS.eatRepeat * towardsVariety,
      sameRecipeAgain: DEFAULT_WEIGHTS.sameRecipeAgain * towardsVariety,
    },
  };
}
