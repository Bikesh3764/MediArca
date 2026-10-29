import React from 'react';
import { LegalLayout } from './LegalLayout';
import { CheckCircle2 } from 'lucide-react';

export const RefundPolicy: React.FC = () => {
  return (
    <LegalLayout title="Cancellation and Refund Policy" updated="October 2026">
      <div className="p-5 rounded-2xl bg-primary-soft border border-primary-line/60 text-[#1d1d1f] flex items-start gap-3.5">
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-base">₹0 platform fee</p>
          <p className="text-sm text-[#48484a] mt-0.5">
            Getting a token is free. You pay the doctor&rsquo;s fee to the receptionist.
          </p>
        </div>
      </div>

      <section>
        <h2>
          1. No Online Charges
        </h2>
        <p>
          When you reserve a doctor consultation token on MediArca, you do not pay any fee on our website or app. Because we do not collect advance payments, there is no risk of locked money or waiting days for online refund transfers.
        </p>
      </section>

      <section>
        <h2>
          2. Free Appointment Cancellation
        </h2>
        <p>
          You can cancel your appointment token pass at any time before your consultation directly from your patient dashboard. There are <strong>no cancellation fees or penalties</strong>.
        </p>
      </section>

      <section>
        <h2>
          3. Paying the Receptionist
        </h2>
        <p>
          You pay the doctor’s consultation fee to the clinic receptionist, by UPI over a call or at the desk. Billing receipts, payment modes and fee queries are handled by the clinic.
        </p>
      </section>

      <section>
        <h2>
          4. Doctor Shift Rescheduling or Cancellation
        </h2>
        <p>
          If a doctor must cancel or reschedule a shift due to medical emergencies or unforeseen delays, unserved tokens for that shift are safely cancelled without any financial loss to you. You can easily rebook for the next available shift.
        </p>
      </section>

      <section>
        <h2>
          5. Questions and Support
        </h2>
        <p>
          If you have any questions regarding your appointment or billing policy, write to us at{' '}
          <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-normal underline">
            contact@mediarca.in
          </a>.
        </p>
      </section>
    </LegalLayout>
  );
};
