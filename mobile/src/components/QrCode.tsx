// QR code drawn on the phone (no outside service sees the check-in code). Each row is a few dark bars.
import { useMemo } from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';

// Only the encoder: the package's main file pulls in canvas and file code the app doesn't need
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('qrcode/lib/core/qrcode') as {
  create: (text: string, opts: { errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' }) => { modules: { size: number; get: (r: number, c: number) => number | boolean } };
};

export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const rows = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    const out: { start: number; len: number }[][] = [];
    for (let r = 0; r < n; r++) {
      const runs: { start: number; len: number }[] = [];
      let c = 0;
      while (c < n) {
        if (modules.get(r, c)) {
          const start = c;
          while (c < n && modules.get(r, c)) c++;
          runs.push({ start, len: c - start });
        } else c++;
      }
      out.push(runs);
    }
    return out;
  }, [value]);

  // Whole pixels per cell keep the edges sharp; 2 cells of white border around it
  const cell = Math.max(1, Math.floor(size / (rows.length + 4)));
  const box = cell * (rows.length + 4);
  return (
    <View accessibilityRole="image" accessibilityLabel="QR code" style={{ width: box, height: box, backgroundColor: colors.white, padding: cell * 2 }}>
      {rows.map((runs, r) => (
        <View key={r} style={{ height: cell, flexDirection: 'row' }}>
          {runs.map((run) => (
            <View key={run.start} style={{ position: 'absolute', left: run.start * cell, width: run.len * cell, height: cell, backgroundColor: '#000' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
