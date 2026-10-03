import React from 'react';
import { Shield, FileText, CheckCircle2 } from 'lucide-react';

export const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Legal & Compliance
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Terms and Conditions of Service
          </h1>
          <p className="text-xs text-[#86868b]">
            Effective Date: October 1, 2026 • Last Updated: October 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-8 text-xs sm:text-sm text-[#48484a] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the platform provided by MediArca Health Technologies Private Limited ("MediArca", "we", "us", or "our"), including our web application, digital queue passes, and clinical desk interfaces, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              2. Nature of the Service
            </h2>
            <p>
              MediArca operates as a real-time outpatient queuing infrastructure and clinical appointment reservation system. MediArca is not a medical provider, does not offer clinical medical advice or diagnosis directly, and is not responsible for the independent professional medical decisions, diagnoses, or prescriptions rendered by verified healthcare practitioners.
            </p>
            <p>
              In case of life-threatening emergencies, do not wait for a digital queue token. Immediately contact local emergency services (112 / 108 in India) or visit the nearest hospital emergency department.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              3. Token Allocation & Waiting Estimates
            </h2>
            <p>
              Consultation queue tokens are generated dynamically based on practitioner shift schedules, average consultation pacing, and physical clinic desk arrival. While our algorithm provides highly accurate estimated start times:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#6e6e73]">
              <li>Clinical emergencies may alter doctor pace and extend waiting periods without prior notice.</li>
              <li>Estimated token numbers become confirmed and official when the patient completes physical check-in or receptionist confirmation at the clinic desk.</li>
              <li>Unconfirmed provisional tokens that have passed their shift window are automatically expired to maintain fair access for waiting patients.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              4. Zero Upfront Fee Policy
            </h2>
            <p>
              MediArca maintains a zero upfront payment barrier for patient token reservations. You are never required to pay online convenience charges to reserve your spot. The consultation fee displayed is payable directly to the clinic or doctor upon arrival at the facility.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              5. User Responsibilities & Conduct
            </h2>
            <p>
              Users agree to provide accurate, truthful personal and contact details (+91 Indian mobile numbers) when generating passes for themselves or dependents. Creating frivolous or abusive duplicate token bookings across simultaneous slots is strictly prohibited and may result in account restriction.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              6. Practitioner and Clinic Verification
            </h2>
            <p>
              MediArca conducts administrative credential checks on doctors (medical registrations, state council certificates) and clinics before granting verified status. However, doctors remain solely responsible for the validity of their licenses and independent medical consultations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              7. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted under applicable Indian law, MediArca shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from clinical delays, physician schedule changes, or medical outcomes arising from third-party consultations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              8. Contact for Legal Inquiries
            </h2>
            <p>
              For any legal notices, disputes, or regulatory queries, please contact our Compliance Officer at:
            </p>
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1 text-xs">
              <p className="font-semibold text-[#1d1d1f]">Legal & Compliance Department</p>
              <p>MediArca Health Technologies Private Limited</p>
              <p>Level 4, City Care Complex, Ring Road, Rourkela, Odisha – 769004, India</p>
              <p className="text-[#0066cc]">Email: legal@mediarca.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
