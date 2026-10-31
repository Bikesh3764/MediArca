// "Are you sure?" dialog. Native alert on phones; the browser's confirm in the web preview.
import { Alert, Platform } from 'react-native';

export const confirmAction = (opts: { title: string; message: string; confirmLabel: string; cancelLabel?: string }) =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web') {
      resolve(typeof globalThis.confirm === 'function' ? globalThis.confirm(`${opts.title}\n\n${opts.message}`) : true);
      return;
    }
    Alert.alert(opts.title, opts.message, [
      { text: opts.cancelLabel || 'Keep', style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
