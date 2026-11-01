// Edit the clinic's name, address, state, city and phone. Same checks as the website
// (frontend/src/pages/Clinic/dashboard/state.tsx handleSaveProfile).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type ClinicProfile, api } from '@mediarca/shared/api';
import { getCitiesForState, INDIAN_STATES } from '@mediarca/shared/utils/indiaStates';
import { formatIndianPhone, isValidIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { Sheet } from '@/components/kit';
import { Button, Card, Field, Notice, SelectField } from '@/components/ui';
import { success } from '@/lib/haptics';
import { space } from '@/theme';

const localPhone = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-10);

export function ClinicDetailsSheet({
  clinic,
  visible,
  onClose,
  onSaved,
}: {
  clinic: ClinicProfile | null | undefined;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fill the form each time the sheet opens
  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setName(clinic?.clinicName || '');
      setAddress(clinic?.address || '');
      setState(clinic?.state || '');
      setCity(clinic?.city || '');
      setPhone(localPhone(clinic?.phone));
      setError(null);
    }
  }

  const save = async () => {
    if (busy) return;
    if (!name.trim()) return setError('Enter the clinic name.');
    if (!address.trim()) return setError('Enter the street address.');
    if (!state) return setError('Choose a state.');
    if (!city) return setError('Choose a city.');
    if (phone.trim() && !isValidIndianPhone(phone.trim())) return setError('Enter a valid 10-digit mobile number.');
    setBusy(true);
    setError(null);
    try {
      await api.updateClinicProfile({
        clinicName: name.trim(),
        address: address.trim(),
        state,
        city: city.trim(),
        phone: phone.trim() ? formatIndianPhone(phone.trim()) : undefined,
      });
      success();
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Clinic details" doneLabel="Close" onClose={() => !busy && onClose()}>
      <View style={styles.stack}>
        <Card>
          <Field label="Clinic name" value={name} onChangeText={setName} maxLength={120} />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, area" maxLength={250} />
          <SelectField
            label="State"
            value={state}
            options={INDIAN_STATES}
            onChange={(s) => {
              setState(s);
              setCity('');
            }}
          />
          <SelectField label="City" value={city} options={state ? getCitiesForState(state) : []} onChange={setCity} disabled={!state} />
          <Field label="Phone" prefix="+91" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="Optional" />
        </Card>
        <Notice tone="error" message={error} />
        <Button label="Save" onPress={save} loading={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
});
