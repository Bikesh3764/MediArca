// Text and TextInput in the Inter font. Use these instead of the ones from 'react-native':
// a bold weight (600) picks Inter SemiBold, everything else Inter Regular.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { type ComponentRef, forwardRef } from 'react';
import { Platform, Text as RNText, TextInput as RNTextInput, type StyleProp, StyleSheet, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { font } from '@/theme';

/** Font files loaded once in app/_layout.tsx. */
export const appFonts = { [font.regular]: Inter_400Regular, [font.semibold]: Inter_600SemiBold };

const BOLD = new Set(['500', '600', '700', '800', '900', 'bold']);

/**
 * iPhone keeps Apple's own font (San Francisco). Apple only licenses it for Apple devices,
 * so Android and web use Inter, the closest match: fontWeight is swapped for the matching file.
 */
const withFont = (style: StyleProp<TextStyle>) => {
  if (Platform.OS === 'ios') return style;
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return style;
  const bold = flat.fontWeight != null && BOLD.has(String(flat.fontWeight));
  return [style, { fontFamily: bold ? font.semibold : font.regular, fontWeight: 'normal' as const }];
};

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} {...props} style={withFont(style)} />;
});

export const TextInput = forwardRef<ComponentRef<typeof RNTextInput>, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={withFont(style)} />;
});
