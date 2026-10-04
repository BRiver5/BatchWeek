import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { categoryColors, type IngredientCategory } from "../theme/colors";
import { DAY_NAMES } from "../lib/model";
import type { WeaveThread } from "../lib/planner";

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ROW_HEIGHT = 22;
const LANE_GAP = 26;
const LABEL_WIDTH = 34;
const DOT_RADIUS = 5;

/**
 * ReuseWeave — сигнатурный виджет BatchWeek.
 *
 * Семь строк — дни недели, каждая вертикальная нить — один продукт, который
 * используется больше чем в один день. Нить тянется от первого дня, где
 * продукт берут в руки, до последнего, с узлом на каждом таком дне. То, что
 * видно глазом — "сколько нитей и насколько они длинные" — это ровно та
 * величина, которую минимизирует движок: чем плотнее переплетение, тем короче
 * список покупок, но тем выше риск, что скоропортящееся не доживёт до
 * последнего узла.
 *
 * Нить рисуется сверху вниз (анимация strokeDasharray), узлы всплывают следом
 * по очереди — после пересборки недели плетение заново "затягивается".
 */
function Thread({
  thread,
  x,
  color,
  delay,
  topInset,
}: {
  thread: WeaveThread;
  x: number;
  color: string;
  delay: number;
  topInset: number;
}) {
  const progress = useSharedValue(0);
  const first = thread.days[0];
  const last = thread.days[thread.days.length - 1];
  const y1 = topInset + first * ROW_HEIGHT + ROW_HEIGHT / 2;
  const y2 = topInset + last * ROW_HEIGHT + ROW_HEIGHT / 2;
  const length = Math.max(1, y2 - y1);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [thread.key, first, last, delay]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));

  return (
    <G>
      <AnimatedLine
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={length}
        animatedProps={lineProps}
      />
      {thread.days.map((day, index) => (
        <Knot
          key={day}
          cx={x}
          cy={topInset + day * ROW_HEIGHT + ROW_HEIGHT / 2}
          color={color}
          delay={delay + 260 + index * 90}
        />
      ))}
    </G>
  );
}

function Knot({ cx, cy, color, delay }: { cx: number; cy: number; color: string; delay: number }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = 0;
    scale.value = withDelay(delay, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2.4)) }));
  }, [cx, cy, delay]);

  const props = useAnimatedProps(() => ({ r: DOT_RADIUS * scale.value }));

  return <AnimatedCircle cx={cx} cy={cy} fill={color} animatedProps={props} />;
}

export function ReuseWeave({
  threads,
  cookDays,
  width,
}: {
  threads: WeaveThread[];
  /** Дни, в которые по плану что-то готовится — у них строка подсвечена. */
  cookDays: number[];
  width: number;
}) {
  const theme = useTheme();
  const topInset = 6;
  const height = topInset * 2 + 7 * ROW_HEIGHT;
  const laneStart = LABEL_WIDTH + LANE_GAP / 2;

  return (
    <View>
      <Svg width={width} height={height}>
        {DAY_NAMES.map((name, day) => (
          <G key={name}>
            {cookDays.includes(day) ? (
              <Rect
                x={0}
                y={topInset + day * ROW_HEIGHT + 2}
                width={width}
                height={ROW_HEIGHT - 4}
                rx={6}
                fill={theme.colors.surfaceAlt}
              />
            ) : null}
            <Line
              x1={LABEL_WIDTH}
              y1={topInset + day * ROW_HEIGHT + ROW_HEIGHT / 2}
              x2={width}
              y2={topInset + day * ROW_HEIGHT + ROW_HEIGHT / 2}
              stroke={theme.colors.border}
              strokeWidth={1}
              strokeDasharray="2 5"
            />
          </G>
        ))}
        {threads.map((thread, index) => (
          <Thread
            key={thread.key}
            thread={thread}
            x={laneStart + index * LANE_GAP}
            color={categoryColors[thread.category as IngredientCategory] ?? theme.colors.inkFaint}
            delay={index * 110}
            topInset={topInset}
          />
        ))}
      </Svg>
      <View style={{ position: "absolute", left: 0, top: topInset }} pointerEvents="none">
        {DAY_NAMES.map((name, day) => (
          <View key={name} style={{ height: ROW_HEIGHT, justifyContent: "center" }}>
            <Text
              style={{
                ...theme.typography.caption,
                fontSize: 11,
                fontWeight: cookDays.includes(day) ? "700" : "400",
                color: cookDays.includes(day) ? theme.colors.ink : theme.colors.inkFaint,
              }}
            >
              {name.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Подписи нитей: цвет никогда не единственный носитель смысла. */
export function WeaveLegend({ threads }: { threads: WeaveThread[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
      {threads.map((thread) => (
        <View key={thread.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: categoryColors[thread.category as IngredientCategory] ?? theme.colors.inkFaint,
            }}
          />
          <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted }}>
            {thread.name} · {thread.days.length}
          </Text>
        </View>
      ))}
    </View>
  );
}
