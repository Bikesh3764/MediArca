import React, { useState } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const ContactUs: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFullName('');
      setEmail('');
      setMessage('');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Support
          </span>
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
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#86868b] font-medium">Direct Email Support</p>
              <a
                href="mailto:support@mediarca.com"
                className="text-sm sm:text-base font-semibold text-[#1d1d1f] hover:text-[#0066cc] transition-colors"
              >
                support@mediarca.com
              </a>
            </div>
          </div>
          <a
            href="mailto:support@mediarca.com"
            className="text-xs font-medium text-[#0066cc] hover:underline shrink-0"
          >
            Send Email →
          </a>
        </div>

        {/* Contact Message Form */}
        <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-[#1d1d1f]">Send a Message</h2>

          {submitted && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Message Sent</p>
                <p className="text-emerald-700 mt-0.5">
                  Thank you for reaching out. We will get back to you at your email soon.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1d1d1f]">Your Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1d1d1f]">Your Email</label>
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
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </AppleButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
