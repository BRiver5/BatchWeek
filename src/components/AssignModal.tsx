import { Modal, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { CookingPot, Eraser, Soup, X } from "lucide-react-native";
import { useTheme } from "../theme";
import { staggerDelay } from "../theme/motion";
import { statusColors } from "../theme/colors";
import { DAY_LONG, type MealKind, type Recipe, type Slot } from "../lib/model";
import { cookMinutes } from "../lib/planner";
import { formatMinutes } from "../lib/dates";
import { PressableScale } from "./PressableScale";
import { PillButton, SectionLabel } from "./Bits";
import { EmptyState } from "./EmptyState";

export type LeftoverOption = {
  recipeId: string;
  recipeName: string;
  sourceDay: number;
  sourceMeal: MealKind;
  ageDays: number;
};

/**
 * Назначение слота — всегда через явную модалку с триггером (тап по слоту или
 * по кнопке "Fill"), а не тихая инлайн-форма: пользователь должен видеть, что
 * он открыл выбор, и уметь его закрыть, ничего не изменив.
 */
export function AssignModal({
  visible,
  day,
  meal,
  recipes,
  leftovers,
  servings,
  onPick,
  onClear,
  onClose,
  canClear,
}: {
  visible: boolean;
  day: number;
  meal: MealKind;
  recipes: Recipe[];
  leftovers: LeftoverOption[];
  servings: number;
  onPick: (slot: Slot) => void;
  onClear: () => void;
  onClose: () => void;
  canClear: boolean;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(35, 26, 28, 0.45)", justifyContent: "flex-end" }}>
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            paddingTop: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            maxHeight: "86%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ ...theme.typography.subtitle, color: theme.colors.ink }}>
                {DAY_LONG[day]} · {meal === "lunch" ? "Lunch" : "Dinner"}
              </Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                {servings} servings needed
              </Text>
            </View>
            <PressableScale scaleTo={0.9} onPress={onClose} style={{ padding: theme.spacing.sm }}>
              <X size={22} color={theme.colors.inkMuted} />
            </PressableScale>
          </View>

          <ScrollView style={{ marginTop: theme.spacing.lg }} showsVerticalScrollIndicator={false}>
            {leftovers.length > 0 ? (
              <View style={{ marginBottom: theme.spacing.lg }}>
                <SectionLabel>Eat leftovers</SectionLabel>
                {leftovers.map((option, index) => (
                  <Animated.View
                    key={option.sourceDay + option.sourceMeal + option.recipeId}
                    entering={FadeInDown.delay(staggerDelay(index)).duration(300)}
                  >
                    <PressableScale
                      onPress={() =>
                        onPick({
                          day,
                          meal,
                          kind: "leftover",
                          recipeId: option.recipeId,
                          sourceDay: option.sourceDay,
                          sourceMeal: option.sourceMeal,
                        })
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: theme.spacing.md,
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.radius.md,
                        padding: theme.spacing.md,
                        marginBottom: theme.spacing.sm,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <Soup size={18} color={statusColors.leftover} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...theme.typography.body, color: theme.colors.ink }}>{option.recipeName}</Text>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                          cooked {DAY_LONG[option.sourceDay]} · {option.ageDays}d old
                        </Text>
                      </View>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            ) : null}

            <SectionLabel>Cook something</SectionLabel>
            {recipes.length === 0 ? (
              <EmptyState title="No recipes yet" description="Add a few recipes first — the planner needs something to work with." />
            ) : (
              recipes.map((recipe, index) => (
                <Animated.View key={recipe.id} entering={FadeInDown.delay(staggerDelay(index)).duration(300)}>
                  <PressableScale
                    onPress={() => onPick({ day, meal, kind: "cook", recipeId: recipe.id, servings })}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: theme.spacing.md,
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.sm,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <CookingPot size={18} color={theme.colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...theme.typography.body, color: theme.colors.ink }}>{recipe.name}</Text>
                      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                        {recipe.tag} · {formatMinutes(cookMinutes(recipe, servings))} · {recipe.lines.length} items
                      </Text>
                    </View>
                  </PressableScale>
                </Animated.View>
              ))
            )}
          </ScrollView>

          {canClear ? (
            <View style={{ marginTop: theme.spacing.md, alignItems: "flex-start" }}>
              <PillButton label="Clear this slot" icon={Eraser} tone="outline" onPress={onClear} />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}
