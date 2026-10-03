import React from 'react';
import { ShieldCheck, Lock, Eye, Database } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Privacy & Trust
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Privacy Policy
          </h1>
          <p className="text-xs text-[#86868b]">
            Effective Date: October 1, 2026 • Compliant with Digital Personal Data Protection Act (DPDP Act, 2023)
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-8 text-xs sm:text-sm text-[#48484a] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              1. Our Privacy Commitment
            </h2>
            <p>
              At MediArca Health Technologies Private Limited ("MediArca"), protecting your personal health privacy is fundamental to our clinical mission. We do not sell your personal data, profile your medical history for commercial advertisers, or share sensitive consultation records with unauthorized third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              2. Information We Collect
            </h2>
            <p>We collect only the minimal data points necessary to facilitate queue management and in-person consultations:</p>
            <ul className="list-disc pl-5 space-y-1 text-[#6e6e73]">
              <li><strong>Contact Information:</strong> Full name, verified mobile phone number (+91 Indian numbers), and optional email address.</li>
              <li><strong>Queue Pass Data:</strong> Preferred consultation shift, selected medical facility, chief symptoms or reason for visit, and age/gender (if booking for a dependent).</li>
              <li><strong>Practitioner Credentials:</strong> Medical registration council numbers, specialty certifications, experience years, and clinic affiliations for licensed doctors.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              3. Purpose of Data Processing
            </h2>
            <p>Your information is processed strictly for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1 text-[#6e6e73]">
              <li>Generating guaranteed atomic queue tokens for outpatient clinics.</li>
              <li>Providing real-time updates regarding doctor cabin status and estimated consultation start times.</li>
              <li>Allowing clinic reception desks to verify patient arrival and issue physical token printouts.</li>
              <li>Ensuring platform integrity and preventing duplicate reservation abuse.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              4. Data Storage and Security
            </h2>
            <p>
              MediArca implements enterprise-grade technical safeguards including end-to-end transport layer security (TLS 1.3 encryption), encrypted PostgreSQL storage on secure cloud infrastructure, and role-based access control preventing cross-tenant data leakage between independent clinics.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              5. Your Rights as a Data Principal
            </h2>
            <p>
              Under the Digital Personal Data Protection Act (DPDP Act, 2023), you have the right to access, correct, update, or request the deletion of your personal data. You may update your profile information directly through the Patient Profile tab or email our Grievance Officer.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              6. Grievance Redressal
            </h2>
            <p>
              If you have any questions, concerns, or grievances regarding our data protection practices, please contact our designated Grievance Officer:
            </p>
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1 text-xs">
              <p className="font-semibold text-[#1d1d1f]">Data Protection & Grievance Officer</p>
              <p>MediArca Health Technologies Private Limited</p>
              <p>Level 4, City Care Complex, Ring Road, Rourkela, Odisha – 769004, India</p>
              <p className="text-[#0066cc]">Email: privacy@mediarca.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
