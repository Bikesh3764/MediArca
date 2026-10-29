import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, Mail, Clock, Building2, Phone, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHero } from '../../components/layout/PageHero';
import { api } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone } from '../../utils/phoneUtils';
import { useToast } from '../../context/ToastContext';
import { preloadBotCheck } from '../../services/botCheck';

// Start loading the bot check as soon as this page opens
preloadBotCheck();

export const ContactUs: React.FC = () => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [message, setMessage] = useState('');
  // Trap field: hidden from people, filled in by simple bots
  const [website, setWebsite] = useState('');
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
        ...(website ? { website } : {}),
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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] pb-24 sm:pb-0 pb-safe">
      <PageHero eyebrow="Contact" title="We&rsquo;re here" highlight="to help." subtitle="Questions or feedback? Write to us." />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 sm:pt-8 pb-16 sm:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 lg:gap-10 items-start">
        {/* Ways to reach us */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <a
            href="mailto:contact@mediarca.in"
            className="group flex items-center gap-4 rounded-2xl bg-white border border-[#e5e5ea] p-5 hover:border-primary-line transition-colors"
          >
            <span className="w-11 h-11 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-[#86868b]">Email</span>
              <span className="block text-sm sm:text-base font-semibold truncate">contact@mediarca.in</span>
            </span>
            <ArrowRight className="w-4 h-4 text-[#c7c7cc] group-hover:text-primary transition-colors shrink-0" />
          </a>
          <div className="flex items-center gap-4 rounded-2xl bg-white border border-[#e5e5ea] p-5">
            <span className="w-11 h-11 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-xs text-[#86868b]">Reply</span>
              <span className="block text-sm sm:text-base font-semibold">By email</span>
            </span>
          </div>
          <div className="rounded-2xl border border-primary-line/60 bg-gradient-to-br from-[#eaf3fd] via-[#f3f8fe] to-white p-5">
            <span className="w-11 h-11 rounded-xl bg-primary text-white inline-flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </span>
            <p className="mt-4 text-base font-semibold">Run a clinic?</p>
            <p className="mt-1 text-sm text-[#6e6e73]">List your clinic and add your doctors.</p>
            <Link to="/clinic/signup" className="mt-3 inline-flex items-center gap-1.5 py-1 text-sm text-primary hover:text-primary-hover">
              List your clinic
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="flex items-start gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-xs text-danger leading-relaxed">
            <Phone className="w-4 h-4 shrink-0 mt-px" />
            <span>
              <strong className="font-semibold">Medical emergency?</strong> Don&rsquo;t write to us. Call{' '}
              <a href="tel:112" className="underline">112</a> or <a href="tel:108" className="underline">108</a>.
            </span>
          </p>
        </aside>

        {/* Contact Message Form */}
        <div className="bg-white rounded-[28px] p-6 sm:p-10 border border-[#e5e5ea] space-y-6">
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
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div>
              <label htmlFor="contact-f-1" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Name *</label>
              <input
                id="contact-f-1" maxLength={100} autoComplete="name"
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
                <label htmlFor="contact-f-2" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Email *</label>
                <input
                  id="contact-f-2" autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label htmlFor="contact-f-3" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Mobile (optional)</label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <span className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-base sm:text-xs font-semibold text-[#1d1d1f]">
                    +91
                  </span>
                  <input
                    id="contact-f-3" autoComplete="tel-national"
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
              <label htmlFor="contact-f-4" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Subject</label>
              <div className="relative">
                <select
                  id="contact-f-4"
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
              <label htmlFor="contact-f-5" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Message</label>
              <textarea
                maxLength={3000}
                id="contact-f-5"
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
      </section>
    </div>
  );
};
