# BatchWeek — plan

Weekly meal-prep planner. You keep a small shelf of recipes you actually cook;
the app composes the week for you so that ingredients overlap, perishable
things get used while they are still good, weeknights stay short, and some
slots are filled by deliberate batch cooking instead of another cook-up. The
shopping list falls out of the plan, rounded to real pack sizes and split into
shopping trips timed to what spoils first.

Everything is local (`expo-sqlite`). No account, no network, no analytics.

## Screens (5)

1. **Week** (`app/index.tsx`) — the planner. Layout archetype: **Sidebar
   Categories** — a narrow vertical day rail on the left (days of the week,
   with state dots and a spring-driven selection indicator), the selected
   day's slots on the right. Hero at the top of the content column is the
   signature widget `ReuseWeave`. Primary action is the "Build week" pill in
   the hero card, not a floating FAB.
2. **Recipes** (`app/recipes.tsx`) — the recipe shelf; add/edit through an
   explicit modal with one-tap ingredient presets.
3. **Shopping** (`app/shop.tsx`) — the derived list: one or two trips, pack
   rounding with a visible surplus, "check at home" staples.
4. **Stats** (`app/stats.tsx`) — six sections (see below).
5. **Settings** (`app/settings.tsx`) — week shape, time budgets, batch rules,
   trips, local data reset.

## The engine (`src/lib/*.ts`, pure functions, 47 unit tests)

- `units.ts` — mass/volume/count families, canonical units, conversion only
  inside a family (no fake density maths).
- `packing.ts` — **exact DP** for pack-size rounding: minimise surplus first,
  then pack count. Greedy genuinely loses here (need 600 with 500/400 packs:
  greedy buys 900, DP buys 800), so greedy is only the fallback for
  unrealistically large grids.
- `planner.ts` — the week composer. Weighted cost function over: distinct
  ingredients bought, pack surplus, spoilage (days between first and last use
  vs shelf life), effort over the day's budget, recipe repeats, same lead
  ingredient on consecutive meals, uncovered slots. Solved by seeded randomised
  greedy construction (marginal cost per slot) + steepest-descent local search
  over two neighbourhoods (replace a slot, swap two slots) + multi-restart.
  Deterministic given a seed; "Rebuild" bumps the seed for a genuinely
  different week.
- `shopping.ts` — aggregation, pack rounding, and **exhaustive** trip-day
  selection (7 options for one trip, 28 pairs for two) minimising total
  freshness loss. No heuristic: the search space is small enough for the
  honest optimum.
- `planStats.ts` — Wilson intervals, and the honest headline: a scan over
  every possible effort cut point looking for one where the two sides'
  confidence intervals do **not** overlap. Reports `found` /
  `insufficientData` / `notSeparated` — never the prettiest number it can find.

## Data model

`recipes` + `recipe_lines` (composition per base serving) · `ingredients`
(shelf life, pack sizes, category, staple flag — a property of the product,
shared by every recipe) · `weeks` + `slots` (plan and per-slot status) ·
`shopping_checks` · `settings`.

## Signature widget

`ReuseWeave` — seven day rows, one vertical thread per ingredient used on more
than one day, a knot at each use. Threads draw in, knots pop after. It shows
exactly what the optimiser trades off: a dense weave means a short shopping
list, long threads mean something has to survive until the last knot.

Secondary: `PackStack` on the shopping list — discrete blocks, one per pack,
filled left to right, the partial tail being the surplus the DP minimises.

## Stats sections

1. Follow-through ring + weeks planned + minutes saved by leftovers.
2. Last 8 weeks stacked: cooked / leftovers / skipped.
3. Active minutes by weekday (bars).
4. Ingredient reuse this week (donut: used once / twice / 3+).
5. 12-week cooking heatmap.
6. "Where the plan breaks" — the Wilson-gated effort threshold plus per-recipe
   follow-through.

## Permissions

Nothing unlocked. `expo-notifications` is removed entirely (a planner that
nags was not worth a notifications permission); the only system capability is
vibration via `expo-haptics`. Camera, audio, location and media stay blocked in
`app.json`.
