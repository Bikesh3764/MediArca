import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useReceptionistDashboard } from './state';
export const PasswordChangeModal: React.FC = () => {
  const {
    user,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changingPassword,
    passwordError,
    handleChangePassword,
  } = useReceptionistDashboard();
  if (!user?.mustChangePassword) return null;
  return (
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn print:hidden">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7  relative text-left max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="mb-5">
              <h2 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                Set Your Password
              </h2>
              <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
                Set your own password to continue.
              </p>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Password from clinic
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="From your clinic"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  New password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Type it again"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-normal transition-all cursor-pointer disabled:opacity-60 mt-2"
              >
                {changingPassword ? 'Updating...' : 'Save'}
              </button>
            </form>
          </div>
        </div>
  );
};
