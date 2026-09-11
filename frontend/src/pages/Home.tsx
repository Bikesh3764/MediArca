import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppleButton } from '../components/ui/AppleButton';
import { Clock, ShieldCheck, ArrowRight, Star, MapPin, Calendar, Stethoscope } from 'lucide-react';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const data = await api.getDoctors();
        setDoctors(data.slice(0, 3));
      } catch (err) {
        console.error('Failed to load doctors:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  const role = user?.role?.toUpperCase();
  const isDoctor = role === 'DOCTOR';
  const isAdmin = role === 'ADMIN';
  const isPatient = Boolean(user && !isDoctor && !isAdmin);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section - Apple Product Announcement Aesthetic */}
      <section className="bg-white pt-20 pb-24 border-b border-[#e5e5ea] text-center px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {user ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0066cc]/10 border border-[#0066cc]/20 text-xs font-semibold text-[#0066cc] mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#0066cc] animate-pulse"></span>
              Welcome back, {user.fullName?.split(' ')[0] || user.fullName || 'User'} • {isDoctor ? 'Doctor Console' : isAdmin ? 'Admin Control Center' : 'Patient Dashboard'}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#0066cc]"></span>
              Introducing MediArca Live Queue
            </div>
          )}

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.08] mb-6">
            Healthcare. Organized with clinical clarity.
          </h1>

          <p className="text-lg sm:text-2xl font-light text-[#86868b] max-w-2xl mx-auto leading-relaxed mb-10">
            Discover verified doctors, inspect real-time checking hours, and reserve your guaranteed queue token in seconds.
          </p>

          {/* Strictly At Most TWO Clean Apple Action Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {isPatient ? (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                  className="flex items-center gap-2"
                >
                  Find a Doctor
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/patient/appointments')}
                  className="flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-[#0066cc]" />
                  My Appointments
                </AppleButton>
              </>
            ) : isDoctor ? (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctor/dashboard')}
                  className="flex items-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  Open Doctor Console
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/doctor/schedule')}
                  className="flex items-center gap-2"
                >
                  <Clock className="w-4 h-4 text-[#0066cc]" />
                  Manage Schedule
                </AppleButton>
              </>
            ) : isAdmin ? (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Control Center
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                >
                  Browse Doctors
                </AppleButton>
              </>
            ) : (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                >
                  Find a Doctor
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  Sign In to Patient Portal
                </AppleButton>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Platform Value Pillars - Pure Apple Editorial Architecture (Removed Fake Simulation Widget) */}
      <section className="bg-[#f5f5f7] py-20 px-4 sm:px-6 border-b border-[#e5e5ea]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider block mb-2">
              Clinical Architecture
            </span>
            <h2 className="text-3xl sm:text-5xl font-semibold text-[#1d1d1f] tracking-tight">
              Clinical excellence. Engineered for real life.
            </h2>
            <p className="text-[#86868b] mt-3 text-base sm:text-lg leading-relaxed">
              MediArca eliminates waiting room guesswork with atomic queue reservations, verified practitioners, and transparent doctor checking windows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-8 shadow-sm hover:shadow-apple-card transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mb-5 font-semibold text-base">
                  01
                </div>
                <h3 className="text-[19px] font-semibold text-[#1d1d1f] mb-2 tracking-tight">
                  Atomic Queue Tokens
                </h3>
                <p className="text-[14px] text-[#86868b] leading-relaxed">
                  Reserve your exact consultation token in real time. Know your position and checking shift before leaving home.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-8 shadow-sm hover:shadow-apple-card transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mb-5 font-semibold text-base">
                  02
                </div>
                <h3 className="text-[19px] font-semibold text-[#1d1d1f] mb-2 tracking-tight">
                  Verified Practitioners
                </h3>
                <p className="text-[14px] text-[#86868b] leading-relaxed">
                  Every doctor is reviewed and verified by platform administrators to ensure certified licensing and clinical safety.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-8 shadow-sm hover:shadow-apple-card transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mb-5 font-semibold text-base">
                  03
                </div>
                <h3 className="text-[19px] font-semibold text-[#1d1d1f] mb-2 tracking-tight">
                  Direct Care Access
                </h3>
                <p className="text-[14px] text-[#86868b] leading-relaxed">
                  Zero subscription walls and zero upfront paywalls. Instant appointment booking with direct consultation fee settlement at the clinic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Verified Specialists - Clean Apple Product / Clinical Cards */}
      <section className="bg-white py-20 px-4 sm:px-6 border-b border-[#e5e5ea]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
            <div>
              <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider block mb-2">
                Verified Medical Practitioners
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tracking-tight">
                Specialists ready for consultation today.
              </h2>
            </div>
            <Link
              to="/doctors"
              className="mt-4 sm:mt-0 inline-flex items-center gap-1.5 text-[15px] font-medium text-[#0066cc] hover:underline"
            >
              View all specialists <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-72 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea] animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {doctors.map((doctor) => {
                const slots = parseDoctorSlots(doctor);
                return (
                  <div
                    key={doctor.id}
                    className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm hover:shadow-apple-card hover:border-[#0066cc]/40 transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Doctor Profile Header */}
                      <div className="flex items-start gap-4 mb-5">
                        <div
                          onClick={() => navigate(`/doctor/${doctor.id}`)}
                          className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer transition-transform group-hover:scale-105"
                        >
                          {doctor.user.avatarUrl ? (
                            <img
                              src={doctor.user.avatarUrl}
                              alt={doctor.user.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-xl text-[#0066cc]">
                              {doctor.user.fullName[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3
                              onClick={() => navigate(`/doctor/${doctor.id}`)}
                              className="text-[18px] font-semibold text-[#1d1d1f] truncate hover:text-[#0066cc] transition-colors cursor-pointer tracking-tight"
                            >
                              {doctor.user.fullName}
                            </h3>
                            <span title="Verified Practitioner by MediArca">
                              <ShieldCheck className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center text-[11px] font-medium text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full">
                              {doctor.specialty}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-2">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                            <span className="font-semibold text-[#1d1d1f]">{doctor.rating.toFixed(1)}</span>
                            <span>({doctor.totalReviews} reviews)</span>
                          </div>
                        </div>
                      </div>

                      {/* Apple Spec Tile Info Grid: Experience & Fee */}
                      <div className="grid grid-cols-2 gap-2.5 mb-4">
                        <div className="p-3 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70">
                          <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                            Experience
                          </span>
                          <span className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5 block">
                            {doctor.experienceYears} Years
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70">
                          <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                            Consultation Fee
                          </span>
                          <span className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5 block">
                            ${doctor.consultationFee} <span className="text-[10px] text-[#86868b] font-normal">at clinic</span>
                          </span>
                        </div>
                      </div>

                      {/* Checking Schedule Badge */}
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70 text-xs mb-4">
                        <span className="text-[#86868b] flex items-center gap-1.5 font-normal">
                          <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                          Checking Shift
                        </span>
                        <strong className="font-semibold text-[#0066cc]">
                          {slots.length > 1
                            ? `${slots.length} Shifts (${format12Hour(slots[0].startTime)}–${format12Hour(slots[0].endTime)})`
                            : `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`}
                        </strong>
                      </div>

                      {/* Dedicated Polished Clinic Address */}
                      <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70 text-xs mb-5">
                        <MapPin className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-[#1d1d1f] block truncate">
                            {doctor.clinicAddress || 'MediArca Healthcare Clinic'}
                          </span>
                          <span className="text-[11px] text-[#86868b] block mt-0.5">
                            In-Person Outpatient Consultation
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3.5 border-t border-[#f0f0f0]">
                      <AppleButton
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/doctor/${doctor.id}`)}
                        className="px-4 text-xs font-medium"
                      >
                        Details
                      </AppleButton>
                      <AppleButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/book/${doctor.id}`)}
                        className="flex-1 justify-center flex items-center gap-1.5 font-medium"
                      >
                        <span>Book Appointment</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </AppleButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. Call to Action - Strict TWO Apple Pills on Dark Canvas */}
      <section className="bg-[#1d1d1f] text-white py-20 px-4 sm:px-6 text-center">
        <div className="max-w-3xl mx-auto">
          {isPatient ? (
            <>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                Healthcare clarity right in your pocket.
              </h2>
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto leading-relaxed">
                Track your active queue positions in real-time, view verified prescriptions, or explore new medical specialists.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                >
                  Browse Doctor Catalog
                </AppleButton>
                <AppleButton
                  variant="secondary-dark"
                  size="lg"
                  onClick={() => navigate('/patient/appointments')}
                  className="flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-[#2997ff]" />
                  My Appointments
                </AppleButton>
              </div>
            </>
          ) : isDoctor ? (
            <>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                Clinical practice, organized with precision.
              </h2>
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto leading-relaxed">
                Manage your daily checking shifts, call queued patients, and write verified digital prescriptions.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctor/dashboard')}
                  className="flex items-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  Open Doctor Console
                </AppleButton>
                <AppleButton
                  variant="secondary-dark"
                  size="lg"
                  onClick={() => navigate('/doctor/schedule')}
                  className="flex items-center gap-2"
                >
                  <Clock className="w-4 h-4 text-[#2997ff]" />
                  Manage Schedule
                </AppleButton>
              </div>
            </>
          ) : isAdmin ? (
            <>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                Platform governance & clinical compliance.
              </h2>
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto leading-relaxed">
                Inspect practitioner license credentials, monitor atomic queue reservations, and review clinic telemetry.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Control Center
                </AppleButton>
                <AppleButton
                  variant="secondary-dark"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                >
                  Browse Doctor Catalog
                </AppleButton>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                Experience clinical booking without friction.
              </h2>
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto leading-relaxed">
                Zero subscription walls, zero forced medical histories. Just direct access to certified medical care.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                >
                  Browse Doctor Catalog
                </AppleButton>
                <AppleButton
                  variant="secondary-dark"
                  size="lg"
                  onClick={() => navigate('/signup')}
                >
                  Create Free Account
                </AppleButton>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
