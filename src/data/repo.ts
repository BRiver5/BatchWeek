// Единственный слой доступа к SQLite. Экраны не пишут SQL — они зовут эти
// функции и получают уже доменные типы из src/lib/model.ts.

import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import { ingredientKey, type Ingredient, type MealKind, type Recipe, type Slot, type SlotStatus } from "../lib/model";
import type { SlotRecord } from "../lib/planStats";
import type { Unit, UnitFamily } from "../lib/units";
import type { IngredientCategory } from "../lib/model";

type RecipeRow = {
  id: string;
  name: string;
  base_servings: number;
  active_minutes: number;
  tag: string;
  keeps_days: number;
  created_at: string;
};

type LineRow = { recipe_id: string; name: string; qty: number; unit: string; position: number };

type IngredientRow = {
  key: string;
  name: string;
  category: string;
  family: string;
  shelf_life_days: number;
  pack_sizes: string;
  staple: number;
};

type SlotRow = {
  week_start: string;
  day: number;
  meal: string;
  kind: string;
  recipe_id: string | null;
  servings: number;
  source_day: number | null;
  source_meal: string | null;
  status: string;
  minutes: number;
};

export async function loadRecipes(): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>("SELECT * FROM recipes ORDER BY name COLLATE NOCASE");
  const lines = await db.getAllAsync<LineRow>("SELECT * FROM recipe_lines ORDER BY position");
  const byRecipe = new Map<string, LineRow[]>();
  for (const line of lines) {
    const list = byRecipe.get(line.recipe_id) ?? [];
    list.push(line);
    byRecipe.set(line.recipe_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseServings: row.base_servings,
    activeMinutes: row.active_minutes,
    tag: row.tag,
    keepsDays: row.keeps_days,
    createdAt: row.created_at,
    lines: (byRecipe.get(row.id) ?? []).map((l) => ({ name: l.name, qty: l.qty, unit: l.unit as Unit })),
  }));
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO recipes (id, name, base_servings, active_minutes, tag, keeps_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, base_servings = excluded.base_servings,
         active_minutes = excluded.active_minutes, tag = excluded.tag, keeps_days = excluded.keeps_days`,
      [recipe.id, recipe.name, recipe.baseServings, recipe.activeMinutes, recipe.tag, recipe.keepsDays, recipe.createdAt]
    );
    await db.runAsync("DELETE FROM recipe_lines WHERE recipe_id = ?", [recipe.id]);
    for (let i = 0; i < recipe.lines.length; i++) {
      const line = recipe.lines[i];
      await db.runAsync(
        "INSERT INTO recipe_lines (id, recipe_id, name, qty, unit, position) VALUES (?, ?, ?, ?, ?, ?)",
        [generateId(), recipe.id, line.name, line.qty, line.unit, i]
      );
    }
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM recipe_lines WHERE recipe_id = ?", [id]);
    await db.runAsync("DELETE FROM recipes WHERE id = ?", [id]);
  });
}

export async function loadCatalog(): Promise<Map<string, Ingredient>> {
  const db = await getDb();
  const rows = await db.getAllAsync<IngredientRow>("SELECT * FROM ingredients");
  const map = new Map<string, Ingredient>();
  for (const row of rows) {
    map.set(row.key, {
      name: row.key,
      category: row.category as IngredientCategory,
      family: row.family as UnitFamily,
      shelfLifeDays: row.shelf_life_days,
      packSizes: row.pack_sizes ? row.pack_sizes.split(",").map(Number).filter((n) => n > 0) : [],
      staple: row.staple === 1,
    });
  }
  return map;
}

export async function saveIngredient(ingredient: Ingredient, displayName?: string): Promise<void> {
  const db = await getDb();
  const key = ingredientKey(ingredient.name);
  await db.runAsync(
    `INSERT INTO ingredients (key, name, category, family, shelf_life_days, pack_sizes, staple)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET name = excluded.name, category = excluded.category, family = excluded.family,
       shelf_life_days = excluded.shelf_life_days, pack_sizes = excluded.pack_sizes, staple = excluded.staple`,
    [
      key,
      displayName ?? ingredient.name,
      ingredient.category,
      ingredient.family,
      ingredient.shelfLifeDays,
      ingredient.packSizes.join(","),
      ingredient.staple ? 1 : 0,
    ]
  );
}

export async function setStaple(key: string, staple: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE ingredients SET staple = ? WHERE key = ?", [staple ? 1 : 0, key]);
}

function slotRowToSlot(row: SlotRow): Slot {
  const meal = row.meal as MealKind;
  if (row.kind === "cook" && row.recipe_id) {
    return { day: row.day, meal, kind: "cook", recipeId: row.recipe_id, servings: row.servings };
  }
  if (row.kind === "leftover" && row.recipe_id && row.source_day !== null && row.source_meal) {
    return {
      day: row.day,
      meal,
      kind: "leftover",
      recipeId: row.recipe_id,
      sourceDay: row.source_day,
      sourceMeal: row.source_meal as MealKind,
    };
  }
  return { day: row.day, meal, kind: "open" };
}

export type StoredWeek = {
  weekStart: string;
  seed: number;
  slots: Slot[];
  statuses: Record<string, SlotStatus>;
  minutes: Record<string, number>;
};

export async function loadWeek(weekStart: string): Promise<StoredWeek | null> {
  const db = await getDb();
  const week = await db.getFirstAsync<{ week_start: string; seed: number }>(
    "SELECT week_start, seed FROM weeks WHERE week_start = ?",
    [weekStart]
  );
  if (!week) return null;
  const rows = await db.getAllAsync<SlotRow>("SELECT * FROM slots WHERE week_start = ? ORDER BY day, meal", [weekStart]);
  const statuses: Record<string, SlotStatus> = {};
  const minutes: Record<string, number> = {};
  for (const row of rows) {
    statuses[row.day + "-" + row.meal] = row.status as SlotStatus;
    minutes[row.day + "-" + row.meal] = row.minutes;
  }
  return { weekStart, seed: week.seed, slots: rows.map(slotRowToSlot), statuses, minutes };
}

export async function saveWeek(
  weekStart: string,
  seed: number,
  slots: Slot[],
  minutesFor: (slot: Slot) => number,
  keepStatuses: Record<string, SlotStatus> = {}
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO weeks (week_start, seed, created_at) VALUES (?, ?, ?)
       ON CONFLICT(week_start) DO UPDATE SET seed = excluded.seed`,
      [weekStart, seed, new Date().toISOString()]
    );
    await db.runAsync("DELETE FROM slots WHERE week_start = ?", [weekStart]);
    for (const slot of slots) {
      const key = slot.day + "-" + slot.meal;
      await db.runAsync(
        `INSERT INTO slots (id, week_start, day, meal, kind, recipe_id, servings, source_day, source_meal, status, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          weekStart,
          slot.day,
          slot.meal,
          slot.kind,
          slot.kind === "open" ? null : slot.recipeId,
          slot.kind === "cook" ? slot.servings : 0,
          slot.kind === "leftover" ? slot.sourceDay : null,
          slot.kind === "leftover" ? slot.sourceMeal : null,
          keepStatuses[key] ?? "planned",
          minutesFor(slot),
        ]
      );
    }
  });
}

export async function setSlotStatus(weekStart: string, day: number, meal: MealKind, status: SlotStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE slots SET status = ? WHERE week_start = ? AND day = ? AND meal = ?", [
    status,
    weekStart,
    day,
    meal,
  ]);
}

export async function loadHistory(): Promise<SlotRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SlotRow>("SELECT * FROM slots ORDER BY week_start, day");
  return rows.map((row) => ({
    weekStart: row.week_start,
    day: row.day,
    meal: row.meal as MealKind,
    kind: row.kind as "cook" | "leftover" | "open",
    status: row.status as SlotStatus,
    recipeId: row.recipe_id,
    minutes: row.minutes,
  }));
}

export async function loadChecked(weekStart: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ item_key: string }>("SELECT item_key FROM shopping_checks WHERE week_start = ?", [
    weekStart,
  ]);
  return new Set(rows.map((r) => r.item_key));
}

export async function setChecked(weekStart: string, itemKey: string, checked: boolean): Promise<void> {
  const db = await getDb();
  if (checked) {
    await db.runAsync("INSERT OR IGNORE INTO shopping_checks (week_start, item_key) VALUES (?, ?)", [
      weekStart,
      itemKey,
    ]);
  } else {
    await db.runAsync("DELETE FROM shopping_checks WHERE week_start = ? AND item_key = ?", [weekStart, itemKey]);
  }
}

export async function loadSettingsRaw(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function saveSettingRaw(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM slots");
    await db.runAsync("DELETE FROM weeks");
    await db.runAsync("DELETE FROM shopping_checks");
  });
}
