import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { Clock, DollarSign, CheckCircle2, ChevronLeft, AlertCircle } from 'lucide-react';

export const ManageSchedule: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [checkingStartTime, setCheckingStartTime] = useState('09:00');
  const [checkingEndTime, setCheckingEndTime] = useState('13:00');
  const [avgConsultationMinutes, setAvgConsultationMinutes] = useState(15);
  const [maxDailyPatients, setMaxDailyPatients] = useState(25);
  const [consultationFee, setConsultationFee] = useState(70);
  const [clinicAddress, setClinicAddress] = useState('');
  const [bio, setBio] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    if (user.doctorProfile) {
      const p = user.doctorProfile;
      setCheckingStartTime(p.checkingStartTime || '09:00');
      setCheckingEndTime(p.checkingEndTime || '13:00');
      setAvgConsultationMinutes(p.avgConsultationMinutes || 15);
      setMaxDailyPatients(p.maxDailyPatients || 25);
      setConsultationFee(p.consultationFee || 70);
      setClinicAddress(p.clinicAddress || '');
      setBio(p.bio || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.updateDoctorSchedule({
        checkingStartTime,
        checkingEndTime,
        avgConsultationMinutes: Number(avgConsultationMinutes),
        maxDailyPatients: Number(maxDailyPatients),
        consultationFee: Number(consultationFee),
        clinicAddress,
        bio,
      });

      await refreshUser();
      setSuccessMsg('Checking schedule and clinic parameters updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Manage Practice Schedule" subtitle="Configure daily checking hours & capacity">
        <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </AppleButton>
      </SubNav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8">
        <UtilityCard>
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#0066cc]" />
                Daily Patient Checking Window
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={checkingStartTime}
                    onChange={(e) => setCheckingStartTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                    Shift End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={checkingEndTime}
                    onChange={(e) => setCheckingEndTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                  Avg Consultation Time (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={avgConsultationMinutes}
                  onChange={(e) => setAvgConsultationMinutes(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                  Max Daily Patients Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxDailyPatients}
                  onChange={(e) => setMaxDailyPatients(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-sm"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#f0f0f0]">
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#0066cc]" />
                Consultation Fee & Facility
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                    Consultation Fee ($ USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Number(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                    Clinic / Hospital Address
                  </label>
                  <input
                    type="text"
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                    placeholder="e.g. Apex Health Center, Suite 300, New York, NY"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#7a7a7a] mb-1">
                    Professional Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your areas of clinical focus, background, and patient care philosophy..."
                    className="w-full p-3 rounded-xl border border-[#e0e0e0] text-sm"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex justify-end">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Practice Parameters'}
              </AppleButton>
            </div>
          </form>
        </UtilityCard>
      </div>
    </div>
  );
};
