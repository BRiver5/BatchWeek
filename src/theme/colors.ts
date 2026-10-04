// Палитра BatchWeek. Единственный файл с цветовыми значениями — магические hex
// в JSX запрещены.
//
// Акцент #CD1D35 ("чили-кармин") выбран количественным поиском: максимальная
// минимальная дистанция в Lab до всех 80 акцентов DESIGN_REGISTRY.md в
// профессиональном диапазоне (sat 55-75, L 36-48). Ближайшие соседи —
// MeetingCost #B8433A (ΔE 18.9), MineBlitz #EE492F (20.1), MarketBasket #A13327
// (21.6): вся красная семья портфеля — приглушённые кирпич/терракота, здесь же
// чистый насыщенный кармин. В последних десяти записях реестра красного нет
// вообще (ближайшие по кругу — ZoneSweep 340° пыльная роза и SleepTab 30° янтарь).
//
// onAccent — белый: контраст 5.49:1 (посчитан, проходит WCAG AA), не унаследован
// от дефолта шаблона вслепую.
//
// Фон #F4F1F2 — холодноватый фарфор с розовым подтоном: намеренно не тёплые
// кремы BrewDial/EnvelopeFlow/BreathEasy и не зеленоватая бумага RecallPace.

export const light = {
  background: "#F4F1F2",
  backgroundAlt: "#EBE5E7",
  surface: "#FFFFFF",
  surfaceAlt: "#F3EEEF",
  border: "#E2D9DC",
  ink: "#231A1C",
  inkMuted: "#6D6164",
  inkFaint: "#A79DA0",
  onAccent: "#FFFFFF",
  accent: "#CD1D35",
  accentSoft: "#F8E4E7",
  danger: "#8C1220",
  success: "#0E7A52",
};

export const dark = {
  background: "#171214",
  backgroundAlt: "#1E1719",
  surface: "#241C1F",
  surfaceAlt: "#2E2427",
  border: "#3A2E31",
  ink: "#F3EDEE",
  inkMuted: "#A99FA2",
  inkFaint: "#776D70",
  onAccent: "#FFFFFF",
  accent: "#E8415A",
  accentSoft: "#3A1C22",
  danger: "#FF6B7A",
  success: "#2FA87A",
};

// Категориальная шкала категорий продуктов (донат на Stats, нити ReuseWeave,
// точки в списке покупок). Прогнана через validate_palette.js дата-виз скилла
// на фоне #F4F1F2: ALL CHECKS PASS (chroma floor, CVD-разделение соседних пар,
// normal-vision floor, контраст ≥3:1). Порядок фиксированный и не цикличный —
// седьмая и дальше категории сворачиваются в "Other" (см. categoryColor).
export const categoryColors = {
  produce: "#618B0F",
  protein: "#B3309B",
  dairy: "#1A7FA8",
  grain: "#B86E0F",
  pantry: "#6243C9",
  fresh: "#11957B",
} as const;

export type IngredientCategory = keyof typeof categoryColors;

export const categoryOrder: IngredientCategory[] = [
  "produce",
  "protein",
  "dairy",
  "grain",
  "pantry",
  "fresh",
];

export const categoryLabels: Record<IngredientCategory, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy & eggs",
  grain: "Grains & pasta",
  pantry: "Pantry",
  fresh: "Herbs & other",
};

// Статусы слота недели (стековая полоса на Stats, точки в плане). Отдельная
// шкала от категориальной — статусы зарезервированы и не переиспользуются как
// "ещё одна категория". Та же проверка валидатором: ALL CHECKS PASS.
// Цвет никогда не единственный носитель смысла — рядом всегда иконка/подпись.
export const statusColors = {
  cooked: "#0E7A52",
  leftover: "#C2771A",
  skipped: "#4C6CA8",
} as const;

export type Palette = typeof light;
