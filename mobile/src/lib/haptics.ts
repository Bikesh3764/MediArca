// Light taps on selection, like iOS. Silent where haptics aren't available (web).
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const tap = () => {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
};

export const success = () => {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
