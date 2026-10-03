import React from 'react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Privacy & Trust
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Privacy Policy
          </h1>
          <p className="text-xs text-[#86868b]">
            Last Updated: October 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-6 text-xs sm:text-sm text-[#48484a] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              1. What Information We Collect
            </h2>
            <p>
              We only collect information necessary to reserve and manage your clinic appointment:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#6e6e73]">
              <li>Basic contact information (name, phone number, and email address).</li>
              <li>Appointment details (selected doctor, clinic location, appointment date and shift).</li>
              <li>Patient name and age (when booking for family members or dependents).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              2. How We Use Your Information
            </h2>
            <p>
              Your information is used strictly to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#6e6e73]">
              <li>Generate your queue token and display your live ticket pass.</li>
              <li>Notify the clinic reception and doctor of your appointment.</li>
              <li>Send critical updates regarding queue changes or doctor shift delays.</li>
            </ul>
            <p className="pt-1 font-medium text-[#1d1d1f]">
              We do not sell, rent, or trade your personal information to third-party marketers or advertisers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              3. Data Security
            </h2>
            <p>
              We protect your data using industry-standard encryption protocols (TLS) for transmission and secure authenticated storage for database records. Only authorized clinic staff and doctors linked to your appointment can view your visit token details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              4. Managing Your Information
            </h2>
            <p>
              You can update your personal profile information anytime through your account settings or request account removal by emailing us.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              5. Contact Us
            </h2>
            <p>
              For any questions or privacy inquiries, contact us directly at{' '}
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
