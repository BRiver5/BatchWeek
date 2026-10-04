// Общее состояние приложения. Экраны читают отсюда и зовут действия — SQL и
// движок планирования живут этажом ниже (src/data/repo.ts, src/lib/*).

import { create } from "zustand";
import {
  ingredientKey,
  type Ingredient,
  type MealKind,
  type Recipe,
  type Slot,
  type SlotStatus,
} from "../lib/model";
import { buildPlan, cookMinutes, normalizeServings } from "../lib/planner";
import type { SlotRecord } from "../lib/planStats";
import { weekStartIso } from "../lib/dates";
import {
  clearHistory,
  deleteRecipe as deleteRecipeRow,
  loadCatalog,
  loadChecked,
  loadHistory,
  loadRecipes,
  loadWeek,
  saveIngredient,
  saveRecipe as saveRecipeRow,
  saveWeek,
  setChecked as setCheckedRow,
  setSlotStatus,
} from "../data/repo";
import { configFromSettings, loadSettings, persistSettings, type AppSettings, DEFAULT_SETTINGS } from "../data/settings";

type State = {
  ready: boolean;
  recipes: Recipe[];
  catalog: Map<string, Ingredient>;
  settings: AppSettings;
  weekStart: string;
  seed: number;
  slots: Slot[];
  statuses: Record<string, SlotStatus>;
  history: SlotRecord[];
  checked: Set<string>;
  building: boolean;

  init: () => Promise<void>;
  rebuild: (nextSeed?: number) => Promise<void>;
  assignSlot: (day: number, meal: MealKind, assignment: Slot) => Promise<void>;
  clearSlot: (day: number, meal: MealKind) => Promise<void>;
  markSlot: (day: number, meal: MealKind, status: SlotStatus) => Promise<void>;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  removeRecipe: (id: string) => Promise<void>;
  upsertIngredient: (ingredient: Ingredient, displayName?: string) => Promise<void>;
  toggleChecked: (itemKey: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetHistory: () => Promise<void>;
};

function minutesFor(slot: Slot, recipes: Recipe[]): number {
  if (slot.kind !== "cook") return 0;
  const recipe = recipes.find((r) => r.id === slot.recipeId);
  return recipe ? cookMinutes(recipe, slot.servings) : 0;
}

async function persistWeek(state: {
  weekStart: string;
  seed: number;
  slots: Slot[];
  recipes: Recipe[];
  statuses: Record<string, SlotStatus>;
}): Promise<void> {
  await saveWeek(state.weekStart, state.seed, state.slots, (slot) => minutesFor(slot, state.recipes), state.statuses);
}

export const useAppStore = create<State>((set, get) => ({
  ready: false,
  recipes: [],
  catalog: new Map(),
  settings: DEFAULT_SETTINGS,
  weekStart: weekStartIso(),
  seed: 1,
  slots: [],
  statuses: {},
  history: [],
  checked: new Set(),
  building: false,

  init: async () => {
    const [recipes, catalog, settings, history] = await Promise.all([
      loadRecipes(),
      loadCatalog(),
      loadSettings(),
      loadHistory(),
    ]);
    const weekStart = weekStartIso();
    const [week, checked] = await Promise.all([loadWeek(weekStart), loadChecked(weekStart)]);
    set({
      ready: true,
      recipes,
      catalog,
      settings,
      history,
      weekStart,
      checked,
      seed: week?.seed ?? 1,
      slots: week?.slots ?? [],
      statuses: week?.statuses ?? {},
    });
  },

  rebuild: async (nextSeed) => {
    const { recipes, catalog, settings, weekStart, seed } = get();
    set({ building: true });
    try {
      const config = configFromSettings(settings);
      const usedSeed = nextSeed ?? seed;
      const result = buildPlan(recipes, catalog, config, usedSeed);
      // Пересборка — это новый план: прошлые отметки "приготовлено" к нему
      // больше не относятся, иначе статистика начнёт считать чужие успехи.
      await persistWeek({ weekStart, seed: usedSeed, slots: result.slots, recipes, statuses: {} });
      set({ slots: result.slots, seed: usedSeed, statuses: {}, history: await loadHistory() });
    } finally {
      set({ building: false });
    }
  },

  assignSlot: async (day, meal, assignment) => {
    const { slots, settings, recipes, weekStart, seed, statuses } = get();
    const exists = slots.some((s) => s.day === day && s.meal === meal);
    const base = exists ? slots : [...slots, { day, meal, kind: "open" as const }];
    const next = normalizeServings(
      base.map((s) => (s.day === day && s.meal === meal ? assignment : s)),
      configFromSettings(settings)
    );
    const nextStatuses = { ...statuses };
    delete nextStatuses[day + "-" + meal];
    await persistWeek({ weekStart, seed, slots: next, recipes, statuses: nextStatuses });
    set({ slots: next, statuses: nextStatuses, history: await loadHistory() });
  },

  clearSlot: async (day, meal) => {
    const { slots, settings, recipes, weekStart, seed, statuses } = get();
    // Остатки, ссылавшиеся на эту готовку, тоже освобождаются — иначе в плане
    // остались бы контейнеры из несуществующей кастрюли.
    const cleared = slots.map((s) => {
      if (s.day === day && s.meal === meal) return { day, meal, kind: "open" as const };
      if (s.kind === "leftover" && s.sourceDay === day && s.sourceMeal === meal) {
        return { day: s.day, meal: s.meal, kind: "open" as const };
      }
      return s;
    });
    const next = normalizeServings(cleared, configFromSettings(settings));
    const nextStatuses = { ...statuses };
    delete nextStatuses[day + "-" + meal];
    await persistWeek({ weekStart, seed, slots: next, recipes, statuses: nextStatuses });
    set({ slots: next, statuses: nextStatuses, history: await loadHistory() });
  },

  markSlot: async (day, meal, status) => {
    const { weekStart, statuses } = get();
    await setSlotStatus(weekStart, day, meal, status);
    set({ statuses: { ...statuses, [day + "-" + meal]: status }, history: await loadHistory() });
  },

  saveRecipe: async (recipe) => {
    await saveRecipeRow(recipe);
    set({ recipes: await loadRecipes() });
  },

  removeRecipe: async (id) => {
    await deleteRecipeRow(id);
    const { slots, settings, recipes, weekStart, seed, statuses } = get();
    const stillUsed = slots.some((s) => s.kind !== "open" && s.recipeId === id);
    if (stillUsed) {
      const cleaned = normalizeServings(
        slots.map((s) => (s.kind !== "open" && s.recipeId === id ? { day: s.day, meal: s.meal, kind: "open" as const } : s)),
        configFromSettings(settings)
      );
      await persistWeek({ weekStart, seed, slots: cleaned, recipes, statuses });
      set({ slots: cleaned });
    }
    set({ recipes: await loadRecipes(), history: await loadHistory() });
  },

  upsertIngredient: async (ingredient, displayName) => {
    await saveIngredient(ingredient, displayName);
    set({ catalog: await loadCatalog() });
  },

  toggleChecked: async (itemKey) => {
    const { checked, weekStart } = get();
    const next = new Set(checked);
    const willCheck = !next.has(itemKey);
    if (willCheck) next.add(itemKey);
    else next.delete(itemKey);
    await setCheckedRow(weekStart, itemKey, willCheck);
    set({ checked: next });
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    await persistSettings(next);
    set({ settings: next });
  },

  resetHistory: async () => {
    await clearHistory();
    set({ slots: [], statuses: {}, history: [], checked: new Set() });
  },
}));

/** Продукт из справочника или разумный дефолт — для экранов. */
export function ingredientFor(catalog: Map<string, Ingredient>, name: string): Ingredient | undefined {
  return catalog.get(ingredientKey(name));
}
