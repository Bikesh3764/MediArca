import React from 'react';

export const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Terms of Service
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Terms and Conditions
          </h1>
          <p className="text-xs text-[#86868b]">
            Last Updated: October 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-6 text-xs sm:text-sm text-[#48484a] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              1. Platform Scope
            </h2>
            <p>
              MediArca is a real-time clinic queue management and token reservation platform. MediArca is not a hospital or clinic and does not provide medical advice or diagnosis. Medical consultations and treatments are provided independently by verified healthcare practitioners.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              2. Emergency Medical Situations
            </h2>
            <p>
              MediArca is intended for scheduled outpatient visits only. In case of a medical emergency, please do not book a token online; immediately call 112 / 108 or visit the nearest emergency hospital.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              3. Queue Tokens and Waiting Times
            </h2>
            <p>
              Queue token numbers and estimated start times are dynamic estimates based on the doctor's ongoing consultation pace. While the platform strives for high accuracy, emergencies or complex patient cases may cause waiting times to vary.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              4. Zero Advance Payment Policy
            </h2>
            <p>
              MediArca does not charge any booking fee, convenience fee, or advance deposit to generate a queue token. The doctor's consultation fee is paid directly in-person at the clinic front desk.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              5. User Responsibilities
            </h2>
            <p>
              Users agree to provide accurate details (name, valid phone number) when booking tokens. If you are unable to attend your appointment, we encourage you to cancel your pass so waiting patients can be served sooner.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              6. Contact
            </h2>
            <p>
              If you have any questions regarding these terms, please contact us at{' '}
              <a href="mailto:support@mediarca.com" className="text-[#0066cc] font-medium underline">
                support@mediarca.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
