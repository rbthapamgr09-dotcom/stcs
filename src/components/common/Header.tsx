import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Layers,
  Printer,
  Cloud,
  Hash,
  Menu,
  UserCheck,
  LogOut,
  ChevronDown,
  ShieldAlert,
  User as UserIcon,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getCurrentDualDate, toNepaliDigits } from '../../utils/nepaliCalendar';
import { UserRole } from '../../types';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const {
    organization,
    activeFiscalYear,
    setActiveFiscalYear,
    fiscalYears,
    useDevanagariNumerals,
    setUseDevanagariNumerals,
    resetToDemoData,
    isDemoData,
    googleSheetsConfig,
    currentUser,
    users,
    login,
    logout,
    openLoginModal,
    openResetPasswordModal,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    previousTab,
    getTabShortLabel,
    isPrivacyMasked,
    togglePrivacyMasking,
    lockScreen,
  } = useApp();

  const currentDate = getCurrentDualDate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'ADMIN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'ACCOUNTANT':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'VIEWER':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getRoleLabelNepali = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'सुपर एडमिन (Super Admin)';
      case 'ADMIN':
        return 'प्रशासक (Admin)';
      case 'ACCOUNTANT':
        return 'लेखापाल (Accountant)';
      case 'VIEWER':
        return 'अवलोकनकर्ता (Viewer)';
      default:
        return role;
    }
  };

  return (
    <header className="bg-white border-b border-[#dce6d7] sticky top-0 z-30 shadow-xs no-print">
      {/* Top Notice / Ministry Band */}
      <div className="bg-[#4B6043] text-white px-4 py-0.5 flex flex-wrap items-center justify-between text-xs gap-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="text-white/90 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5"
            title="मेनु बार खोल्नुहोस् / विस्तार / संकुचित गर्नुहोस् (Toggle Menu Bar)"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-bold tracking-wide">
            {[
              organization.officeName,
              organization.departmentName,
              organization.ministryName,
              organization.name,
              organization.parentBodyName,
            ]
              .filter(Boolean)
              .join(' | ') || 'तलबी तथा कर गणना प्रणाली (Salary & Tax Calculation System)'}
          </span>
          {organization.district && (
            <span className="hidden sm:inline-block text-emerald-200">
              ({organization.district}{organization.province ? `, ${organization.province}` : ''})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Dual Date Display */}
          <div className="flex items-center gap-1.5 font-medium bg-black/15 px-2.5 py-0.5 rounded text-emerald-50">
            <Calendar className="w-3.5 h-3.5 text-emerald-300" />
            <span>वि.सं. {toNepaliDigits(currentDate.bs)}</span>
            <span className="text-[11px] text-emerald-200">({currentDate.ad})</span>
          </div>

          {/* Demo Data Tag with Reset */}
          {isDemoData && (
            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>DEMO DATA</span>
              <button
                onClick={resetToDemoData}
                title="डेमो डाटा पुनः लोड गर्नुहोस्"
                className="ml-1 hover:text-white underline text-[10px]"
              >
                रिसेट
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main App Title Bar */}
      <div className="px-4 py-1 flex flex-wrap items-center justify-between gap-3">
        {/* Left: App Title & Subtitle with Toggle Menu Button & Back/Forward Navigation */}
        <div className="flex items-center gap-2">
          {/* Navigation Controls Group */}
          <div className="flex items-center gap-0.5 bg-[#eef4ea] p-0.5 rounded-lg border border-[#cbdac5] shadow-xs">
            <button
              onClick={onToggleSidebar}
              className="p-1 rounded-lg text-[#4B6043] hover:bg-[#dce9d6] hover:text-[#32452b] transition-all cursor-pointer"
              title="मेनु बार विस्तार / संकुचन गर्नुहोस् (Toggle Menu Bar)"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="h-3 w-px bg-[#cbdac5]" />

            {/* Back Button */}
            <button
              id="header-btn-back"
              onClick={goBack}
              disabled={!canGoBack}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                canGoBack
                  ? 'bg-[#4B6043] text-white hover:bg-[#3d5137] shadow-xs cursor-pointer active:scale-95'
                  : 'bg-transparent text-gray-400 cursor-not-allowed opacity-40'
              }`}
              title={
                canGoBack
                  ? `पछाडि फर्कनुहोस् (${previousTab ? getTabShortLabel(previousTab) : 'ड्यासबोर्ड'}) - [Alt + ←]`
                  : 'पछाडि जाने अघिल्लो पृष्ठ छैन'
              }
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">पछाडि</span>
            </button>

            {/* Forward Button */}
            {canGoForward && (
              <button
                id="header-btn-forward"
                onClick={goForward}
                className="p-1 rounded-lg text-[#4B6043] hover:bg-[#dce9d6] hover:text-[#32452b] transition-all cursor-pointer active:scale-95"
                title="अगाडिको पृष्ठमा जानुहोस् - [Alt + →]"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-[#24331C] tracking-tight flex items-center gap-1.5">
              तलबी तथा कर गणना प्रणाली <span className="text-[11px] font-semibold text-[#526a48] hidden md:inline">(Salary & Tax Calculation System)</span>
            </h1>
            <p className="text-[10px] text-[#526a48] font-medium hidden sm:block mt-0.1">
              कर्मचारी वार्षिक तथा मासिक तलब, कर गणना एवं प्रतिवेदन प्रणाली
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Fiscal Year Selector (Dynamic from FY database) */}
          <div className="flex items-center gap-1 bg-[#f4f8f1] border border-[#cddcc8] px-2 py-1 rounded-lg text-[11px]">
            <Layers className="w-3 h-3 text-[#4B6043]" />
            <span className="font-bold text-[#34472c]">आ.व.:</span>
            <select
              value={activeFiscalYear}
              onChange={(e) => setActiveFiscalYear(e.target.value)}
              className="bg-transparent font-bold text-[#24331C] focus:outline-none cursor-pointer"
            >
              {fiscalYears.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </div>

          {/* Numeral Script Toggle */}
          <button
            id="btn-toggle-numeral-script"
            onClick={() => setUseDevanagariNumerals(!useDevanagariNumerals)}
            title={
              useDevanagariNumerals
                ? 'अंकहरू अंग्रेजीमा हेर्न क्लिक गर्नुहोस् (Switch to English Number 123)'
                : 'अंकहरू नेपाली युनिकोडमा हेर्न क्लिक गर्नुहोस् (Switch to Nepali Unicode)'
            }
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-xs transition-all cursor-pointer ${
              useDevanagariNumerals
                ? 'bg-[#4B6043] text-white border-[#3b4e34] hover:bg-[#3d5137]'
                : 'bg-white text-[#24331C] border-[#b7cbb2] hover:bg-[#eef5eb]'
            }`}
          >
            <Hash className="w-3 h-3" />
            <span>{useDevanagariNumerals ? '# नेपाली अंक' : '# 123 अंक'}</span>
          </button>

          {/* Google Sheets Sync Pill */}
          <div
            className={`hidden xl:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border ${
              googleSheetsConfig.webAppUrl
                ? googleSheetsConfig.syncStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            <Cloud className="w-3 h-3" />
            <span className="font-medium">
              {googleSheetsConfig.webAppUrl ? 'गुगल सिट्स' : 'लोकल मोड'}
            </span>
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[#4B6043] hover:bg-[#3b4e33] transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-3 h-3" />
            <span>प्रिन्ट</span>
          </button>

          {/* Privacy Masking Toggle */}
          <button
            onClick={togglePrivacyMasking}
            className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors shadow-xs cursor-pointer ${
              isPrivacyMasked
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-[#edf4ea] hover:text-[#24331C]'
            }`}
            title={
              isPrivacyMasked
                ? 'गोपनीयता मोड सक्रिय छ (बैंक खाता, प्यान नम्बर मास्क गरिएको छ) - हेर्नका लागि क्लिक गर्नुहोस्'
                : 'गोपनीयता मोड (बैंक खाता, प्यान नम्बर जस्ता संवेदनशील विवरणहरू मास्क गर्नुहोस्)'
            }
          >
            {isPrivacyMasked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{isPrivacyMasked ? 'मास्क' : 'गोपनीयता'}</span>
          </button>

          {/* Screen Lock Button */}
          <button
            onClick={lockScreen}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition-colors shadow-xs cursor-pointer"
            title="स्क्रिन तुरुन्त सुरक्षित लक गर्नुहोस् (Alt + L)"
          >
            <Lock className="w-3 h-3 text-amber-600" />
            <span className="hidden sm:inline">लक</span>
          </button>

          {/* User Account / Role Badge & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 px-2 py-1 bg-[#f4f8f1] hover:bg-[#e6f0e2] border border-[#cddcc8] rounded-lg text-[11px] transition-colors cursor-pointer"
              title="लगइन भएको प्रयोगकर्ताको प्रोफाइल (My Profile)"
            >
              <div className="w-5 h-5 rounded-full bg-[#4B6043] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="font-bold text-[#24331C] text-[10px] leading-tight truncate max-w-[120px]">
                  {currentUser?.fullName || 'प्रयोगकर्ता'}
                </p>
                <span
                  className={`inline-block px-1 py-0.1 rounded border text-[8px] font-semibold ${getRoleBadgeStyle(
                    currentUser?.role || 'VIEWER'
                  )}`}
                >
                  {currentUser?.role}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {/* Logged-in User Profile Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-[#d6e3d2] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
                {/* Profile Header */}
                <div className="px-4 py-3.5 border-b border-gray-100 bg-[#f8faf6]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#4B6043] text-white flex items-center justify-center text-base font-bold shadow-sm shrink-0">
                      {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'U'}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-xs font-bold text-[#24331C] truncate">{currentUser?.fullName}</p>
                      <p className="text-[11px] text-gray-500 truncate">{currentUser?.designation || 'कर्मचारी'}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(
                            currentUser?.role || 'VIEWER'
                          )}`}
                        >
                          {getRoleLabelNepali(currentUser?.role || 'VIEWER')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Details (Only Logged-in User Info) */}
                <div className="px-4 py-3 border-b border-gray-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="text-gray-400 font-medium">User ID / कोड:</span>
                    <span className="font-mono font-bold text-[#24331C] bg-[#edf4ea] px-2 py-0.5 rounded border border-[#d2e2ce] text-[11px]">
                      {currentUser?.username}
                    </span>
                  </div>

                  {currentUser?.email && (
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="text-gray-400 font-medium">इमेल:</span>
                      <span className="font-mono text-[#24331C] text-[11px] truncate max-w-[160px]">
                        {currentUser.email}
                      </span>
                    </div>
                  )}

                  {currentUser?.phone && (
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="text-gray-400 font-medium">सम्पर्क:</span>
                      <span className="font-mono text-[#24331C] text-[11px]">
                        {currentUser.phone}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-gray-600 pt-1">
                    <span className="text-gray-400 font-medium">खाता स्थिति:</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      सक्रिय (Active)
                    </span>
                  </div>
                </div>

                {/* Security / Password Reset for this logged in user */}
                <div className="p-2 border-b border-gray-100 space-y-1">
                  <button
                    onClick={() => {
                      lockScreen();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#24331C] hover:bg-[#edf4ea] rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>स्क्रिन सुरक्षित लक गर्नुहोस् (Lock - Alt+L)</span>
                  </button>

                  <button
                    onClick={() => {
                      togglePrivacyMasking();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#24331C] hover:bg-[#edf4ea] rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    {isPrivacyMasked ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-[#4B6043]" />
                    )}
                    <span>
                      {isPrivacyMasked
                        ? 'गोपनीयता मोड निष्कृय गर्नुहोस्'
                        : 'गोपनीयता मोड सक्रिय गर्नुहोस् (Mask PII)'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      openResetPasswordModal(currentUser?.username);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#24331C] hover:bg-[#edf4ea] rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#4B6043]" />
                    <span>पासवर्ड परिवर्तन गर्नुहोस् (Change Password)</span>
                  </button>
                </div>

                {/* Logout Action */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>लगआउट गर्नुहोस् (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
