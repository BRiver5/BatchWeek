// Единицы измерения и перевод в каноническую форму.
//
// Три семейства: масса (канон — грамм), объём (канон — миллилитр), штуки.
// Перевод РАЗРЕШЁН только внутри семейства: "200 g муки" и "1 cup муки" без
// плотности конкретного продукта не складываются, и приложение не делает вид,
// что умеет это — такие строки остаются в списке покупок раздельно.

export type Unit = "g" | "kg" | "oz" | "lb" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "pcs";
export type UnitFamily = "mass" | "volume" | "count";

type UnitSpec = { family: UnitFamily; perCanonical: number };

const UNITS: Record<Unit, UnitSpec> = {
  g: { family: "mass", perCanonical: 1 },
  kg: { family: "mass", perCanonical: 1000 },
  oz: { family: "mass", perCanonical: 28.3495 },
  lb: { family: "mass", perCanonical: 453.592 },
  ml: { family: "volume", perCanonical: 1 },
  l: { family: "volume", perCanonical: 1000 },
  tsp: { family: "volume", perCanonical: 5 },
  tbsp: { family: "volume", perCanonical: 15 },
  cup: { family: "volume", perCanonical: 240 },
  pcs: { family: "count", perCanonical: 1 },
};

export const ALL_UNITS = Object.keys(UNITS) as Unit[];

export function unitFamily(unit: Unit): UnitFamily {
  return UNITS[unit].family;
}

export function isUnit(value: string): value is Unit {
  return Object.prototype.hasOwnProperty.call(UNITS, value);
}

/** Количество в канонической единице семейства (g / ml / pcs). */
export function toCanonical(qty: number, unit: Unit): number {
  return qty * UNITS[unit].perCanonical;
}

export function fromCanonical(canonical: number, unit: Unit): number {
  return canonical / UNITS[unit].perCanonical;
}

export function canonicalUnit(family: UnitFamily): Unit {
  return family === "mass" ? "g" : family === "volume" ? "ml" : "pcs";
}

function trim(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Человеческий формат канонического количества: граммы переходят в килограммы
 * после 1000, миллилитры — в литры, штуки остаются штуками. Дробные штуки
 * округляются вверх — половины яйца в списке покупок не существует.
 */
export function formatCanonical(canonical: number, family: UnitFamily): string {
  if (family === "count") {
    const whole = Math.ceil(canonical - 1e-9);
    return `${whole} ${whole === 1 ? "pc" : "pcs"}`;
  }
  if (family === "mass") {
    return canonical >= 1000 ? `${trim(canonical / 1000)} kg` : `${trim(canonical)} g`;
  }
  return canonical >= 1000 ? `${trim(canonical / 1000)} l` : `${trim(canonical)} ml`;
}

/** Короткая запись количества в той единице, в которой её ввёл пользователь. */
export function formatQuantity(qty: number, unit: Unit): string {
  return `${trim(qty)} ${unit}`;
}
