// Clinic QR codes: Check-in (patients scan it at the front desk) and Booking (opens the clinic page).
// Same links as frontend/src/components/common/ClinicQrStandeeModal.tsx. Drawn on the phone; shared as an image or printed.
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { captureRef } from 'react-native-view-shot';
import { EmptyState, PlaceholderCard } from '@/components/kit';
import { QrCode, qrSvg } from '@/components/QrCode';
import { Button, Notice, Screen, Segmented, Title } from '@/components/ui';
import { useClinic } from '@/context/ClinicContext';
import { escapeHtml, printHtml } from '@/lib/print';
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
  const [busy, setBusy] = useState<'share' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poster = useRef<React.ComponentRef<typeof View>>(null);
  const clinic = data?.clinic;

  const url = clinic ? (kind === 'checkin' ? checkinQrUrl(clinic.id, clinic.checkinCode) : clinicBookingUrl(clinic.id)) : '';

  const shareImage = async () => {
    if (busy) return;
    setBusy('share');
    setError(null);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) throw new Error('no-share');
      const uri = await captureRef(poster, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: clinic?.clinicName || 'QR Code' });
    } catch {
      setError('Couldn’t share the image. Try Print instead.');
    } finally {
      setBusy(null);
    }
  };

  // A4 poster: clinic name, big QR, one line, MediArca. No codes printed as text.
  const print = async () => {
    if (busy || !clinic) return;
    setBusy('print');
    setError(null);
    try {
      await printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(clinic.clinicName)}</title>
<style>@page{size:A4;margin:0}body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f}
.page{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;padding:40px;box-sizing:border-box}
h1{font-size:40px;letter-spacing:-0.6px;margin:0;max-width:90%}.qr{border:1px solid #e5e5ea;border-radius:28px;padding:24px}
.cap{font-size:30px;font-weight:600}.brand{font-size:18px;font-weight:600;color:#0066cc}</style></head>
<body><div class="page"><h1>${escapeHtml(clinic.clinicName)}</h1><div class="qr">${qrSvg(url, 380)}</div>
<div class="cap">${escapeHtml(CAPTION[kind])}</div><div class="brand">MediArca</div></div></body></html>`);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t print. Try again.');
    } finally {
      setBusy(null);
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
          <Button label="Print" icon="print-outline" onPress={print} loading={busy === 'print'} />
          <Button label="Share image" variant="secondary" icon="share-outline" onPress={shareImage} loading={busy === 'share'} />
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
