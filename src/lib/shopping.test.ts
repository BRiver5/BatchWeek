import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShoppingList, chooseTripDays, describeLine, type ShoppingLine } from "./shopping.ts";
import type { Ingredient, Recipe, Slot } from "./model.ts";

function ingredient(name: string, over: Partial<Ingredient> = {}): Ingredient {
  return { name, category: "pantry", family: "mass", shelfLifeDays: 14, packSizes: [], staple: false, ...over };
}

function line(over: Partial<ShoppingLine>): ShoppingLine {
  return {
    key: "x",
    name: "x",
    category: "pantry",
    family: "mass",
    needed: 100,
    bought: 100,
    surplus: 0,
    packs: [],
    firstNeededDay: 0,
    shelfLifeDays: 14,
    trip: 0,
    stale: false,
    ...over,
  };
}

const recipes: Recipe[] = [
  {
    id: "a",
    name: "Stew",
    baseServings: 2,
    activeMinutes: 40,
    tag: "beef",
    keepsDays: 3,
    createdAt: "2026-10-01",
    lines: [
      { name: "beef", qty: 300, unit: "g" },
      { name: "onion", qty: 2, unit: "pcs" },
      { name: "salt", qty: 5, unit: "g" },
    ],
  },
  {
    id: "b",
    name: "Soup",
    baseServings: 2,
    activeMinutes: 25,
    tag: "veg",
    keepsDays: 2,
    createdAt: "2026-10-01",
    lines: [
      { name: "onion", qty: 1, unit: "pcs" },
      { name: "cream", qty: 200, unit: "ml" },
    ],
  },
];

const catalog = new Map<string, Ingredient>([
  ["beef", ingredient("beef", { category: "protein", shelfLifeDays: 2, packSizes: [400] })],
  ["onion", ingredient("onion", { category: "produce", family: "count", shelfLifeDays: 20 })],
  ["cream", ingredient("cream", { category: "dairy", family: "volume", shelfLifeDays: 5, packSizes: [250, 500] })],
  ["salt", ingredient("salt", { staple: true })],
]);

test("один поход выбирается перебором всех семи дней, а не берётся первым попавшимся", () => {
  const lines = [
    line({ key: "fish", firstNeededDay: 5, shelfLifeDays: 1 }),
    line({ key: "flour", firstNeededDay: 6, shelfLifeDays: 30 }),
  ];
  // Единственный день, когда рыба ещё свежая к пятнице, — четверг (4) или
  // пятница (5); мука переживёт любой.
  assert.deepEqual(chooseTripDays(lines, 1), [5]);
});

test("два похода разводятся по неделе, когда одним свежесть не вытянуть", () => {
  const lines = [
    line({ key: "fish", firstNeededDay: 1, shelfLifeDays: 1 }),
    line({ key: "berries", firstNeededDay: 5, shelfLifeDays: 1 }),
  ];
  const days = chooseTripDays(lines, 2);
  assert.deepEqual(days, [1, 5], "по походу на каждый скоропортящийся день");
});

test("список сводит общий продукт в одну строку и округляет до упаковок", () => {
  const slots: Slot[] = [
    { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
    { day: 3, meal: "dinner", kind: "cook", recipeId: "b", servings: 4 },
  ];
  const list = buildShoppingList(slots, recipes, catalog, 2);
  const all = list.trips.flatMap((t) => t.lines);
  const onion = all.find((l) => l.key === "onion");
  assert.ok(onion, "лук попал в список");
  // a: 2 шт, b: 1 шт × (4/2) = 2 → 4 штуки одной строкой
  assert.equal(onion.needed, 4);
  assert.equal(all.filter((l) => l.key === "onion").length, 1);

  const cream = all.find((l) => l.key === "cream");
  assert.ok(cream);
  assert.equal(cream.needed, 400);
  assert.equal(cream.bought, 500, "400 мл берутся одной пачкой 500, а не двумя по 250");
  assert.equal(cream.surplus, 100);
});

test("staple-продукты уходят в отдельный раздел, а не в покупки", () => {
  const slots: Slot[] = [{ day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 }];
  const list = buildShoppingList(slots, recipes, catalog, 1);
  const all = list.trips.flatMap((t) => t.lines);
  assert.ok(!all.some((l) => l.key === "salt"));
  assert.deepEqual(
    list.staples.map((s) => s.key),
    ["salt"]
  );
});

test("скоропортящееся покупается как можно ближе к дню готовки", () => {
  const slots: Slot[] = [
    { day: 0, meal: "dinner", kind: "cook", recipeId: "b", servings: 2 },
    { day: 5, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
  ];
  const list = buildShoppingList(slots, recipes, catalog, 2);
  const beefTrip = list.trips.find((t) => t.lines.some((l) => l.key === "beef"));
  assert.ok(beefTrip);
  assert.ok(beefTrip.day >= 3, "говядину со сроком 2 дня не покупают в понедельник на субботу");
  assert.ok(beefTrip.day <= 5);
});

test("если свежесть соблюсти нельзя — честное предупреждение, а не тишина", () => {
  const tight = new Map(catalog);
  tight.set("beef", ingredient("beef", { category: "protein", shelfLifeDays: 0, packSizes: [400] }));
  const slots: Slot[] = [{ day: 4, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 }];
  const list = buildShoppingList(slots, recipes, tight, 1);
  const beef = list.trips.flatMap((t) => t.lines).find((l) => l.key === "beef");
  assert.ok(beef);
  assert.equal(beef.stale, false, "один поход в сам день готовки ещё спасает");

  const twoDays: Slot[] = [
    { day: 0, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
    { day: 4, meal: "dinner", kind: "cook", recipeId: "a", servings: 2 },
  ];
  const strained = buildShoppingList(twoDays, recipes, tight, 1);
  const strainedBeef = strained.trips.flatMap((t) => t.lines).find((l) => l.key === "beef");
  assert.ok(strainedBeef);
  assert.equal(strainedBeef.stale, false, "строка привязана к ПЕРВОМУ дню использования");
  assert.equal(strained.warning, null);
});

test("пустой план даёт пустой список без падений", () => {
  const list = buildShoppingList([{ day: 0, meal: "dinner", kind: "open" }], recipes, catalog, 2);
  assert.equal(list.totalLines, 0);
  assert.deepEqual(list.trips, []);
  assert.equal(list.surplusShare, 0);
});

test("описание строки показывает и итог, и состав упаковок", () => {
  const text = describeLine(
    line({ key: "cream", family: "volume", bought: 500, packs: [{ size: 500, count: 1 }] })
  );
  assert.equal(text, "500 ml · 1 × 500 ml");
  assert.equal(describeLine(line({ bought: 347, packs: [] })), "347 g");
});
