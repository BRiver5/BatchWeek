// Доменная модель BatchWeek: рецепты, справочник продуктов, недельный план.
// Чистые типы без React и без SQLite — всё, что считает движок, живёт на них.

import type { Unit, UnitFamily } from "./units.ts";

export type IngredientCategory = "produce" | "protein" | "dairy" | "grain" | "pantry" | "fresh";

/** Строка состава рецепта: сколько и чего на базовое число порций. */
export type RecipeLine = {
  name: string;
  qty: number;
  unit: Unit;
};

export type Recipe = {
  id: string;
  name: string;
  /** На сколько порций рассчитан состав. */
  baseServings: number;
  /** Активные минуты у плиты — то, что реально занимает вечер. */
  activeMinutes: number;
  /** Ведущий продукт/кухня: по нему работает правило разнообразия. */
  tag: string;
  /** Сколько дней готовое блюдо живёт в холодильнике. */
  keepsDays: number;
  lines: RecipeLine[];
  createdAt: string;
};

/**
 * Справочник продуктов: срок хранения и размеры упаковки — это свойство
 * продукта, а не рецепта, поэтому они живут отдельно и переиспользуются всеми
 * рецептами сразу (изменил срок хранения сметаны — пересчитались все недели).
 */
export type Ingredient = {
  name: string;
  category: IngredientCategory;
  family: UnitFamily;
  /** Сколько дней продукт лежит дома после покупки. */
  shelfLifeDays: number;
  /** Размеры упаковок в канонических единицах семейства. Пусто — весовой. */
  packSizes: number[];
  /** "Это всегда есть дома" — не попадает в список покупок. */
  staple: boolean;
};

export type MealKind = "lunch" | "dinner";
export const MEALS: MealKind[] = ["lunch", "dinner"];
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type SlotKey = { day: number; meal: MealKind };

/** Порядковый номер слота внутри недели — им сравнивают "раньше/позже". */
export function slotOrdinal(day: number, meal: MealKind): number {
  return day * 2 + (meal === "lunch" ? 0 : 1);
}

export function slotId(day: number, meal: MealKind): string {
  return `${day}-${meal}`;
}

export type Slot =
  | { day: number; meal: MealKind; kind: "open" }
  /** Готовим в этот слот. servings — сколько порций варим ВСЕГО (с запасом на остатки). */
  | { day: number; meal: MealKind; kind: "cook"; recipeId: string; servings: number }
  /** Доедаем приготовленное в слоте sourceDay/sourceMeal. */
  | { day: number; meal: MealKind; kind: "leftover"; recipeId: string; sourceDay: number; sourceMeal: MealKind };

export type SlotStatus = "planned" | "cooked" | "skipped";

export type PlanWeights = {
  ingredient: number;
  surplus: number;
  spoil: number;
  effort: number;
  /** Повтор рецепта ближе, чем minRepeatGap дней. */
  repeat: number;
  /**
   * Повтор рецепта где угодно на неделе, даже за пределами minRepeatGap.
   * Без этого слагаемого оптимизатор вырождается: второе приготовление того
   * же блюда не добавляет НИ ОДНОГО нового продукта, то есть по "стоимости
   * покупок" оно бесплатно, и честный минимум — это одно и то же блюдо всю
   * неделю. Проверено на живом прогоне: без него неделя собиралась из двух
   * рецептов на семь ужинов.
   */
  sameRecipeAgain: number;
  /**
   * Однообразие СЪЕДЕННОГО: пара слотов недели с одним и тем же блюдом,
   * включая остатки. Готовка впрок — смысл приложения, но без этого члена
   * "оптимально" значит "свари два раза и ешь это семь дней". Вес живёт в
   * настройках как ползунок Variety: это вкусовое решение пользователя, а не
   * константа, которую автор знает лучше него.
   */
  eatRepeat: number;
  tagAdjacency: number;
  uncovered: number;
};

export const DEFAULT_WEIGHTS: PlanWeights = {
  ingredient: 1,
  surplus: 6,
  spoil: 4,
  effort: 0.6,
  repeat: 14,
  sameRecipeAgain: 9,
  eatRepeat: 7,
  tagAdjacency: 5,
  uncovered: 400,
};

export type PlanConfig = {
  /** Какие слоты недели нужно закрыть. */
  slots: SlotKey[];
  servingsPerMeal: number;
  /** Бюджет активной готовки на будний вечер и на выходной день (минуты). */
  weekdayMinutes: number;
  weekendMinutes: number;
  /** Разрешено ли готовить впрок и доедать. */
  allowBatch: boolean;
  /** Один и тот же рецепт не ближе чем через N дней (остатки не считаются). */
  minRepeatGap: number;
  /** Жёсткий потолок возраста остатков, независимо от рецепта. */
  leftoverMaxAge: number;
  weights: PlanWeights;
};

export const DEFAULT_CONFIG: Omit<PlanConfig, "slots"> = {
  servingsPerMeal: 2,
  weekdayMinutes: 35,
  weekendMinutes: 75,
  allowBatch: true,
  minRepeatGap: 3,
  leftoverMaxAge: 2,
  weights: DEFAULT_WEIGHTS,
};

export const DEFAULT_INGREDIENT: Omit<Ingredient, "name"> = {
  category: "pantry",
  family: "mass",
  shelfLifeDays: 14,
  packSizes: [],
  staple: false,
};

/** Ключ продукта: регистр и лишние пробелы не должны плодить дубли в списке. */
export function ingredientKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isWeekend(day: number): boolean {
  return day >= 5;
}
