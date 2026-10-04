import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

export type StackedDatum = {
  label: string;
  segments: { value: number; color: string }[];
};

/**
 * Стековые столбцы недель: готовка / остатки / срывы одной колонкой.
 * Между сегментами оставлен зазор цветом поверхности — иначе два соседних
 * цвета читаются как один блок.
 */
export function StackedBars({ data, height = 128 }: { data: StackedDatum[]; height?: number }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0)));

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm, height }}>
      {data.map((datum, index) => (
        <View key={datum.label + index} style={{ flex: 1, alignItems: "center" }}>
          <View style={{ width: "100%", height: height - 20, justifyContent: "flex-end", gap: 2 }}>
            {datum.segments
              .filter((segment) => segment.value > 0)
              .map((segment, segmentIndex) => (
                <Segment
                  key={segmentIndex}
                  target={(segment.value / max) * (height - 24)}
                  color={segment.color}
                  delay={Math.min(index, 8) * 60 + segmentIndex * 40}
                  radius={theme.radius.sm / 2}
                />
              ))}
          </View>
          <Text style={{ fontSize: 10, color: theme.colors.inkFaint, marginTop: theme.spacing.xs }}>
            {datum.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Segment({ target, color, delay, radius }: { target: number; color: string; delay: number; radius: number }) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = 0;
    height.value = withDelay(delay, withTiming(target, { duration: 560, easing: Easing.out(Easing.cubic) }));
  }, [target, delay]);

  const style = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[{ width: "100%", backgroundColor: color, borderRadius: radius }, style]} />;
}

/** Легенда: идентичность не держится на одном цвете. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, marginTop: theme.spacing.md }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: item.color }} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
