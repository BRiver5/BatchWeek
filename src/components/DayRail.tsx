import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme";
import { spring } from "../theme/motion";
import { statusColors } from "../theme/colors";
import { DAY_NAMES } from "../lib/model";
import { PressableScale } from "./PressableScale";

export const RAIL_WIDTH = 78;
const ITEM_HEIGHT = 62;

export type RailDay = {
  day: number;
  dateLabel: string;
  /** Точки состояния слотов дня: что готовится, что доедается, что пусто. */
  marks: ("cook" | "leftover" | "open")[];
  isToday: boolean;
};

/**
 * Левая колонка дней — навигация недели и одновременно её мини-карта.
 * Выделение не перепрыгивает между днями скачком, а переезжает пружиной по
 * измеренной позиции — так видно, на сколько дней вперёд ты ушёл.
 */
export function DayRail({
  days,
  selected,
  onSelect,
  header,
  footer,
}: {
  days: RailDay[];
  selected: number;
  onSelect: (day: number) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const offset = useSharedValue(selected * ITEM_HEIGHT);

  useEffect(() => {
    offset.value = withSpring(selected * ITEM_HEIGHT, spring.gentle);
  }, [selected]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View
      style={{
        width: RAIL_WIDTH,
        backgroundColor: theme.colors.backgroundAlt,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        alignItems: "center",
        paddingTop: theme.spacing.sm,
      }}
    >
      {header}
      <View style={{ height: days.length * ITEM_HEIGHT, width: RAIL_WIDTH }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: theme.spacing.sm,
              right: theme.spacing.sm,
              height: ITEM_HEIGHT - 6,
              top: 3,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.accent,
            },
            indicatorStyle,
          ]}
        />
        {days.map((item) => {
          const active = item.day === selected;
          return (
            <PressableScale
              key={item.day}
              scaleTo={0.92}
              onPress={() => onSelect(item.day)}
              style={{ height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}
            >
              <Text
                style={{
                  ...theme.typography.label,
                  fontSize: 11,
                  letterSpacing: 1,
                  color: active ? theme.colors.onAccent : theme.colors.inkMuted,
                }}
              >
                {DAY_NAMES[item.day].toUpperCase()}
              </Text>
              <Text
                style={{
                  ...theme.typography.subtitle,
                  color: active ? theme.colors.onAccent : theme.colors.ink,
                  marginTop: 1,
                }}
              >
                {item.dateLabel}
              </Text>
              <View style={{ flexDirection: "row", gap: 3, marginTop: 4, height: 6 }}>
                {item.marks.map((mark, index) => (
                  <View
                    key={index}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      borderWidth: mark === "open" ? 1 : 0,
                      borderColor: active ? theme.colors.onAccent : theme.colors.inkFaint,
                      backgroundColor:
                        mark === "open"
                          ? "transparent"
                          : active
                            ? theme.colors.onAccent
                            : mark === "cook"
                              ? statusColors.cooked
                              : statusColors.leftover,
                    }}
                  />
                ))}
              </View>
              {item.isToday ? (
                <View
                  style={{
                    position: "absolute",
                    right: theme.spacing.sm + 2,
                    top: theme.spacing.sm,
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: active ? theme.colors.onAccent : theme.colors.accent,
                  }}
                />
              ) : null}
            </PressableScale>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      {footer}
    </View>
  );
}
