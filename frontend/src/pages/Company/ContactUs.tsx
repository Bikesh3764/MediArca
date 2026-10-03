import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

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
        phone: phone ? phone.trim() : undefined,
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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Contact Us
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Have a question, feedback, or need help with a booking? Reach out to us below.
          </p>
        </div>

        {/* Email Direct Card */}
        <div className="bg-white rounded-[20px] p-5 border border-[#e5e5ea] shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-[#1d1d1f]" />
            </div>
            <div>
              <p className="text-xs text-[#86868b] font-medium">Direct Email Support</p>
              <a
                href="mailto:contact@mediarca.in"
                className="text-sm sm:text-base font-semibold text-[#1d1d1f] hover:text-[#0066cc] transition-colors"
              >
                contact@mediarca.in
              </a>
            </div>
          </div>
          <a
            href="mailto:contact@mediarca.in"
            className="text-xs font-semibold text-[#0066cc] hover:underline shrink-0"
          >
            Send Email →
          </a>
        </div>

        {/* Contact Message Form */}
        <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-[#1d1d1f]">Send a Message</h2>

          {submitted && (
            <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Message Sent</p>
                <p className="text-[#6e6e73] mt-0.5">
                  Thank you for reaching out. We will get back to you at your email soon.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to Send</p>
                <p className="text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1d1d1f]">Your Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1d1d1f]">Your Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1d1d1f]">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1d1d1f]">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
              >
                <option value="General Inquiry">General Inquiry</option>
                <option value="Appointment Issue">Appointment / Queue Issue</option>
                <option value="Doctor or Clinic Onboarding">Doctor or Clinic Inquiry</option>
                <option value="Feedback">Feedback</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1d1d1f]">Message</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
