import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building,
  ArrowRight,
  Calendar,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { verifyPasswordSync } from '../../utils/securityUtils';
// @ts-ignore
import loginIllustration from '../../assets/images/salary_tax_calc_1788096542080.jpg';

// Helper function to validate password complexity (min 8 chars, 1 uppercase, 1 number, 1 special character)
export const checkPasswordStrength = (password: string) => {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
  const isValid = minLength && hasUpper && hasNumber && hasSpecial;

  return {
    isValid,
    minLength,
    hasUpper,
    hasNumber,
    hasSpecial,
  };
};

export const LoginPage: React.FC = () => {
  const {
    login,
    resetPassword,
    completeFirstTimePasswordChange,
    users,
    organization,
    supportContact,
    fiscalYears,
    activeFiscalYear,
    setActiveFiscalYear,
    addToast,
  } = useApp();

  // Mode: 'login' | 'first_time_password' | 'reset_password'
  const [mode, setMode] = useState<'login' | 'first_time_password' | 'reset_password'>('login');

  // Selected fiscal year for login
  const [selectedFy, setSelectedFy] = useState<string>(activeFiscalYear || fiscalYears[0] || '२०८१/८२');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Pending user for first-time password change
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [firstTimeNewPassword, setFirstTimeNewPassword] = useState('');
  const [firstTimeConfirmPassword, setFirstTimeConfirmPassword] = useState('');
  const [firstTimePin, setFirstTimePin] = useState('1234');
  const [firstTimeQuestion, setFirstTimeQuestion] = useState('तपाईंको पहिलो विद्यालयको नाम के हो?');
  const [firstTimeAnswer, setFirstTimeAnswer] = useState('');
  const [showFirstTimePass, setShowFirstTimePass] = useState(false);
  const [firstTimeLoading, setFirstTimeLoading] = useState(false);

  // Reset password form state
  const [resetUsername, setResetUsername] = useState('');
  const [resetMethod, setResetMethod] = useState<'pin' | 'securityQuestion' | 'masterKey'>('pin');
  const [verificationValue, setVerificationValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Selected user for security question in reset mode
  const matchedResetUser = users.find(
    (u) =>
      u.username.toLowerCase() === resetUsername.trim().toLowerCase() ||
      (u.email && u.email.toLowerCase() === resetUsername.trim().toLowerCase())
  );

  // Real-time password validation metrics for reset and first time forms
  const resetPassStrength = checkPasswordStrength(newPassword);
  const firstTimePassStrength = checkPasswordStrength(firstTimeNewPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const trimmedUser = loginUsername.trim();
    if (!trimmedUser) {
      setLoginError('कृपया प्रयोगकर्ता आइडी (User ID) प्रविष्ट गर्नुहोस्।');
      return;
    }
    if (!loginPassword) {
      setLoginError('कृपया पासवर्ड प्रविष्ट गर्नुहोस्।');
      return;
    }

    // Set the selected fiscal year as active
    if (selectedFy) {
      setActiveFiscalYear(selectedFy);
    }

    setLoginLoading(true);
    try {
      const result = await login(trimmedUser, loginPassword);
      setLoginLoading(false);

      if (result.mustChangePassword && result.user) {
        // User must change password on first login
        setPendingUser(result.user);
        setFirstTimePin(result.user.securityPin || '1234');
        setFirstTimeQuestion(result.user.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?');
        setFirstTimeAnswer(result.user.securityAnswer || '');
        setFirstTimeNewPassword('');
        setFirstTimeConfirmPassword('');
        setMode('first_time_password');
        addToast(
          'info',
          'पहिलो लगइन प्रमाणीकरण',
          'सुरक्षाका लागि पहिलो लगइनमा नयाँ पासवर्ड सेट गर्नु अनिवार्य छ।'
        );
      } else if (!result.success) {
        setLoginError(result.message || 'लगइन असफल भयो। User ID वा पासवर्ड मिलेन।');
      }
    } catch (err: any) {
      setLoginLoading(false);
      setLoginError(err.message || 'लगइन प्रक्रियामा प्राविधिक समस्या आयो।');
    }
  };

  const handleFirstTimePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    const strength = checkPasswordStrength(firstTimeNewPassword);
    if (!strength.isValid) {
      let errorMsg = 'नयाँ पासवर्ड कम्तिमा ८ अक्षरको हुनुपर्दछ, जसमा कम्तिमा एउटा Capital letter, एउटा Number र एउटा Special Character समावेश हुनु अनिवार्य छ।';
      if (!strength.minLength) {
        errorMsg = 'पासवर्ड कम्तिमा ८ अक्षरको हुनुपर्दछ।';
      } else if (!strength.hasUpper) {
        errorMsg = 'पासवर्डमा कम्तिमा एउटा ठूलो अंग्रेजी अक्षर (Capital letter A-Z) हुनुपर्दछ।';
      } else if (!strength.hasNumber) {
        errorMsg = 'पासवर्डमा कम्तिमा एउटा अंक (Number 0-9) हुनुपर्दछ।';
      } else if (!strength.hasSpecial) {
        errorMsg = 'पासवर्डमा कम्तिमा एउटा विशेष चिन्ह (Special Character जस्तै @, #, $, %, &, *) हुनुपर्दछ।';
      }
      addToast('error', 'कमजोर पासवर्ड', errorMsg);
      return;
    }

    if (pendingUser.password) {
      const passCheck = verifyPasswordSync(firstTimeNewPassword, pendingUser.password);
      if (passCheck.isValid) {
        addToast('warning', 'नयाँ पासवर्ड राख्नुहोस्', 'नयाँ पासवर्ड पुरानो प्रारम्भिक पासवर्ड भन्दा फरक हुनुपर्दछ।');
        return;
      }
    }

    if (firstTimeNewPassword !== firstTimeConfirmPassword) {
      addToast('error', 'पासवर्ड मिलेन', 'नयाँ पासवर्ड र पुष्टि गरिएको पासवर्ड एउटै हुनुपर्दछ।');
      return;
    }

    if (selectedFy) {
      setActiveFiscalYear(selectedFy);
    }

    setFirstTimeLoading(true);
    setTimeout(() => {
      const result = completeFirstTimePasswordChange({
        userId: pendingUser.id,
        newPassword: firstTimeNewPassword,
        securityPin: firstTimePin.trim() || '1234',
        securityQuestion: firstTimeQuestion,
        securityAnswer: firstTimeAnswer.trim() || 'काठमाडौँ',
      });
      setFirstTimeLoading(false);

      if (!result.success) {
        addToast('error', 'त्रुटि', result.message);
      }
    }, 350);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccessMessage(null);

    const trimmedUser = resetUsername.trim();
    if (!trimmedUser) {
      setResetError('कृपया आफ्नो User ID वा इमेल प्रविष्ट गर्नुहोस्।');
      return;
    }
    if (!verificationValue.trim()) {
      setResetError('कृपया सुरक्षा पिन, प्रश्नको उत्तर वा मास्टर कुञ्जी भर्नुहोस्।');
      return;
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      let errorMsg = 'नयाँ पासवर्ड कम्तिमा ८ अक्षरको हुनुपर्दछ, जसमा कम्तिमा एउटा Capital letter, एउटा Number र एउटा Special Character समावेश हुनु अनिवार्य छ।';
      if (!strength.minLength) {
        errorMsg = 'नयाँ पासवर्ड कम्तिमा ८ अक्षरको हुनुपर्दछ।';
      } else if (!strength.hasUpper) {
        errorMsg = 'पासवर्डमा कम्तिमा एउटा ठूलो अंग्रेजी अक्षर (Capital letter A-Z) हुनुपर्दछ।';
      } else if (!strength.hasNumber) {
        errorMsg = 'पासवर्डमा कम्तिमा एउटा अंक (Number 0-9) हुनुपर्दछ।';
      } else if (!strength.hasSpecial) {
        errorMsg = 'पासवर्डमा कम्तिमा एउटा विशेष चिन्ह (Special Character जस्तै @, #, $, %, &, *) हुनुपर्दछ।';
      }
      setResetError(errorMsg);
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('नयाँ पासवर्ड र पुष्टि गरिएको पासवर्ड एउटै हुनुपर्दछ।');
      return;
    }

    setResetLoading(true);
    setTimeout(() => {
      const result = resetPassword({
        usernameOrEmail: trimmedUser,
        method: resetMethod,
        verificationValue: verificationValue.trim(),
        newPassword: newPassword,
      });
      setResetLoading(false);

      if (result.success) {
        setResetSuccessMessage('पासवर्ड सफलतापूर्वक रिसेट भयो! कृपया नयाँ पासवर्ड प्रयोग गरि लगइन गर्नुहोस्।');
        setLoginUsername(trimmedUser);
        setLoginPassword(newPassword);
        setTimeout(() => {
          setMode('login');
          setResetSuccessMessage(null);
        }, 1500);
      } else {
        setResetError(result.message);
      }
    }, 350);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ACCOUNTANT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F3] text-[#24331C] flex flex-col justify-center items-center antialiased selection:bg-[#4B6043] selection:text-white p-3 sm:p-6 relative overflow-y-auto">
      {/* Centered Two-Card Container with Balanced Gap */}
      <main className="w-full max-w-5xl my-auto py-4 flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 md:gap-6 relative z-10">
        {/* ================= LEFT SIDE: APP THEMED BRANDING CARD (Smaller Section) ================= */}
        <section className="w-full md:w-[320px] lg:w-[340px] shrink-0 bg-gradient-to-br from-[#2D3E27] via-[#364B2F] to-[#1E2B19] text-white rounded-2xl shadow-xl flex flex-col justify-between relative z-10 border border-[#4B6043]/30 min-h-[460px] overflow-hidden">
          <div>
            {/* Top Logo & Office Emblem (Banner spanning the top area) */}
            <div className="w-full h-44 sm:h-48 relative overflow-hidden">
              <img
                src={loginIllustration}
                alt="System Security & Login"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover filter brightness-[0.85]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2D3E27] via-transparent to-black/30" />
            </div>

            {/* Middle Content Wrapper */}
            <div className="p-5 sm:p-6 pb-2">
              {/* Main Office / System Title */}
              <div className="text-center space-y-1">
                <h1 className="text-lg sm:text-xl font-black text-white leading-snug tracking-tight">
                  तलबी तथा कर गणना प्रणाली
                </h1>
                <p className="text-[11px] sm:text-xs text-emerald-200 font-medium tracking-wide">
                  Salary & Tax Calculation System
                </p>
                <p className="text-[11px] text-white/85 pt-1 font-medium leading-relaxed">
                  {organization.officeName || 'कर्मचारी तलबी तथा कर कट्टी व्यवस्थापन प्रणाली'}
                </p>
              </div>
            </div>
          </div>

          {/* Lower Box: Assistance / Support (Smaller Second Section) */}
          <div className="p-5 sm:p-6 pt-0 mt-auto space-y-2.5">
            <div className="bg-[#1A2616]/90 rounded-xl p-3.5 border border-white/10 text-white text-xs space-y-1.5 shadow-inner">
              <h3 className="font-bold text-xs text-emerald-200 tracking-wide border-b border-white/10 pb-1 flex items-center justify-between">
                <span>सहायता तथा सम्पर्क</span>
                <span className="text-[9px] font-mono text-emerald-300/80 bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
                  Support
                </span>
              </h3>
              <div className="space-y-1.5 font-medium text-[11px] leading-relaxed text-emerald-50">
                {Boolean(String(supportContact?.phone || '').trim()) && (
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-white shrink-0">सम्पर्क नं. (Contact No.):</span>
                    <a href={`tel:${String(supportContact?.phone || '').trim()}`} className="font-mono text-emerald-100 hover:underline">
                      {String(supportContact?.phone || '').trim()}
                    </a>
                  </div>
                )}
                {Boolean(String(supportContact?.email || '').trim()) && (
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-white shrink-0">इमेल (Email):</span>
                    <a href={`mailto:${String(supportContact?.email || '').trim()}`} className="font-mono text-[10px] text-emerald-100 hover:underline">
                      {String(supportContact?.email || '').trim()}
                    </a>
                  </div>
                )}
                {Boolean(String(supportContact?.whatsapp || '').trim()) && (
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-white shrink-0">वाट्सएप (WhatsApp):</span>
                    <a
                      href={`https://wa.me/${String(supportContact?.whatsapp || '').trim().replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-emerald-100 hover:underline"
                    >
                      {String(supportContact?.whatsapp || '').trim()}
                    </a>
                  </div>
                )}
                {Boolean(String(supportContact?.supportNote || '').trim()) && (
                  <p className="text-[10px] text-emerald-100/90 leading-tight pt-0.5 italic">
                    {String(supportContact?.supportNote || '').trim()}
                  </p>
                )}
                {!String(supportContact?.phone || '').trim() && !String(supportContact?.email || '').trim() && !String(supportContact?.whatsapp || '').trim() && !String(supportContact?.supportNote || '').trim() && (
                  <div className="text-[10px] text-emerald-100/85">
                    प्रणाली सम्बन्धी सहायताको लागि सुपर एडमिन वा कार्यालय प्रशासकमा सम्पर्क राख्नुहोस्।
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= RIGHT SIDE: PROMINENT WHITE SIGN-IN CARD (Larger Section) ================= */}
        <section className="w-full md:w-[440px] lg:w-[480px] bg-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col justify-center relative z-10 border border-[#dce6d7] my-auto">
          {/* ================= MODE 1: STANDARD LOGIN ================= */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#24331C] tracking-tight">लग -इन</h2>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  प्रणालीमा प्रवेश गर्न आफ्नो प्रयोगकर्ता नाम र पासवर्ड भर्नुहोस्।
                </p>
              </div>

              {loginError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">लगइन असफल:</p>
                    <p>{loginError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* 1. User ID Field */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#24331C]">
                    प्रयोगकर्ता नाम (User ID) / पीआईएस कोड: *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="User ID वा पीआईएस कोड"
                    className="w-full px-3 py-2 rounded-lg border border-[#c8d7c2] text-[#24331C] text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-[#4B6043] focus:border-[#4B6043] transition-all bg-white"
                  />
                </div>

                {/* 2. Password Field */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#24331C]">
                    पासवर्ड (Password): *
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError(null);
                      }}
                      placeholder="पासवर्ड प्रविष्ट गर्नुहोस्"
                      className="w-full px-3 py-2 pr-9 rounded-lg border border-[#c8d7c2] text-[#24331C] text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-[#4B6043] focus:border-[#4B6043] transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      title={showLoginPassword ? 'पासवर्ड लुकाउनुहोस्' : 'पासवर्ड देखाउनुहोस्'}
                    >
                      {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 3. Fiscal Year Selection Field */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#24331C]">
                    आर्थिक वर्ष (Fiscal Year):
                  </label>
                  <div className="relative">
                    <select
                      value={selectedFy}
                      onChange={(e) => {
                        setSelectedFy(e.target.value);
                        setActiveFiscalYear(e.target.value);
                      }}
                      className="w-full px-3 py-2 pr-8 rounded-lg border border-[#c8d7c2] text-[#24331C] text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#4B6043] focus:border-[#4B6043] transition-all bg-white appearance-none cursor-pointer"
                    >
                      {fiscalYears.map((fy) => (
                        <option key={fy} value={fy} className="font-mono">
                          {fy}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* 4. Forgot Password Action Link */}
                <div className="flex items-center justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setResetUsername(loginUsername);
                      setResetError(null);
                      setResetSuccessMessage(null);
                      setMode('reset_password');
                    }}
                    className="text-xs font-semibold text-[#4B6043] hover:text-[#2D3E27] hover:underline cursor-pointer transition-colors"
                  >
                    पासवर्ड भुल्नु भयो?
                  </button>
                </div>

                {/* 5. Submit Action Button */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 bg-[#4B6043] hover:bg-[#384c31] active:bg-[#283723] disabled:opacity-50 text-white font-bold rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer text-sm mt-1"
                >
                  {loginLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>लग -इन</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ================= MODE 2: FIRST-TIME MANDATORY PASSWORD CHANGE ================= */}
          {mode === 'first_time_password' && pendingUser && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#24331C]">पहिलो लगइन: नयाँ पासवर्ड</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  सुरक्षाका लागि नयाँ गोप्य पासवर्ड सेट गर्नुहोस्।
                </p>
              </div>

              {/* Security Alert Header */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>प्रयोगकर्ता: {pendingUser.fullName}</span>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <span className={`px-2 py-0.5 rounded border font-bold ${getRoleBadge(pendingUser.role)}`}>
                    भूमिका: {pendingUser.role}
                  </span>
                </div>
              </div>

              <form onSubmit={handleFirstTimePasswordSubmit} className="space-y-3 text-xs">
                {/* New Password Input */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">नयाँ पासवर्ड (New Password): *</label>
                  <div className="relative">
                    <input
                      type={showFirstTimePass ? 'text' : 'password'}
                      required
                      value={firstTimeNewPassword}
                      onChange={(e) => setFirstTimeNewPassword(e.target.value)}
                      placeholder="नयाँ पासवर्ड"
                      className="w-full px-3 py-2 pr-9 rounded-lg border border-[#c8d7c2] text-[#24331C] font-mono text-xs outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFirstTimePass(!showFirstTimePass)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showFirstTimePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Password Strength Checklist */}
                  <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-1 text-[10px]">
                    <div className="grid grid-cols-2 gap-1">
                      <span className={`flex items-center gap-1 font-medium ${firstTimePassStrength.minLength ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {firstTimePassStrength.minLength ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        Minimum - 8 Character
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${firstTimePassStrength.hasUpper ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {firstTimePassStrength.hasUpper ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        One Capital
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${firstTimePassStrength.hasNumber ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {firstTimePassStrength.hasNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        One Number
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${firstTimePassStrength.hasSpecial ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {firstTimePassStrength.hasSpecial ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        One Special Char
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">पासवर्ड पुष्टि गर्नुहोस् (Confirm): *</label>
                  <input
                    type={showFirstTimePass ? 'text' : 'password'}
                    required
                    value={firstTimeConfirmPassword}
                    onChange={(e) => setFirstTimeConfirmPassword(e.target.value)}
                    placeholder="पुनः नयाँ पासवर्ड टाइप गर्नुहोस्"
                    className="w-full px-3 py-2 rounded-lg border border-[#c8d7c2] text-[#24331C] font-mono text-xs outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>

                {/* Security PIN Update */}
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <label className="font-semibold text-gray-700 text-[11px]">
                    ४-अंकको सुरक्षा पिन (4-Digit PIN for Recovery):
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={firstTimePin}
                    onChange={(e) => setFirstTimePin(e.target.value)}
                    placeholder="जस्तै: 1234"
                    className="w-full px-2.5 py-1.5 rounded border border-gray-300 bg-white font-mono text-xs"
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setPendingUser(null);
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    रद्द गर्नुहोस्
                  </button>
                  <button
                    type="submit"
                    disabled={firstTimeLoading}
                    className="flex-1 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    {firstTimeLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>पासवर्ड सुरक्षित गरि प्रवेश गर्नुहोस्</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= MODE 3: FORGOT / RESET PASSWORD ================= */}
          {mode === 'reset_password' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2 font-bold text-[#24331C] text-base">
                  <KeyRound className="w-5 h-5 text-[#4B6043]" />
                  <span>पासवर्ड रिसेट</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setResetError(null);
                    setResetSuccessMessage(null);
                  }}
                  className="text-xs text-[#4B6043] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>लग-इनमा फर्कनुहोस्</span>
                </button>
              </div>

              {resetSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-emerald-800 text-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">सफल भयो!</p>
                    <p>{resetSuccessMessage}</p>
                  </div>
                </div>
              )}

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{resetError}</p>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-3">
                {/* User ID Input */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">User ID / प्रयोगकर्ता नाम: *</label>
                  <input
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => {
                      setResetUsername(e.target.value);
                      setResetError(null);
                    }}
                    placeholder="प्रयोगकर्ताको आई.डी."
                    className="w-full px-3 py-2 rounded-lg border border-[#c8d7c2] font-mono text-xs outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>

                {/* Method Tabs */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700">प्रमाणीकरण विधि:</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setResetMethod('pin');
                        setVerificationValue('');
                      }}
                      className={`py-1 rounded font-semibold text-[11px] transition-all cursor-pointer ${
                        resetMethod === 'pin' ? 'bg-white text-[#24331C] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      सुरक्षा पिन
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetMethod('securityQuestion');
                        setVerificationValue('');
                      }}
                      className={`py-1 rounded font-semibold text-[11px] transition-all cursor-pointer ${
                        resetMethod === 'securityQuestion'
                          ? 'bg-white text-[#24331C] shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      सुरक्षा प्रश्न
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetMethod('masterKey');
                        setVerificationValue('');
                      }}
                      className={`py-1 rounded font-semibold text-[11px] transition-all cursor-pointer ${
                        resetMethod === 'masterKey'
                          ? 'bg-white text-[#24331C] shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Master Key
                    </button>
                  </div>
                </div>

                {/* Verification Value Input */}
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 flex items-center justify-between">
                    <span>
                      {resetMethod === 'pin' && '४-अंकको सुरक्षा पिन (4-Digit PIN): *'}
                      {resetMethod === 'securityQuestion' &&
                        `सुरक्षा प्रश्न: "${matchedResetUser?.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?'}" को उत्तर: *`}
                      {resetMethod === 'masterKey' && 'मास्टर रिकभरी कुञ्जी (Master Key): *'}
                    </span>
                  </label>
                  <input
                    type={resetMethod === 'masterKey' ? 'password' : 'text'}
                    required
                    value={verificationValue}
                    onChange={(e) => {
                      setVerificationValue(e.target.value);
                      setResetError(null);
                    }}
                    placeholder={
                      resetMethod === 'pin'
                        ? 'सुरक्षा पिन टाइप गर्नुहोस् (जस्तै: 1234)'
                        : resetMethod === 'securityQuestion'
                        ? 'सुरक्षा प्रश्नको उत्तर टाइप गर्नुहोस्'
                        : 'मास्टर रिकभरी कुञ्जी प्रविष्ट गर्नुहोस्'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#c8d7c2] font-mono text-xs outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>

                {/* New Password & Confirm */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700">नयाँ पासवर्ड: *</label>
                      <div className="relative">
                        <input
                          type={showResetNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="नयाँ पासवर्ड"
                          className="w-full px-3 py-2 pr-8 rounded-lg border border-[#c8d7c2] font-mono text-xs outline-none focus:ring-2 focus:ring-[#4B6043]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showResetNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700">पुष्टि गर्नुहोस्: *</label>
                      <input
                        type={showResetNewPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="पुनः टाइप गर्नुहोस्"
                        className="w-full px-3 py-2 rounded-lg border border-[#c8d7c2] font-mono text-xs outline-none focus:ring-2 focus:ring-[#4B6043]"
                      />
                    </div>
                  </div>

                  {/* Requirements Box in English */}
                  <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px]">
                    <div className="grid grid-cols-2 gap-1">
                      <span className={`flex items-center gap-1 font-medium ${resetPassStrength.minLength ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {resetPassStrength.minLength ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        Minimum - 8 Character
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${resetPassStrength.hasUpper ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {resetPassStrength.hasUpper ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        One Capital
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${resetPassStrength.hasNumber ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {resetPassStrength.hasNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        One Number
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${resetPassStrength.hasSpecial ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {resetPassStrength.hasSpecial ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
                        One Special Char
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setResetError(null);
                      setResetSuccessMessage(null);
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    रद्द गर्नुहोस्
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-lg shadow-sm text-xs cursor-pointer flex items-center gap-1"
                  >
                    {resetLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>पासवर्ड रिसेट गर्नुहोस्</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};


