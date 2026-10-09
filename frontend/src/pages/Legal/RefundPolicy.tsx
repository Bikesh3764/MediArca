import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header (No pill badge) */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Cancellation and Refund Policy
          </h1>
          <p className="text-xs text-[#86868b]">
            Last Updated: October 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-6 text-xs sm:text-sm text-[#48484a] leading-relaxed">
          {/* Neutral Highlight */}
          <div className="p-4 rounded-[18px] bg-[#fbfbfd] border border-[#e5e5ea] text-[#1d1d1f] flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#1d1d1f] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Zero Upfront Online Payments</p>
              <p className="text-xs text-[#6e6e73] mt-0.5">
                MediArca does not charge any booking fees online. Generating a token is completely free.
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              1. No Online Charges
            </h2>
            <p>
              When you reserve a doctor consultation token on MediArca, you do not pay any fee on our website or app. Because we do not collect advance payments, there is no risk of locked money or waiting days for online refund transfers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              2. Free Appointment Cancellation
            </h2>
            <p>
              You can cancel your appointment token pass at any time before your consultation directly from your patient dashboard. There are <strong>no cancellation fees or penalties</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              3. Clinic On-Site Payments
            </h2>
            <p>
              The doctor’s consultation fee is paid directly at the clinic reception counter upon your physical arrival. Any billing receipts, clinic payment modes (cash, UPI, card), or clinic-level fee queries are handled directly by the respective clinic management.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              4. Doctor Shift Rescheduling or Cancellation
            </h2>
            <p>
              If a doctor must cancel or reschedule a shift due to medical emergencies or unforeseen delays, unserved tokens for that shift are safely cancelled without any financial loss to you. You can easily rebook for the next available shift.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#1d1d1f]">
              5. Questions and Support
            </h2>
            <p>
              If you have any questions regarding your appointment or billing policy, write to us at{' '}
              <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-medium underline">
                contact@mediarca.in
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
