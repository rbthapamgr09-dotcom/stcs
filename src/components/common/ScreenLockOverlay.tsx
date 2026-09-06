import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  KeyRound,
  Shield,
  Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toNepaliDigits } from '../../utils/nepaliCalendar';

export const ScreenLockOverlay: React.FC = () => {
  const {
    isScreenLocked,
    unlockScreen,
    currentUser,
    organization,
    logout,
    addToast,
  } = useApp();

  const [inputCode, setInputCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isScreenLocked) {
      setInputCode('');
      setErrorMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isScreenLocked]);

  if (!isScreenLocked || !currentUser) {
    return null;
  }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const code = inputCode.trim();
    if (!code) {
      setErrorMsg('कृपया आफ्नो पासवर्ड वा ४ अंकको सुरक्षा पिन प्रविष्ट गर्नुहोस्।');
      return;
    }

    setIsSubmitting(true);
    setTimeout(async () => {
      const result = await unlockScreen(code);
      setIsSubmitting(false);

      if (!result.success) {
        setErrorMsg(result.message);
        inputRef.current?.select();
      } else {
        addToast('success', 'स्क्रिन अनलक भयो', 'तपाईंको सत्र पुनः सुचारु भएको छ।');
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#162111]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#cddcc7] max-w-md w-full p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Subtle decorative background accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#4B6043]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#8F9489]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Lock Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#4B6043] text-white flex items-center justify-center shadow-lg shadow-[#4B6043]/20 mb-4 animate-bounce-short">
          <Lock className="w-8 h-8" />
        </div>

        {/* Office & System Notice */}
        <div className="mb-4">
          <p className="text-[11px] font-bold text-[#4B6043] tracking-wide flex items-center justify-center gap-1">
            <Building className="w-3.5 h-3.5" />
            <span>{organization.officeName || 'नेपाल सरकार'}</span>
          </p>
          <h2 className="text-lg sm:text-xl font-black text-[#24331C] mt-1">
            कार्यक्षेत्र लक गरिएको छ
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            गोपनीयता तथा वित्तीय विवरण सुरक्षाका लागि कार्यक्षेत्र अस्थायी रूपमा सुरक्षित गरिएको छ।
          </p>
        </div>

        {/* Current Active User Profile Capsule */}
        <div className="bg-[#f5f8f3] border border-[#d6e3d2] rounded-2xl p-3 mb-5 flex items-center gap-3 text-left">
          <div className="w-11 h-11 rounded-xl bg-[#4B6043] text-white flex items-center justify-center text-base font-bold shadow-xs shrink-0">
            {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs sm:text-sm font-bold text-[#24331C] truncate">
              {currentUser.fullName}
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {currentUser.designation || 'कर्मचारी'} •{' '}
              <span className="font-semibold text-[#4B6043]">{currentUser.role}</span>
            </p>
          </div>
          <div className="shrink-0 bg-[#e3eedf] text-[#374931] p-1.5 rounded-lg">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="text-left">
            <label className="block text-xs font-bold text-[#24331C] mb-1.5">
              पासवर्ड वा सुरक्षा पिन (Password or PIN)
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="पासवर्ड वा ४-अंकको पिन..."
                className="w-full pl-3 pr-10 py-2.5 bg-[#fbfdfa] border border-[#bccdb7] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#4B6043] focus:outline-none transition-all"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showPassword ? 'गोप्य राख्नुहोस्' : 'हेर्नुहोस्'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              * तपाईंको खाता पासवर्ड वा ४-अंकको सुरक्षा पिन प्रविष्ट गर्नुहोस्।
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-left animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm bg-[#4B6043] text-white hover:bg-[#3d5137] active:scale-98 transition-all shadow-md shadow-[#4B6043]/20 cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>{isSubmitting ? 'प्रमाणीकरण हुँदैछ...' : 'अनलक गर्नुहोस् (Unlock)'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>खाताबाट बाहिरिनुहोस् (Logout / Switch User)</span>
            </button>
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span>सुरक्षा प्रणाली: AES-256 / SHA-256</span>
          <span className="font-mono">IP: सुरक्षित (Local)</span>
        </div>
      </div>
    </div>
  );
};
