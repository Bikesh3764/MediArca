// Profile or clinic photo: tap to choose one from the phone, crop it square, shrink it, upload.
// Same server calls as frontend/src/pages/Doctor/DoctorProfile.tsx and Clinic/ClinicProfile.tsx.
// The server takes JPG/PNG/WebP up to 1 MB; photos are cut to 600 px JPEG, well under that.
import { Ionicons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { api } from '@mediarca/shared/api';
import { ActionMenu } from '@/components/ActionMenu';
import { useAuth } from '@/context/AuthContext';
import { success } from '@/lib/haptics';
import { colors } from '@/theme';

const SIZE = 600;

async function shrink(uri: string) {
  const image = await ImageManipulator.manipulate(uri).resize({ width: SIZE, height: SIZE }).renderAsync();
  const out = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return out.uri;
}

async function asUpload(uri: string) {
  const name = 'photo.jpg';
  if (Platform.OS !== 'web') return { uri, name, type: 'image/jpeg' };
  // In the browser preview the photo is a blob link, so send the file itself
  const blob = await (await fetch(uri)).blob();
  return new File([blob], name, { type: 'image/jpeg' });
}

/**
 * Wraps a photo (Avatar or ClinicImage) with a small camera badge.
 * Tapping it offers Choose photo / Remove photo; the new photo shows everywhere after saving.
 */
export function PhotoPicker({
  children,
  hasPhoto,
  onChanged,
  onError,
  rounded = false,
}: {
  children: React.ReactNode;
  /** Clinic photos are rounded squares, people are circles. */
  rounded?: boolean;
  hasPhoto: boolean;
  /** Called after a photo is saved or removed (e.g. reload the clinic). */
  onChanged?: () => void;
  onError: (message: string | null) => void;
}) {
  const { updateUser } = useAuth();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    onError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return onError('Allow photo access in your phone settings.');
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (picked.canceled || !picked.assets?.[0]) return;
    setBusy(true);
    try {
      const file = await asUpload(await shrink(picked.assets[0].uri));
      const res = await api.uploadAvatar(file);
      if (res?.user) updateUser(res.user);
      success();
      onChanged?.();
    } catch (err: any) {
      onError(err?.message || 'Couldn’t upload the photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    onError(null);
    setBusy(true);
    try {
      const res = await api.removeAvatar();
      if (res?.user) updateUser(res.user);
      onChanged?.();
    } catch (err: any) {
      onError(err?.message || 'Couldn’t remove the photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? 'Change photo' : 'Add photo'}
        disabled={busy}
        onPress={() => (hasPhoto ? setMenu(true) : choose())}
        style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.8 }]}
      >
        {children}
        {busy ? (
          <View style={[styles.cover, { borderRadius: rounded ? 16 : 999 }]}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
        <View style={styles.badge}>
          <Ionicons name="camera" size={13} color={colors.white} />
        </View>
      </Pressable>
      <ActionMenu
        actions={
          menu
            ? [
                { label: 'Choose photo', onPress: choose },
                { label: 'Remove photo', onPress: remove, destructive: true },
              ]
            : null
        }
        onClose={() => setMenu(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
