import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppleButton } from '../components/ui/AppleButton';
import { UtilityCard } from '../components/ui/UtilityCard';
import { Clock, ShieldCheck, ArrowRight, Star, MapPin, Calendar, FileText, Stethoscope } from 'lucide-react';

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
      <section className="bg-white pt-20 pb-24 border-b border-[#e0e0e0] text-center px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {user ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0066cc]/10 border border-[#0066cc]/20 text-xs font-semibold text-[#0066cc] mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#0066cc] animate-pulse"></span>
              Welcome back, {user.fullName?.split(' ')[0] || user.fullName || 'User'} • {isDoctor ? 'Doctor Console' : isAdmin ? 'Admin Control Center' : 'Patient Dashboard'}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-xs font-medium text-[#1d1d1f] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#0066cc]"></span>
              Introducing MediArca Live Queue
            </div>
          )}

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.08] mb-6">
            Healthcare. Organized with clinical clarity.
          </h1>

          <p className="text-lg sm:text-2xl font-light text-[#7a7a7a] max-w-2xl mx-auto leading-relaxed mb-10">
            Discover verified doctors, inspect real-time checking hours, and reserve your guaranteed queue token in seconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {isPatient ? (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                  className="text-base flex items-center gap-2"
                >
                  Find a Doctor
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/patient/appointments')}
                  className="text-base flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-[#0066cc]" />
                  View My Queue Pass
                </AppleButton>
                <AppleButton
                  variant="ghost"
                  size="lg"
                  onClick={() => navigate('/patient/records')}
                  className="text-base flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[#7a7a7a]" />
                  Access Medical Vault
                </AppleButton>
              </>
            ) : isDoctor ? (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/doctor/dashboard')}
                  className="text-base flex items-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  Open Doctor Console
                </AppleButton>
                <AppleButton
                  variant="ghost"
                  size="lg"
                  onClick={() => navigate('/doctor/schedule')}
                  className="text-base flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Manage Schedule
                </AppleButton>
              </>
            ) : isAdmin ? (
              <>
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/admin')}
                  className="text-base flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Control Center
                </AppleButton>
                <AppleButton
                  variant="ghost"
                  size="lg"
                  onClick={() => navigate('/doctors')}
                  className="text-base"
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
                  className="text-base"
                >
                  Find a Doctor
                </AppleButton>
                <AppleButton
                  variant="ghost"
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="text-base"
                >
                  Sign In to Patient Portal
                </AppleButton>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Interactive Queue Feature Demonstration (Parchment Tile) */}
      <section className="bg-[#f5f5f7] py-20 px-4 sm:px-6 border-b border-[#e0e0e0]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider block mb-2">
              The Real-World Solution
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tracking-tight">
              The Queue Number Innovation. Zero waiting room guesswork.
            </h2>
            <p className="text-[#7a7a7a] mt-3 text-base">
              Traditional booking hands you an ambiguous time slot. MediArca gives you an exact Queue Token and transparent doctor checking windows.
            </p>
          </div>

          {/* Demonstration Card */}
          <div className="bg-white rounded-[24px] border border-[#e0e0e0] p-6 sm:p-10 shadow-sm max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#f0f0f0]">
              <div>
                <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider">
                  Live Clinic Simulation
                </span>
                <h3 className="text-2xl font-semibold text-[#1d1d1f] mt-1">
                  Dr. Sarah Jenkins • Cardiology
                </h3>
                <p className="text-xs text-[#7a7a7a] mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                  Active Checking Window: <strong>09:00 AM – 01:00 PM</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-[#1d1d1f] text-white px-4 py-2 rounded-2xl text-center">
                  <span className="text-[10px] text-white/70 block uppercase">Serving Now</span>
                  <span className="text-xl font-bold text-[#2997ff]">Queue #1</span>
                </div>
                <div className="bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 px-4 py-2 rounded-2xl text-center">
                  <span className="text-[10px] block uppercase">Next Assigned</span>
                  <span className="text-xl font-bold">Queue #2</span>
                </div>
              </div>
            </div>

            <div className="py-6 border-b border-[#f0f0f0]">
              <div className="flex justify-between text-xs font-semibold text-[#1d1d1f] mb-2">
                <span>Queue Flow Tracking</span>
                <span className="text-[#0066cc]">Avg. 20 mins per consultation</span>
              </div>
              <div className="w-full bg-[#f5f5f7] h-3 rounded-full overflow-hidden border border-[#e0e0e0]">
                <div className="bg-[#0066cc] h-full w-1/2 rounded-full"></div>
              </div>
              <p className="text-xs text-[#7a7a7a] mt-3">
                When you book, your Queue Token is reserved atomically in the database to guarantee no double-booking or patient collisions.
              </p>
            </div>

            <div className="pt-6 flex justify-end">
              <Link to="/doctors" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0066cc] hover:underline">
                Explore Available Doctors <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Verified Specialists */}
      <section className="bg-white py-20 px-4 sm:px-6 border-b border-[#e0e0e0]">
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
                <div key={i} className="h-64 rounded-[18px] bg-gray-100 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {doctors.map((doctor) => (
                <UtilityCard key={doctor.id} hoverEffect className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden flex-shrink-0">
                        {doctor.user.avatarUrl ? (
                          <img
                            src={doctor.user.avatarUrl}
                            alt={doctor.user.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-[#0066cc]">
                            {doctor.user.fullName[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                            {doctor.user.fullName}
                          </h3>
                          <span title="Verified Doctor"><ShieldCheck className="w-4 h-4 text-[#0066cc]" /></span>
                        </div>
                        <span className="text-[13px] text-[#0066cc] font-medium block">
                          {doctor.specialty}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-[#7a7a7a] mt-0.5">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{doctor.rating.toFixed(1)}</span>
                          <span>({doctor.totalReviews} reviews)</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#7a7a7a] line-clamp-2 mb-4 leading-relaxed">
                      {doctor.bio}
                    </p>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] space-y-1 text-xs text-[#1d1d1f] mb-5">
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a7a7a]">Practice Shift:</span>
                        <strong className="text-[#0066cc]">
                          {parseDoctorSlots(doctor).length > 1
                            ? `${parseDoctorSlots(doctor).length} Shifts (${format12Hour(parseDoctorSlots(doctor)[0].startTime)})`
                            : `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7a7a7a]">Experience:</span>
                        <span>{doctor.experienceYears} Years</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7a7a7a]">Consultation:</span>
                        <strong className="text-[#1d1d1f]">${doctor.consultationFee}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
                    <div className="flex items-center gap-1 text-xs text-[#7a7a7a] truncate max-w-[140px]">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{doctor.clinicAddress || 'MediArca Clinic'}</span>
                    </div>
                    <AppleButton
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/book/${doctor.id}`)}
                    >
                      Book Queue Slot
                    </AppleButton>
                  </div>
                </UtilityCard>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Startup Call to Action */}
      <section className="bg-[#1d1d1f] text-white py-20 px-4 sm:px-6 text-center">
        <div className="max-w-3xl mx-auto">
          {isPatient ? (
            <>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                Healthcare clarity right in your pocket.
              </h2>
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto">
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
                <AppleButton
                  variant="ghost"
                  size="lg"
                  onClick={() => navigate('/patient/records')}
                  className="text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[#2997ff]" />
                  Medical Vault
                </AppleButton>
              </div>
            </>
          ) : isDoctor ? (
            <>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
                Clinical practice, organized with precision.
              </h2>
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto">
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
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto">
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
              <p className="text-base sm:text-lg text-[#cccccc] font-light mb-8 max-w-xl mx-auto">
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
                  Create Account
                </AppleButton>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
