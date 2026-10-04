# BatchWeek

Offline weekly meal-prep planner for Android (Expo / React Native).

Keep a shelf of recipes you actually cook. BatchWeek composes the week so that
ingredients overlap between dishes, perishable things are used while they are
still good, weeknights stay inside your time budget, and some meals are
covered by deliberate batch cooking. The shopping list is derived from the
plan, rounded to real pack sizes, and split into trips timed to what spoils
first.

No account, no backend, no analytics — everything lives in a local SQLite
database on the device.

## Running

```bash
npm install
npx expo start      # then open in Expo Go
npm run verify      # tsc + unit tests + project rules + offline bundle export
```

## Layout

```
app/            expo-router screens: index (week), recipes, shop, stats, settings
src/lib/        the engine — units, pack DP, week composer, shopping, stats (unit tested)
src/components/ ReuseWeave (signature widget), DayRail, PackStack, StackedBars, modals
src/data/       SQLite repository, settings, ingredient presets
src/store/      zustand app store
src/theme/      palette, typography, spacing, motion
```

## Notes

- Dinner-only by default; lunches can be switched on in Settings.
- "Rebuild week" re-runs the optimiser with a new seed — same data, genuinely
  different arrangement.
- Stats only state a conclusion when the numbers support it; otherwise they
  say so.
