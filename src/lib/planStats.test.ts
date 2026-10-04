import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cookingHeatmap,
  findEffortThreshold,
  followThrough,
  leftoverPayoff,
  minutesByWeekday,
  recipeReliability,
  weekBreakdowns,
  wilson,
  type SlotRecord,
} from "./planStats.ts";

function record(over: Partial<SlotRecord> = {}): SlotRecord {
  return {
    weekStart: "2026-09-28",
    day: 0,
    meal: "dinner",
    kind: "cook",
    status: "cooked",
    recipeId: "a",
    minutes: 30,
    ...over,
  };
}

test("интервал Уилсона не вылезает за границы и не схлопывается на малой выборке", () => {
  const none = wilson(0, 0);
  assert.deepEqual(none, { low: 0, high: 1, rate: 0, n: 0 });

  const perfect = wilson(3, 3);
  assert.equal(perfect.rate, 1);
  assert.ok(perfect.low < 1, "три из трёх — это ещё не доказанные 100%");
  assert.equal(perfect.high, 1);

  const wide = wilson(1, 2);
  const narrow = wilson(50, 100);
  assert.ok(wide.high - wide.low > narrow.high - narrow.low, "больше данных — уже интервал");
});

test("порог усилия не объявляется, пока данных мало", () => {
  const few = Array.from({ length: 6 }, () => record());
  const verdict = findEffortThreshold(few);
  assert.equal(verdict.kind, "insufficientData");
  if (verdict.kind === "insufficientData") assert.ok(verdict.needed > verdict.n);
});

test("порог усилия не объявляется, когда стороны неразличимы", () => {
  const mixed: SlotRecord[] = [];
  for (let i = 0; i < 20; i++) {
    mixed.push(record({ minutes: i % 2 === 0 ? 20 : 60, status: i % 3 === 0 ? "skipped" : "cooked" }));
  }
  const verdict = findEffortThreshold(mixed);
  assert.equal(verdict.kind, "notSeparated");
});

test("порог усилия находится там, где тяжёлые слоты реально срываются", () => {
  const records: SlotRecord[] = [];
  for (let i = 0; i < 14; i++) records.push(record({ minutes: 20, status: "cooked" }));
  for (let i = 0; i < 14; i++) records.push(record({ minutes: 70, status: "skipped" }));
  const verdict = findEffortThreshold(records);
  assert.equal(verdict.kind, "found");
  if (verdict.kind === "found") {
    assert.equal(verdict.minutes, 20);
    assert.ok(verdict.lightRate > verdict.heavyRate);
    assert.equal(verdict.lightN, 14);
    assert.equal(verdict.heavyN, 14);
  }
});

test("незакрытые ещё слоты не считаются ни успехом, ни срывом", () => {
  const records = [
    record({ status: "cooked" }),
    record({ status: "skipped" }),
    record({ status: "planned" }),
    record({ kind: "open", status: "planned", recipeId: null }),
  ];
  const result = followThrough(records);
  assert.equal(result.cooked, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.rate, 0.5);
  assert.equal(result.planned, 3, "три слота были запланированы, четвёртый пустой");
});

test("разбивка по неделям разделяет готовку, остатки и срывы", () => {
  const records = [
    record({ weekStart: "2026-09-21", kind: "cook", status: "cooked" }),
    record({ weekStart: "2026-09-21", kind: "leftover", status: "cooked", minutes: 0 }),
    record({ weekStart: "2026-09-21", kind: "cook", status: "skipped" }),
    record({ weekStart: "2026-09-28", kind: "cook", status: "cooked" }),
  ];
  const weeks = weekBreakdowns(records);
  assert.equal(weeks.length, 2);
  assert.deepEqual(weeks[0], { weekStart: "2026-09-21", cooked: 1, leftovers: 1, skipped: 1 });
  assert.deepEqual(weeks[1], { weekStart: "2026-09-28", cooked: 1, leftovers: 0, skipped: 0 });
});

test("минуты по дням недели учитывают только реально приготовленное", () => {
  const records = [
    record({ day: 0, minutes: 30, status: "cooked" }),
    record({ day: 0, minutes: 20, status: "skipped" }),
    record({ day: 6, minutes: 55, status: "cooked" }),
    record({ day: 6, kind: "leftover", minutes: 0, status: "cooked" }),
  ];
  assert.deepEqual(minutesByWeekday(records), [30, 0, 0, 0, 0, 0, 55]);
});

test("экономия от остатков считается только по съеденным остаткам", () => {
  const records = [
    record({ kind: "leftover", status: "cooked", minutes: 0 }),
    record({ kind: "leftover", status: "skipped", minutes: 0 }),
    record({ kind: "cook", status: "cooked" }),
  ];
  assert.equal(leftoverPayoff(records, 35), 35);
});

test("heatmap покрывает все дни запрошенных недель и нормируется на максимум", () => {
  const records = [
    record({ weekStart: "2026-09-28", day: 2, minutes: 60, status: "cooked" }),
    record({ weekStart: "2026-09-28", day: 3, minutes: 30, status: "cooked" }),
  ];
  const cells = cookingHeatmap(records, ["2026-09-21", "2026-09-28"]);
  assert.equal(cells.length, 14);
  const hot = cells.find((c) => c.key === "2026-09-28:2");
  const warm = cells.find((c) => c.key === "2026-09-28:3");
  assert.equal(hot?.intensity, 1);
  assert.equal(warm?.intensity, 0.5);
  assert.ok(cells.filter((c) => c.intensity === 0).length === 12);
});

test("надёжность рецепта считается только при достаточном числе попыток", () => {
  const records = [
    record({ recipeId: "often", status: "cooked" }),
    record({ recipeId: "often", status: "cooked" }),
    record({ recipeId: "often", status: "skipped" }),
    record({ recipeId: "rare", status: "cooked" }),
  ];
  const rows = recipeReliability(records);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipeId, "often");
  assert.ok(Math.abs(rows[0].rate - 2 / 3) < 1e-9);
});
