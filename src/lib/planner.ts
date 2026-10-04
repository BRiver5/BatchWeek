// Композитор недели — главный движок приложения.
//
// Задача: разложить рецепты по слотам недели так, чтобы (а) продукты
// пересекались между блюдами и список покупок был короче, (б) скоропортящееся
// съедалось раньше, чем испортится, (в) будний вечер не превращался в
// полуторачасовую готовку, (г) одно и то же не ели три дня подряд, (д) часть
// слотов закрывалась остатками от сознательной готовки впрок.
//
// Это не фильтр по списку: цели конфликтуют (максимальное пересечение продуктов
// тянет к повторению одного и того же блюда, разнообразие — наоборот), поэтому
// решение ищется оптимизацией: взвешенная функция стоимости + жадное построение
// по маржинальному приросту + наискорейший спуск по окрестностям (замена слота,
// обмен двух слотов) + несколько рестартов с разными сидами. Сид фиксирован —
// одна и та же неделя при тех же данных собирается одинаково, "Rebuild" с новым
// сидом даёт честно другой вариант, а не случайный шум при каждом рендере.

import { toCanonical } from "./units.ts";
import { packFor } from "./packing.ts";
import {
  DEFAULT_INGREDIENT,
  ingredientKey,
  isWeekend,
  slotOrdinal,
  type Ingredient,
  type PlanConfig,
  type Recipe,
  type Slot,
} from "./model.ts";

export type ScoreParts = {
  ingredient: number;
  surplus: number;
  spoil: number;
  effort: number;
  repeat: number;
  tagAdjacency: number;
  uncovered: number;
};

export type PlanScore = { total: number; parts: ScoreParts };

export type IngredientNeed = {
  key: string;
  name: string;
  canonical: number;
  /** Дни недели (0..6), в которые продукт реально берут в руки. */
  days: number[];
};

/** Детерминированный ГПСЧ (xorshift32) — план воспроизводим по сиду. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

export function lookupIngredient(catalog: Map<string, Ingredient>, name: string): Ingredient {
  const key = ingredientKey(name);
  return catalog.get(key) ?? { name: key, ...DEFAULT_INGREDIENT };
}

/** Во сколько раз рецепт масштабируется под число порций в слоте. */
function scaleOf(recipe: Recipe, servings: number): number {
  return servings / Math.max(1, recipe.baseServings);
}

/**
 * Готовка впрок дороже обычной, но не пропорционально: нарезка и мытьё посуды
 * не удваиваются. 35% сверху за каждую лишнюю "порцию базового рецепта" —
 * именно из-за этой нелинейности батч вообще имеет смысл.
 */
export function cookMinutes(recipe: Recipe, servings: number): number {
  const scale = scaleOf(recipe, servings);
  return Math.round(recipe.activeMinutes * (1 + 0.35 * Math.max(0, scale - 1)));
}

export function collectNeeds(
  slots: Slot[],
  recipeById: Map<string, Recipe>,
  catalog: Map<string, Ingredient>
): Map<string, IngredientNeed> {
  const needs = new Map<string, IngredientNeed>();
  for (const slot of slots) {
    if (slot.kind !== "cook") continue;
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe) continue;
    const scale = scaleOf(recipe, slot.servings);
    for (const line of recipe.lines) {
      const info = lookupIngredient(catalog, line.name);
      if (info.staple) continue;
      const key = info.name;
      const canonical = toCanonical(line.qty, line.unit) * scale;
      const existing = needs.get(key);
      if (existing) {
        existing.canonical += canonical;
        if (!existing.days.includes(slot.day)) existing.days.push(slot.day);
      } else {
        needs.set(key, { key, name: line.name.trim(), canonical, days: [slot.day] });
      }
    }
  }
  for (const need of needs.values()) need.days.sort((a, b) => a - b);
  return needs;
}

