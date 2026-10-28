import { useRouter, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type ScreenBackButtonProps = {
  fallbackHref?: Href;
  onPress?: () => void;
};

export function ScreenBackButton({
  fallbackHref = '/(tabs)',
  onPress,
}: ScreenBackButtonProps) {
  const router = useRouter();

  function handlePress() {
    if (onPress) {
      onPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <ChevronLeft color={Colors.text} size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pressed: { opacity: 0.6 },
});
