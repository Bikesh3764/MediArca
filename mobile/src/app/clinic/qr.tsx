// Clinic QR codes: Check-in (patients scan it at the front desk) and Booking (opens the clinic page).
// Same links as frontend/src/components/common/ClinicQrStandeeModal.tsx. Drawn on the phone; shared as an image.
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { EmptyState, PlaceholderCard } from '@/components/kit';
import { QrCode } from '@/components/QrCode';
import { Button, Notice, Screen, Segmented, Title } from '@/components/ui';
import { useClinic } from '@/context/ClinicContext';
import { checkinQrUrl, clinicBookingUrl } from '@/lib/site';
import { colors, radius, shadow, space, type } from '@/theme';

type Kind = 'checkin' | 'booking';
const CAPTION: Record<Kind, string> = {
  checkin: 'Scan to check in',
  booking: 'Scan to book a doctor',
};

export default function ClinicQr() {
  const { data, failed, reload } = useClinic();
  const [kind, setKind] = useState<Kind>('checkin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poster = useRef<React.ComponentRef<typeof View>>(null);
  const clinic = data?.clinic;

  const url = clinic ? (kind === 'checkin' ? checkinQrUrl(clinic.id, clinic.checkinCode) : clinicBookingUrl(clinic.id)) : '';

  const shareImage = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) throw new Error('no-share');
      const uri = await captureRef(poster, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: clinic?.clinicName || 'QR Code' });
    } catch {
      setError('Couldn’t share the image. Use the website to print it.');
    } finally {
      setBusy(false);
    }
  };

  const shareLink = () => {
    if (!clinic) return;
    Share.share({ message: `Book a doctor at ${clinic.clinicName}\n${clinicBookingUrl(clinic.id)}` }).catch(() => {});
  };

  return (
    <Screen edges={['top']}>
      <Title>QR Code</Title>
      {!clinic ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={reload} />
        ) : (
          <PlaceholderCard height={360} />
        )
      ) : (
        <>
          <Segmented
            options={[
              { value: 'checkin', label: 'Check-in' },
              { value: 'booking', label: 'Booking' },
            ]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setError(null);
            }}
          />

          <View style={styles.card}>
            {/* The part saved as an image: white, name on top, one line below */}
            <View ref={poster} collapsable={false} style={styles.poster}>
              <Text style={styles.name} numberOfLines={2}>
                {clinic.clinicName}
              </Text>
              <QrCode value={url} size={248} />
              <Text style={styles.caption}>{CAPTION[kind]}</Text>
              <Text style={styles.brand}>MediArca</Text>
            </View>
          </View>

          <Text style={[type.caption, styles.center]}>
            {kind === 'checkin' ? 'Keep it at the front desk.' : 'Put it at the entrance or share it.'}
          </Text>
          <Notice tone="error" message={error} />
          <Button label="Share image" icon="share-outline" onPress={shareImage} loading={busy} />
          {kind === 'booking' ? <Button label="Share link" variant="secondary" icon="link" onPress={shareLink} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  poster: { backgroundColor: colors.white, alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.md },
  name: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3, color: colors.ink, textAlign: 'center' },
  caption: { fontSize: 17, fontWeight: '600', color: colors.ink },
  brand: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
