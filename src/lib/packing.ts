// Округление до размеров упаковки.
//
// Магазин не продаёт 340 г сметаны: он продаёт банки по 200 и 500. Сколько
// банок взять, чтобы покрыть потребность и выбросить меньше всего — это
// задача о размене монет в варианте "минимальный перебор сверху", и решается
// она точным динамическим программированием, а не жадным "бери самую большую".
//
// Жадность здесь реально ошибается: нужно 600 при упаковках 500 и 400 —
// жадный берёт 500 + 400 = 900 (излишек 300), ДП берёт 400 + 400 = 800
// (излишек 200). Поэтому основной путь — ДП, а жадность остаётся только
// аварийным фолбэком для нереалистично больших сеток.

export type PackSize = { size: number; label?: string };
export type PackResult = {
  /** Сколько упаковок какого размера взять. */
  packs: { size: number; count: number }[];
  /** Сколько по факту куплено (в канонических единицах). */
  bought: number;
  /** Куплено минус нужно. Ноль — идеальное попадание. */
  surplus: number;
  /** true, если точный ДП не применялся (слишком большая сетка). */
  approximate: boolean;
};

const MAX_GRID = 60000;
// Int32Array не вмещает Number.MAX_SAFE_INTEGER (обрежется в -1 и сломает
// сравнения) — для «недостижимо» нужен свой часовой внутри диапазона int32.
const UNREACHABLE = 0x3fffffff;

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function greedy(need: number, sizes: number[]): PackResult {
  const sorted = [...sizes].sort((a, b) => b - a);
  const counts = new Map<number, number>();
  let bought = 0;
  for (const size of sorted) {
    while (bought + size <= need) {
      counts.set(size, (counts.get(size) ?? 0) + 1);
      bought += size;
    }
  }
  if (bought < need) {
    // Добрать одной упаковкой — той, что даёт наименьший перебор.
    const best = sorted.reduce((acc, size) => (size >= need - bought && size < acc ? size : acc), Infinity);
    const pick = Number.isFinite(best) ? best : sorted[0];
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    bought += pick;
  }
  return {
    packs: [...counts.entries()].map(([size, count]) => ({ size, count })).sort((a, b) => b.size - a.size),
    bought,
    surplus: bought - need,
    approximate: true,
  };
}

/**
 * Точный подбор упаковок: минимизируем сначала излишек, при равном излишке —
 * число упаковок. Возвращает null-подобный результат (одна «упаковка» равная
 * потребности), если список размеров пуст — значит продукт покупается на вес.
 */
export function packFor(need: number, sizes: number[]): PackResult {
  const positive = sizes.filter((s) => s > 0);
  if (need <= 0) return { packs: [], bought: 0, surplus: 0, approximate: false };
  if (positive.length === 0) {
    return { packs: [], bought: need, surplus: 0, approximate: false };
  }

  const scale = positive.reduce((acc, s) => gcd(acc, s), positive[0]);
  const scaledSizes = positive.map((s) => Math.round(s / scale));
  const scaledNeed = Math.ceil(need / scale - 1e-9);
  const maxPack = Math.max(...scaledSizes);
  const limit = scaledNeed + maxPack;

  if (limit > MAX_GRID) return greedy(need, positive);

  // dp[t] — минимальное число упаковок, дающих ровно t; choice[t] — какая
  // упаковка была добавлена последней (для восстановления набора).
  const dp = new Int32Array(limit + 1).fill(UNREACHABLE);
  const choice = new Int32Array(limit + 1).fill(-1);
  dp[0] = 0;
  for (let t = 1; t <= limit; t++) {
    for (const size of scaledSizes) {
      if (size > t) continue;
      const prev = dp[t - size];
      if (prev === UNREACHABLE) continue;
      if (prev + 1 < dp[t]) {
        dp[t] = prev + 1;
        choice[t] = size;
      }
    }
  }

  // Первый достижимый t ≥ need — он же и есть минимальный излишек; число
  // упаковок при этом t уже минимально по построению dp.
  let bestTotal = -1;
  for (let t = scaledNeed; t <= limit; t++) {
    if (dp[t] !== UNREACHABLE) {
      bestTotal = t;
      break;
    }
  }
  if (bestTotal === -1) return greedy(need, positive);

  const counts = new Map<number, number>();
  let cursor = bestTotal;
  while (cursor > 0) {
    const size = choice[cursor];
    if (size <= 0) break;
    counts.set(size * scale, (counts.get(size * scale) ?? 0) + 1);
    cursor -= size;
  }

  const bought = bestTotal * scale;
  return {
    packs: [...counts.entries()].map(([size, count]) => ({ size, count })).sort((a, b) => b.size - a.size),
    bought,
    surplus: bought - need,
    approximate: false,
  };
}
