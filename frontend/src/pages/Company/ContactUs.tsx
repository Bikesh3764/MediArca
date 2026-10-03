import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const ContactUs: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate instant support ticket submission
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFullName('');
      setEmail('');
      setPhone('');
      setMessage('');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Contact & Support
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f]">
            We're Here to Help
          </h1>
          <p className="text-sm text-[#86868b]">
            Have a question about token allocation, clinic onboarding, or your appointment pass? Reach out to our dedicated clinical support desk.
          </p>
        </div>

        {/* Contact Info Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[20px] p-5 border border-[#e5e5ea] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">Email Us</h3>
            <p className="text-sm font-semibold text-[#1d1d1f] break-all">support@mediarca.com</p>
            <p className="text-[11px] text-[#86868b]">Typical response in under 2 hours</p>
          </div>

          <div className="bg-white rounded-[20px] p-5 border border-[#e5e5ea] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">Call Helpline</h3>
            <p className="text-sm font-semibold text-[#1d1d1f]">+91 98765 43210</p>
            <p className="text-[11px] text-[#86868b]">Toll-free across India</p>
          </div>

          <div className="bg-white rounded-[20px] p-5 border border-[#e5e5ea] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">Support Hours</h3>
            <p className="text-sm font-semibold text-[#1d1d1f]">08:00 AM – 08:00 PM</p>
            <p className="text-[11px] text-[#86868b]">Monday to Saturday (IST)</p>
          </div>

          <div className="bg-white rounded-[20px] p-5 border border-[#e5e5ea] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">Office Location</h3>
            <p className="text-sm font-semibold text-[#1d1d1f] truncate">Rourkela, Odisha</p>
            <p className="text-[11px] text-[#86868b]">City Care Complex, 769004</p>
          </div>
        </div>

        {/* Main Grid: Form & Office Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#1d1d1f]">Send Us a Message</h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                Fill out the form below and our clinical coordination team will get back to you promptly.
              </p>
            </div>

            {submitted && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-[13px]">Message Sent Successfully</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Thank you for reaching out. We have received your inquiry and will respond within 24 hours.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Ray"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul@example.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Subject / Concern
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc]"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Appointment & Token Help">Appointment & Token Help</option>
                    <option value="Doctor Practice Inquiries">Doctor Practice Inquiries</option>
                    <option value="Clinic Partnership">Clinic Partnership</option>
                    <option value="Technical Feedback">Technical Feedback</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Your Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we assist you today? Please share relevant details..."
                  className="w-full p-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc] resize-none"
                />
              </div>

              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Sending Message...' : 'Send Message'}
              </AppleButton>
            </form>
          </div>

          {/* Office Address Card */}
          <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1d1d1f] mb-2">Registered Headquarters</h2>
              <p className="text-xs text-[#86868b] leading-relaxed">
                MediArca Health Technologies Private Limited
              </p>
              <div className="mt-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2 text-xs text-[#1d1d1f]">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    Level 4, City Care Complex, Ring Road, Rourkela, Sundargarh, Odisha – 769004, India
                  </p>
                </div>
                <div className="flex items-center gap-2.5 text-[#86868b] pt-1">
                  <Phone className="w-4 h-4 text-[#86868b] shrink-0" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#86868b]">
                  <Mail className="w-4 h-4 text-[#86868b] shrink-0" />
                  <span>contact@mediarca.com</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-[#0066cc] space-y-1">
              <p className="font-semibold">Urgent Clinic Coordination</p>
              <p className="text-[11px] text-[#48484a] leading-relaxed">
                If you are a clinical administrator or hospital desk facing an active queue disruption, our priority emergency line is accessible directly through your portal console.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
