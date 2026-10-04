import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

/**
 * PackStack — сколько упаковок придётся взять и сколько из них уйдёт в дело.
 *
 * Не непрерывная полоса прогресса, а дискретные блоки: каждая упаковка — это
 * отдельный блок фиксированной ширины, потому что в магазине так и есть —
 * пачку нельзя купить на 60%. Нужное количество заливается слева направо, и
 * последний блок обычно остаётся залит частично: вот этот видимый хвост и есть
 * излишек, который ДП из packing.ts старается сделать минимальным.
 */
export function PackStack({
  packs,
  needed,
  bought,
  color,
  delay = 0,
}: {
  packs: { size: number; count: number }[];
  needed: number;
  bought: number;
  color: string;
  delay?: number;
}) {
  const theme = useTheme();
  const blocks: number[] = [];
  for (const pack of packs) {
    for (let i = 0; i < pack.count; i++) blocks.push(pack.size);
  }
  if (blocks.length === 0) blocks.push(bought || needed);

  let remaining = needed;
  const fills = blocks.map((size) => {
    const used = Math.max(0, Math.min(size, remaining));
    remaining -= used;
    return size > 0 ? used / size : 0;
  });

  return (
    <View style={{ flexDirection: "row", gap: 3, marginTop: 6 }}>
      {fills.map((fill, index) => (
        <Block key={index} fill={fill} color={color} track={theme.colors.surfaceAlt} delay={delay + index * 70} />
      ))}
    </View>
  );
}

function Block({ fill, color, track, delay }: { fill: number; color: string; track: string; delay: number }) {
  const width = useSharedValue(0);
  const theme = useTheme();

  useEffect(() => {
    width.value = 0;
    width.value = withDelay(delay, withTiming(fill, { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, [fill, delay]);

  const style = useAnimatedStyle(() => ({ width: `${Math.round(width.value * 100)}%` }));

  return (
    <View
      style={{
        flex: 1,
        height: 7,
        maxWidth: 46,
        borderRadius: 3,
        backgroundColor: track,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: "hidden",
      }}
    >
      <Animated.View style={[{ height: "100%", backgroundColor: color, borderRadius: 2 }, style]} />
    </View>
  );
}
