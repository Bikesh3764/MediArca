// Small animations used across the app: fade-in for new content, spring press for buttons,
// and a soft layout change for things that open and close. Runs on the native thread on phones.
import { useEffect, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, type StyleProp, type ViewStyle } from 'react-native';

export const nativeDriver = Platform.OS !== 'web';

/** Next layout change (a panel opening, a row appearing) animates instead of jumping. */
export const smoothLayout = (ms = 220) => {
  if (Platform.OS === 'web') return;
  LayoutAnimation.configureNext(LayoutAnimation.create(ms, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
};

/** Fades in and rises a little when it first appears. */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Spring scale for anything pressable: spread `handlers` on the Pressable, `style` on an Animated.View. */
export function usePressScale(to = 0.97) {
  const scale = useState(() => new Animated.Value(1))[0];
  const go = (value: number) => Animated.spring(scale, { toValue: value, speed: 40, bounciness: value === 1 ? 6 : 0, useNativeDriver: nativeDriver }).start();
  return {
    style: { transform: [{ scale }] },
    handlers: { onPressIn: () => go(to), onPressOut: () => go(1) },
  };
}
