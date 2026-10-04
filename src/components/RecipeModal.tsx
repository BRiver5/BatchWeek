import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { Minus, Plus, Trash2, X } from "lucide-react-native";
import { useTheme } from "../theme";
import { staggerDelay } from "../theme/motion";
import { categoryColors, categoryLabels, categoryOrder } from "../theme/colors";
import { generateId } from "../lib/id";
import { todayIso } from "../lib/dates";
import { ingredientKey, type Ingredient, type IngredientCategory, type Recipe, type RecipeLine } from "../lib/model";
import { ALL_UNITS, isUnit, unitFamily, type Unit } from "../lib/units";
import { INGREDIENT_PRESETS, TAG_PRESETS } from "../data/presets";
import { PressableScale } from "./PressableScale";
import { Chip, PillButton, SectionLabel } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { Toggle } from "./Toggle";

type Draft = {
  name: string;
  tag: string;
  baseServings: number;
  activeMinutes: number;
  keepsDays: number;
  lines: RecipeLine[];
};

const EMPTY: Draft = { name: "", tag: TAG_PRESETS[0], baseServings: 2, activeMinutes: 30, keepsDays: 3, lines: [] };

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginBottom: 4 }}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 6,
        }}
      >
        <PressableScale scaleTo={0.88} onPress={() => onChange(Math.max(min, value - step))} style={{ padding: 4 }}>
          <Minus size={16} color={theme.colors.inkMuted} />
        </PressableScale>
        <Text style={{ ...theme.typography.body, fontWeight: "600", color: theme.colors.ink }}>
          {value}
          {suffix ?? ""}
        </Text>
        <PressableScale scaleTo={0.88} onPress={() => onChange(Math.min(max, value + step))} style={{ padding: 4 }}>
          <Plus size={16} color={theme.colors.inkMuted} />
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * Добавление/правка рецепта. Состав — самый повторяющийся ввод, поэтому
 * продукты набираются из пресетов в один тап (с уже проставленными единицей,
 * сроком хранения и размерами упаковки), а руками вводится только то, чего в
 * пресетах нет.
 */