/**
 * Стоимость плана. Чем меньше — тем лучше. Каждое слагаемое отдаётся наружу
 * отдельно: экран показывает пользователю, ИЗ ЧЕГО сложилась оценка, а не одно
 * загадочное число.
 */
export function scorePlan(
  slots: Slot[],
  recipeById: Map<string, Recipe>,
  catalog: Map<string, Ingredient>,
  config: PlanConfig,
  packCache?: Map<string, number>
): PlanScore {
  const w = config.weights;
  const needs = collectNeeds(slots, recipeById, catalog);

  let surplusRatio = 0;
  let spoil = 0;
  for (const need of needs.values()) {
    const info = lookupIngredient(catalog, need.key);
    if (info.packSizes.length > 0) {
      const cacheKey = need.key + ":" + Math.round(need.canonical);
      let surplus = packCache ? packCache.get(cacheKey) : undefined;
      if (surplus === undefined) {
        surplus = packFor(need.canonical, info.packSizes).surplus;
        if (packCache) packCache.set(cacheKey, surplus);
      }
      surplusRatio += surplus / Math.max(1, need.canonical);
    }
    const firstUse = need.days[0];
    for (const day of need.days) {
      const over = day - firstUse - info.shelfLifeDays;
      if (over > 0) spoil += over;
    }
  }

  const minutesPerDay = new Array(7).fill(0);
  for (const slot of slots) {
    if (slot.kind !== "cook") continue;
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe) continue;
    minutesPerDay[slot.day] += cookMinutes(recipe, slot.servings);
  }
  let effort = 0;
  for (let day = 0; day < 7; day++) {
    const budget = isWeekend(day) ? config.weekendMinutes : config.weekdayMinutes;
    effort += Math.max(0, minutesPerDay[day] - budget);
  }

  // Разнообразие: повтор рецепта считается только между ГОТОВКАМИ (доедать
  // остатки — это и есть смысл приложения, штрафовать их за "повтор" нельзя),
  // а соседство по ведущему продукту — между любыми съеденными слотами подряд.
  const cooks: { day: number; recipeId: string }[] = [];
  for (const slot of slots) {
    if (slot.kind === "cook") cooks.push({ day: slot.day, recipeId: slot.recipeId });
  }
  let repeat = 0;
  for (let i = 0; i < cooks.length; i++) {
    for (let j = i + 1; j < cooks.length; j++) {
      if (cooks[i].recipeId !== cooks[j].recipeId) continue;
      const gap = Math.abs(cooks[i].day - cooks[j].day);
      if (gap < config.minRepeatGap) repeat += config.minRepeatGap - gap;
    }
  }

  const eaten: { ordinal: number; tag: string }[] = [];
  for (const slot of slots) {
    if (slot.kind === "open") continue;
    eaten.push({
      ordinal: slotOrdinal(slot.day, slot.meal),
      tag: recipeById.get(slot.recipeId)?.tag ?? "",
    });
  }
  eaten.sort((a, b) => a.ordinal - b.ordinal);
  let tagAdjacency = 0;
  for (let i = 1; i < eaten.length; i++) {
    if (eaten[i].tag && eaten[i].tag === eaten[i - 1].tag) tagAdjacency += 1;
  }

  let uncovered = 0;
  for (const slot of slots) if (slot.kind === "open") uncovered += 1;

  const parts: ScoreParts = {
    ingredient: needs.size * w.ingredient,
    surplus: surplusRatio * w.surplus,
    spoil: spoil * w.spoil,
    effort: effort * w.effort,
    repeat: repeat * w.repeat,
    tagAdjacency: tagAdjacency * w.tagAdjacency,
    uncovered: uncovered * w.uncovered,
  };
  const total =
    parts.ingredient + parts.surplus + parts.spoil + parts.effort + parts.repeat + parts.tagAdjacency + parts.uncovered;
  return { total, parts };
}

function emptySlots(config: PlanConfig): Slot[] {
  return config.slots.map((s) => ({ day: s.day, meal: s.meal, kind: "open" as const }));
}

