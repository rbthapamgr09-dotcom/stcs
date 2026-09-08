import React, { useState, useEffect } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

export const AuthModal: React.FC = () => {
  const {
    authModal,
    closeAuthModal,
    login,
    resetPassword,
    users,
    currentUser,
    addToast,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'reset'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Reset password form state
  const [resetUsername, setResetUsername] = useState('');
  const [resetMethod, setResetMethod] = useState<'pin' | 'securityQuestion' | 'masterKey'>('pin');
  const [verificationValue, setVerificationValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (authModal.isOpen) {
      setMode(authModal.mode);
      if (authModal.initialUsername) {
        setLoginUsername(authModal.initialUsername);
        setResetUsername(authModal.initialUsername);
      }
      setLoginPassword('');
      setVerificationValue('');
      setNewPassword('');
      setConfirmPassword('');
      setResetSuccess(false);
    }
  }, [authModal]);

  if (!authModal.isOpen) return null;

  // Selected user for security question hint
  const matchedResetUser = users.find(
    (u) =>
      u.username.toLowerCase() === resetUsername.trim().toLowerCase() ||
      (u.email && u.email.toLowerCase() === resetUsername.trim().toLowerCase())
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) {
      addToast('error', 'User ID आवश्यक', 'कृपया प्रयोगकर्ता नाम (User ID) प्रविष्ट गर्नुहोस्।');
      return;
    }
    setLoginLoading(true);
    try {
      const result = await login(loginUsername.trim(), loginPassword);
      setLoginLoading(false);
      if (result.success) {
        setLoginPassword('');
      }
    } catch {
      setLoginLoading(false);
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUsername.trim()) {
      addToast('error', 'User ID आवश्यक', 'कृपया आफ्नो User ID वा इमेल प्रविष्ट गर्नुहोस्।');
      return;
    }
    if (!verificationValue.trim()) {
      addToast('error', 'प्रमाणीकरण आवश्यक', 'कृपया सुरक्षा पिन, उत्तर वा मास्टर कुञ्जी भर्नुहोस्।');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      addToast('error', 'कमजोर पासवर्ड', 'नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्दछ।');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('error', 'पासवर्ड मिलेन', 'नयाँ पासवर्ड र पुष्टि गरिएको पासवर्ड एउटै हुनुपर्दछ।');
      return;
    }

    setResetLoading(true);
    setTimeout(() => {
      const result = resetPassword({
        usernameOrEmail: resetUsername.trim(),
        method: resetMethod,
        verificationValue: verificationValue.trim(),
        newPassword: newPassword,
      });
      setResetLoading(false);

      if (result.success) {
        setResetSuccess(true);
        setTimeout(() => {
          setLoginUsername(resetUsername.trim());
          setLoginPassword(newPassword);
          setMode('login');
          setResetSuccess(false);
        }, 1500);
      }
    }, 300);
  };

  const handleFillDemoCreds = (username: string, pass: string) => {
    setLoginUsername(username);
    setLoginPassword(pass);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={closeAuthModal}
    >
      <div
        className="bg-white rounded-3xl border border-[#d6e3d2] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#4B6043] text-white p-5 relative">
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
            title="बन्द गर्नुहोस्"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
              {mode === 'login' ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {mode === 'login' ? 'प्रणाली सुरक्षित लगइन (Login)' : 'पासवर्ड रिसेट (Reset Password)'}
              </h2>
              <p className="text-[11px] text-emerald-100">
                {mode === 'login'
                  ? 'प्रयोगकर्ता ID र पासवर्ड प्रविष्ट गरी लगइन गर्नुहोस्'
                  : 'सुरक्षा प्रमाणिकरण गरि नयाँ पासवर्ड सेट गर्नुहोस्'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs">
          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* User ID / Username Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 flex items-center justify-between">
                  <span>User ID / प्रयोगकर्ता नाम: *</span>
                  <span className="text-[10px] text-gray-400 font-normal">वा दर्ता भएको इमेल</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="जस्तै: superadmin, accountant, viewer"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700">पासवर्ड (Password): *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetUsername(loginUsername);
                      setMode('reset');
                    }}
                    className="text-[11px] text-[#4B6043] hover:text-[#2c3d26] font-bold underline cursor-pointer"
                  >
                    पासवर्ड बिर्सनुभयो?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="पासवर्ड टाइप गर्नुहोस्"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-[#4B6043] hover:bg-[#384c31] disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {loginLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>प्रणालीमा लगइन गर्नुहोस् (Sign In)</span>
                  </>
                )}
              </button>

              {/* Quick Credentials / Demo Logins */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[11px] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>द्रुत परीक्षण खाताहरू (Quick Demo Login Credentials):</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFillDemoCreds('superadmin', 'admin123')}
                    className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-colors cursor-pointer group"
                  >
                    <p className="font-bold text-purple-900 text-[10px] group-hover:underline">Super Admin</p>
                    <p className="text-[9px] text-gray-500 font-mono">superadmin</p>
                    <p className="text-[8px] text-purple-700 font-mono">admin123</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillDemoCreds('accountant', 'account123')}
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors cursor-pointer group"
                  >
                    <p className="font-bold text-blue-900 text-[10px] group-hover:underline">Accountant</p>
                    <p className="text-[9px] text-gray-500 font-mono">accountant</p>
                    <p className="text-[8px] text-blue-700 font-mono">account123</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillDemoCreds('viewer', 'viewer123')}
                    className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors cursor-pointer group"
                  >
                    <p className="font-bold text-gray-800 text-[10px] group-hover:underline">Viewer</p>
                    <p className="text-[9px] text-gray-500 font-mono">viewer</p>
                    <p className="text-[8px] text-gray-600 font-mono">viewer123</p>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Reset Password Form */
            <form onSubmit={handleResetSubmit} className="space-y-4">
              {resetSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-800 flex items-center gap-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-xs">पासवर्ड सफलतापूर्वक रिसेट भयो!</p>
                    <p className="text-[11px] text-emerald-700">लगइन पृष्ठमा स्वतः रिडाइरेक्ट हुँदैछ...</p>
                  </div>
                </div>
              )}

              {/* User ID / Email Input */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700">User ID / प्रयोगकर्ता नाम वा इमेल: *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="जस्तै: superadmin, accountant"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>
              </div>

              {/* Verification Method Chooser */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">प्रमाणीकरण विधि (Verification Method):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMethod('pin');
                      setVerificationValue('');
                    }}
                    className={`p-2 rounded-xl text-center border font-bold transition-colors cursor-pointer ${
                      resetMethod === 'pin'
                        ? 'bg-[#edf4ea] border-[#4B6043] text-[#24331C]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    सुरक्षा पिन (PIN)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetMethod('securityQuestion');
                      setVerificationValue('');
                    }}
                    className={`p-2 rounded-xl text-center border font-bold transition-colors cursor-pointer ${
                      resetMethod === 'securityQuestion'
                        ? 'bg-[#edf4ea] border-[#4B6043] text-[#24331C]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
                    className={`p-2 rounded-xl text-center border font-bold transition-colors cursor-pointer ${
                      resetMethod === 'masterKey'
                        ? 'bg-[#edf4ea] border-[#4B6043] text-[#24331C]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    मास्टर कुञ्जी
                  </button>
                </div>
              </div>

              {/* Verification Input Field */}
              <div className="bg-[#f8faf6] p-3 rounded-xl border border-[#d8e4d3] space-y-2">
                {resetMethod === 'pin' && (
                  <div className="space-y-1">
                    <label className="font-bold text-gray-800 flex items-center justify-between">
                      <span>४-अङ्कको सुरक्षा पिन (Security PIN): *</span>
                      <span className="text-[10px] text-gray-400 font-normal">(मानक: 1234)</span>
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={verificationValue}
                      onChange={(e) => setVerificationValue(e.target.value)}
                      placeholder="पिन प्रविष्ट गर्नुहोस् (e.g. 1234)"
                      className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white font-mono font-bold tracking-widest text-center text-sm outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                )}

                {resetMethod === 'securityQuestion' && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-gray-700">
                      <span className="font-bold text-[#24331C]">सुरक्षा प्रश्न: </span>
                      <span>
                        {matchedResetUser?.securityQuestion ||
                          'तपाईंको पहिलो विद्यालयको नाम / जन्मस्थान / मनपर्ने रङ्ग के हो?'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">सुरक्षा उत्तर (Security Answer): *</label>
                      <input
                        type="text"
                        required
                        value={verificationValue}
                        onChange={(e) => setVerificationValue(e.target.value)}
                        placeholder="जस्तै: नेपाल वा काठमाडौँ"
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white font-semibold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043]"
                      />
                    </div>
                  </div>
                )}

                {resetMethod === 'masterKey' && (
                  <div className="space-y-1">
                    <label className="font-bold text-gray-800 flex items-center justify-between">
                      <span>मास्टर रिकभरी कुञ्जी (Master Admin Key): *</span>
                      <span className="text-[10px] text-amber-700 font-normal">(`nepal@gov2081`)</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={verificationValue}
                      onChange={(e) => setVerificationValue(e.target.value)}
                      placeholder="मास्टर कुञ्जी प्रविष्ट गर्नुहोस्"
                      className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                )}
              </div>

              {/* New Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">नयाँ पासवर्ड: *</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="नयाँ पासवर्ड"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">पासवर्ड पुष्टि: *</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="पासवर्ड पुनः लेख्नुहोस्"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>
              </div>

              {/* Show Password Toggle */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-gray-600 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNewPassword}
                    onChange={(e) => setShowNewPassword(e.target.checked)}
                    className="rounded text-[#4B6043]"
                  />
                  <span>पासवर्ड देखाउनुहोस्</span>
                </label>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[11px] text-gray-500 hover:text-gray-800 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>लगइन पृष्ठमा फर्कनुहोस्</span>
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {resetLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>पासवर्ड रिसेट गर्नुहोस्</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
