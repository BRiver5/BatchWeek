import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  diffDays,
  formatMinutes,
  formatWeekRange,
  lastWeekStarts,
  toIso,
  weekStartIso,
  weekdayIndex,
} from "./dates.ts";

test("ISO собирается из локальных компонент, а не из UTC", () => {
  // 23:30 локального времени: toISOString() в положительном поясе уже показал
  // бы следующие сутки — проверяем, что дата осталась сегодняшней.
  const late = new Date(2026, 9, 4, 23, 30, 0);
  assert.equal(toIso(late), "2026-10-04");
});

test("сложение дней переживает границу месяца и года", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(diffDays("2026-09-28", "2026-10-04"), 6);
  assert.equal(diffDays("2026-10-04", "2026-09-28"), -6);
});

test("неделя начинается с понедельника, воскресенье принадлежит прошлой", () => {
  assert.equal(weekStartIso("2026-10-04"), "2026-09-28"); // воскресенье
  assert.equal(weekStartIso("2026-09-28"), "2026-09-28"); // понедельник
  assert.equal(weekStartIso("2026-10-05"), "2026-10-05");
  assert.equal(weekdayIndex("2026-09-28"), 0);
  assert.equal(weekdayIndex("2026-10-04"), 6);
});

test("список последних недель заканчивается текущей", () => {
  const weeks = lastWeekStarts(3, "2026-10-04");
  assert.deepEqual(weeks, ["2026-09-14", "2026-09-21", "2026-09-28"]);
});

test("подписи читаются по-человечески", () => {
  assert.equal(formatWeekRange("2026-09-28"), "Sep 28 – Oct 4");
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(60), "1 h");
  assert.equal(formatMinutes(135), "2 h 15 min");
});
