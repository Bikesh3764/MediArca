import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Doctor, QueuePreview } from '../../services/api';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  ShieldCheck,
  Star,
  Clock,
  MapPin,
  Award,
  Calendar,
  UserCheck,
  ChevronLeft,
} from 'lucide-react';

export const DoctorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [queuePreview, setQueuePreview] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const data = await api.getDoctorById(id);
        setDoctor(data);
      } catch (err) {
        console.error('Failed to load doctor:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctor();
  }, [id]);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!id || !selectedDate) return;
      setLoadingQueue(true);
      try {
        const preview = await api.getQueuePreview(id, selectedDate);
        setQueuePreview(preview);
      } catch (err) {
        console.error('Failed to calculate queue preview:', err);
      } finally {
        setLoadingQueue(false);
      }
    };
    fetchQueue();
  }, [id, selectedDate]);

  if (loading || !doctor) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title={doctor.user.fullName} subtitle={doctor.specialty}>
        <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctors')} className="flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" />
          Back to Directory
        </AppleButton>
      </SubNav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Doctor Bio & Credentials (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <UtilityCard>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-[#f0f0f0]">
                <div className="w-24 h-24 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden flex-shrink-0">
                  {doctor.user.avatarUrl ? (
                    <img src={doctor.user.avatarUrl} alt={doctor.user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[#0066cc]">
                      {doctor.user.fullName[0]}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-[#1d1d1f]">{doctor.user.fullName}</h2>
                    <span title="Verified Practitioner"><ShieldCheck className="w-5 h-5 text-[#0066cc]" /></span>
                  </div>
                  <p className="text-[16px] text-[#0066cc] font-medium mt-0.5">{doctor.specialty}</p>
                  <p className="text-xs text-[#7a7a7a] mt-1">{doctor.qualifications}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-[#1d1d1f]">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <strong>{doctor.rating.toFixed(1)}</strong> ({doctor.totalReviews} reviews)
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[#7a7a7a]">
                      <Award className="w-4 h-4" />
                      {doctor.experienceYears} Years Experience
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio & Clinic */}
              <div className="py-6 border-b border-[#f0f0f0]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-2">About the Doctor</h3>
                <p className="text-[15px] leading-relaxed text-[#1d1d1f]">{doctor.bio}</p>

                <div className="mt-5 p-4 rounded-xl bg-[#f5f5f7] flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#0066cc] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#1d1d1f]">Clinic / Hospital Location</h4>
                    <p className="text-xs text-[#7a7a7a] mt-0.5">{doctor.clinicAddress || 'MediArca Healthcare Facility'}</p>
                  </div>
                </div>
              </div>

              {/* Patient Reviews */}
              <div className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-4">
                  Patient Reviews ({doctor.reviews?.length || 0})
                </h3>
                <div className="space-y-3">
                  {doctor.reviews && doctor.reviews.length > 0 ? (
                    doctor.reviews.map((rev) => (
                      <div key={rev.id} className="p-4 rounded-xl border border-[#f0f0f0] bg-[#fafafc]">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-xs text-[#1d1d1f]">
                            {rev.patientUser.fullName}
                          </span>
                          <div className="flex items-center gap-1">
                            {[...Array(rev.rating)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-[#7a7a7a] italic">"{rev.comment}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#7a7a7a]">No reviews yet for this doctor.</p>
                  )}
                </div>
              </div>
            </UtilityCard>
          </div>

          {/* Live Queue Booking Preview Widget (1 Column) */}
          <div className="space-y-6">
            <UtilityCard className="sticky top-28">
              <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider block mb-1">
                Queue Reservation
              </span>
              <h3 className="text-xl font-semibold text-[#1d1d1f] mb-4">Book Your Token</h3>

              {/* Date Selector */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
                  Select Appointment Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-[14px] bg-white focus:outline-none focus:border-[#0066cc]"
                />
              </div>

              {/* Dynamic Queue Preview Card */}
              {loadingQueue ? (
                <div className="p-6 rounded-2xl bg-[#f5f5f7] animate-pulse h-40"></div>
              ) : queuePreview ? (
                <div className="p-5 rounded-2xl bg-[#0066cc]/5 border border-[#0066cc]/20 mb-5 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-[#0066cc]/10">
                    <span className="text-xs text-[#7a7a7a]">Checking Hours:</span>
                    <strong className="text-xs text-[#0066cc] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {queuePreview.checkingWindow}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[#7a7a7a] uppercase block">Assigned Token</span>
                      <strong className="text-2xl text-[#1d1d1f]">
                        Queue #{queuePreview.nextQueueNumber}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-[#7a7a7a] uppercase block">Est. Start Time</span>
                      <strong className="text-base text-[#0066cc]">
                        {queuePreview.estimatedTime}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0066cc]/10 text-xs text-[#7a7a7a] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {queuePreview.patientsAhead === 0
                        ? 'No patients ahead of you! You will be first.'
                        : `${queuePreview.patientsAhead} patient(s) ahead in line today.`}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Price summary & Proceed */}
              <div className="pt-2 border-t border-[#f0f0f0] mb-5">
                <div className="flex justify-between text-xs mb-1 text-[#7a7a7a]">
                  <span>Consultation Fee:</span>
                  <span className="font-semibold text-[#1d1d1f] text-sm">${doctor.consultationFee}</span>
                </div>
                <div className="flex justify-between text-xs text-[#7a7a7a]">
                  <span>Booking Fee:</span>
                  <span className="text-emerald-600 font-semibold">$0.00 (Zero Upfront Paywall)</span>
                </div>
              </div>

              {queuePreview?.isFull && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span>Doctor's maximum capacity reached for this date. Please select another date.</span>
                </div>
              )}

              <AppleButton
                variant="primary"
                size="lg"
                disabled={Boolean(queuePreview?.isFull)}
                onClick={() => navigate(`/book/${doctor.id}?date=${selectedDate}`)}
                className="w-full"
              >
                {queuePreview?.isFull ? 'Fully Booked for Date' : 'Proceed to Confirm Queue'}
              </AppleButton>
            </UtilityCard>
          </div>
        </div>
      </div>
    </div>
  );
};