export function RecipeModal({
  visible,
  editing,
  catalog,
  onSave,
  onDelete,
  onUpsertIngredient,
  onClose,
}: {
  visible: boolean;
  editing: Recipe | null;
  catalog: Map<string, Ingredient>;
  onSave: (recipe: Recipe) => void;
  onDelete?: (id: string) => void;
  onUpsertIngredient: (ingredient: Ingredient, displayName: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [customName, setCustomName] = useState("");
  const [qty, setQty] = useState("200");
  const [unit, setUnit] = useState<Unit>("g");
  const [category, setCategory] = useState<IngredientCategory>("produce");
  const [shelfLife, setShelfLife] = useState(7);
  const [staple, setStaple] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(
      editing
        ? {
            name: editing.name,
            tag: editing.tag,
            baseServings: editing.baseServings,
            activeMinutes: editing.activeMinutes,
            keepsDays: editing.keepsDays,
            lines: [...editing.lines],
          }
        : EMPTY
    );
    setCustomName("");
    setPendingPreset(null);
    setQty("200");
    setUnit("g");
    setCategory("produce");
    setShelfLife(7);
    setStaple(false);
  }, [visible, editing]);

  const usedKeys = useMemo(() => new Set(draft.lines.map((l) => ingredientKey(l.name))), [draft.lines]);
  const presets = useMemo(() => INGREDIENT_PRESETS.filter((p) => !usedKeys.has(p.name)), [usedKeys]);

  function applyPreset(presetName: string) {
    const preset = INGREDIENT_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    setPendingPreset(presetName);
    setCustomName(preset.name);
    setUnit(isUnit(preset.defaultUnit) ? preset.defaultUnit : "g");
    setCategory(preset.category);
    setShelfLife(preset.shelfLifeDays);
    setStaple(preset.staple);
    setQty(preset.family === "count" ? "1" : "200");
  }

  function addLine() {
    const name = customName.trim();
    const amount = Number(qty.replace(",", "."));
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    const preset = INGREDIENT_PRESETS.find((p) => p.name === ingredientKey(name));
    const known = catalog.get(ingredientKey(name));
    onUpsertIngredient(
      {
        name: ingredientKey(name),
        category,
        family: unitFamily(unit),
        shelfLifeDays: shelfLife,
        packSizes: preset?.packSizes ?? known?.packSizes ?? [],
        staple,
      },
      name
    );
    setDraft((prev) => ({ ...prev, lines: [...prev.lines, { name, qty: amount, unit }] }));
    setCustomName("");
    setPendingPreset(null);
    setQty("200");
  }

  function removeLine(index: number) {
    setDraft((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }

  const canSave = draft.name.trim().length > 0 && draft.lines.length > 0;

  function save() {
    if (!canSave) return;
    onSave({
      id: editing?.id ?? generateId(),
      name: draft.name.trim(),
      baseServings: draft.baseServings,
      activeMinutes: draft.activeMinutes,
      tag: draft.tag,
      keepsDays: draft.keepsDays,
      lines: draft.lines,
      createdAt: editing?.createdAt ?? todayIso(),
    });
  }

  const inputStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    color: theme.colors.ink,
    ...theme.typography.body,
  };

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
            paddingBottom: theme.spacing.lg,
            maxHeight: "92%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...theme.typography.subtitle, color: theme.colors.ink }}>
              {editing ? "Edit recipe" : "New recipe"}
            </Text>
            <PressableScale scaleTo={0.9} onPress={onClose} style={{ padding: theme.spacing.sm }}>
              <X size={22} color={theme.colors.inkMuted} />
            </PressableScale>
          </View>

          <ScrollView style={{ marginTop: theme.spacing.md }} showsVerticalScrollIndicator={false}>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, name: text }))}
              placeholder="Recipe name"
              placeholderTextColor={theme.colors.inkFaint}
              style={inputStyle}
            />

            <View style={{ marginTop: theme.spacing.lg }}>
              <SectionLabel>Main thing in it</SectionLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {TAG_PRESETS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={draft.tag === tag}
                    onPress={() => setDraft((prev) => ({ ...prev, tag }))}
                  />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
              <Stepper
                label="Serves"
                value={draft.baseServings}
                min={1}
                max={12}
                onChange={(v) => setDraft((prev) => ({ ...prev, baseServings: v }))}
              />
              <Stepper
                label="Active min"
                value={draft.activeMinutes}
                min={5}
                max={180}
                step={5}
                onChange={(v) => setDraft((prev) => ({ ...prev, activeMinutes: v }))}
              />
              <Stepper
                label="Keeps days"
                value={draft.keepsDays}
                min={0}
                max={7}
                onChange={(v) => setDraft((prev) => ({ ...prev, keepsDays: v }))}
              />
            </View>

            <View style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>Ingredients</SectionLabel>
              {draft.lines.map((line, index) => (
                <Animated.View
                  key={line.name + index}
                  layout={LinearTransition.springify().damping(18)}
                  entering={FadeInDown.delay(staggerDelay(index, 40, 6)).duration(260)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: 10,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flex: 1 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          categoryColors[catalog.get(ingredientKey(line.name))?.category ?? "pantry"],
                      }}
                    />
                    <Text style={{ ...theme.typography.body, color: theme.colors.ink, flex: 1 }} numberOfLines={1}>
                      {line.name}
                    </Text>
                  </View>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginRight: 10 }}>
                    {line.qty} {line.unit}
                  </Text>
                  <PressableScale scaleTo={0.85} onPress={() => removeLine(index)} style={{ padding: 4 }}>
                    <Trash2 size={16} color={theme.colors.inkFaint} />
                  </PressableScale>
                </Animated.View>
              ))}

              <View
                style={{
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                  marginTop: theme.spacing.sm,
                }}
              >
                <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginBottom: 8 }}>
                  Tap a preset — unit, shelf life and pack sizes come with it.
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                  {presets.slice(0, 16).map((preset) => (
                    <Chip
                      key={preset.name}
                      label={preset.name}
                      selected={pendingPreset === preset.name}
                      color={categoryColors[preset.category]}
                      onPress={() => applyPreset(preset.name)}
                    />
                  ))}
                </View>

                <TextInput
                  value={customName}
                  onChangeText={(text) => {
                    setCustomName(text);
                    setPendingPreset(null);
                  }}
                  placeholder="…or type anything else"
                  placeholderTextColor={theme.colors.inkFaint}
                  style={{ ...inputStyle, marginTop: theme.spacing.md }}
                />

                <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <TextInput
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="numeric"
                    placeholder="Qty"
                    placeholderTextColor={theme.colors.inkFaint}
                    style={{ ...inputStyle, width: 86 }}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {ALL_UNITS.map((item) => (
                      <Chip key={item} label={item} selected={unit === item} onPress={() => setUnit(item)} />
                    ))}
                  </ScrollView>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.spacing.md }}>
                  {categoryOrder.map((item) => (
                    <Chip
                      key={item}
                      label={categoryLabels[item]}
                      selected={category === item}
                      color={categoryColors[item]}
                      onPress={() => setCategory(item)}
                    />
                  ))}
                </View>

                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                  <Stepper label="Keeps (days)" value={shelfLife} min={1} max={60} onChange={setShelfLife} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginBottom: 4 }}>
                      Always at home
                    </Text>
                    <Toggle value={staple} onValueChange={setStaple} />
                  </View>
                </View>

                <View style={{ marginTop: theme.spacing.md, alignItems: "flex-start" }}>
                  <PillButton label="Add ingredient" icon={Plus} tone="accent" onPress={addLine} />
                </View>
              </View>
            </View>

            <View style={{ marginTop: theme.spacing.xl }}>
              <PrimaryButton label={editing ? "Save changes" : "Save recipe"} onPress={save} disabled={!canSave} />
              {editing && onDelete ? (
                <View style={{ marginTop: theme.spacing.md, alignItems: "center" }}>
                  <PillButton label="Delete recipe" icon={Trash2} tone="outline" onPress={() => onDelete(editing.id)} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
