import { Text, View, type ViewStyle, type StyleProp } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { haptics } from "../services/haptics";

/** Капслок-подпись секции — общий ритм всех экранов. */
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[{ marginBottom: theme.spacing.sm }, style]}>
      <Text
        style={{
          ...theme.typography.label,
          fontSize: 11,
          letterSpacing: 1.2,
          color: theme.colors.inkMuted,
        }}
      >
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

/** Небольшая кнопка-пилюля с иконкой: навигация и второстепенные действия. */
export function PillButton({
  label,
  icon: Icon,
  onPress,
  tone = "quiet",
  disabled,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  tone?: "quiet" | "accent" | "outline";
  disabled?: boolean;
}) {
  const theme = useTheme();
  const background =
    tone === "accent" ? theme.colors.accent : tone === "outline" ? "transparent" : theme.colors.surface;
  const color = tone === "accent" ? theme.colors.onAccent : theme.colors.ink;
  return (
    <PressableScale
      onPress={() => {
        if (disabled) return;
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.pill,
        backgroundColor: background,
        borderWidth: tone === "outline" ? 1 : 0,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {Icon ? <Icon size={15} color={color} strokeWidth={2.2} /> : null}
      <Text style={{ ...theme.typography.label, color }}>{label}</Text>
    </PressableScale>
  );
}

/** Плитка "число + подпись" для верха экранов. */
export function StatTile({
  value,
  label,
  hint,
  accent,
  children,
}: {
  value?: string;
  label: string;
  hint?: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {children ?? (
        <Text style={{ ...theme.typography.title, color: accent ?? theme.colors.ink }}>{value}</Text>
      )}
      <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: 2 }}>{label}</Text>
      {hint ? (
        <Text style={{ ...theme.typography.caption, fontSize: 11, color: theme.colors.inkFaint }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Чип выбора (пресеты, единицы, теги). */
export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      scaleTo={0.93}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={{
        paddingVertical: 7,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? (color ?? theme.colors.accent) : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? (color ?? theme.colors.accent) : theme.colors.border,
      }}
    >
      <Text
        style={{
          ...theme.typography.caption,
          fontWeight: "600",
          color: selected ? theme.colors.onAccent : theme.colors.inkMuted,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
