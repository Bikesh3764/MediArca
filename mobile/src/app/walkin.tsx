// Doctor adds a walk-in to their own queue (front desk walk-ins: receptionist/walkin.tsx).
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { type DoctorAffiliationClinic, api } from '@mediarca/shared/api';
import { WalkinForm } from '@/components/WalkinForm';
import { EmptyState, PlaceholderCard } from '@/components/kit';
import { Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function DoctorWalkin() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState<DoctorAffiliationClinic[] | null>(null);

  useEffect(() => {
    api
      .getDoctorAffiliations()
      .then((a) => setClinics(a.clinics || []))
      .catch(() => setClinics([]));
  }, []);

  if (user?.role !== 'DOCTOR') return <Redirect href="/" />;
  const doctorId = user.doctorProfile?.id || user.id;

  return (
    <Screen back="/doctor">
      <Title>Walk-in</Title>
      {!clinics ? (
        <PlaceholderCard height={300} />
      ) : clinics.length === 0 ? (
        <EmptyState icon="business-outline" title="Add a clinic first" message="Join a clinic on the website to see patients." />
      ) : (
        <WalkinForm
          fixedDoctorId={doctorId}
          clinics={clinics.map((c) => ({ id: c.clinicId, label: c.clinicName }))}
          phoneRequired={false}
          familyToggle={false}
          submit={async (v) => {
            const res: any = await api.bookAppointment({
              doctorId: v.doctorId,
              appointmentDate: v.appointmentDate,
              slotId: v.slotId,
              reasonForVisit: v.reasonForVisit || 'Clinic Walk-in Consultation',
              isForOther: true,
              patientName: v.patientName,
              patientAge: v.patientAge,
              patientGender: v.gender,
              patientPhone: v.patientPhone,
              clinicId: v.clinicId,
            });
            const a = res?.data || res;
            return {
              queueNumber: a?.queueNumber,
              estimatedTime: a?.estimatedTime,
              checkingWindow: a?.checkingWindow,
              walkInCode: v.patientPhone ? a?.walkInCode ?? null : null,
              patientName: v.patientName,
              patientPhone: v.patientPhone,
              doctorName: user.fullName,
              appointmentDate: v.appointmentDate,
            };
          }}
        />
      )}
    </Screen>
  );
}
