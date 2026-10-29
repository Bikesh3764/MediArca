import React from 'react';
import {
  IndianRupee,
  Activity,
  QrCode,
  PhoneCall,
  Stethoscope,
  Baby,
  Venus,
  Sparkles,
  Bone,
  HeartPulse,
  Ear,
  Smile,
  Eye,
  Brain,
  ArrowRight,
} from 'lucide-react';
import { useHome } from './state';

const BENEFITS = [
  { icon: IndianRupee, title: '₹0 platform fee', text: 'Pay the receptionist' },
  { icon: Activity, title: 'Live token', text: 'Know when to leave' },
  { icon: QrCode, title: 'QR check-in', text: 'Scan on arrival' },
  { icon: PhoneCall, title: 'UPI over call', text: 'Or pay at the desk' },
];

/** Four benefits on a frosted card that overlaps the bottom of the hero. */
export const BenefitsStrip: React.FC = () => (
  <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 -mt-10 sm:-mt-12">
    <ul className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-[#e5e5ea] overflow-hidden">
      {BENEFITS.map(({ icon: Icon, title, text }, i) => (
        <li
          key={title}
          className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 ${i % 2 === 1 ? 'border-l' : ''} ${
            i >= 2 ? 'border-t lg:border-t-0' : ''
          } ${i === 2 ? 'lg:border-l' : ''} border-[#f0f0f2]`}
        >
          <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm sm:text-[15px] font-semibold text-[#1d1d1f] leading-tight">{title}</p>
            <p className="mt-0.5 text-xs text-[#86868b] leading-snug">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const SPECIALTIES = [
  { label: 'General', value: 'General Medicine', icon: Stethoscope },
  { label: 'Children', value: 'Pediatrics', icon: Baby },
  { label: 'Women', value: 'Gynecology & Obstetrics', icon: Venus },
  { label: 'Skin', value: 'Dermatology', icon: Sparkles },
  { label: 'Bones', value: 'Orthopedics', icon: Bone },
  { label: 'Heart', value: 'Cardiology', icon: HeartPulse },
  { label: 'ENT', value: 'ENT / Otorhinolaryngology', icon: Ear },
  { label: 'Dental', value: 'Dentistry', icon: Smile },
  { label: 'Eyes', value: 'Ophthalmology', icon: Eye },
  { label: 'Brain', value: 'Neurology', icon: Brain },
];

/** Quick specialty picker: opens the Doctors tab filtered to that specialty. */
export const SpecialtySection: React.FC = () => {
  const { handleSectionSwitch, setSelectedSpecialty, specialtyCounts } = useHome();

  const pick = (value: string) => {
    setSelectedSpecialty(value);
    handleSectionSwitch('doctors');
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[32px] font-semibold tracking-tight text-[#1d1d1f]">Browse by specialty</h2>
          <p className="mt-1.5 text-sm sm:text-base text-[#86868b]">Find the right doctor in one tap.</p>
        </div>
        <button
          type="button"
          onClick={() => pick('All')}
          className="hidden sm:inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover cursor-pointer shrink-0"
        >
          All doctors
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-7 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <ul className="flex sm:grid sm:grid-cols-5 gap-3 sm:gap-4 w-max sm:w-full">
          {SPECIALTIES.map(({ label, value, icon: Icon }) => {
            const count = specialtyCounts[value] ?? 0;
            return (
              <li key={value} className="w-[112px] sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => pick(value)}
                  className="group w-full h-full rounded-2xl bg-white border border-[#e5e5ea] hover:border-primary-line p-4 sm:p-5 flex flex-col items-start gap-4 sm:gap-5 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary-soft text-primary group-hover:bg-primary group-hover:text-white inline-flex items-center justify-center transition-colors duration-200">
                    <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
                  </span>
                  <span className="block w-full">
                    <span className="block text-sm sm:text-[15px] font-semibold text-[#1d1d1f]">{label}</span>
                    <span className="block mt-0.5 text-xs text-[#86868b]">
                      {count > 0 ? `${count} ${count === 1 ? 'doctor' : 'doctors'}` : 'Doctors'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
