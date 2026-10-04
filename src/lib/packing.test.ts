import { test } from "node:test";
import assert from "node:assert/strict";
import { packFor } from "./packing.ts";

test("точное попадание без излишка", () => {
  const r = packFor(1000, [500]);
  assert.equal(r.bought, 1000);
  assert.equal(r.surplus, 0);
  assert.deepEqual(r.packs, [{ size: 500, count: 2 }]);
});

test("ДП обыгрывает жадный выбор там, где большая упаковка ведёт в тупик", () => {
  // Жадный: 500 + 400 = 900 (излишек 300). Оптимум: 400 + 400 = 800 (излишек 200).
  const r = packFor(600, [500, 400]);
  assert.equal(r.bought, 800);
  assert.equal(r.surplus, 200);
  assert.equal(r.approximate, false);
});

test("при равном излишке берётся меньшее число упаковок", () => {
  const r = packFor(400, [200, 400]);
  assert.equal(r.surplus, 0);
  assert.deepEqual(r.packs, [{ size: 400, count: 1 }]);
});

test("потребность всегда покрыта, излишек неотрицателен", () => {
  for (const need of [1, 37, 350, 999, 2501]) {
    const r = packFor(need, [250, 400, 1000]);
    assert.ok(r.bought >= need, `need=${need} bought=${r.bought}`);
    assert.ok(r.surplus >= 0);
    const sum = r.packs.reduce((acc, p) => acc + p.size * p.count, 0);
    assert.equal(sum, r.bought);
  }
});

test("без размеров упаковки продукт считается весовым — излишка нет", () => {
  const r = packFor(347, []);
  assert.equal(r.bought, 347);
  assert.equal(r.surplus, 0);
  assert.deepEqual(r.packs, []);
});

test("нулевая потребность ничего не покупает", () => {
  assert.deepEqual(packFor(0, [500]), { packs: [], bought: 0, surplus: 0, approximate: false });
});

test("штучные упаковки: 10 яиц из коробок по 6 — две коробки", () => {
  const r = packFor(10, [6, 12]);
  assert.equal(r.bought, 12);
  assert.equal(r.surplus, 2);
});
