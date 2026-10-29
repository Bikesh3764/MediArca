import React from 'react';
import { LegalLayout } from './LegalLayout';

export const Terms: React.FC = () => {
  return (
    <LegalLayout title="Terms and Conditions" updated="October 2026">
      <section>
        <h2>
          1. Platform Scope
        </h2>
        <p>
          MediArca is a real-time clinic queue management and token reservation platform. MediArca is not a hospital or clinic and does not provide medical advice or diagnosis. Medical consultations and treatments are provided independently by verified healthcare practitioners.
        </p>
      </section>

      <section>
        <h2>
          2. Emergency Medical Situations
        </h2>
        <p>
          MediArca is intended for scheduled outpatient visits only. In case of a medical emergency, please do not book a token online; immediately call 112 / 108 or visit the nearest emergency hospital.
        </p>
      </section>

      <section>
        <h2>
          3. Queue Tokens and Waiting Times
        </h2>
        <p>
          Queue token numbers and estimated start times are dynamic estimates based on the doctor's ongoing consultation pace. While the platform strives for high accuracy, emergencies or complex patient cases may cause waiting times to vary.
        </p>
      </section>

      <section>
        <h2>
          4. Zero Advance Payment Policy
        </h2>
        <p>
          MediArca has a ₹0 platform fee. It does not charge any convenience fee or advance deposit to generate a queue token. You pay the doctor's consultation fee to the clinic receptionist, by UPI over a call or at the desk.
        </p>
      </section>

      <section>
        <h2>
          5. User Responsibilities
        </h2>
        <p>
          Users agree to provide accurate details (name, valid phone number) when booking tokens. If you are unable to attend your appointment, we encourage you to cancel your pass so waiting patients can be served sooner.
        </p>
      </section>

      <section>
        <h2>
          6. Contact
        </h2>
        <p>
          If you have any questions regarding these terms, please contact us at{' '}
          <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-normal underline">
            contact@mediarca.in
          </a>.
        </p>
      </section>
    </LegalLayout>
  );
};
