import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, Minus, Plus } from "lucide-react-native";
import { useAppStore } from "../src/store/appStore";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { DAY_NAMES } from "../src/lib/model";
import { PressableScale } from "../src/components/PressableScale";
import { Chip, PillButton, SectionLabel } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { haptics } from "../src/services/haptics";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.body, color: theme.colors.ink }}>{label}</Text>
        {hint ? (
          <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function NumberControl({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 6,
      }}
    >
      <PressableScale
        scaleTo={0.86}
        onPress={() => {
          haptics.tap();
          onChange(Math.max(min, value - step));
        }}
      >
        <Minus size={16} color={theme.colors.inkMuted} />
      </PressableScale>
      <Text style={{ ...theme.typography.label, color: theme.colors.ink, minWidth: 52, textAlign: "center" }}>
        {value}
        {suffix ?? ""}
      </Text>
      <PressableScale
        scaleTo={0.86}
        onPress={() => {
          haptics.tap();
          onChange(Math.min(max, value + step));
        }}
      >
        <Plus size={16} color={theme.colors.inkMuted} />
      </PressableScale>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, resetHistory, recipes } = useAppStore();
  const [confirmReset, setConfirmReset] = useState(false);

  const sections: { title: string; content: React.ReactNode }[] = [
    {
      title: "The week",
      content: (
        <>
          <Row label="Plan lunches too" hint="Two slots a day instead of dinner only">
            <Toggle value={settings.planLunches} onValueChange={(value) => updateSettings({ planLunches: value })} />
          </Row>
          <Row label="Servings per meal">
            <NumberControl
              value={settings.servingsPerMeal}
              min={1}
              max={8}
              onChange={(value) => updateSettings({ servingsPerMeal: value })}
            />
          </Row>
          <View style={{ paddingVertical: theme.spacing.md }}>
            <Text style={{ ...theme.typography.body, color: theme.colors.ink, marginBottom: theme.spacing.sm }}>
              Days to plan
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {DAY_NAMES.map((name, day) => (
                <Chip
                  key={name}
                  label={name}
                  selected={settings.activeDays.includes(day)}
                  onPress={() => {
                    const next = settings.activeDays.includes(day)
                      ? settings.activeDays.filter((d) => d !== day)
                      : [...settings.activeDays, day];
                    updateSettings({ activeDays: next.sort((a, b) => a - b) });
                  }}
                />
              ))}
            </View>
          </View>
        </>
      ),
    },
    {
      title: "Time at the stove",
      content: (
        <>
          <Row label="Weekday budget" hint="Active minutes the planner may spend on a weeknight">
            <NumberControl
              value={settings.weekdayMinutes}
              min={10}
              max={120}
              step={5}
              suffix="m"
              onChange={(value) => updateSettings({ weekdayMinutes: value })}
            />
          </Row>
          <Row label="Weekend budget">
            <NumberControl
              value={settings.weekendMinutes}
              min={10}
              max={240}
              step={5}
              suffix="m"
              onChange={(value) => updateSettings({ weekendMinutes: value })}
            />
          </Row>
        </>
      ),
    },
    {
      title: "Batch cooking",
      content: (
        <>
          <Row label="Cook once, eat twice" hint="Let the planner fill slots with leftovers">
            <Toggle value={settings.allowBatch} onValueChange={(value) => updateSettings({ allowBatch: value })} />
          </Row>
          <Row label="Leftovers keep for" hint="Hard cap, on top of each recipe's own limit">
            <NumberControl
              value={settings.leftoverMaxAge}
              min={1}
              max={5}
              suffix="d"
              onChange={(value) => updateSettings({ leftoverMaxAge: value })}
            />
          </Row>
          <Row label="Same recipe not within" hint="Keeps the week from collapsing into one dish">
            <NumberControl
              value={settings.minRepeatGap}
              min={1}
              max={7}
              suffix="d"
              onChange={(value) => updateSettings({ minRepeatGap: value })}
            />
          </Row>
          <View style={{ paddingVertical: theme.spacing.md }}>
            <Text style={{ ...theme.typography.body, color: theme.colors.ink }}>Variety vs short list</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: 2 }}>
              {settings.varietyBias <= 2
                ? "Fewer things to buy — expect the same dish more often"
                : settings.varietyBias >= 4
                  ? "More different dishes — expect a longer shopping list"
                  : "Balanced: a few cook-ups, a few leftover days"}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: theme.spacing.sm }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Chip
                  key={level}
                  label={level === 1 ? "Short list" : level === 5 ? "Variety" : String(level)}
                  selected={settings.varietyBias === level}
                  onPress={() => updateSettings({ varietyBias: level })}
                />
              ))}
            </View>
          </View>
        </>
      ),
    },
    {
      title: "Shopping",
      content: (
        <Row label="Trips per week" hint="Two trips keep fresh things fresh; one is simpler">
          <NumberControl
            value={settings.tripCount}
            min={1}
            max={2}
            onChange={(value) => updateSettings({ tripCount: value })}
          />
        </Row>
      ),
    },
    {
      title: "Data",
      content: (
        <>
          <Row label="Recipes stored" hint="Everything stays on this phone — no account, no sync">
            <Text style={{ ...theme.typography.subtitle, color: theme.colors.ink }}>{recipes.length}</Text>
          </Row>
          <View style={{ paddingTop: theme.spacing.md, alignItems: "flex-start" }}>
            {confirmReset ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.danger }}>
                  This clears every planned week and its history. Recipes stay.
                </Text>
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  <PillButton
                    label="Yes, clear"
                    tone="accent"
                    onPress={async () => {
                      await resetHistory();
                      setConfirmReset(false);
                    }}
                  />
                  <PillButton label="Cancel" tone="outline" onPress={() => setConfirmReset(false)} />
                </View>
              </View>
            ) : (
              <PillButton label="Clear planning history" tone="outline" onPress={() => setConfirmReset(true)} />
            )}
          </View>
        </>
      ),
    },
  ];

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
        <Text style={{ ...theme.typography.title, color: theme.colors.ink }}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, index) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(staggerDelay(index, 80, 6)).duration(340)}
            style={{ marginBottom: theme.spacing.lg }}
          >
            <SectionLabel>{section.title}</SectionLabel>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.xs,
              }}
            >
              {section.content}
            </View>
          </Animated.View>
        ))}

        <Text style={{ ...theme.typography.caption, color: theme.colors.inkFaint, textAlign: "center" }}>
          BatchWeek · offline meal planning
        </Text>
      </ScrollView>
    </View>
  );
}
