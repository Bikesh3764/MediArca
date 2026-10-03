import React from 'react';
import { CreditCard, CheckCircle2, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Billing & Policies
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Cancellation & Refund Policy
          </h1>
          <p className="text-xs text-[#86868b]">
            Effective Date: October 1, 2026 • Last Updated: October 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-8 text-xs sm:text-sm text-[#48484a] leading-relaxed">
          {/* Key Principle Highlight */}
          <div className="p-5 rounded-[18px] bg-[#0066cc]/5 border border-[#0066cc]/15 flex items-start gap-4">
            <CheckCircle2 className="w-5 h-5 text-[#0066cc] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                Zero Financial Lock-in Principle
              </h3>
              <p className="text-xs sm:text-sm text-[#48484a]">
                MediArca operates on a strict <strong>zero upfront fee</strong> model for all online queue reservations. Patients are never charged advance convenience fees or platform deposits, ensuring total financial freedom and zero cancellation penalties.
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              1. Digital Appointment Booking & Advance Payments
            </h2>
            <p>
              When you reserve an outpatient consultation token on MediArca, <strong>no payment is processed or demanded online</strong>. The estimated queue pass is issued completely free of upfront financial obligations. 
            </p>
            <p>
              Because MediArca does not collect advance consultation fees from patients, there are no locked funds, no payment gateway deductions, and no prolonged waiting periods for bank refund reversals.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              2. Appointment Cancellation Policy
            </h2>
            <p>
              Patients maintain full autonomy over their outpatient schedules:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#6e6e73]">
              <li>
                <strong>Self-Service Cancellation:</strong> You may cancel any pending or unserviced appointment pass at any time directly through your Live Queue Pass or the Patient Dashboard.
              </li>
              <li>
                <strong>Zero Cancellation Fees:</strong> MediArca imposes zero cancellation charges or penalties, regardless of when you cancel prior to consultation.
              </li>
              <li>
                <strong>Fair Queue Etiquette:</strong> We kindly encourage patients to release their tokens as early as possible if their plans change, enabling other waiting patients in the city to advance in the live queue.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              3. Clinic On-Site Billing & Consultation Fees
            </h2>
            <p>
              All professional doctor consultation fees and related clinic services are paid <strong>in-person directly at the clinic desk</strong> (via cash, UPI, or card) upon arrival or after the doctor has completed your medical consultation.
            </p>
            <p>
              Any clinical billing questions, payment receipts, fee concessions, or institutional disputes are governed exclusively by the respective clinic or hospital's administrative billing guidelines and must be settled on-site with the clinic management.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              4. Doctor Absence, Emergency Rescheduling & Clinic Cancellations
            </h2>
            <p>
              Healthcare practitioners may occasionally face emergency surgical duties, clinical rounds, or unforeseen illness requiring shift adjustments:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#6e6e73]">
              <li>
                If a doctor cancels or curtails a shift, all unfulfilled digital tokens for that shift are safely voided, and affected patients receive immediate status updates on their passes.
              </li>
              <li>
                Because no monetary transactions occurred on the platform, patients suffer zero financial loss and may effortlessly rebook for the practitioner’s next available shift or select an alternate verified specialist.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              5. Institutional Subscriptions & Partner Clinics
            </h2>
            <p>
              For clinics, hospitals, or polyclinics subscribing to MediArca's enterprise queue management software or digital desk management modules, commercial terms, billing schedules, and refund policies are defined in their enterprise Master Service Agreement (MSA).
            </p>
            <p>
              Institutional subscription refunds are evaluated based on service level agreements (SLAs) and platform uptime commitments outlined in their specific contract.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
              6. Grievances & Billing Support
            </h2>
            <p>
              If you have any questions regarding our cancellation policies or need assistance with your booking records, our support desk is at your disposal:
            </p>
            <div className="bg-[#f5f5f7] rounded-[16px] p-4 text-xs space-y-1 text-[#6e6e73]">
              <p><strong className="text-[#1d1d1f]">MediArca Support Desk</strong></p>
              <p>Email: <a href="mailto:support@mediarca.com" className="text-[#0066cc] underline">support@mediarca.com</a></p>
              <p>Helpline: +91 98765 43210 (Mon – Sat, 8:00 AM – 8:00 PM IST)</p>
              <p>Location: Level 4, City Care Complex, Ring Road, Rourkela, Odisha - 769004</p>
            </div>
          </section>

          {/* Quick navigation */}
          <div className="pt-6 border-t border-[#e5e5ea] flex flex-wrap items-center justify-between gap-4 text-xs">
            <Link to="/terms" className="text-[#0066cc] hover:underline font-medium">
              ← View Terms of Service
            </Link>
            <Link to="/privacy" className="text-[#0066cc] hover:underline font-medium">
              View Privacy Policy →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
