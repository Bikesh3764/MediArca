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
  ChevronRight,
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
    <ul className="grid grid-cols-2 lg:grid-cols-4 gap-y-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-[#e5e5ea] px-5 py-5 sm:px-8 sm:py-6">
      {BENEFITS.map(({ icon: Icon, title, text }, i) => (
        <li
          key={title}
          className={`min-w-0 pr-3 ${i > 0 ? 'lg:pl-8 lg:border-l lg:border-[#f0f0f2]' : ''} ${i % 2 === 1 ? 'pl-4 border-l border-[#f0f0f2] lg:pl-8' : ''}`}
        >
          <p className="flex items-center gap-2 text-sm sm:text-[15px] font-semibold text-[#1d1d1f] leading-tight">
            <Icon className="w-4 h-4 text-primary shrink-0" strokeWidth={2.25} />
            <span className="truncate">{title}</span>
          </p>
          <p className="mt-1 text-xs text-[#86868b] leading-snug">{text}</p>
        </li>
      ))}
    </ul>
  </div>
);

const SPECIALTIES = [
  { label: 'General', hint: 'Fever, cough, BP', value: 'General Medicine', icon: Stethoscope },
  { label: 'Children', hint: 'Kids & newborns', value: 'Pediatrics', icon: Baby },
  { label: 'Women', hint: 'Pregnancy, PCOD', value: 'Gynecology & Obstetrics', icon: Venus },
  { label: 'Skin', hint: 'Acne, hair, rashes', value: 'Dermatology', icon: Sparkles },
  { label: 'Bones', hint: 'Joints, back pain', value: 'Orthopedics', icon: Bone },
  { label: 'Heart', hint: 'Chest pain, BP', value: 'Cardiology', icon: HeartPulse },
  { label: 'ENT', hint: 'Ear, nose, throat', value: 'ENT / Otorhinolaryngology', icon: Ear },
  { label: 'Dental', hint: 'Teeth, gums', value: 'Dentistry', icon: Smile },
  { label: 'Eyes', hint: 'Vision, glasses', value: 'Ophthalmology', icon: Eye },
  { label: 'Brain', hint: 'Headache, nerves', value: 'Neurology', icon: Brain },
];

/** Quick specialty picker: opens the Doctors tab filtered to that specialty. */
export const SpecialtySection: React.FC = () => {
  const { handleSectionSwitch, setSelectedSpecialty } = useHome();

  const pick = (value: string) => {
    setSelectedSpecialty(value);
    handleSectionSwitch('doctors');
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl sm:text-[32px] font-semibold tracking-tight text-[#1d1d1f]">Browse by specialty</h2>
        <button
          type="button"
          onClick={() => pick('All')}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover cursor-pointer shrink-0"
        >
          All doctors
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {SPECIALTIES.map(({ label, hint, value, icon: Icon }) => (
          <li key={value} className="min-w-0">
            <button
              type="button"
              onClick={() => pick(value)}
              className="group w-full min-h-[64px] rounded-2xl bg-white border border-[#e5e5ea] hover:border-[#d2d2d7] px-3.5 sm:px-4 py-3 flex items-center gap-3 text-left transition-colors duration-200 active:scale-[0.98] cursor-pointer"
            >
              <Icon className="w-5 h-5 text-primary shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm sm:text-[15px] font-semibold text-[#1d1d1f] leading-tight truncate">{label}</span>
                <span className="block mt-0.5 text-xs text-[#86868b] leading-snug truncate">{hint}</span>
              </span>
              <ChevronRight className="hidden sm:block w-4 h-4 text-[#c7c7cc] group-hover:text-[#86868b] shrink-0 transition-colors" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
