import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию —
// добавляй новую в конец массива. PRAGMA user_version хранит номер последней
// применённой ступени, миграции применяются последовательно от текущего значения.
const migrations: string[] = [
  `
  -- Библиотека рецептов и их составы.
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    base_servings INTEGER NOT NULL,
    active_minutes INTEGER NOT NULL,
    tag TEXT NOT NULL,
    keeps_days INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipe_lines (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recipe_lines_recipe ON recipe_lines(recipe_id);

  -- Справочник продуктов: срок хранения и упаковки — свойство продукта,
  -- общее для всех рецептов сразу.
  CREATE TABLE IF NOT EXISTS ingredients (
    key TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    family TEXT NOT NULL,
    shelf_life_days INTEGER NOT NULL,
    pack_sizes TEXT NOT NULL,
    staple INTEGER NOT NULL DEFAULT 0
  );

  -- Собранные недели и их слоты.
  CREATE TABLE IF NOT EXISTS weeks (
    week_start TEXT PRIMARY KEY NOT NULL,
    seed INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY NOT NULL,
    week_start TEXT NOT NULL REFERENCES weeks(week_start) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    meal TEXT NOT NULL,
    kind TEXT NOT NULL,
    recipe_id TEXT,
    servings INTEGER NOT NULL DEFAULT 0,
    source_day INTEGER,
    source_meal TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    minutes INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_slots_week ON slots(week_start);

  -- Отмеченные строки списка покупок (состояние UI, но его ждут между запусками).
  CREATE TABLE IF NOT EXISTS shopping_checks (
    week_start TEXT NOT NULL,
    item_key TEXT NOT NULL,
    PRIMARY KEY (week_start, item_key)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}
