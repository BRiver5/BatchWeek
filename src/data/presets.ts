// Пресеты ввода.
//
// Состав рецепта — самый повторяющийся ввод в приложении: лук, рис, оливковое
// масло набираются руками в каждом втором рецепте вместе с единицей измерения,
// сроком хранения и размером упаковки. Здесь лежат готовые значения на один
// тап. Это НЕ демо-данные: в базу не попадает ничего, пока пользователь сам не
// выберет строку — пустое приложение остаётся пустым.

import type { Ingredient, IngredientCategory } from "../lib/model.ts";

export type IngredientPreset = Omit<Ingredient, "staple"> & { defaultUnit: string; staple: boolean };

export const INGREDIENT_PRESETS: IngredientPreset[] = [
  // Produce
  { name: "onion", category: "produce", family: "count", shelfLifeDays: 21, packSizes: [], defaultUnit: "pcs", staple: false },
  { name: "garlic", category: "produce", family: "count", shelfLifeDays: 30, packSizes: [], defaultUnit: "pcs", staple: true },
  { name: "carrot", category: "produce", family: "count", shelfLifeDays: 14, packSizes: [], defaultUnit: "pcs", staple: false },
  { name: "potato", category: "produce", family: "mass", shelfLifeDays: 21, packSizes: [1000, 2500], defaultUnit: "g", staple: false },
  { name: "tomato", category: "produce", family: "count", shelfLifeDays: 6, packSizes: [], defaultUnit: "pcs", staple: false },
  { name: "bell pepper", category: "produce", family: "count", shelfLifeDays: 7, packSizes: [], defaultUnit: "pcs", staple: false },
  { name: "spinach", category: "produce", family: "mass", shelfLifeDays: 3, packSizes: [150, 300], defaultUnit: "g", staple: false },
  { name: "broccoli", category: "produce", family: "mass", shelfLifeDays: 5, packSizes: [400], defaultUnit: "g", staple: false },
  { name: "mushrooms", category: "produce", family: "mass", shelfLifeDays: 4, packSizes: [250, 500], defaultUnit: "g", staple: false },
  { name: "lemon", category: "produce", family: "count", shelfLifeDays: 14, packSizes: [], defaultUnit: "pcs", staple: false },

  // Protein
  { name: "chicken breast", category: "protein", family: "mass", shelfLifeDays: 2, packSizes: [500, 1000], defaultUnit: "g", staple: false },
  { name: "chicken thighs", category: "protein", family: "mass", shelfLifeDays: 2, packSizes: [600, 1000], defaultUnit: "g", staple: false },
  { name: "ground beef", category: "protein", family: "mass", shelfLifeDays: 2, packSizes: [400, 800], defaultUnit: "g", staple: false },
  { name: "pork loin", category: "protein", family: "mass", shelfLifeDays: 3, packSizes: [500], defaultUnit: "g", staple: false },
  { name: "salmon fillet", category: "protein", family: "mass", shelfLifeDays: 1, packSizes: [250, 500], defaultUnit: "g", staple: false },
  { name: "eggs", category: "protein", family: "count", shelfLifeDays: 21, packSizes: [6, 10], defaultUnit: "pcs", staple: false },
  { name: "chickpeas", category: "protein", family: "mass", shelfLifeDays: 400, packSizes: [400], defaultUnit: "g", staple: false },
  { name: "black beans", category: "protein", family: "mass", shelfLifeDays: 400, packSizes: [400], defaultUnit: "g", staple: false },
  { name: "tofu", category: "protein", family: "mass", shelfLifeDays: 7, packSizes: [280], defaultUnit: "g", staple: false },

  // Dairy & eggs
  { name: "milk", category: "dairy", family: "volume", shelfLifeDays: 6, packSizes: [500, 1000], defaultUnit: "ml", staple: false },
  { name: "butter", category: "dairy", family: "mass", shelfLifeDays: 30, packSizes: [200], defaultUnit: "g", staple: true },
  { name: "yoghurt", category: "dairy", family: "mass", shelfLifeDays: 10, packSizes: [150, 500], defaultUnit: "g", staple: false },
  { name: "cream", category: "dairy", family: "volume", shelfLifeDays: 5, packSizes: [200, 500], defaultUnit: "ml", staple: false },
  { name: "parmesan", category: "dairy", family: "mass", shelfLifeDays: 30, packSizes: [100, 200], defaultUnit: "g", staple: false },
  { name: "feta", category: "dairy", family: "mass", shelfLifeDays: 14, packSizes: [200], defaultUnit: "g", staple: false },

  // Grains & pasta
  { name: "rice", category: "grain", family: "mass", shelfLifeDays: 400, packSizes: [500, 1000], defaultUnit: "g", staple: true },
  { name: "pasta", category: "grain", family: "mass", shelfLifeDays: 400, packSizes: [500], defaultUnit: "g", staple: true },
  { name: "couscous", category: "grain", family: "mass", shelfLifeDays: 300, packSizes: [500], defaultUnit: "g", staple: false },
  { name: "tortillas", category: "grain", family: "count", shelfLifeDays: 14, packSizes: [8], defaultUnit: "pcs", staple: false },
  { name: "bread", category: "grain", family: "count", shelfLifeDays: 4, packSizes: [1], defaultUnit: "pcs", staple: false },
  { name: "oats", category: "grain", family: "mass", shelfLifeDays: 300, packSizes: [500, 1000], defaultUnit: "g", staple: true },

  // Pantry
  { name: "olive oil", category: "pantry", family: "volume", shelfLifeDays: 300, packSizes: [500], defaultUnit: "ml", staple: true },
  { name: "soy sauce", category: "pantry", family: "volume", shelfLifeDays: 300, packSizes: [250], defaultUnit: "ml", staple: true },
  { name: "canned tomatoes", category: "pantry", family: "mass", shelfLifeDays: 400, packSizes: [400], defaultUnit: "g", staple: false },
  { name: "coconut milk", category: "pantry", family: "volume", shelfLifeDays: 400, packSizes: [400], defaultUnit: "ml", staple: false },
  { name: "stock cube", category: "pantry", family: "count", shelfLifeDays: 300, packSizes: [6], defaultUnit: "pcs", staple: true },
  { name: "flour", category: "pantry", family: "mass", shelfLifeDays: 300, packSizes: [1000], defaultUnit: "g", staple: true },
  { name: "salt", category: "pantry", family: "mass", shelfLifeDays: 999, packSizes: [], defaultUnit: "g", staple: true },
  { name: "black pepper", category: "pantry", family: "mass", shelfLifeDays: 999, packSizes: [], defaultUnit: "g", staple: true },

  // Herbs & other
  { name: "parsley", category: "fresh", family: "mass", shelfLifeDays: 4, packSizes: [30], defaultUnit: "g", staple: false },
  { name: "coriander", category: "fresh", family: "mass", shelfLifeDays: 3, packSizes: [30], defaultUnit: "g", staple: false },
  { name: "basil", category: "fresh", family: "mass", shelfLifeDays: 4, packSizes: [30], defaultUnit: "g", staple: false },
  { name: "ginger", category: "fresh", family: "mass", shelfLifeDays: 20, packSizes: [], defaultUnit: "g", staple: false },
  { name: "chilli", category: "fresh", family: "count", shelfLifeDays: 10, packSizes: [], defaultUnit: "pcs", staple: false },
];

/** Ведущий продукт/кухня — по нему работает правило "не два дня подряд". */
export const TAG_PRESETS = [
  "chicken",
  "beef",
  "pork",
  "fish",
  "veggie",
  "beans",
  "pasta",
  "rice bowl",
  "soup",
  "salad",
  "eggs",
  "bake",
];

export const CATEGORY_HINTS: Record<IngredientCategory, string> = {
  produce: "Keeps a few days to a few weeks",
  protein: "The fastest to spoil — bought last",
  dairy: "Short shelf life, sold in fixed packs",
  grain: "Long shelf life, often already at home",
  pantry: "Tins, oils, sauces — buy any time",
  fresh: "Herbs and aromatics — days, not weeks",
};
