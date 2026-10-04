import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { ChevronLeft, Clock, Plus, Users } from "lucide-react-native";
import { useAppStore } from "../src/store/appStore";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { categoryColors } from "../src/theme/colors";
import { ingredientKey, type Recipe } from "../src/lib/model";
import { formatMinutes } from "../src/lib/dates";
import { PressableScale } from "../src/components/PressableScale";
import { PillButton, SectionLabel } from "../src/components/Bits";
import { EmptyState } from "../src/components/EmptyState";
import { RecipeModal } from "../src/components/RecipeModal";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { haptics } from "../src/services/haptics";

export default function RecipesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recipes, catalog, saveRecipe, removeRecipe, upsertIngredient } = useAppStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [burst, setBurst] = useState(false);

  const tags = useMemo(() => [...new Set(recipes.map((r) => r.tag))].sort(), [recipes]);
  const [filter, setFilter] = useState<string | null>(null);
  const visible = filter ? recipes.filter((r) => r.tag === filter) : recipes;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <PressableScale scaleTo={0.88} onPress={() => router.back()} style={{ padding: 4 }}>
            <ChevronLeft size={24} color={theme.colors.ink} />
          </PressableScale>
          <Text style={{ ...theme.typography.title, color: theme.colors.ink }}>Recipes</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          {burst ? <SuccessBurst visible onDone={() => setBurst(false)} size={34} /> : null}
          <PillButton
            label="New"
            icon={Plus}
            tone="accent"
            onPress={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          />
        </View>
      </View>

      {tags.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
        >
          <PillButton label="All" tone={filter === null ? "accent" : "quiet"} onPress={() => setFilter(null)} />
          {tags.map((tag) => (
            <PillButton
              key={tag}
              label={tag}
              tone={filter === tag ? "accent" : "quiet"}
              onPress={() => setFilter(filter === tag ? null : tag)}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {recipes.length === 0 ? (
          <EmptyState
            title="Your recipe shelf is empty"
            description="Add the dishes you actually cook. Four is already enough for the planner to find overlap."
          />
        ) : (
          <>
            <SectionLabel>{`${visible.length} recipes`}</SectionLabel>
            {visible.map((recipe, index) => (
              <Animated.View
                key={recipe.id}
                layout={LinearTransition.springify().damping(18)}
                entering={FadeInDown.delay(staggerDelay(index)).duration(320)}
              >
                <PressableScale
                  scaleTo={0.98}
                  onPress={() => {
                    setEditing(recipe);
                    setModalOpen(true);
                  }}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    padding: theme.spacing.lg,
                    marginBottom: theme.spacing.md,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ ...theme.typography.subtitle, color: theme.colors.ink, flex: 1 }} numberOfLines={1}>
                      {recipe.name}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: 3,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>{recipe.tag}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Clock size={14} color={theme.colors.inkFaint} />
                      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                        {formatMinutes(recipe.activeMinutes)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Users size={14} color={theme.colors.inkFaint} />
                      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                        serves {recipe.baseServings}
                      </Text>
                    </View>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
                      keeps {recipe.keepsDays}d
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.spacing.md }}>
                    {recipe.lines.map((line) => (
                      <View
                        key={line.name}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: theme.radius.pill,
                          backgroundColor: theme.colors.surfaceAlt,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: categoryColors[catalog.get(ingredientKey(line.name))?.category ?? "pantry"],
                          }}
                        />
                        <Text style={{ ...theme.typography.caption, fontSize: 12, color: theme.colors.inkMuted }}>
                          {line.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </PressableScale>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>

      <RecipeModal
        visible={modalOpen}
        editing={editing}
        catalog={catalog}
        onUpsertIngredient={(ingredient, displayName) => upsertIngredient(ingredient, displayName)}
        onSave={async (recipe) => {
          await saveRecipe(recipe);
          setModalOpen(false);
          setBurst(true);
          haptics.success();
        }}
        onDelete={async (id) => {
          await removeRecipe(id);
          setModalOpen(false);
        }}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}
