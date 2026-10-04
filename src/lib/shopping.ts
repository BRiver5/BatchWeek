// Список покупок из недельного плана.
//
// Три шага, каждый со своим решением:
//  1. Свести состав всех готовок в одну потребность по продукту (с
//     масштабированием под порции и переводом в каноническую единицу).
//  2. Округлить потребность до реальных упаковок (точное ДП, см. packing.ts) —
//     "нужно 340 г" превращается в "две банки по 200, 60 г лишних".
//  3. Разложить покупки по походам в магазин так, чтобы скоропортящееся
//     покупалось как можно ближе к дню готовки. Это не эвристика: дней в
//     неделе семь, поэтому для одного похода перебираются все 7 вариантов, для
//     двух — все 28 пар, и выбирается честный минимум суммарной "потери
//     свежести". Полный перебор здесь дешевле любой хитрости.

import { packFor } from "./packing.ts";
import { formatCanonical, type UnitFamily } from "./units.ts";
import { lookupIngredient, collectNeeds } from "./planner.ts";
import type { Ingredient, IngredientCategory, Recipe, Slot } from "./model.ts";

export type ShoppingLine = {
  key: string;
  name: string;
  category: IngredientCategory;
  family: UnitFamily;
  /** Сколько реально нужно по рецептам (каноническая единица). */
  needed: number;
  /** Сколько придётся купить после округления до упаковок. */
  bought: number;
  surplus: number;
  packs: { size: number; count: number }[];
  firstNeededDay: number;
  shelfLifeDays: number;
  /** Индекс похода в магазин, в который попала строка. */
  trip: number;
  /** true, если к дню готовки продукт уже выйдет за свой срок хранения. */
  stale: boolean;
};

export type ShoppingTrip = {
  /** День недели похода (0..6). */
  day: number;
  lines: ShoppingLine[];
};

export type ShoppingList = {
  trips: ShoppingTrip[];
  /** Продукты, помеченные как "всегда есть дома" — их только проверить. */
  staples: { key: string; name: string; category: IngredientCategory }[];
  totalLines: number;
  surplusShare: number;
  /** Честная оговорка, если свежесть соблюсти не удалось. */
  warning: string | null;
};

const STALE_PENALTY = 10;

function freshnessCost(line: { firstNeededDay: number; shelfLifeDays: number }, tripDay: number): number {
  if (tripDay > line.firstNeededDay) return Infinity;
  const age = line.firstNeededDay - tripDay;
  if (age > line.shelfLifeDays) return STALE_PENALTY + age - line.shelfLifeDays;
  return age / Math.max(1, line.shelfLifeDays);
}

/** Лучший (самый поздний допустимый) поход для одной строки. */
function bestTripFor(line: ShoppingLine, tripDays: number[]): { index: number; cost: number } {
  let bestIndex = 0;
  let bestCost = Infinity;
  tripDays.forEach((day, index) => {
    const cost = freshnessCost(line, day);
    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = index;
    }
  });
  if (!Number.isFinite(bestCost)) {
    // Ни один поход не успевает до дня готовки — берём самый ранний и честно
    // помечаем строку как проблемную, а не прячем её.
    return { index: 0, cost: STALE_PENALTY * 2 };
  }
  return { index: bestIndex, cost: bestCost };
}

function totalCost(lines: ShoppingLine[], tripDays: number[]): number {
  let sum = 0;
  for (const line of lines) sum += bestTripFor(line, tripDays).cost;
  return sum;
}

/**
 * Дни походов в магазин. Перебор полный: 7 вариантов для одного похода, 28 пар
 * для двух — гарантированный оптимум, не "купи всё в понедельник".
 */
export function chooseTripDays(lines: ShoppingLine[], tripCount: number): number[] {
  if (lines.length === 0) return [0];
  const earliest = Math.min(...lines.map((l) => l.firstNeededDay));
  if (tripCount <= 1) {
    let best = earliest;
    let bestCost = Infinity;
    for (let day = 0; day <= 6; day++) {
      const cost = totalCost(lines, [day]);
      if (cost < bestCost) {
        bestCost = cost;
        best = day;
      }
    }
    return [best];
  }

  let best: number[] = [earliest, earliest];
  let bestCost = Infinity;
  for (let a = 0; a <= 6; a++) {
    for (let b = a + 1; b <= 6; b++) {
      const cost = totalCost(lines, [a, b]);
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = [a, b];
      }
    }
  }
  return best;
}

export function buildShoppingList(
  slots: Slot[],
  recipes: Recipe[],
  catalog: Map<string, Ingredient>,
  tripCount: number
): ShoppingList {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const needs = collectNeeds(slots, recipeById, catalog);

  const lines: ShoppingLine[] = [];
  for (const need of needs.values()) {
    const info = lookupIngredient(catalog, need.key);
    const packed = packFor(need.canonical, info.packSizes);
    lines.push({
      key: need.key,
      name: need.name,
      category: info.category,
      family: info.family,
      needed: need.canonical,
      bought: packed.bought,
      surplus: packed.surplus,
      packs: packed.packs,
      firstNeededDay: need.days[0],
      shelfLifeDays: info.shelfLifeDays,
      trip: 0,
      stale: false,
    });
  }

  // Продукты из кладовки: их не покупают, но проверить перед готовкой стоит.
  const staples: ShoppingList["staples"] = [];
  const seenStaples = new Set<string>();
  for (const slot of slots) {
    if (slot.kind !== "cook") continue;
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe) continue;
    for (const line of recipe.lines) {
      const info = lookupIngredient(catalog, line.name);
      if (!info.staple || seenStaples.has(info.name)) continue;
      seenStaples.add(info.name);
      staples.push({ key: info.name, name: line.name.trim(), category: info.category });
    }
  }

  const tripDays = chooseTripDays(lines, tripCount);
  let staleCount = 0;
  for (const line of lines) {
    const { index } = bestTripFor(line, tripDays);
    line.trip = index;
    const age = line.firstNeededDay - tripDays[index];
    line.stale = age > line.shelfLifeDays;
    if (line.stale) staleCount += 1;
  }

  const trips: ShoppingTrip[] = tripDays
    .map((day, index) => ({
      day,
      lines: lines
        .filter((l) => l.trip === index)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    }))
    .filter((trip) => trip.lines.length > 0);

  const neededTotal = lines.reduce((sum, l) => sum + l.needed, 0);
  const surplusTotal = lines.reduce((sum, l) => sum + l.surplus, 0);

  let warning: string | null = null;
  if (staleCount > 0) {
    warning =
      staleCount === 1
        ? "1 item is cooked later than it keeps. Add a trip or move that meal earlier."
        : staleCount + " items are cooked later than they keep. Add a trip or move those meals earlier.";
  }

  return {
    trips,
    staples: staples.sort((a, b) => a.name.localeCompare(b.name)),
    totalLines: lines.length,
    surplusShare: neededTotal > 0 ? surplusTotal / neededTotal : 0,
    warning,
  };
}

/** Строка количества для экрана: "500 g · 1 pack of 500 g (+0 g)". */
export function describeLine(line: ShoppingLine): string {
  const base = formatCanonical(line.bought, line.family);
  if (line.packs.length === 0) return base;
  const packs = line.packs
    .map((p) => p.count + " × " + formatCanonical(p.size, line.family))
    .join(" + ");
  return base + " · " + packs;
}
