import React from 'react';
import { Appointment } from '../../services/api';
import { AppleButton } from './AppleButton';
import { BrandLogo } from './BrandLogo';
import { X, Printer, CheckCircle } from 'lucide-react';

interface PrescriptionModalProps {
  appointment: Appointment | null;
  onClose: () => void;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ appointment, onClose }) => {
  if (!appointment || !appointment.prescription) return null;

  const { doctor, prescription, appointmentDate, queueNumber } = appointment;
  let medicines: any[] = [];
  try {
    medicines = JSON.parse(prescription.medicines);
  } catch {
    medicines = [];
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[24px] border border-[#e0e0e0] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8">
        {/* Modal Controls */}
        <div className="flex items-center justify-between pb-6 border-b border-[#e0e0e0]">
          <div className="flex items-center gap-2">
            <BrandLogo variant="icon" size="sm" />
            <h2 className="text-[20px] font-semibold text-[#1d1d1f]">Official Digital Prescription</h2>
          </div>
          <div className="flex items-center gap-2">
            <AppleButton variant="ghost" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-[#1d1d1f]" />
              <span>Print / PDF</span>
            </AppleButton>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-[#7a7a7a] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prescription Header / Clinic Info */}
        <div className="my-6 grid grid-cols-2 gap-4 pb-6 border-b border-[#f0f0f0] text-xs">
          <div>
            <span className="text-[#7a7a7a] block">Healthcare Provider</span>
            <h3 className="text-[16px] font-semibold text-[#1d1d1f] mt-0.5">{doctor.user.fullName}</h3>
            <p className="text-[#0088e8] font-medium">{doctor.specialty} • {doctor.qualifications}</p>
            <p className="text-[#7a7a7a] mt-1">{doctor.clinicAddress}</p>
          </div>
          <div className="text-right">
            <span className="text-[#7a7a7a] block">Date of Consultation</span>
            <strong className="text-[14px] text-[#1d1d1f] block mt-0.5">{appointmentDate}</strong>
            <span className="text-[#7a7a7a] block mt-2">Queue Token</span>
            <span className="inline-block bg-[#1d1d1f] text-white px-2.5 py-0.5 rounded text-xs font-semibold">
              Queue #{queueNumber}
            </span>
          </div>
        </div>

        {/* Clinical Diagnosis */}
        <div className="mb-6 p-4 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0]/70">
          <span className="text-xs font-semibold text-[#7a7a7a] uppercase tracking-wider block">
            Clinical Diagnosis / Impression
          </span>
          <p className="text-[15px] font-medium text-[#1d1d1f] mt-1">{prescription.diagnosis}</p>
          {appointment.clinicalNotes && (
            <p className="text-xs text-[#7a7a7a] mt-2 italic">
              Notes: {appointment.clinicalNotes}
            </p>
          )}
        </div>

        {/* Prescribed Medicines */}
        <div className="mb-6">
          <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-3 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Prescribed Medications
          </h4>
          <div className="space-y-3">
            {medicines.map((med: any, idx: number) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-[#e0e0e0] bg-white hover:border-[#0088e8]/30 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-semibold text-[#1d1d1f] text-[14px]">{med.name}</h5>
                    <p className="text-xs text-[#0088e8] font-medium mt-0.5">
                      Dosage: {med.dosage} • Frequency: {med.frequency}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#7a7a7a] bg-gray-100 px-2 py-0.5 rounded">
                    Duration: {med.duration}
                  </span>
                </div>
                {med.instructions && (
                  <p className="text-xs text-[#7a7a7a] mt-2 border-t border-gray-100 pt-2">
                    Instruction: {med.instructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Doctor Advice & Follow Up */}
        {(prescription.advice || prescription.followUpDate) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#0088e8]/5 border border-[#0088e8]/20 text-xs">
            {prescription.advice && (
              <div>
                <strong className="text-[#0088e8] block mb-1">Dietary & Lifestyle Advice</strong>
                <p className="text-[#1d1d1f]">{prescription.advice}</p>
              </div>
            )}
            {prescription.followUpDate && (
              <div>
                <strong className="text-[#0088e8] block mb-1">Recommended Follow-up</strong>
                <p className="text-[#1d1d1f] font-semibold">{prescription.followUpDate}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-[#f0f0f0] flex justify-end">
          <AppleButton variant="dark" size="sm" onClick={onClose}>
            Close
          </AppleButton>
        </div>
      </div>
    </div>
  );
};
