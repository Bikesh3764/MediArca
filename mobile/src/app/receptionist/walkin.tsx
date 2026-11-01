// Front desk adds a walk-in for any of its doctors and gets a token (plus a tracking code).
import { api } from '@mediarca/shared/api';
import { WalkinForm } from '@/components/WalkinForm';
import { EmptyState, PlaceholderCard } from '@/components/kit';
import { Screen, Title } from '@/components/ui';
import { useDesk } from '@/context/DeskContext';
import { doctorName } from '@/lib/booking';

export default function DeskWalkin() {
  const { desk, reload } = useDesk();
  const doctors = desk?.doctors || [];

  return (
    <Screen edges={['top']}>
      <Title>Walk-in</Title>
      {!desk ? (
        <PlaceholderCard height={300} />
      ) : doctors.length === 0 ? (
        <EmptyState icon="medkit-outline" title="No doctors yet" message="Your clinic adds doctors to this desk." />
      ) : (
        <WalkinForm
          doctors={doctors.map((d) => ({ id: d.doctorId, label: doctorName(d.fullName) }))}
          fixedClinicId={desk.clinic?.id || doctors[0]?.clinics?.[0]?.clinicId}
          phoneRequired
          familyToggle
          submit={async (v) => {
            const res: any = await api.bookWalkinAppointment({
              doctorId: v.doctorId,
              patientName: v.patientName,
              patientPhone: v.patientPhone || '',
              gender: v.gender,
              patientAge: v.patientAge,
              isForOther: v.isForOther,
              appointmentDate: v.appointmentDate,
              slotId: v.slotId,
              clinicId: v.clinicId,
              reasonForVisit: v.reasonForVisit || 'Walk-in Consultation',
            });
            reload();
            const a = res?.data || res;
            return {
              queueNumber: a?.queueNumber ?? res?.queueNumber,
              estimatedTime: a?.estimatedTime ?? res?.estimatedTime,
              checkingWindow: a?.checkingWindow ?? res?.checkingWindow,
              walkInCode: res?.walkInCode ?? a?.walkInCode ?? null,
              patientName: v.patientName,
              patientPhone: v.patientPhone,
              doctorName: doctors.find((d) => d.doctorId === v.doctorId)?.fullName || 'Doctor',
              appointmentDate: v.appointmentDate,
            };
          }}
        />
      )}
    </Screen>
  );
}
