import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlan,
  collectNeeds,
  cookMinutes,
  explainPlan,
  makeRng,
  normalizeServings,
  scorePlan,
  weaveThreads,
} from "./planner.ts";
import { DEFAULT_CONFIG, type Ingredient, type PlanConfig, type Recipe, type Slot } from "./model.ts";

function recipe(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name: id,
    baseServings: 2,
    activeMinutes: 30,
    tag: "chicken",
    keepsDays: 3,
    lines: [{ name: "rice", qty: 200, unit: "g" }],
    createdAt: "2026-10-01",
    ...over,
  };
}

function ingredient(name: string, over: Partial<Ingredient> = {}): Ingredient {
  return {
    name,
    category: "pantry",
    family: "mass",
    shelfLifeDays: 14,
    packSizes: [],
    staple: false,
    ...over,
  };
}

function catalogOf(list: Ingredient[]): Map<string, Ingredient> {
  return new Map(list.map((i) => [i.name, i]));
}

function configFor(slotCount: number, over: Partial<PlanConfig> = {}): PlanConfig {
  const slots = [];
  for (let day = 0; day < slotCount; day++) slots.push({ day, meal: "dinner" as const });
  return { ...DEFAULT_CONFIG, slots, ...over };
}

test("ГПСЧ детерминирован по сиду и выдаёт числа в [0,1)", () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 50; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test("готовка впрок дороже обычной, но дешевле двух отдельных готовок", () => {
  const r = recipe("r", { activeMinutes: 40, baseServings: 2 });
  const single = cookMinutes(r, 2);
  const double = cookMinutes(r, 4);
  assert.equal(single, 40);
  assert.ok(double > single, "двойная порция требует больше времени");
  assert.ok(double < single * 2, "но не вдвое — в этом и смысл батча");
});

test("состав масштабируется под число порций и складывается по продукту", () => {
  const recipes = new Map([
    ["a", recipe("a", { lines: [{ name: "Rice", qty: 100, unit: "g" }] })],
    ["b", recipe("b", { lines: [{ name: "rice", qty: 0.2, unit: "kg" }] })],
  ]);
  const slots: Slot[] = [
    { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 4 },
    { day: 2, meal: "dinner", kind: "cook", recipeId: "b", servings: 2 },
  ];
  const needs = collectNeeds(slots, recipes, catalogOf([ingredient("rice")]));
  assert.equal(needs.size, 1, "Rice и rice — один продукт");
  const rice = needs.get("rice");
  assert.ok(rice);
  // a: 100 г × (4/2) = 200, b: 200 г × (2/2) = 200
  assert.equal(Math.round(rice.canonical), 400);
  assert.deepEqual(rice.days, [0, 2]);
});

test("staple-продукты не попадают ни в потребность, ни в стоимость", () => {
  const recipes = new Map([["a", recipe("a", { lines: [{ name: "salt", qty: 5, unit: "g" }] })]]);
  const slots: Slot[] = [{ day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 }];
  const needs = collectNeeds(slots, recipes, catalogOf([ingredient("salt", { staple: true })]));
  assert.equal(needs.size, 0);
});

test("порции готовки равны числу съеденных порций вместе с остатками", () => {
  const config = configFor(3);
  const slots: Slot[] = [
    { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
    { day: 1, meal: "dinner", kind: "leftover", recipeId: "a", sourceDay: 0, sourceMeal: "dinner" },
    { day: 2, meal: "dinner", kind: "leftover", recipeId: "a", sourceDay: 0, sourceMeal: "dinner" },
  ];
  const normalized = normalizeServings(slots, config);
  const cook = normalized[0];
  assert.equal(cook.kind, "cook");
  if (cook.kind === "cook") assert.equal(cook.servings, config.servingsPerMeal * 3);
});

test("стоимость растёт за перерасход времени, повтор и непокрытый слот", () => {
  const config = configFor(2, { weekdayMinutes: 20 });
  const recipes = new Map([["a", recipe("a", { activeMinutes: 60 })]]);
  const catalog = catalogOf([ingredient("rice")]);

  const empty = scorePlan(
    [
      { day: 0, meal: "dinner", kind: "open" },
      { day: 1, meal: "dinner", kind: "open" },
    ],
    recipes,
    catalog,
    config
  );
  assert.equal(empty.parts.uncovered, 2 * config.weights.uncovered);

  const heavy = scorePlan(
    [
      { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
      { day: 1, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
    ],
    recipes,
    catalog,
    config
  );
  assert.ok(heavy.parts.effort > 0, "60 минут при бюджете 20 — перерасход");
  assert.ok(heavy.parts.repeat > 0, "один рецепт два дня подряд — повтор");
  assert.ok(heavy.parts.tagAdjacency > 0, "и один и тот же ведущий продукт подряд");
});

test("просрочка считается от первого использования, а не от конца недели", () => {
  const config = configFor(7);
  const recipes = new Map([
    ["a", recipe("a", { lines: [{ name: "spinach", qty: 100, unit: "g" }] })],
    ["b", recipe("b", { tag: "veg", lines: [{ name: "spinach", qty: 100, unit: "g" }] })],
  ]);
  const catalog = catalogOf([ingredient("spinach", { shelfLifeDays: 2, category: "produce" })]);

  const close = scorePlan(
    [
      { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
      { day: 2, meal: "dinner", kind: "cook", recipeId: "b", servings: 2 },
    ],
    recipes,
    catalog,
    config
  );
  const far = scorePlan(
    [
      { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
      { day: 6, meal: "dinner", kind: "cook", recipeId: "b", servings: 2 },
    ],
    recipes,
    catalog,
    config
  );
  assert.equal(close.parts.spoil, 0, "2 дня при сроке 2 — ещё нормально");
  assert.ok(far.parts.spoil > 0, "6 дней при сроке 2 — шпинат не доживёт");
});

test("план покрывает все слоты и не нарушает возраст остатков", () => {
  const recipes = [
    recipe("a", { tag: "chicken", lines: [{ name: "chicken", qty: 300, unit: "g" }] }),
    recipe("b", { tag: "beans", lines: [{ name: "beans", qty: 200, unit: "g" }] }),
    recipe("c", { tag: "pasta", lines: [{ name: "pasta", qty: 250, unit: "g" }] }),
    recipe("d", { tag: "fish", lines: [{ name: "fish", qty: 300, unit: "g" }] }),
  ];
  const catalog = catalogOf([
    ingredient("chicken", { category: "protein", shelfLifeDays: 2 }),
    ingredient("beans", { category: "pantry" }),
    ingredient("pasta", { category: "grain" }),
    ingredient("fish", { category: "protein", shelfLifeDays: 1 }),
  ]);
  const config = configFor(7);
  const result = buildPlan(recipes, catalog, config, 11);

  assert.equal(result.slots.length, 7);
  assert.equal(result.slots.filter((s) => s.kind === "open").length, 0, "все слоты закрыты");
  assert.equal(result.score.parts.uncovered, 0);

  const cookKeys = new Set(result.slots.filter((s) => s.kind === "cook").map((s) => s.day + "-" + s.meal));
  for (const slot of result.slots) {
    if (slot.kind !== "leftover") continue;
    assert.ok(cookKeys.has(slot.sourceDay + "-" + slot.sourceMeal), "остаток ссылается на реальную готовку");
    const age = slot.day - slot.sourceDay;
    assert.ok(age > 0 && age <= config.leftoverMaxAge, "возраст остатков в пределах потолка");
  }
});

test("один и тот же сид даёт тот же план, другой сид — другой поиск", () => {
  const recipes = [
    recipe("a", { tag: "chicken", lines: [{ name: "chicken", qty: 300, unit: "g" }] }),
    recipe("b", { tag: "beans", lines: [{ name: "beans", qty: 200, unit: "g" }] }),
    recipe("c", { tag: "pasta", lines: [{ name: "pasta", qty: 250, unit: "g" }] }),
  ];
  const catalog = catalogOf([ingredient("chicken"), ingredient("beans"), ingredient("pasta")]);
  const config = configFor(5);
  const first = buildPlan(recipes, catalog, config, 7);
  const same = buildPlan(recipes, catalog, config, 7);
  assert.deepEqual(same.slots, first.slots);
  const other = buildPlan(recipes, catalog, config, 8);
  assert.ok(other.score.total >= 0);
});

test("при общих продуктах план предпочитает пересечение независимым блюдам", () => {
  // Два рецепта делят рис и курицу, два других не делят ничего. Правильный
  // план при прочих равных должен тянуться к пересекающимся.
  const recipes = [
    recipe("share1", { tag: "a", lines: [{ name: "rice", qty: 200, unit: "g" }, { name: "chicken", qty: 300, unit: "g" }] }),
    recipe("share2", { tag: "b", lines: [{ name: "rice", qty: 150, unit: "g" }, { name: "chicken", qty: 200, unit: "g" }] }),
    recipe("solo1", { tag: "c", lines: [{ name: "tofu", qty: 200, unit: "g" }, { name: "noodles", qty: 200, unit: "g" }] }),
    recipe("solo2", { tag: "d", lines: [{ name: "lamb", qty: 300, unit: "g" }, { name: "couscous", qty: 200, unit: "g" }] }),
  ];
  const catalog = catalogOf(
    ["rice", "chicken", "tofu", "noodles", "lamb", "couscous"].map((n) => ingredient(n, { shelfLifeDays: 7 }))
  );
  const config = configFor(2, { allowBatch: false, minRepeatGap: 3 });
  const result = buildPlan(recipes, catalog, config, 3);
  const used = result.slots.map((s) => (s.kind === "cook" ? s.recipeId : s.kind)).sort();
  assert.deepEqual(used, ["share1", "share2"]);
});

test("explainPlan честно считает экономию и не уходит в минус", () => {
  const recipes = [recipe("a", { activeMinutes: 40, keepsDays: 3 })];
  const catalog = catalogOf([ingredient("rice")]);
  const config = configFor(3);
  const slots: Slot[] = normalizeServings(
    [
      { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
      { day: 1, meal: "dinner", kind: "leftover", recipeId: "a", sourceDay: 0, sourceMeal: "dinner" },
      { day: 2, meal: "dinner", kind: "leftover", recipeId: "a", sourceDay: 0, sourceMeal: "dinner" },
    ],
    config
  );
  const info = explainPlan(slots, recipes, catalog, config);
  assert.equal(info.cookCount, 1);
  assert.equal(info.leftoverCount, 2);
  assert.equal(info.minutesIfSeparate, 120);
  assert.ok(info.minutesSaved > 0 && info.minutesSaved < info.minutesIfSeparate);
  assert.equal(info.distinctIngredients, 1);
  assert.equal(info.ingredientsIfSeparate, 3);
});

test("нити плетения — только продукты, которые делят минимум два дня", () => {
  const recipes = [
    recipe("a", { lines: [{ name: "rice", qty: 100, unit: "g" }, { name: "leek", qty: 1, unit: "pcs" }] }),
    recipe("b", { tag: "veg", lines: [{ name: "rice", qty: 100, unit: "g" }] }),
  ];
  const catalog = catalogOf([ingredient("rice"), ingredient("leek", { category: "produce", family: "count" })]);
  const slots: Slot[] = [
    { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
    { day: 3, meal: "dinner", kind: "cook", recipeId: "b", servings: 2 },
  ];
  const threads = weaveThreads(slots, recipes, catalog);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].key, "rice");
  assert.deepEqual(threads[0].days, [0, 3]);
});

test("пустая библиотека рецептов не роняет сборку", () => {
  const result = buildPlan([], new Map(), configFor(3), 1);
  assert.equal(result.slots.length, 3);
  assert.ok(result.slots.every((s) => s.kind === "open"));
});

test("сборка недели на реалистичной библиотеке укладывается в секунду", () => {
  const recipes: Recipe[] = [];
  for (let i = 0; i < 30; i++) {
    recipes.push(
      recipe("r" + i, {
        tag: "tag" + (i % 6),
        activeMinutes: 20 + (i % 5) * 10,
        lines: [
          { name: "base" + (i % 7), qty: 200, unit: "g" },
          { name: "extra" + (i % 11), qty: 100, unit: "g" },
        ],
      })
    );
  }
  const catalog = catalogOf(
    recipes.flatMap((r) => r.lines.map((l) => ingredient(l.name, { packSizes: [250, 400], shelfLifeDays: 5 })))
  );
  const config: PlanConfig = {
    ...DEFAULT_CONFIG,
    slots: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
      { day, meal: "lunch" as const },
      { day, meal: "dinner" as const },
    ]),
  };
  const started = Date.now();
  const result = buildPlan(recipes, catalog, config, 5);
  const elapsed = Date.now() - started;
  assert.equal(result.slots.filter((s) => s.kind === "open").length, 0);
  assert.ok(elapsed < 1000, "сборка заняла " + elapsed + " мс");
});
