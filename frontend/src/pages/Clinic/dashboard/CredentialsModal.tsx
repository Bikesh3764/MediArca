import React from 'react';
import { appUrl } from '../../../utils/siteUrl';
import { X, Check } from 'lucide-react';
import { useClinicDashboard } from './state';
export const CredentialsModal: React.FC = () => {
  const {
    createdCredentials,
    setCreatedCredentials,
    copiedCreds,
    setCopiedCreds,
    clinic,
  } = useClinicDashboard();
  if (!createdCredentials) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreatedCredentials(null);
          }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8  space-y-5 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Receptionist login</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">Share these with your receptionist.</p>
              </div>
              <button aria-label="Close"
                onClick={() => setCreatedCredentials(null)}
                className="p-2 rounded-full text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs space-y-1 leading-relaxed">
              <p className="font-semibold">Note</p>
              <p className="text-xs text-[#86868b]">
                They sign in from the Receptionist link and set their own password.
              </p>
            </div>

            <div className="bg-[#f5f5f7] rounded-2xl p-4 border border-[#e5e5ea] space-y-3 text-xs">
              <div>
                <span className="text-xs text-[#86868b] font-normal block mb-0.5">
                  Name
                </span>
                <span className="text-[#1d1d1f] font-semibold text-[14px]">
                  {createdCredentials.fullName}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#86868b] font-normal block mb-1">
                  Email
                </span>
                <span className="text-[#0066cc] select-all bg-white px-3 py-2 rounded-xl border border-[#e5e5ea] block font-semibold">
                  {createdCredentials.email}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#86868b] font-normal block mb-1">
                  Temporary Password
                </span>
                <span className="text-[#1d1d1f] select-all bg-white px-3 py-2 rounded-xl border border-[#e5e5ea] block font-semibold">
                  {createdCredentials.password}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#86868b] font-normal block mb-0.5">
                  Sign-in link
                </span>
                <span className="text-[#0066cc] text-xs block select-all font-normal break-all">
                  {appUrl('/receptionist/login')}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const portalUrl = appUrl('/receptionist/login');
                  const text = `MediArca receptionist login\nClinic: ${clinic?.clinicName || 'Clinic'}\nName: ${createdCredentials.fullName}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nSign in at: ${portalUrl}`;
                  navigator.clipboard.writeText(text);
                  setCopiedCreds(true);
                  setTimeout(() => setCopiedCreds(false), 2500);
                }}
                className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedCreds ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0066cc]" />
                    Copied
                  </>
                ) : (
                  'Copy All'
                )}
              </button>

              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
  );
};
