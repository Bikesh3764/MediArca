// Text cut to a few lines with a "See more" / "See less" link, used for clinic addresses.
import { useState } from 'react';
import { Platform, type StyleProp, StyleSheet, type TextStyle, View } from 'react-native';
import { Text } from '@/components/AppText';
import { smoothLayout } from '@/lib/motion';
import { colors } from '@/theme';

export function MoreText({ children, lines = 1, style }: { children: string; lines?: number; style?: StyleProp<TextStyle> }) {
  const [open, setOpen] = useState(false);
  // Phones measure the real line count; the web has no measuring, so guess by length.
  const [long, setLong] = useState(Platform.OS === 'web' ? children.length > lines * 34 : false);
  const [measured, setMeasured] = useState(Platform.OS === 'web');

  if (!children) return null;

  return (
    <View>
      <Text
        style={style}
        numberOfLines={open || !measured ? undefined : lines}
        onTextLayout={
          measured
            ? undefined
            : (e) => {
                setLong(e.nativeEvent.lines.length > lines);
                setMeasured(true);
              }
        }
      >
        {children}
      </Text>
      {long ? (
        // Plain tappable text (not a button) so it can sit inside a tappable card
        <Text
          style={styles.linkText}
          suppressHighlighting
          onPress={(e) => {
            e?.stopPropagation?.();
            smoothLayout(200);
            setOpen((o) => !o);
          }}
        >
          {open ? 'See less' : 'See more'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  linkText: { alignSelf: 'flex-start', marginTop: 2, paddingVertical: 2, fontSize: 13, color: colors.primary },
});
