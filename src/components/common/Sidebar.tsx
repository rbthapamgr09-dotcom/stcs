import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Building,
  Users,
  Banknote,
  Scissors,
  Percent,
  CalendarDays,
  Calculator,
  FileText,
  FileSpreadsheet,
  BarChart3,
  CloudUpload,
  Settings,
  ChevronRight,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  User as UserIcon,
  LogOut,
  KeyRound,
  ChevronUp,
  ChevronDown,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  X,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toNepaliDigits } from '../../utils/nepaliCalendar';
import { UserRole } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isDesktopCollapsed: externalCollapsed,
  onToggleDesktopCollapse,
}) => {
  const {
    activeTab,
    setActiveTab,
    employees,
    taxReferences,
    currentUser,
    logout,
    openResetPasswordModal,
    organization,
  } = useApp();

  // Internal state for desktop collapse & hover expansion
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // User Profile popup & modal states
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
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

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleDesktopCollapse) {
      onToggleDesktopCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  // Expand if pinned open OR temporarily when hovered on desktop
  const isExpanded = !isCollapsed || isHovered;

  const getRoleLabelNepali = (role?: UserRole) => {
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
        return role || 'प्रयोगकर्ता';
    }
  };

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-900/70 text-purple-200 border-purple-400/40';
      case 'ADMIN':
        return 'bg-emerald-900/70 text-emerald-200 border-emerald-400/40';
      case 'ACCOUNTANT':
        return 'bg-blue-900/70 text-blue-200 border-blue-400/40';
      case 'VIEWER':
      default:
        return 'bg-gray-800 text-gray-300 border-gray-600';
    }
  };

  const menuItems = [
    {
      id: 'dashboard',
      nepali: 'ड्यासबोर्ड',
      english: '(Dashboard)',
      sub: 'समग्र तथ्याङ्क तथा सारांश',
      icon: LayoutDashboard,
    },
    {
      id: 'organization',
      nepali: 'कार्यालय विवरण',
      english: '(Organization)',
      sub: 'लेटरहेड, लोगो तथा हस्ताक्षर',
      icon: Building,
    },
    {
      id: 'employees',
      nepali: 'कर्मचारी विवरण तथा तलब/आय',
      english: '(Employees & Salary Setup)',
      sub: 'विवरण, सेवा, पद, तलब तथा कर विवरण',
      icon: Users,
      badge: toNepaliDigits(employees.length),
    },
    {
      id: 'salary_reports',
      nepali: 'तलबी प्रतिवेदन',
      english: '(Salary Report)',
      sub: '१९ स्तम्भीय आधिकारिक फाराम',
      icon: FileSpreadsheet,
    },
    {
      id: 'tax_reference',
      nepali: 'कर स्ल्याब तथा नियम',
      english: '(Tax Reference)',
      sub: 'प्रगतिशील कर दर तथा छुटहरू',
      icon: Percent,
      badge: toNepaliDigits(taxReferences.length),
    },
    {
      id: 'monthly_salary',
      nepali: 'मासिक तलब भरपाई',
      english: '(Monthly Sheet)',
      sub: 'श्रावणदेखि अषाढ तलब विवरण',
      icon: CalendarDays,
    },
    {
      id: 'annual_tax',
      nepali: 'वार्षिक कर गणना',
      english: '(Annual Tax)',
      sub: 'समस्त कर्मचारीको कर दायित्व',
      icon: Calculator,
    },
    {
      id: 'google_sheets',
      nepali: 'गुगल सिट्स सिंक',
      english: '(Data Sync)',
      sub: 'Apps Script API इन्टिग्रेसन',
      icon: CloudUpload,
    },
    {
      id: 'settings',
      nepali: 'सेटिङ्स',
      english: '(Settings)',
      sub: 'डेमो डाटा, ब्याकअप तथा नियम',
      icon: Settings,
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.id === 'google_sheets') {
      return currentUser?.role === 'SUPER_ADMIN';
    }
    return true;
  });

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden no-print"
        />
      )}

      {/* Sidebar Container - Situated directly below header banner */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredItemId(null);
        }}
        className={`fixed lg:relative top-0 lg:top-auto left-0 bottom-0 lg:bottom-auto z-40 lg:z-20 bg-[#23351E] text-[#E4EDE0] flex flex-col transition-all duration-300 ease-in-out border-r border-[#3a5233] shadow-2xl lg:shadow-none h-full shrink-0 no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isExpanded ? 'w-72' : 'w-20'}`}
      >
        {/* Sidebar Brand Header with Collapse/Expand Action */}
        <div className="p-3.5 border-b border-[#374f30] bg-[#1c2b18] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#4B6043] border border-[#69885e] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Shield className="w-4.5 h-4.5" />
            </div>
            {isExpanded && (
              <div className="min-w-0 truncate transition-opacity duration-200">
                <p className="text-[11px] font-bold text-emerald-300 tracking-wider truncate">तलबी तथा कर गणना</p>
                <h2 className="text-xs font-extrabold text-white leading-tight truncate">
                  प्रणाली मेनु (Menu)
                </h2>
              </div>
            )}
          </div>

          {/* Expand/Collapse Toggle Button */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'मेनु बार विस्तार गर्नुहोस् (Click to Expand)' : 'मेनु बार संकुचित गर्नुहोस् (Click to Collapse)'}
            className="p-1.5 rounded-lg text-emerald-200/80 hover:text-white hover:bg-[#38512f] transition-colors shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation List with smooth dark scrollbar */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll p-2.5 space-y-1.5 overscroll-contain">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isItemHovered = hoveredItemId === item.id;

            return (
              <div key={item.id} className="relative">
                <button
                  onClick={() => handleSelectTab(item.id)}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  className={`w-full flex items-center rounded-xl text-left transition-all duration-200 group relative ${
                    isExpanded ? 'px-3 py-2.5 justify-between' : 'p-2.5 justify-center'
                  } ${
                    isActive
                      ? 'bg-[#4B6043] text-white font-bold shadow-md ring-1 ring-emerald-400/30'
                      : 'text-[#D0E0CC] hover:bg-[#32492a] hover:text-white hover:translate-x-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-1.5 rounded-lg transition-transform duration-200 shrink-0 self-start mt-0.5 ${
                        isActive
                          ? 'bg-white/20 text-white scale-105'
                          : 'text-emerald-300/80 group-hover:text-emerald-200 group-hover:scale-110 group-hover:bg-[#3c5633]'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    {isExpanded && (
                      <div className="min-w-0 flex-1">
                        {/* Nepali Menu Title: 12pt, Bold */}
                        <p
                          style={{ fontSize: '12pt', lineHeight: 1.25 }}
                          className={`font-bold truncate ${
                            isActive ? 'text-white' : 'text-[#E8F1E5] group-hover:text-white'
                          }`}
                        >
                          {item.nepali}
                        </p>
                        
                        {/* English Menu Sub-title: Below Nepali Text */}
                        <p
                          className={`text-xs truncate font-medium leading-tight mt-0.5 ${
                            isActive ? 'text-emerald-200' : 'text-emerald-300/80 group-hover:text-emerald-200'
                          }`}
                        >
                          {item.english}
                        </p>
                        
                        {/* Sub description */}
                        {item.sub && (
                          <p
                            className={`text-[10px] truncate leading-tight mt-0.5 ${
                              isActive ? 'text-emerald-100/70' : 'text-emerald-400/60 group-hover:text-emerald-300/80'
                            }`}
                          >
                            {item.sub}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-1 self-start mt-1">
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-transform ${
                            isActive
                              ? 'bg-white text-[#23351E]'
                              : 'bg-[#3b5333] text-emerald-200 group-hover:scale-105'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}

                  {/* Notification Dot in collapsed mode when badge exists */}
                  {!isExpanded && item.badge && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#23351E]" />
                  )}
                </button>

                {/* Floating Tooltip when sidebar is collapsed and not hovered on full sidebar */}
                {!isExpanded && isItemHovered && (
                  <div className="fixed left-20 z-50 ml-2 px-3 py-2 bg-[#172513] text-white rounded-xl shadow-2xl border border-[#44603b] pointer-events-none whitespace-nowrap animate-in fade-in duration-150">
                    <p style={{ fontSize: '12pt' }} className="font-bold text-white leading-snug">{item.nepali}</p>
                    <p className="text-xs text-emerald-300">{item.english}</p>
                    {item.sub && <p className="text-[10px] text-emerald-400/80">{item.sub}</p>}
                    {item.badge && (
                      <span className="inline-block mt-1 text-[9px] font-bold bg-[#4B6043] text-white px-1.5 py-0.5 rounded">
                        संख्या: {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Info with Small Avatar Button that Expands on Click */}
        <div
          ref={userMenuRef}
          className="relative p-2.5 bg-[#182515] border-t border-[#31462b] text-[11px] text-[#9bb893] shrink-0"
        >
          {isExpanded ? (
            <div className="flex items-center justify-between gap-2">
              {currentUser && (
                <div className="relative">
                  {/* Single Small Avatar Button matching the image [ प ] - Toggles on Click */}
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-xs border shadow-sm transition-all duration-200 cursor-pointer active:scale-95 ${
                      showUserMenu
                        ? 'bg-[#436437] border-emerald-400 ring-2 ring-emerald-400/50 scale-105'
                        : 'bg-[#344e2c] hover:bg-[#436437] border-[#4d7240] hover:border-emerald-400/60'
                    }`}
                    title={`${currentUser.fullName} (${currentUser.role}) - क्लिक गरी प्रोफाइल तथा लगआउट मेनु खोल्नुहोस्`}
                  >
                    {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
                  </button>

                  {/* Expand on Click: Floating Extended User Card */}
                  {showUserMenu && (
                    <div className="absolute bottom-full left-0 mb-2.5 w-64 bg-[#1b2b17] border border-[#3e5b34] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 text-white">
                      {/* User Header in Card */}
                      <div className="flex items-start gap-2.5 pb-2 mb-2 border-b border-[#2d4427]">
                        <div className="w-8 h-8 rounded-lg bg-[#4B6043] border border-emerald-400/30 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                          <p className="font-bold text-white text-xs truncate leading-snug">
                            {currentUser.fullName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded border text-[8px] font-bold ${getRoleBadgeColor(
                                currentUser.role
                              )}`}
                            >
                              {currentUser.role}
                            </span>
                            <span className="text-[8px] text-emerald-400/80 font-mono truncate">
                              @{currentUser.username}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowUserMenu(false)}
                          className="p-1 text-emerald-400/60 hover:text-white hover:bg-[#283e23] rounded-lg transition-colors cursor-pointer"
                          title="बन्द गर्नुहोस्"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="space-y-1">
                        {/* View Profile */}
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowProfileModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-[#283d23] hover:text-white rounded-lg font-medium transition-colors text-left cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>विस्तृत प्रोफाइल (View Profile)</span>
                        </button>

                        {/* Change Password */}
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            openResetPasswordModal(currentUser.username);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-[#283d23] hover:text-white rounded-lg font-medium transition-colors text-left cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>पासवर्ड परिवर्तन (Password)</span>
                        </button>

                        {/* Settings if Admin */}
                        {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') && (
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              handleSelectTab('settings');
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-[#283d23] hover:text-white rounded-lg font-medium transition-colors text-left cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>प्रयोगकर्ता व्यवस्थापन (Settings)</span>
                          </button>
                        )}

                        <div className="h-px bg-[#2d4427] my-1" />

                        {/* Logout Action */}
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 rounded-lg font-bold transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>लगआउट (Logout)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Version and System Tag */}
              <div className="flex-1 min-w-0 pl-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 text-[10.5px]">संस्करण २.०</span>
                  <span className="text-[8.5px] bg-[#293d23] px-1 py-0.2 rounded text-emerald-200 border border-[#3e5935]">
                    सुरक्षित
                  </span>
                </div>
                <p className="text-[9px] text-[#7d9b74] truncate">
                  आयकर ऐन २०५८
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              {currentUser && (
                <div className="relative">
                  {/* Single Small Avatar Button for Collapsed Mode - Toggles on Click */}
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-[10px] border shadow-sm transition-all cursor-pointer ${
                      showUserMenu
                        ? 'bg-[#436437] border-emerald-400 ring-2 ring-emerald-400/50'
                        : 'bg-[#344e2c] hover:bg-[#436437] border-[#4d7240]'
                    }`}
                    title={`${currentUser.fullName} (${currentUser.role}) - क्लिक गरी प्रोफाइल मेनु खोल्नुहोस्`}
                  >
                    {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
                  </button>

                  {/* Expand on Click for Collapsed Mode */}
                  {showUserMenu && (
                    <div className="absolute bottom-0 left-full ml-2.5 w-60 bg-[#1b2b17] border border-[#3e5b34] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-left-2 duration-150 text-white">
                      <div className="flex items-start gap-2.5 pb-2 mb-2 border-b border-[#2d4427]">
                        <div className="w-7 h-7 rounded-lg bg-[#4B6043] border border-emerald-400/30 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                          <p className="font-bold text-white text-xs truncate">
                            {currentUser.fullName}
                          </p>
                          <span
                            className={`inline-block mt-0.5 px-1.5 py-0.2 rounded border text-[8px] font-bold ${getRoleBadgeColor(
                              currentUser.role
                            )}`}
                          >
                            {currentUser.role}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowUserMenu(false)}
                          className="p-1 text-emerald-400/60 hover:text-white hover:bg-[#283e23] rounded-lg transition-colors cursor-pointer"
                          title="बन्द गर्नुहोस्"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowProfileModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-[#283d23] hover:text-white rounded-lg font-medium transition-colors text-left cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>विस्तृत प्रोफाइल</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            openResetPasswordModal(currentUser.username);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-[#283d23] hover:text-white rounded-lg font-medium transition-colors text-left cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>पासवर्ड परिवर्तन</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 rounded-lg font-bold transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>लगआउट (Logout)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="text-[8px] font-mono font-bold text-emerald-300 bg-[#293d23] px-1 py-0.2 rounded border border-[#3e5935]">
                v2.0
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Comprehensive User Profile Modal */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 no-print">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#cddcc8] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header Banner */}
            <div className="bg-gradient-to-r from-[#24331C] via-[#334b28] to-[#4B6043] text-white p-6 relative">
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-black/20 text-white/80 hover:text-white hover:bg-black/40 transition-colors"
                title="बन्द गर्नुहोस्"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/30 backdrop-blur-md flex items-center justify-center text-2xl font-black text-white shadow-lg">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-white truncate">{currentUser.fullName}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide border shadow-xs ${
                        currentUser.role === 'SUPER_ADMIN'
                          ? 'bg-purple-500 text-white border-purple-300'
                          : currentUser.role === 'ADMIN'
                          ? 'bg-emerald-500 text-white border-emerald-300'
                          : 'bg-blue-500 text-white border-blue-300'
                      }`}
                    >
                      {getRoleLabelNepali(currentUser.role)}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    {currentUser.designation || 'प्रणाली व्यवस्थापक / अधिकृत'}
                  </p>
                  <p className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                    प्रयोगकर्ता आइडी (Username): @{currentUser.username}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-[#24331C]">
              {/* Account Details Grid */}
              <div>
                <h4 className="text-xs font-bold text-[#4B6043] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4" />
                  <span>व्यक्तिगत तथा खाता विवरण (Account Information)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f7faf5] p-3.5 rounded-2xl border border-[#d6e3d2] text-xs">
                  <div>
                    <span className="text-gray-500 text-[11px] block">पूरा नाम (Full Name)</span>
                    <span className="font-bold text-[#24331C]">{currentUser.fullName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">पद (Designation)</span>
                    <span className="font-bold text-[#24331C]">{currentUser.designation || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">प्रयोगकर्ता भूमिका (Role)</span>
                    <span className="font-mono font-bold text-purple-800">{currentUser.role}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">सम्बद्ध संस्था / कार्यालय</span>
                    <span className="font-semibold text-[#24331C] truncate">
                      {currentUser.organizationName || organization.officeName || 'सबै कार्यालय (Global)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">इमेल ठेगाना</span>
                    <span className="font-mono text-[#24331C]">{currentUser.email || 'उपलब्ध छैन'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">सम्पर्क फोन</span>
                    <span className="font-mono text-[#24331C]">{currentUser.phone || 'उपलब्ध छैन'}</span>
                  </div>
                </div>
              </div>

              {/* Role Permissions & Capabilities */}
              <div>
                <h4 className="text-xs font-bold text-[#4B6043] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>प्रणाली अधिकार तथा अनुमति (System Permissions)</span>
                </h4>
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>कर्मचारी विवरण, सेवा, तलब तथा कट्टी अभिलेखीकरण</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>१९ स्तम्भीय तलबी प्रतिवेदन तथा पारिश्रमिक आयकर निर्धारण फाराम</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>कर स्ल्याब, वैधानिक सीमा, गुगल सिट्स सिंक तथा Excel/PDF निर्यात</span>
                  </div>
                  {currentUser.role === 'SUPER_ADMIN' && (
                    <div className="flex items-center gap-2 text-purple-900 font-bold pt-1 border-t border-emerald-200">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>सम्पूर्ण प्रणाली, बहु-कार्यालय, डाटा रिसेट तथा प्रयोगकर्ता व्यवस्थापनको पूर्ण अधिकार</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Security & Password Action Box */}
              <div className="bg-[#f2f7ef] border border-[#c6dbc0] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-xs text-[#24331C]">सुरक्षा तथा पासवर्ड व्यवस्थापन</h5>
                  <p className="text-[11px] text-gray-600">
                    आफ्नो लगइन पासवर्ड सुरक्षित राख्नुहोस् तथा आवश्यकता अनुसार परिवर्तन गर्नुहोस्।
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    openResetPasswordModal(currentUser.username);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4B6043] hover:bg-[#394a33] text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>पासवर्ड परिवर्तन</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#f7faf5] border-t border-[#d6e3d2] px-6 py-3.5 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  logout();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>लगआउट (Logout)</span>
              </button>

              <button
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-2 bg-[#4B6043] hover:bg-[#3a4c33] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                बन्द गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
