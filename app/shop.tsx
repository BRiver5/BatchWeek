import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Check, ChevronLeft, Home, ShoppingBasket, TriangleAlert } from "lucide-react-native";
import { useAppStore } from "../src/store/appStore";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { categoryColors, categoryLabels } from "../src/theme/colors";
import { DAY_LONG } from "../src/lib/model";
import { buildShoppingList, describeLine } from "../src/lib/shopping";
import { formatCanonical } from "../src/lib/units";
import { PressableScale } from "../src/components/PressableScale";
import { SectionLabel } from "../src/components/Bits";
import { EmptyState } from "../src/components/EmptyState";
import { PackStack } from "../src/components/PackStack";
import { haptics } from "../src/services/haptics";

export default function ShopScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slots, recipes, catalog, settings, checked, toggleChecked } = useAppStore();

  const list = useMemo(
    () => buildShoppingList(slots, recipes, catalog, settings.tripCount),
    [slots, recipes, catalog, settings.tripCount]
  );

  const totalItems = list.trips.reduce((sum, trip) => sum + trip.lines.length, 0);
  const doneItems = list.trips.reduce(
    (sum, trip) => sum + trip.lines.filter((line) => checked.has(line.key)).length,
    0
  );

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
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.title, color: theme.colors.ink }}>Shopping</Text>
          {totalItems > 0 ? (
            <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
              {doneItems}/{totalItems} picked up · {Math.round(list.surplusShare * 100)}% bought as spare
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {totalItems === 0 ? (
          <EmptyState
            title="Nothing to buy yet"
            description="Build a week on the planner screen and the list assembles itself from the recipes you picked."
          />
        ) : (
          <>
            {list.warning ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: theme.spacing.sm,
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.lg,
                }}
              >
                <TriangleAlert size={18} color={theme.colors.danger} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.ink, flex: 1 }}>{list.warning}</Text>
              </View>
            ) : null}

            {list.trips.map((trip, tripIndex) => (
              <View key={trip.day} style={{ marginBottom: theme.spacing.xl }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <ShoppingBasket size={16} color={theme.colors.accent} />
                  <SectionLabel style={{ marginBottom: 0 }}>
                    {list.trips.length > 1 ? `Trip ${tripIndex + 1} · ${DAY_LONG[trip.day]}` : DAY_LONG[trip.day]}
                  </SectionLabel>
                </View>
                <Text
                  style={{
                    ...theme.typography.caption,
                    color: theme.colors.inkFaint,
                    marginTop: 2,
                    marginBottom: theme.spacing.md,
                  }}
                >
                  {trip.lines.length} items, timed to what you cook first
                </Text>

                {trip.lines.map((line, index) => {
                  const isChecked = checked.has(line.key);
                  return (
                    <Animated.View key={line.key} entering={FadeInDown.delay(staggerDelay(index)).duration(300)}>
                      <PressableScale
                        scaleTo={0.985}
                        onPress={() => {
                          haptics.tap();
                          toggleChecked(line.key);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: theme.spacing.md,
                          backgroundColor: theme.colors.surface,
                          borderRadius: theme.radius.md,
                          borderWidth: 1,
                          borderColor: line.stale ? theme.colors.danger : theme.colors.border,
                          padding: theme.spacing.md,
                          marginBottom: theme.spacing.sm,
                          opacity: isChecked ? 0.55 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 1.5,
                            borderColor: isChecked ? theme.colors.accent : theme.colors.border,
                            backgroundColor: isChecked ? theme.colors.accent : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: 2,
                          }}
                        >
                          {isChecked ? <Check size={14} color={theme.colors.onAccent} strokeWidth={3} /> : null}
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: categoryColors[line.category],
                              }}
                            />
                            <Text
                              style={{
                                ...theme.typography.body,
                                color: theme.colors.ink,
                                textDecorationLine: isChecked ? "line-through" : "none",
                                flex: 1,
                              }}
                              numberOfLines={1}
                            >
                              {line.name}
                            </Text>
                            <Text style={{ ...theme.typography.label, color: theme.colors.ink }}>
                              {formatCanonical(line.bought, line.family)}
                            </Text>
                          </View>

                          <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: 2 }}>
                            {categoryLabels[line.category]} · need {formatCanonical(line.needed, line.family)}
                            {line.surplus > 0 ? ` · ${formatCanonical(line.surplus, line.family)} spare` : " · exact fit"}
                          </Text>

                          <PackStack
                            packs={line.packs}
                            needed={line.needed}
                            bought={line.bought}
                            color={categoryColors[line.category]}
                            delay={staggerDelay(index)}
                          />

                          {line.stale ? (
                            <Text style={{ ...theme.typography.caption, color: theme.colors.danger, marginTop: 6 }}>
                              Cooked on {DAY_LONG[line.firstNeededDay]}, keeps only {line.shelfLifeDays}d
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </View>
            ))}

            {list.staples.length > 0 ? (
              <View style={{ marginBottom: theme.spacing.xl }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <Home size={16} color={theme.colors.inkMuted} />
                  <SectionLabel style={{ marginBottom: 0 }}>Check at home</SectionLabel>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.spacing.md }}>
                  {list.staples.map((staple) => (
                    <View
                      key={staple.key}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: categoryColors[staple.category],
                        }}
                      />
                      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>{staple.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