/** Остатки живут ограниченное время — и по рецепту, и по общему потолку. */
function leftoverAgeOk(ageDays: number, recipe: Recipe, config: PlanConfig): boolean {
  return ageDays >= 0 && ageDays <= Math.min(recipe.keepsDays, config.leftoverMaxAge);
}

/**
 * Все допустимые назначения для одного слота при текущем состоянии плана:
 * сварить любой из рецептов или доесть остатки от уже запланированной готовки.
 */
function candidatesFor(
  index: number,
  slots: Slot[],
  recipes: Recipe[],
  recipeById: Map<string, Recipe>,
  config: PlanConfig
): Slot[] {
  const target = slots[index];
  const out: Slot[] = [];
  for (const recipe of recipes) {
    out.push({
      day: target.day,
      meal: target.meal,
      kind: "cook",
      recipeId: recipe.id,
      servings: config.servingsPerMeal,
    });
  }
  if (!config.allowBatch) return out;

  const targetOrdinal = slotOrdinal(target.day, target.meal);
  for (let i = 0; i < slots.length; i++) {
    if (i === index) continue;
    const source = slots[i];
    if (source.kind !== "cook") continue;
    if (slotOrdinal(source.day, source.meal) >= targetOrdinal) continue;
    const recipe = recipeById.get(source.recipeId);
    if (!recipe) continue;
    if (!leftoverAgeOk(target.day - source.day, recipe, config)) continue;
    out.push({
      day: target.day,
      meal: target.meal,
      kind: "leftover",
      recipeId: source.recipeId,
      sourceDay: source.day,
      sourceMeal: source.meal,
    });
  }
  return out;
}

/**
 * Порции готовки всегда равны тому, что реально съедят: сам слот плюс все
 * остатки, которые на него ссылаются. Пересчитывается после каждого хода —
 * иначе кастрюля быстро расходится с планом.
 */
export function normalizeServings(slots: Slot[], config: PlanConfig): Slot[] {
  const fed = new Map<string, number>();
  for (const slot of slots) {
    if (slot.kind !== "leftover") continue;
    const key = slot.sourceDay + "-" + slot.sourceMeal;
    fed.set(key, (fed.get(key) ?? 0) + 1);
  }
  return slots.map((slot) => {
    if (slot.kind !== "cook") return slot;
    const extra = fed.get(slot.day + "-" + slot.meal) ?? 0;
    return { ...slot, servings: config.servingsPerMeal * (1 + extra) };
  });
}

/** Остатки, потерявшие свою готовку (её заменили) — снова пустые слоты. */
function dropOrphanLeftovers(slots: Slot[], recipeById: Map<string, Recipe>, config: PlanConfig): Slot[] {
  const cooks = new Map<string, Slot>();
  for (const slot of slots) {
    if (slot.kind === "cook") cooks.set(slot.day + "-" + slot.meal, slot);
  }
  return slots.map((slot) => {
    if (slot.kind !== "leftover") return slot;
    const source = cooks.get(slot.sourceDay + "-" + slot.sourceMeal);
    if (!source || source.kind !== "cook" || source.recipeId !== slot.recipeId) {
      return { day: slot.day, meal: slot.meal, kind: "open" as const };
    }
    const recipe = recipeById.get(source.recipeId);
    if (!recipe || !leftoverAgeOk(slot.day - slot.sourceDay, recipe, config)) {
      return { day: slot.day, meal: slot.meal, kind: "open" as const };
    }
    return slot;
  });
}

function settle(slots: Slot[], recipeById: Map<string, Recipe>, config: PlanConfig): Slot[] {
  return normalizeServings(dropOrphanLeftovers(slots, recipeById, config), config);
}

