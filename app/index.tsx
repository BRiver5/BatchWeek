import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  BarChart3,
  Check,
  ChefHat,
  CookingPot,
  ListChecks,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Soup,
  Undo2,
  X,
} from "lucide-react-native";
import { useAppStore } from "../src/store/appStore";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { statusColors } from "../src/theme/colors";
import { DAY_LONG, MEALS, type MealKind, type Slot } from "../src/lib/model";
import { cookMinutes, explainPlan, weaveThreads } from "../src/lib/planner";
import { addDays, formatMinutes, formatWeekRange, fromIso, todayIso, weekStartIso, weekdayIndex } from "../src/lib/dates";
import { configFromSettings } from "../src/data/settings";
import { DayRail, RAIL_WIDTH, type RailDay } from "../src/components/DayRail";
import { ReuseWeave, WeaveLegend } from "../src/components/ReuseWeave";
import { AssignModal, type LeftoverOption } from "../src/components/AssignModal";
import { PillButton, SectionLabel, StatTile } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { haptics } from "../src/services/haptics";

export default function WeekScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { recipes, catalog, settings, slots, statuses, weekStart, seed, building, rebuild, assignSlot, clearSlot, markSlot } =
    useAppStore();

  const isCurrentWeek = weekStart === weekStartIso();
  const [selectedDay, setSelectedDay] = useState(isCurrentWeek ? weekdayIndex(todayIso()) : 0);
  const [editing, setEditing] = useState<{ day: number; meal: MealKind } | null>(null);
  const [burst, setBurst] = useState(false);

  const config = useMemo(() => configFromSettings(settings), [settings]);
  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const threads = useMemo(() => weaveThreads(slots, recipes, catalog), [slots, recipes, catalog]);
  const summary = useMemo(() => explainPlan(slots, recipes, catalog, config), [slots, recipes, catalog, config]);

  const plannedMeals: MealKind[] = settings.planLunches ? MEALS : ["dinner"];
  const contentWidth = width - RAIL_WIDTH - theme.spacing.lg * 2;

  const railDays: RailDay[] = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        dateLabel: String(fromIso(addDays(weekStart, day)).getDate()),
        marks: plannedMeals.map((meal) => {
          const slot = slots.find((s) => s.day === day && s.meal === meal);
          if (!slot || slot.kind === "open") return "open" as const;
          return slot.kind;
        }),
        isToday: isCurrentWeek && weekdayIndex(todayIso()) === day,
      })),
    [slots, weekStart, settings.planLunches, isCurrentWeek]
  );

  const cookDays = useMemo(
    () => [...new Set(slots.filter((s) => s.kind === "cook").map((s) => s.day))],
    [slots]
  );

  function minutesOf(slot: Slot | undefined): number {
    if (!slot || slot.kind !== "cook") return 0;
    const recipe = recipeById.get(slot.recipeId);
    return recipe ? cookMinutes(recipe, slot.servings) : 0;
  }

  function leftoverOptionsFor(day: number, meal: MealKind): LeftoverOption[] {
    const targetOrdinal = day * 2 + (meal === "lunch" ? 0 : 1);
    const options: LeftoverOption[] = [];
    for (const slot of slots) {
      if (slot.kind !== "cook") continue;
      const sourceOrdinal = slot.day * 2 + (slot.meal === "lunch" ? 0 : 1);
      if (sourceOrdinal >= targetOrdinal) continue;
      const recipe = recipeById.get(slot.recipeId);
      if (!recipe) continue;
      const age = day - slot.day;
      if (age > Math.min(recipe.keepsDays, settings.leftoverMaxAge)) continue;
      options.push({
        recipeId: slot.recipeId,
        recipeName: recipe.name,
        sourceDay: slot.day,
        sourceMeal: slot.meal,
        ageDays: age,
      });
    }
    return options;
  }

  async function onPick(slot: Slot) {
    setEditing(null);
    await assignSlot(slot.day, slot.meal, slot);
    haptics.success();
  }

  async function onBuild() {
    await rebuild(seed + 1);
    setBurst(true);
    haptics.success();
  }

  const hasPlan = slots.some((s) => s.kind !== "open");

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, flexDirection: "row", paddingTop: insets.top }}>
      <DayRail
        days={railDays}
        selected={selectedDay}
        onSelect={setSelectedDay}
        header={
          <View style={{ alignItems: "center", marginBottom: theme.spacing.md }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CookingPot size={19} color={theme.colors.onAccent} strokeWidth={2.2} />
            </View>
          </View>
        }
        footer={
          <PressableScale
            scaleTo={0.88}
            onPress={() => router.push("/settings")}
            style={{ padding: theme.spacing.md, marginBottom: insets.bottom + theme.spacing.sm }}
          >
            <SettingsIcon size={20} color={theme.colors.inkMuted} />
          </PressableScale>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
          {formatWeekRange(weekStart)}
        </Text>
        <Text style={{ ...theme.typography.title, color: theme.colors.ink, marginTop: 2 }}>BatchWeek</Text>

        <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <PillButton label="Recipes" icon={ChefHat} onPress={() => router.push("/recipes")} />
          <PillButton label="Shop" icon={ListChecks} onPress={() => router.push("/shop")} />
          <PillButton label="Stats" icon={BarChart3} onPress={() => router.push("/stats")} />
        </View>

        {/* Hero — сигнатурный виджет: переплетение продуктов по дням недели. */}
        <Animated.View
          entering={FadeInDown.duration(380)}
          style={{
            marginTop: theme.spacing.lg,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: theme.spacing.lg,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <SectionLabel>Ingredient reuse</SectionLabel>
              <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginBottom: theme.spacing.sm }}>
                {hasPlan
                  ? threads.length > 0
                    ? `${threads.length} ingredients carry across days`
                    : "Nothing overlaps yet — every meal shops for itself"
                  : "Build a week to see how the shopping list folds together"}
              </Text>
            </View>
            {burst ? (
              <SuccessBurst visible onDone={() => setBurst(false)} size={44} />
            ) : null}
          </View>

          <ReuseWeave threads={threads} cookDays={cookDays} width={contentWidth - theme.spacing.lg * 2} />
          {threads.length > 0 ? <WeaveLegend threads={threads} /> : null}

          <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            <PillButton
              label={building ? "Building…" : hasPlan ? "Rebuild week" : "Build week"}
              icon={RefreshCw}
              tone="accent"
              disabled={building || recipes.length === 0}
              onPress={onBuild}
            />
          </View>
        </Animated.View>

        {hasPlan ? (
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            <StatTile label="Active cooking" hint={`${summary.cookCount} cook-ups`}>
              <AnimatedCounter
                value={summary.activeMinutes}
                formatter={(v) => {
                  "worklet";
                  return `${Math.round(v)} min`;
                }}
                style={{ ...theme.typography.title, color: theme.colors.ink, padding: 0 }}
              />
            </StatTile>
            <StatTile
              value={`${summary.distinctIngredients}`}
              label="Items to buy"
              hint={`vs ${summary.ingredientsIfSeparate} if separate`}
            />
            <StatTile
              value={`${summary.minutesSaved}`}
              label="Minutes saved"
              hint={`${summary.leftoverCount} leftover meals`}
              accent={theme.colors.accent}
            />
          </View>
        ) : null}

        {summary.spoilRisks.length > 0 ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{
              marginTop: theme.spacing.lg,
              backgroundColor: theme.colors.accentSoft,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
            }}
          >
            <Text style={{ ...theme.typography.label, color: theme.colors.danger }}>Freshness warning</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.ink, marginTop: 2 }}>
              {summary.spoilRisks
                .slice(0, 2)
                .map((risk) => `${risk.name} is used across ${risk.gapDays} days but keeps ${risk.shelfLifeDays}`)
                .join(" · ")}
            </Text>
          </Animated.View>
        ) : null}

        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>{DAY_LONG[selectedDay]}</SectionLabel>

          {recipes.length === 0 ? (
            <StartChecklist onAddRecipes={() => router.push("/recipes")} />
          ) : (
            plannedMeals.map((meal, index) => {
              const slot = slots.find((s) => s.day === selectedDay && s.meal === meal);
              const status = statuses[selectedDay + "-" + meal] ?? "planned";
              return (
                <Animated.View key={meal} entering={FadeInDown.delay(staggerDelay(index)).duration(320)}>
                  <SlotCard
                    meal={meal}
                    slot={slot}
                    status={status}
                    recipeName={slot && slot.kind !== "open" ? recipeById.get(slot.recipeId)?.name : undefined}
                    minutes={minutesOf(slot)}
                    servings={slot && slot.kind === "cook" ? slot.servings : settings.servingsPerMeal}
                    sourceLabel={slot && slot.kind === "leftover" ? DAY_LONG[slot.sourceDay] : undefined}
                    onPress={() => setEditing({ day: selectedDay, meal })}
                    onMark={(next) => {
                      markSlot(selectedDay, meal, next);
                      if (next === "cooked") {
                        setBurst(true);
                        haptics.success();
                      }
                    }}
                  />
                </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>

      <AssignModal
        visible={editing !== null}
        day={editing?.day ?? 0}
        meal={editing?.meal ?? "dinner"}
        recipes={recipes}
        leftovers={editing ? leftoverOptionsFor(editing.day, editing.meal) : []}
        servings={settings.servingsPerMeal}
        canClear={Boolean(
          editing && slots.some((s) => s.day === editing.day && s.meal === editing.meal && s.kind !== "open")
        )}
        onPick={onPick}
        onClear={() => {
          if (!editing) return;
          clearSlot(editing.day, editing.meal);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

function SlotCard({
  meal,
  slot,
  status,
  recipeName,
  minutes,
  servings,
  sourceLabel,
  onPress,
  onMark,
}: {
  meal: MealKind;
  slot: Slot | undefined;
  status: string;
  recipeName?: string;
  minutes: number;
  servings: number;
  sourceLabel?: string;
  onPress: () => void;
  onMark: (status: "cooked" | "skipped" | "planned") => void;
}) {
  const theme = useTheme();
  const kind = slot?.kind ?? "open";
  const accent = kind === "cook" ? statusColors.cooked : kind === "leftover" ? statusColors.leftover : theme.colors.border;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.md,
        overflow: "hidden",
      }}
    >
      <PressableScale scaleTo={0.985} onPress={onPress} style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 4, alignSelf: "stretch", backgroundColor: accent }} />
        <View style={{ flex: 1, padding: theme.spacing.lg }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.inkFaint, letterSpacing: 1 }}>
            {meal.toUpperCase()}
          </Text>
          {kind === "open" ? (
            <Text style={{ ...theme.typography.subtitle, color: theme.colors.inkFaint, marginTop: 2 }}>
              Nothing planned
            </Text>
          ) : (
            <>
              <Text style={{ ...theme.typography.subtitle, color: theme.colors.ink, marginTop: 2 }}>{recipeName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                {kind === "cook" ? (
                  <>
                    <CookingPot size={14} color={statusColors.cooked} />
                    <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                      Cook {servings} servings · {formatMinutes(minutes)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Soup size={14} color={statusColors.leftover} />
                    <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                      Leftovers from {sourceLabel} · no cooking
                    </Text>
                  </>
                )}
              </View>
            </>
          )}
        </View>
        {kind === "open" ? (
          <View style={{ paddingRight: theme.spacing.lg }}>
            <Plus size={20} color={theme.colors.accent} />
          </View>
        ) : null}
      </PressableScale>

      {kind !== "open" ? (
        <View
          style={{
            flexDirection: "row",
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
          }}
        >
          {status === "planned" ? (
            <>
              <PillButton label="Done" icon={Check} tone="accent" onPress={() => onMark("cooked")} />
              <PillButton label="Skipped" icon={X} tone="outline" onPress={() => onMark("skipped")} />
            </>
          ) : (
            <PillButton
              label={status === "cooked" ? "Marked done" : "Marked skipped"}
              icon={Undo2}
              tone="outline"
              onPress={() => onMark("planned")}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Пустое состояние — чеклист "с чего начать", а не просто надпись. */
function StartChecklist({ onAddRecipes }: { onAddRecipes: () => void }) {
  const theme = useTheme();
  const steps = [
    "Add 4–6 recipes you actually cook",
    "Build the week — overlap and leftovers are worked out for you",
    "Shop in one or two trips, timed to what spoils first",
  ];
  return (
    <Animated.View
      entering={FadeInDown.duration(360)}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
      }}
    >
      <Text style={{ ...theme.typography.subtitle, color: theme.colors.ink }}>Three steps to a planned week</Text>
      {steps.map((step, index) => (
        <View key={step} style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.md }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: theme.colors.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ ...theme.typography.caption, fontWeight: "700", color: theme.colors.accent }}>
              {index + 1}
            </Text>
          </View>
          <Text style={{ ...theme.typography.body, color: theme.colors.inkMuted, flex: 1 }}>{step}</Text>
        </View>
      ))}
      <View style={{ marginTop: theme.spacing.lg, alignItems: "flex-start" }}>
        <PillButton label="Add a recipe" icon={Plus} tone="accent" onPress={onAddRecipes} />
      </View>
    </Animated.View>
  );
}
