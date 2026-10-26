import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone } from '../../utils/phoneUtils';
import { useToast } from '../../context/ToastContext';

export const ContactUs: React.FC = () => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.submitContactMessage({
        fullName,
        email,
        phone: phone ? formatIndianPhone(phone) : undefined,
        subject,
        message,
      });
      setSubmitted(true);
      toast.success('Message sent. We’ll reply by email.');
      setFullName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      const errMsg = err?.message || 'Couldn’t send. Please email contact@mediarca.in.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 pb-safe">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
            Contact Us
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Questions or feedback? Write to us.
          </p>
        </div>

        {/* Email Direct Card */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e5e5ea]  flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#86868b] font-normal">Email</p>
            <a
              href="mailto:contact@mediarca.in"
              className="text-sm sm:text-base font-semibold text-[#1d1d1f] hover:text-[#0066cc] transition-colors mt-0.5 inline-block"
            >
              contact@mediarca.in
            </a>
          </div>
          <a
            href="mailto:contact@mediarca.in"
            className="text-xs font-semibold text-[#0066cc] hover:underline shrink-0"
          >
            Send Email →
          </a>
        </div>

        {/* Contact Message Form */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e5e5ea]  space-y-6">
          <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Send a message</h2>

          {submitted && (
            <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#0066cc] shrink-0" />
              <div>
                <p className="font-semibold text-sm">Message sent</p>
                <p className="text-[#6e6e73] mt-0.5">
                  Thanks. We’ll reply by email soon.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              <div>
                <p className="font-semibold text-sm">Couldn’t send</p>
                <p className="text-danger mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Mobile (optional)</label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <span className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-base sm:text-xs font-semibold text-[#1d1d1f]">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={sanitizeIndianPhone(phone)}
                    onChange={(e) => {
                      const digits = sanitizeIndianPhone(e.target.value);
                      setPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Subject</label>
              <div className="relative">
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                >
                  <option value="General Inquiry">General</option>
                  <option value="Appointment Issue">Appointment problem</option>
                  <option value="Doctor or Clinic Onboarding">For doctors and clinics</option>
                  <option value="Feedback">Feedback</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#86868b] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Message</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                className="w-full p-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-semibold  transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