function construct(
  recipes: Recipe[],
  recipeById: Map<string, Recipe>,
  catalog: Map<string, Ingredient>,
  config: PlanConfig,
  rng: () => number,
  packCache: Map<string, number>
): Slot[] {
  let slots = emptySlots(config);
  const order = slots.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }

  for (const index of order) {
    let best: Slot[] | null = null;
    let bestScore = Infinity;
    for (const candidate of candidatesFor(index, slots, recipes, recipeById, config)) {
      const next = settle(
        slots.map((s, i) => (i === index ? candidate : s)),
        recipeById,
        config
      );
      const score = scorePlan(next, recipeById, catalog, config, packCache).total + rng() * 1e-6;
      if (score < bestScore) {
        bestScore = score;
        best = next;
      }
    }
    if (best) slots = best;
  }
  return slots;
}

function localSearch(
  slots: Slot[],
  recipes: Recipe[],
  recipeById: Map<string, Recipe>,
  catalog: Map<string, Ingredient>,
  config: PlanConfig,
  packCache: Map<string, number>,
  maxPasses = 10
): Slot[] {
  let current = slots;
  let currentScore = scorePlan(current, recipeById, catalog, config, packCache).total;

  for (let pass = 0; pass < maxPasses; pass++) {
    let bestPlan: Slot[] | null = null;
    let bestScore = currentScore - 1e-9;

    // Окрестность 1 — заменить назначение одного слота.
    for (let i = 0; i < current.length; i++) {
      for (const candidate of candidatesFor(i, current, recipes, recipeById, config)) {
        const next = settle(
          current.map((s, idx) => (idx === i ? candidate : s)),
          recipeById,
          config
        );
        const score = scorePlan(next, recipeById, catalog, config, packCache).total;
        if (score < bestScore) {
          bestScore = score;
          bestPlan = next;
        }
      }
    }

    // Окрестность 2 — поменять местами содержимое двух слотов: двигает тяжёлую
    // готовку на выходной, чего заменой одного слота не добиться.
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const b = current[j];
        if (a.kind === "leftover" || b.kind === "leftover") continue;
        if (a.kind === "open" && b.kind === "open") continue;
        const next = settle(
          current.map((s, idx) => {
            if (idx === i) return { ...b, day: a.day, meal: a.meal };
            if (idx === j) return { ...a, day: b.day, meal: b.meal };
            return s;
          }),
          recipeById,
          config
        );
        const score = scorePlan(next, recipeById, catalog, config, packCache).total;
        if (score < bestScore) {
          bestScore = score;
          bestPlan = next;
        }
      }
    }

    if (!bestPlan) break;
    current = bestPlan;
    currentScore = bestScore;
  }
  return current;
}

export type PlanResult = {
  slots: Slot[];
  score: PlanScore;
  seed: number;
};

/**
 * Собрать неделю. restarts — независимые прогоны "жадное построение + спуск" с
 * разными сидами: спуск застревает в локальном минимуме, рестарты из разных
 * стартовых точек вытаскивают из него заметно чаще, чем один длинный прогон.
 */
export function buildPlan(
  recipes: Recipe[],
  catalog: Map<string, Ingredient>,
  config: PlanConfig,
  seed = 1,
  restarts = 4
): PlanResult {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  if (recipes.length === 0 || config.slots.length === 0) {
    const slots = emptySlots(config);
    return { slots, score: scorePlan(slots, recipeById, catalog, config), seed };
  }

  const packCache = new Map<string, number>();
  let best: Slot[] | null = null;
  let bestScore = Infinity;

  for (let r = 0; r < restarts; r++) {
    const rng = makeRng(seed * 7919 + r * 104729);
    const constructed = construct(recipes, recipeById, catalog, config, rng, packCache);
    const improved = localSearch(constructed, recipes, recipeById, catalog, config, packCache);
    const score = scorePlan(improved, recipeById, catalog, config, packCache).total;
    if (score < bestScore) {
      bestScore = score;
      best = improved;
    }
  }

  const slots = best ?? emptySlots(config);
  return { slots, score: scorePlan(slots, recipeById, catalog, config, packCache), seed };
}

