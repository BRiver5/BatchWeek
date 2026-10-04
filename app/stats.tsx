import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";
import { useAppStore } from "../src/store/appStore";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { categoryColors, statusColors } from "../src/theme/colors";
import { DAY_NAMES } from "../src/lib/model";
import { explainPlan } from "../src/lib/planner";
import { configFromSettings } from "../src/data/settings";
import {
  cookingHeatmap,
  findEffortThreshold,
  followThrough,
  leftoverPayoff,
  minutesByWeekday,
  recipeReliability,
  weekBreakdowns,
} from "../src/lib/planStats";
import { formatMinutes, formatShort, lastWeekStarts } from "../src/lib/dates";
import { PressableScale } from "../src/components/PressableScale";
import { SectionLabel, StatTile } from "../src/components/Bits";
import { EmptyState } from "../src/components/EmptyState";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { BarChart } from "../src/components/BarChart";
import { DonutChart } from "../src/components/DonutChart";
import { Heatmap } from "../src/components/Heatmap";
import { Legend, StackedBars } from "../src/components/StackedBars";

const HEAT_CELL = 13;
const HEAT_GAP = 4;
const REUSE_COLORS = [categoryColors.dairy, categoryColors.grain, categoryColors.fresh];

function Section({ title, subtitle, index, children }: { title: string; subtitle?: string; index: number; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(staggerDelay(index, 90, 7)).duration(380)}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.lg,
      }}
    >
      <SectionLabel>{title}</SectionLabel>
      {subtitle ? (
        <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginBottom: theme.spacing.md }}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </Animated.View>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { history, recipes, catalog, settings, slots } = useAppStore();

  const config = useMemo(() => configFromSettings(settings), [settings]);
  const plan = useMemo(() => explainPlan(slots, recipes, catalog, config), [slots, recipes, catalog, config]);
  const follow = useMemo(() => followThrough(history), [history]);
  const weeks = useMemo(() => weekBreakdowns(history), [history]);
  const weekdayMinutes = useMemo(() => minutesByWeekday(history), [history]);
  const threshold = useMemo(() => findEffortThreshold(history), [history]);
  const reliability = useMemo(() => recipeReliability(history), [history]);
  const heatWeeks = useMemo(() => lastWeekStarts(12), []);
  const heatCells = useMemo(() => cookingHeatmap(history, heatWeeks), [history, heatWeeks]);
  const savedMinutes = useMemo(
    () =>
      leftoverPayoff(
        history,
        recipes.length > 0 ? Math.round(recipes.reduce((sum, r) => sum + r.activeMinutes, 0) / recipes.length) : 30
      ),
    [history, recipes]
  );

  const hasHistory = history.some((record) => record.kind !== "open");

  const reuseSegments = [
    { value: plan.reuse.once, color: REUSE_COLORS[0], label: "used once" },
    { value: plan.reuse.twice, color: REUSE_COLORS[1], label: "used twice" },
    { value: plan.reuse.more, color: REUSE_COLORS[2], label: "used 3+ times" },
  ];
  const reuseTotal = reuseSegments.reduce((sum, s) => sum + s.value, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
      >
        <PressableScale scaleTo={0.88} onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={theme.colors.ink} />
        </PressableScale>
        <Text style={{ ...theme.typography.title, color: theme.colors.ink }}>Stats</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!hasHistory && reuseTotal === 0 ? (
          <EmptyState
            title="No cooking logged yet"
            description="Build a week, then mark meals done or skipped — everything here grows out of that."
          />
        ) : (
          <>
            {/* 1 — верхние плитки: follow-through кольцом и счётчики. */}
            <Animated.View
              entering={FadeInDown.duration(360)}
              style={{ flexDirection: "row", gap: theme.spacing.md, marginBottom: theme.spacing.lg }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  padding: theme.spacing.lg,
                  alignItems: "center",
                }}
              >
                <AnimatedRing
                  progress={follow.rate}
                  size={104}
                  strokeWidth={12}
                  color={theme.colors.accent}
                  trackColor={theme.colors.surfaceAlt}
                >
                  <AnimatedCounter
                    value={Math.round(follow.rate * 100)}
                    formatter={(v) => {
                      "worklet";
                      return `${Math.round(v)}%`;
                    }}
                    style={{ ...theme.typography.title, color: theme.colors.ink, padding: 0 }}
                  />
                </AnimatedRing>
                <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: theme.spacing.sm }}>
                  plan followed
                </Text>
                <Text style={{ ...theme.typography.caption, fontSize: 11, color: theme.colors.inkFaint }}>
                  {follow.cooked} of {follow.cooked + follow.skipped} decided
                </Text>
              </View>

              <View style={{ flex: 1, gap: theme.spacing.md }}>
                <StatTile value={String(weeks.length)} label="Weeks planned" />
                <StatTile value={formatMinutes(savedMinutes)} label="Saved by leftovers" accent={theme.colors.accent} />
              </View>
            </Animated.View>

            {/* 2 — как прошли последние недели. */}
            <Section
              title="Weeks"
              subtitle="One bar per week, labelled by the day its Monday fell on"
              index={1}
            >
              {weeks.length === 0 ? (
                <Text style={{ ...theme.typography.caption, color: theme.colors.inkFaint }}>
                  Nothing logged yet.
                </Text>
              ) : (
                <>
                  <StackedBars
                    data={weeks.map((week) => ({
                      label: formatShort(week.weekStart).split(" ")[1],
                      segments: [
                        { value: week.cooked, color: statusColors.cooked },
                        { value: week.leftovers, color: statusColors.leftover },
                        { value: week.skipped, color: statusColors.skipped },
                      ],
                    }))}
                  />
                  <Legend
                    items={[
                      { label: "Cooked", color: statusColors.cooked },
                      { label: "Leftovers", color: statusColors.leftover },
                      { label: "Skipped", color: statusColors.skipped },
                    ]}
                  />
                </>
              )}
            </Section>

            {/* 3 — куда уходит время в течение недели. */}
            <Section title="Active cooking by weekday" subtitle="Minutes actually spent at the stove" index={2}>
              <BarChart
                data={DAY_NAMES.map((name, index) => ({ label: name, value: weekdayMinutes[index] }))}
                color={theme.colors.accent}
              />
            </Section>

            {/* 4 — насколько плотно переплетён текущий список покупок. */}
            <Section
              title="Ingredient reuse this week"
              subtitle={
                reuseTotal > 0
                  ? `${plan.distinctIngredients} items cover ${plan.cookCount + plan.leftoverCount} meals`
                  : "Build a week to fill this in"
              }
              index={3}
            >
              {reuseTotal === 0 ? (
                <Text style={{ ...theme.typography.caption, color: theme.colors.inkFaint }}>No plan yet.</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xl }}>
                  <DonutChart segments={reuseSegments.map((s) => ({ value: s.value, color: s.color }))} size={128} />
                  <View style={{ flex: 1, gap: theme.spacing.sm }}>
                    {reuseSegments.map((segment) => (
                      <View key={segment.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                          style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: segment.color }}
                        />
                        <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, flex: 1 }}>
                          {segment.label}
                        </Text>
                        <Text style={{ ...theme.typography.label, color: theme.colors.ink }}>{segment.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Section>

            {/* 5 — 12 недель активности. */}
            <Section title="Cooking activity" subtitle="Last 12 weeks · days left to right, weeks top to bottom" index={4}>
              {/* Ширина контейнера задана ровно под семь клеток: без неё
                  flexWrap переносит строки по месту на экране, и сетка
                  перестаёт читаться как недели (видно на живом прогоне). */}
              <View style={{ width: 7 * (HEAT_CELL + HEAT_GAP) }}>
                <View style={{ flexDirection: "row", gap: HEAT_GAP, marginBottom: 4 }}>
                  {DAY_NAMES.map((name) => (
                    <Text
                      key={name}
                      style={{
                        width: HEAT_CELL,
                        fontSize: 8,
                        textAlign: "center",
                        color: theme.colors.inkFaint,
                      }}
                    >
                      {name[0]}
                    </Text>
                  ))}
                </View>
              <Heatmap
                cells={heatCells}
                cellSize={HEAT_CELL}
                gap={HEAT_GAP}
                colorForIntensity={(intensity) =>
                  intensity === 0
                    ? theme.colors.surfaceAlt
                    : intensity < 0.34
                      ? "#F0B9C0"
                      : intensity < 0.67
                        ? "#DE6677"
                        : theme.colors.accent
                }
              />
              </View>
            </Section>

            {/* 6 — честный вывод: где план перестаёт выполняться. */}
            <Section title="Where the plan breaks" subtitle="Based on what you marked done or skipped" index={5}>
              {threshold.kind === "insufficientData" ? (
                <Text style={{ ...theme.typography.body, color: theme.colors.inkMuted }}>
                  Not enough finished meals yet — {threshold.n} of {threshold.needed} needed before this says anything.
                </Text>
              ) : threshold.kind === "notSeparated" ? (
                <Text style={{ ...theme.typography.body, color: theme.colors.inkMuted }}>
                  No effort threshold stands out across {threshold.n} meals. Long and short cook-ups get done about
                  equally often.
                </Text>
              ) : (
                <>
                  <Text style={{ ...theme.typography.body, color: theme.colors.ink }}>
                    Meals over {threshold.minutes} min get cooked {Math.round(threshold.heavyRate * 100)}% of the time,
                    against {Math.round(threshold.lightRate * 100)}% for the shorter ones.
                  </Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: 6 }}>
                    {threshold.lightN} short vs {threshold.heavyN} long meals, confidence intervals do not overlap.
                    Lowering the weekday budget to {threshold.minutes} min would keep the planner on the side that
                    actually happens.
                  </Text>
                </>
              )}

              {reliability.length > 0 ? (
                <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
                  {reliability.slice(0, 3).map((row) => {
                    const recipe = recipes.find((r) => r.id === row.recipeId);
                    if (!recipe) return null;
                    return (
                      <View key={row.recipeId} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, flex: 1 }} numberOfLines={1}>
                          {recipe.name}
                        </Text>
                        <View
                          style={{
                            height: 6,
                            width: 70,
                            borderRadius: 3,
                            backgroundColor: theme.colors.surfaceAlt,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              height: "100%",
                              width: `${Math.round(row.rate * 100)}%`,
                              backgroundColor: theme.colors.accent,
                            }}
                          />
                        </View>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.ink, width: 48, textAlign: "right" }}>
                          {row.cooked}/{row.total}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}
