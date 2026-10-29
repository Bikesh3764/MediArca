import React from 'react';
import { LegalLayout } from './LegalLayout';

export const PrivacyPolicy: React.FC = () => {
  return (
    <LegalLayout title="Privacy Policy" updated="October 2026">
      <section>
        <h2>
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

      <section>
        <h2>
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
        <p className="pt-1 font-normal text-[#1d1d1f]">
          We do not sell, rent, or trade your personal information to third-party marketers or advertisers.
        </p>
      </section>

      <section>
        <h2>
          3. Data Security
        </h2>
        <p>
          We protect your data using industry-standard encryption protocols (TLS) for transmission and secure authenticated storage for database records. Only authorized clinic staff and doctors linked to your appointment can view your visit token details.
        </p>
      </section>

      <section>
        <h2>
          4. Managing Your Information
        </h2>
        <p>
          You can update your personal profile information anytime through your account settings or request account removal by emailing us.
        </p>
      </section>

      <section>
        <h2>
          5. Contact Us
        </h2>
        <p>
          For any questions or privacy inquiries, contact us directly at{' '}
          <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-normal underline">
            contact@mediarca.in
          </a>.
        </p>
      </section>
    </LegalLayout>
  );
};
