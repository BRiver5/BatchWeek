import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalUnit, formatCanonical, formatQuantity, fromCanonical, toCanonical, unitFamily } from "./units.ts";

test("перевод в канон и обратно симметричен внутри семейства", () => {
  assert.equal(toCanonical(1.5, "kg"), 1500);
  assert.equal(toCanonical(2, "tbsp"), 30);
  assert.equal(fromCanonical(1500, "kg"), 1.5);
  assert.ok(Math.abs(fromCanonical(toCanonical(3, "lb"), "lb") - 3) < 1e-9);
});

test("семейства не смешиваются", () => {
  assert.equal(unitFamily("cup"), "volume");
  assert.equal(unitFamily("oz"), "mass");
  assert.equal(unitFamily("pcs"), "count");
  assert.equal(canonicalUnit("volume"), "ml");
});

test("формат канона переключает масштаб на 1000 и не плодит дробные штуки", () => {
  assert.equal(formatCanonical(850, "mass"), "850 g");
  assert.equal(formatCanonical(1250, "mass"), "1.25 kg");
  assert.equal(formatCanonical(500, "volume"), "500 ml");
  assert.equal(formatCanonical(2000, "volume"), "2 l");
  assert.equal(formatCanonical(2.1, "count"), "3 pcs");
  assert.equal(formatCanonical(1, "count"), "1 pc");
});

test("formatQuantity сохраняет исходную единицу пользователя", () => {
  assert.equal(formatQuantity(0.5, "cup"), "0.5 cup");
  assert.equal(formatQuantity(3, "pcs"), "3 pcs");
});
