import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone } from '../../utils/phoneUtils';
import { AppleButton } from '../../components/ui/AppleButton';

export const ContactUs: React.FC = () => {
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
      setFullName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      setError(err?.message || 'Failed to send message. Please email us at contact@mediarca.in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 sm:space-y-10">
        {/* Page Header */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <h1 className="text-page-title sm:text-[32px]">
            Contact Us
          </h1>
          <p className="text-body text-[#6e6e73]">
            Have a question, feedback, or need help with a booking? Reach out to us below.
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Email Direct Support Card */}
          <div className="apple-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-secondary text-[12px]">Direct Email Support</p>
                <a
                  href="mailto:contact@mediarca.in"
                  className="text-card-title hover:text-[#0066cc] transition-colors"
                >
                  contact@mediarca.in
                </a>
              </div>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => {
                window.location.href = 'mailto:contact@mediarca.in';
              }}
              className="self-start sm:self-center shrink-0"
            >
              Email Us
            </AppleButton>
          </div>

          {/* Contact Message Form */}
          <div className="apple-card p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-section-title">Send a Message</h2>
              <p className="text-secondary mt-0.5">
                Fill out the form below and our support team will respond shortly.
              </p>
            </div>

            {submitted && (
              <div className="p-4 rounded-xl bg-[#34c759]/10 border border-[#34c759]/25 text-[#1d1d1f] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#248a3d] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[14px]">Message Sent</p>
                  <p className="text-[13px] text-[#48484a] mt-0.5">
                    Thank you for reaching out. We will get back to you at your email soon.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#ff3b30] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[14px]">Unable to Send Message</p>
                  <p className="text-[13px] mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="ui-form-stack">
              <div>
                <label className="ui-label">Your Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="ui-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="ui-label">Your Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="ui-label">Mobile Number (Optional)</label>
                  <div className="flex h-11 rounded-xl border border-[#d2d2d7]/80 bg-white overflow-hidden transition-all duration-150 hover:border-[#86868b]/60 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15">
                    <span className="inline-flex items-center px-3 bg-[#f5f5f7] border-r border-[#e5e5ea] text-[#48484a] font-medium text-[13px] select-none">
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
                      className="flex-1 h-full px-3.5 text-[14px] bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="ui-label">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="ui-select"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Appointment Issue">Appointment / Queue Issue</option>
                  <option value="Doctor or Clinic Onboarding">Doctor or Clinic Inquiry</option>
                  <option value="Feedback">Feedback</option>
                </select>
              </div>

              <div>
                <label className="ui-label">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here..."
                  className="ui-textarea resize-none"
                />
              </div>

              <div className="pt-2">
                <AppleButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Sending Message...' : 'Send Message'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