export type PlanExplanation = {
  activeMinutes: number;
  /** Сколько заняло бы, если бы каждый слот готовился отдельно. */
  minutesIfSeparate: number;
  minutesSaved: number;
  distinctIngredients: number;
  /** Сумма составов, как если бы блюда покупались независимо друг от друга. */
  ingredientsIfSeparate: number;
  cookCount: number;
  leftoverCount: number;
  openCount: number;
  overBudgetDays: number[];
  spoilRisks: { name: string; gapDays: number; shelfLifeDays: number }[];
  /** Сколько продуктов используется ровно в 1 / 2 / 3+ готовках. */
  reuse: { once: number; twice: number; more: number };
};

/** Человеческая расшифровка плана: то, что экран показывает словами и цифрами. */
export function explainPlan(
  slots: Slot[],
  recipes: Recipe[],
  catalog: Map<string, Ingredient>,
  config: PlanConfig
): PlanExplanation {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const needs = collectNeeds(slots, recipeById, catalog);

  let activeMinutes = 0;
  let minutesIfSeparate = 0;
  let ingredientsIfSeparate = 0;
  let cookCount = 0;
  let leftoverCount = 0;
  let openCount = 0;
  const minutesPerDay = new Array(7).fill(0);

  for (const slot of slots) {
    if (slot.kind === "open") {
      openCount += 1;
      continue;
    }
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe) continue;
    if (slot.kind === "cook") {
      cookCount += 1;
      const minutes = cookMinutes(recipe, slot.servings);
      activeMinutes += minutes;
      minutesPerDay[slot.day] += minutes;
    } else {
      leftoverCount += 1;
    }
    // "Как если бы готовили отдельно" — каждый съеденный слот варится сам по
    // себе на config.servingsPerMeal порций, со своим полным составом.
    minutesIfSeparate += cookMinutes(recipe, config.servingsPerMeal);
    for (const line of recipe.lines) {
      if (!lookupIngredient(catalog, line.name).staple) ingredientsIfSeparate += 1;
    }
  }

  const overBudgetDays: number[] = [];
  for (let day = 0; day < 7; day++) {
    const budget = isWeekend(day) ? config.weekendMinutes : config.weekdayMinutes;
    if (minutesPerDay[day] > budget) overBudgetDays.push(day);
  }

  const spoilRisks: PlanExplanation["spoilRisks"] = [];
  const reuse = { once: 0, twice: 0, more: 0 };
  for (const need of needs.values()) {
    const info = lookupIngredient(catalog, need.key);
    const gap = need.days[need.days.length - 1] - need.days[0];
    if (gap > info.shelfLifeDays) {
      spoilRisks.push({ name: need.name, gapDays: gap, shelfLifeDays: info.shelfLifeDays });
    }
    if (need.days.length === 1) reuse.once += 1;
    else if (need.days.length === 2) reuse.twice += 1;
    else reuse.more += 1;
  }
  spoilRisks.sort((a, b) => b.gapDays - b.shelfLifeDays - (a.gapDays - a.shelfLifeDays));

  return {
    activeMinutes,
    minutesIfSeparate,
    minutesSaved: Math.max(0, minutesIfSeparate - activeMinutes),
    distinctIngredients: needs.size,
    ingredientsIfSeparate,
    cookCount,
    leftoverCount,
    openCount,
    overBudgetDays,
    spoilRisks,
    reuse,
  };
}

/** Продукты, которые делят между собой несколько дней — нити ReuseWeave. */
export type WeaveThread = {
  key: string;
  name: string;
  days: number[];
  category: string;
};

export function weaveThreads(
  slots: Slot[],
  recipes: Recipe[],
  catalog: Map<string, Ingredient>,
  limit = 6
): WeaveThread[] {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const needs = collectNeeds(slots, recipeById, catalog);
  return [...needs.values()]
    .filter((need) => need.days.length > 1)
    .sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((need) => ({
      key: need.key,
      name: need.name,
      days: need.days,
      category: lookupIngredient(catalog, need.key).category,
    }));
}
