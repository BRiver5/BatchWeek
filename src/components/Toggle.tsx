import { Switch } from "react-native";
import { useTheme } from "../theme";

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function Toggle({ value, onValueChange }: Props) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      // Выключенный трек НЕ surfaceAlt: на карточках того же тона переключатель
      // пропадал целиком, оставался висеть один белый кружок (видно на живом
      // прогоне). Ползунок тоже фиксированно светлый, а не onAccent.
      trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
      thumbColor="#FFFFFF"
    />
  );
}
