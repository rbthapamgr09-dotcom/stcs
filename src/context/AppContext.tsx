import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef } from 'react';
import {
  Employee,
  SalarySetup,
  DeductionSetup,
  TaxReference,
  OrganizationSetup,
  GoogleSheetsConfig,
  ToastMessage,
  AnnualTaxCalculationResult,
  MonthlySalaryItem,
  NepaliMonth,
  User,
  UserRole,
  FiscalYearData,
  OrganizationItem,
  OrganizationDataStore,
  SystemSupportContact,
} from '../types';
import {
  DEFAULT_ORGANIZATION,
  DEFAULT_TAX_REFERENCES,
  DEMO_EMPLOYEES,
  DEMO_SALARY_SETUPS,
  DEMO_DEDUCTION_SETUPS,
  DEFAULT_GOOGLE_SHEETS_CONFIG,
  DEFAULT_USERS,
  DEFAULT_ORGANIZATIONS,
  DEFAULT_SUPPORT_CONTACT,
} from '../data/demoData';
import {
  calculateAnnualSalaryAndTax,
  calculateMonthlySalaryItem,
} from '../utils/calculationEngine';
import {
  sortFiscalYearsDescending,
  DEFAULT_FISCAL_YEARS_LIST,
  toEnglishDigits,
} from '../utils/nepaliCalendar';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getAccessToken,
  getCurrentGoogleUser,
  isGoogleConnected,
  directConnectAdminAccount,
} from '../services/googleAuthService';
import {
  createAppSpreadsheet,
  pushDataToGoogleSpreadsheet,
  pullDataFromGoogleSpreadsheet,
  findAppSpreadsheetInDrive,
  listUserSpreadsheets,
  getKathmanduTimestamp,
  AppSyncDataPayload,
  TARGET_GOOGLE_DRIVE_FOLDER_ID,
  TARGET_GOOGLE_DRIVE_FOLDER_URL,
} from '../services/googleSheetsService';
import {
  saveCloudAppConnection,
  getCloudAppConnection,
  saveCloudUsers,
  getCloudUsers,
  deleteCloudUser,
  saveCloudSupportContact,
  getCloudSupportContact,
  saveCloudOrganization,
  saveCloudOrganizations,
  getCloudOrganizations,
  deleteCloudOrganization,
  saveOrgSheetsConfig,
  getOrgSheetsConfig,
  db,
} from '../services/cloudSyncService';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  hashPasswordSync,
  verifyPasswordSync,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  sanitizeInput,
  logSecurityEvent,
  generateDataChecksum,
  verifyDataChecksum,
} from '../utils/securityUtils';
import { normalizeLogoUrl } from '../utils/logoUtils';

interface ConfirmationDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export type PermissionType =
  | 'MANAGE_USERS'
  | 'MANAGE_GENERAL_USERS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_TAX_SLABS'
  | 'MANAGE_DEDUCTIONS'
  | 'EDIT_EMPLOYEE_SALARY'
  | 'DELETE_EMPLOYEE'
  | 'DELETE_DATA'
  | 'EDIT_DATA'
  | 'VIEW_DATA'
  | 'PRINT_REPORTS'
  | 'CARRY_FORWARD'
  | 'RESET_DATA';

interface AppContextType {
  // Navigation & Preferences
  activeTab: string;
  setActiveTab: (tab: string, options?: { replace?: boolean }) => void;
  navigationHistory: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  previousTab?: string;
  getTabLabel: (tab: string) => string;
  getTabShortLabel: (tab: string) => string;
  activeFiscalYear: string;
  setActiveFiscalYear: (fy: string) => void;
  activeMonth: NepaliMonth;
  setActiveMonth: (m: NepaliMonth) => void;
  useDevanagariNumerals: boolean;
  setUseDevanagariNumerals: (v: boolean) => void;

  // Multi-Tenancy & Organizations
  organizations: OrganizationItem[];
  activeOrganizationId: string;
  activeOrganization: OrganizationItem | undefined;
  setActiveOrganizationId: (orgId: string) => void;
  addOrganization: (
    org: Omit<OrganizationItem, 'id' | 'createdAt'>,
    initialAdmin?: {
      username: string;
      password?: string;
      fullName: string;
      email?: string;
      phone?: string;
      designation?: string;
      securityPin?: string;
    }
  ) => { success: boolean; organization?: OrganizationItem; message: string };
  updateOrganizationDetails: (orgId: string, orgData: Partial<OrganizationItem>) => boolean;
  deleteOrganization: (orgId: string) => { success: boolean; message: string };

  // Fiscal Year Management
  fiscalYears: string[];
  fyDatabase: Record<string, FiscalYearData>;
  createFiscalYear: (newFy: string, copyFromPreviousFy?: string) => boolean;
  updateFiscalYear: (oldFy: string, newFy: string) => boolean;
  deleteFiscalYear: (fy: string) => boolean;
  carryForwardFiscalYear: (
    sourceFy: string,
    targetFy: string,
    options?: {
      copyEmployees?: boolean;
      promoteGrades?: boolean;
      copyDeductions?: boolean;
      copyTaxSlabs?: boolean;
    }
  ) => boolean;
  clearFiscalYearData: (fy: string) => void;

  // Authentication & Users (RBAC)
  isAuthenticated: boolean;
  users: User[];
  currentUser: User | null;
  login: (
    userIdOrUsername: string,
    password?: string
  ) => { success: boolean; mustChangePassword?: boolean; user?: User; message?: string };
  logout: () => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => boolean;
  updateUser: (user: User) => boolean;
  deleteUser: (id: string) => boolean;
  changeUserRole: (id: string, role: UserRole) => boolean;
  changeUserPassword: (userId: string, newPassword: string) => boolean;
  completeFirstTimePasswordChange: (params: {
    userId: string;
    newPassword: string;
    securityPin?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }) => { success: boolean; message: string };
  resetPassword: (params: {
    usernameOrEmail: string;
    method: 'pin' | 'securityQuestion' | 'masterKey';
    verificationValue: string;
    newPassword: string;
  }) => { success: boolean; message: string };
  hasPermission: (permission: PermissionType) => boolean;
  authModal: { isOpen: boolean; mode: 'login' | 'reset'; initialUsername?: string };
  openLoginModal: (initialUsername?: string) => void;
  openResetPasswordModal: (initialUsername?: string) => void;
  closeAuthModal: () => void;

  // Data Collections (Active FY scoped)
  employees: Employee[];
  salarySetups: Record<string, SalarySetup>;
  deductionSetups: Record<string, DeductionSetup>;
  taxReferences: TaxReference[];
  organization: OrganizationSetup;

  // Calculated Results
  annualTaxResults: Record<string, AnnualTaxCalculationResult>;
  monthlySalaryItems: MonthlySalaryItem[];
  dashboardMetrics: {
    totalEmployees: number;
    permanentEmployees: number;
    temporaryEmployees: number;
    contractEmployees: number;
    totalAnnualIncome: number;
    totalAnnualTaxLiability: number;
    totalAnnualDeductions: number;
    totalAnnualNetSalary: number;
    totalMonthlyGross: number;
    totalMonthlyTax: number;
    totalMonthlyNet: number;
  };

  // Employee CRUD
  addEmployee: (
    emp: Omit<Employee, 'id' | 'createdAt'>,
    salary?: Partial<SalarySetup>,
    deduction?: Partial<DeductionSetup>
  ) => boolean;
  updateEmployee: (
    emp: Employee,
    salary?: Partial<SalarySetup>,
    deduction?: Partial<DeductionSetup>
  ) => boolean;
  bulkImportEmployees: (
    items: Array<{
      employee: Omit<Employee, 'id' | 'createdAt'>;
      salary?: Partial<SalarySetup>;
      deduction?: Partial<DeductionSetup>;
      isExisting?: boolean;
      existingId?: string;
    }>,
    updateExisting?: boolean
  ) => { added: number; updated: number; skipped: number; total: number };
  deleteEmployee: (id: string) => void;
  getEmployeeById: (id: string) => Employee | undefined;

  // Salary & Deduction Updaters
  updateSalarySetup: (empId: string, setup: Partial<SalarySetup>) => void;
  updateDeductionSetup: (empId: string, setup: Partial<DeductionSetup>) => void;

  // Tax Reference CRUD
  saveTaxReference: (taxRef: TaxReference) => void;
  deleteTaxReference: (id: string) => void;
  getActiveTaxReference: (filingType: 'एकल' | 'दम्पत्ती') => TaxReference;

  // Organization & Support
  updateOrganization: (org: Partial<OrganizationSetup>) => void;
  supportContact: SystemSupportContact;
  updateSupportContact: (contact: Partial<SystemSupportContact>) => void;

  // Google Sheets & Cloud Sync
  googleSheetsConfig: GoogleSheetsConfig;
  updateGoogleSheetsConfig: (cfg: Partial<GoogleSheetsConfig>) => void;
  syncWithGoogleSheets: (
    mode?: 'push' | 'pull' | 'all',
    options?: {
      isAutoSync?: boolean;
      spreadsheetIdOverride?: string;
      overrideEmployees?: Employee[];
      overrideSalarySetups?: Record<string, SalarySetup>;
      overrideDeductionSetups?: Record<string, DeductionSetup>;
      overrideTaxReferences?: TaxReference[];
      overrideOrganization?: OrganizationSetup;
      overrideUsers?: User[];
    }
  ) => Promise<{ success: boolean; message: string }>;
  isGoogleAccountConnected: boolean;
  googleConnectedEmail?: string;
  connectGoogleAccount: () => Promise<boolean>;
  connectDirectAccount: (email?: string, displayName?: string) => Promise<boolean>;
  disconnectGoogleAccount: () => Promise<void>;
  createGoogleSpreadsheetForApp: (options?: {
    officeNameOverride?: string;
    orgIdOverride?: string;
    webAppUrlOverride?: string;
  }) => Promise<{ success: boolean; spreadsheetId?: string; url?: string; message: string }>;
  triggerAutoSyncOnSave: (overrides?: {
    overrideEmployees?: Employee[];
    overrideSalarySetups?: Record<string, SalarySetup>;
    overrideDeductionSetups?: Record<string, DeductionSetup>;
    overrideTaxReferences?: TaxReference[];
    overrideOrganization?: OrganizationSetup;
    overrideUsers?: User[];
  }) => Promise<void>;
  isAutoLoadingGoogleData: boolean;
  pullDataFromGoogle: (isSilent?: boolean) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  isUnauthorizedDomainModalOpen: boolean;
  openUnauthorizedDomainModal: () => void;
  closeUnauthorizedDomainModal: () => void;

  // Audit / Calculation Inspector Modal
  auditEmployeeId: string | null;
  setAuditEmployeeId: (id: string | null) => void;

  // UI Dialogs & Toasts
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, message: string) => void;
  removeToast: (id: string) => void;
  confirmationDialog: ConfirmationDialogState;
  showConfirmation: (config: Omit<ConfirmationDialogState, 'isOpen'>) => void;
  hideConfirmation: () => void;

  // Demo Data Actions
  resetToDemoData: () => void;
  clearAllData: () => void;
  isDemoData: boolean;

  // Security & Privacy Hardening
  isPrivacyMasked: boolean;
  togglePrivacyMasking: () => void;
  setIsPrivacyMasked: (val: boolean) => void;
  isScreenLocked: boolean;
  lockScreen: () => void;
  unlockScreen: (code: string) => Promise<{ success: boolean; message: string }>;
  inactivityTimeoutMinutes: number;
  setInactivityTimeoutMinutes: (minutes: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ORGANIZATIONS: 'np_payroll_organizations_v4',
  ACTIVE_ORG_ID: 'np_payroll_active_org_id_v4',
  ORG_DATABASES: 'np_payroll_org_databases_v4',
  USERS: 'np_payroll_users_v4',
  CURRENT_USER: 'np_payroll_current_user_v4',
  AUTH_SESSION: 'np_payroll_auth_session_v4',
  ACTIVE_FY: 'np_payroll_active_fy_v4',
  ACTIVE_MONTH: 'np_payroll_active_month_v4',
  DEVANAGARI: 'np_payroll_devanagari_v4',
  IS_DEMO: 'np_payroll_is_demo_v4',
  ORG: 'np_payroll_org_v4',
  FISCAL_YEARS: 'np_payroll_fiscal_years_v4',
  FY_DATABASE: 'np_payroll_fy_database_v4',
  GSHEETS: 'np_payroll_gsheets_v4',
  SUPPORT_CONTACT: 'np_payroll_support_contact_v4',
  PRIVACY_MASKED: 'np_payroll_privacy_masked_v4',
  INACTIVITY_TIMEOUT: 'np_payroll_inactivity_timeout_v4',
  SCREEN_LOCKED: 'np_payroll_screen_locked_v4',
  // Legacy keys for seamless backward compatibility & migration
  LEGACY_FY_DATABASE: 'np_payroll_fy_database_v3',
  LEGACY_FISCAL_YEARS: 'np_payroll_available_fys_v3',
  LEGACY_ORG: 'np_payroll_org_v3',
  LEGACY_USERS: 'np_payroll_users_v3',
};

const DEFAULT_FY_LIST = DEFAULT_FISCAL_YEARS_LIST;

const initializeDefaultOrgDatabases = (): Record<string, OrganizationDataStore> => {
  let defaultOrgSetup: OrganizationSetup = DEFAULT_ORGANIZATION;
  let defaultFyDatabase: Record<string, FiscalYearData> = {
    '२०८१/८२': {
      employees: DEMO_EMPLOYEES,
      salarySetups: DEMO_SALARY_SETUPS,
      deductionSetups: DEMO_DEDUCTION_SETUPS,
      taxReferences: DEFAULT_TAX_REFERENCES,
    },
  };
  let defaultFiscalYears: string[] = DEFAULT_FISCAL_YEARS_LIST;

  // Check legacy localStorage for migration
  try {
    const legacyOrg = localStorage.getItem(STORAGE_KEYS.LEGACY_ORG);
    if (legacyOrg) {
      const parsed = JSON.parse(legacyOrg);
      defaultOrgSetup = { ...DEFAULT_ORGANIZATION, ...parsed };
    }
    const legacyFyDb = localStorage.getItem(STORAGE_KEYS.LEGACY_FY_DATABASE);
    if (legacyFyDb) {
      defaultFyDatabase = JSON.parse(legacyFyDb);
    }
    const legacyFys = localStorage.getItem(STORAGE_KEYS.LEGACY_FISCAL_YEARS);
    if (legacyFys) {
      defaultFiscalYears = JSON.parse(legacyFys);
    }
  } catch (e) {
    console.error('Migration notice:', e);
  }

  return {
    org_default: {
      organization: defaultOrgSetup,
      fiscalYears: defaultFiscalYears,
      activeFiscalYear: '२०८१/८२',
      fyDatabase: defaultFyDatabase,
      googleSheetsConfig: DEFAULT_GOOGLE_SHEETS_CONFIG,
    },
  };
};

export const APP_TAB_DEFINITIONS: Record<string, { label: string; shortLabel: string; category: string }> = {
  dashboard: {
    label: 'ड्यासबोर्ड (Dashboard)',
    shortLabel: 'ड्यासबोर्ड',
    category: 'गृहपृष्ठ',
  },
  organization: {
    label: 'कार्यालय तथा लेटरहेड व्यवस्थापन (Organization Setup)',
    shortLabel: 'कार्यालय विवरण',
    category: 'सेटअप',
  },
  employees: {
    label: 'कर्मचारी विवरण तथा तलब/आय (Employee Details & Salary Setup)',
    shortLabel: 'कर्मचारी विवरण',
    category: 'कर्मचारी',
  },
  salary_income: {
    label: 'कर्मचारी तलब तथा आय विवरण (Salary Income Details)',
    shortLabel: 'तलब तथा आय',
    category: 'कर्मचारी',
  },
  deductions: {
    label: 'कट्टी विवरण (Deduction Setup)',
    shortLabel: 'कट्टी विवरण',
    category: 'तलब तथा कट्टी',
  },
  tax_reference: {
    label: 'कर स्ल्याब तथा नियम (Tax Reference)',
    shortLabel: 'कर स्ल्याब नियम',
    category: 'कर सेटअप',
  },
  monthly_salary: {
    label: 'मासिक तलब भरपाई (Monthly Salary Sheet)',
    shortLabel: 'मासिक तलब भरपाई',
    category: 'तलब व्यवस्थापन',
  },
  annual_tax: {
    label: 'वार्षिक कर गणना (Annual Tax Calculation)',
    shortLabel: 'वार्षिक कर गणना',
    category: 'कर विवरण',
  },
  employee_tax_report: {
    label: 'कर्मचारी कर कट्टी प्रतिवेदन (Employee Tax Report)',
    shortLabel: 'कर कट्टी प्रतिवेदन',
    category: 'प्रतिवेदन',
  },
  salary_reports: {
    label: 'तलबी प्रतिवेदन (Salary Report / Kitabkhana)',
    shortLabel: 'तलबी प्रतिवेदन',
    category: 'प्रतिवेदन',
  },
  google_sheets: {
    label: 'गुगल सिट्स सिंक (Google Sheets Sync)',
    shortLabel: 'गुगल सिट्स',
    category: 'एकीकरण',
  },
  settings: {
    label: 'सेटिङ्स तथा प्रणाली व्यवस्थापन (Settings)',
    shortLabel: 'सेटिङ्स',
    category: 'प्रणाली',
  },
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation History Stack
  const [navigationHistory, setNavigationHistory] = useState<string[]>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      return hash ? [hash] : ['dashboard'];
    } catch {
      return ['dashboard'];
    }
  });

  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      return hash || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const getTabLabel = (tab: string): string => {
    return APP_TAB_DEFINITIONS[tab]?.label || tab;
  };

  const getTabShortLabel = (tab: string): string => {
    return APP_TAB_DEFINITIONS[tab]?.shortLabel || tab;
  };

  const setActiveTab = (tab: string, options?: { replace?: boolean }) => {
    if (!tab) return;
    if (tab === activeTab && !options?.replace) return;

    setActiveTabState(tab);
    try {
      window.location.hash = tab;
    } catch {}

    if (options?.replace) {
      setNavigationHistory((prev) => {
        const next = [...prev];
        next[historyIndex] = tab;
        return next;
      });
      return;
    }

    setNavigationHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      sliced.push(tab);
      return sliced;
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const canGoBack = historyIndex > 0 || activeTab !== 'dashboard';
  const canGoForward = historyIndex < navigationHistory.length - 1;

  const previousTab =
    historyIndex > 0
      ? navigationHistory[historyIndex - 1]
      : activeTab !== 'dashboard'
      ? 'dashboard'
      : undefined;

  const goBack = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const targetTab = navigationHistory[targetIndex];
      setHistoryIndex(targetIndex);
      setActiveTabState(targetTab);
      try {
        window.location.hash = targetTab;
      } catch {}
    } else if (activeTab !== 'dashboard') {
      setActiveTabState('dashboard');
      setNavigationHistory(['dashboard']);
      setHistoryIndex(0);
      try {
        window.location.hash = 'dashboard';
      } catch {}
    }
  };

  const goForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const targetIndex = historyIndex + 1;
      const targetTab = navigationHistory[targetIndex];
      setHistoryIndex(targetIndex);
      setActiveTabState(targetTab);
      try {
        window.location.hash = targetTab;
      } catch {}
    }
  };

  // Keyboard navigation & hash change listeners
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== activeTab) {
        setActiveTabState(hash);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.altKey && e.key === 'ArrowLeft' && !isInput) {
        e.preventDefault();
        goBack();
      } else if (e.altKey && e.key === 'ArrowRight' && !isInput) {
        e.preventDefault();
        goForward();
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, historyIndex, navigationHistory]);
  
  // Fiscal Years State (Always sorted in Descending Order: पछिल्लो/नवीनतम पहिले)
  const [fiscalYears, setFiscalYears] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FISCAL_YEARS);
      const list = saved ? JSON.parse(saved) : DEFAULT_FY_LIST;
      return sortFiscalYearsDescending(list);
    } catch {
      return sortFiscalYearsDescending(DEFAULT_FY_LIST);
    }
  });

  const [activeFiscalYear, setActiveFiscalYearState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_FY) || '२०८१/८२';
  });

  const [activeMonth, setActiveMonth] = useState<NepaliMonth>(() => {
    return (localStorage.getItem(STORAGE_KEYS.ACTIVE_MONTH) as NepaliMonth) || 'श्रावण';
  });

  const [useDevanagariNumerals, setUseDevanagariNumerals] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEVANAGARI);
    return saved !== null ? saved === 'true' : true;
  });

  const [isDemoData, setIsDemoData] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.IS_DEMO);
    return saved !== null ? saved === 'true' : false;
  });

  // Users & RBAC
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      const autoCreatedIds = ['user_admin', 'user_general', 'user_accountant', 'user_viewer', 'user_new_staff', 'user_rbthapa_mgr', 'user_rbthapa_mgf'];
      const autoCreatedUsernames = ['admin', 'user', 'accountant', 'viewer', 'newuser', 'rbthapamgr09', 'rbthapamgf09'];

      if (saved) {
        const parsed: User[] = JSON.parse(saved);
        const filtered = parsed.filter(
          (u) =>
            !autoCreatedIds.includes(u.id) &&
            !autoCreatedUsernames.includes((u.username || '').toLowerCase())
        );
        const resultUsers = [...filtered];
        DEFAULT_USERS.forEach((defUser) => {
          const exists = resultUsers.some(
            (u) =>
              u.id === defUser.id ||
              u.username.toLowerCase() === defUser.username.toLowerCase() ||
              (u.email && defUser.email && u.email.toLowerCase() === defUser.email.toLowerCase())
          );
          if (!exists) {
            resultUsers.push(defUser);
          }
        });

        // Ensure default passwords/pins exist for loaded users
        const finalUsers = resultUsers.map((u) => ({
          ...u,
          password:
            u.password ||
            (u.role === 'SUPER_ADMIN'
              ? 'admin123'
              : u.role === 'ACCOUNTANT'
              ? 'account123'
              : 'viewer123'),
          securityPin: u.securityPin || '1234',
          securityQuestion:
            u.securityQuestion ||
            (u.role === 'SUPER_ADMIN'
              ? 'तपाईंको पहिलो विद्यालयको नाम के हो?'
              : u.role === 'ACCOUNTANT'
              ? 'तपाईंको जन्मस्थान कहाँ हो?'
              : 'तपाईंको मनपर्ने रङ्ग कुन हो?'),
          securityAnswer:
            u.securityAnswer ||
            (u.role === 'SUPER_ADMIN' ? 'नेपाल' : u.role === 'ACCOUNTANT' ? 'काठमाडौँ' : 'हरियो'),
        }));

        try {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(finalUsers));
        } catch {}

        return finalUsers;
      }
      return DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return session === 'true' && Boolean(saved);
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (session === 'true' && saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id === 'user_rbthapa_mgr' || parsed.id === 'user_rbthapa_mgf' || parsed.username === 'rbthapamgr09' || parsed.username === 'rbthapamgf09') {
          return DEFAULT_USERS[0];
        }
        return {
          ...parsed,
          password: parsed.password || 'admin123',
          securityPin: parsed.securityPin || '1234',
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  // Auth Modal State (Login / Reset Password)
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean;
    mode: 'login' | 'reset';
    initialUsername?: string;
  }>({
    isOpen: false,
    mode: 'login',
  });

  const openLoginModal = (initialUsername?: string) => {
    setAuthModal({ isOpen: true, mode: 'login', initialUsername });
  };

  const openResetPasswordModal = (initialUsername?: string) => {
    setAuthModal({ isOpen: true, mode: 'reset', initialUsername });
  };

  const closeAuthModal = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Privacy Mode (Sensitive Data Masking: Bank, PAN, Phone)
  const [isPrivacyMasked, setIsPrivacyMasked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PRIVACY_MASKED) === 'true';
    } catch {
      return false;
    }
  });

  // Session Inactivity Timeout in minutes (default 15 minutes, 0 = disabled)
  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutesState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INACTIVITY_TIMEOUT);
      return saved !== null ? Number(saved) : 15;
    } catch {
      return 15;
    }
  });

  const setInactivityTimeoutMinutes = useCallback((minutes: number) => {
    setInactivityTimeoutMinutesState(minutes);
    try {
      localStorage.setItem(STORAGE_KEYS.INACTIVITY_TIMEOUT, String(minutes));
    } catch {}
    logSecurityEvent({
      action: 'SECURITY_SETTINGS_UPDATED',
      category: 'SECURITY',
      userId: currentUser?.id,
      username: currentUser?.username,
      userRole: currentUser?.role,
      description: `सत्र निष्क्रियता समय (Inactivity Timeout) ${minutes} मिनेटमा परिमार्जन गरियो`,
    });
  }, [currentUser]);

  // Screen Lock State (Transient in session)
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.SCREEN_LOCKED) === 'true';
    } catch {
      return false;
    }
  });

  const togglePrivacyMasking = useCallback(() => {
    setIsPrivacyMasked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.PRIVACY_MASKED, String(next));
      } catch {}
      logSecurityEvent({
        action: 'SECURITY_SETTINGS_UPDATED',
        category: 'SECURITY',
        userId: currentUser?.id,
        username: currentUser?.username,
        userRole: currentUser?.role,
        description: next ? 'गोपनीयता मोड (Privacy Masking) सक्रिय गरियो' : 'गोपनीयता मोड निष्कृय गरियो',
      });
      return next;
    });
  }, [currentUser]);

  const lockScreen = useCallback(() => {
    if (!isAuthenticated || !currentUser) return;
    setIsScreenLocked(true);
    try {
      sessionStorage.setItem(STORAGE_KEYS.SCREEN_LOCKED, 'true');
    } catch {}
    logSecurityEvent({
      action: 'SCREEN_LOCKED',
      category: 'AUTH',
      userId: currentUser.id,
      username: currentUser.username,
      userRole: currentUser.role,
      description: 'प्रयोगकर्ताद्वारा तत्काल स्क्रिन लक गरियो',
    });
  }, [isAuthenticated, currentUser]);

  const unlockScreen = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      if (!currentUser) {
        return { success: false, message: 'सत्र फेला परेन।' };
      }
      const trimmed = code.trim();
      const isPinMatch = currentUser.securityPin && currentUser.securityPin.trim() === trimmed;
      const isPassMatch = verifyPasswordSync(trimmed, currentUser.password).isValid;

      if (isPinMatch || isPassMatch) {
        setIsScreenLocked(false);
        try {
          sessionStorage.removeItem(STORAGE_KEYS.SCREEN_LOCKED);
        } catch {}
        logSecurityEvent({
          action: 'SCREEN_UNLOCKED',
          category: 'AUTH',
          userId: currentUser.id,
          username: currentUser.username,
          userRole: currentUser.role,
          description: 'सुरक्षा प्रमाण प्रमाणीकरण गरी स्क्रिन अनलक गरियो',
          status: 'SUCCESS',
        });
        return { success: true, message: 'सफलतापूर्वक अनलक भयो।' };
      }

      logSecurityEvent({
        action: 'SCREEN_LOCKED',
        category: 'AUTH',
        userId: currentUser.id,
        username: currentUser.username,
        userRole: currentUser.role,
        description: 'गलत पासवर्ड वा पिन प्रविष्टि - स्क्रिन अनलक असफल',
        status: 'WARNING',
      });
      return { success: false, message: 'गलत पासवर्ड वा सुरक्षा पिन। कृपया पुनः प्रयास गर्नुहोस्।' };
    },
    [currentUser]
  );

  // Inactivity auto-lock watcher
  useEffect(() => {
    if (!isAuthenticated || !currentUser || isScreenLocked || inactivityTimeoutMinutes <= 0) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScreenLocked(true);
        try {
          sessionStorage.setItem(STORAGE_KEYS.SCREEN_LOCKED, 'true');
        } catch {}
        logSecurityEvent({
          action: 'SCREEN_LOCKED',
          category: 'AUTH',
          userId: currentUser?.id,
          username: currentUser?.username,
          userRole: currentUser?.role,
          description: `निष्क्रियताका कारण (${inactivityTimeoutMinutes} मिनेट) स्वचालित रूपमा स्क्रिन सुरक्षित लक गरियो`,
        });
      }, inactivityTimeoutMinutes * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isAuthenticated, currentUser, isScreenLocked, inactivityTimeoutMinutes]);

  // Keyboard shortcut listener (Alt+L to lock screen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (isAuthenticated && currentUser && !isScreenLocked) {
          lockScreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, currentUser, isScreenLocked, lockScreen]);

  // Master FY-isolated Database
  const [fyDatabase, setFyDatabase] = useState<Record<string, FiscalYearData>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FY_DATABASE);
      if (saved) {
        return JSON.parse(saved);
      }
      // Initialize with demo data for default FY
      return {
        '२०८१/८२': {
          employees: DEMO_EMPLOYEES,
          salarySetups: DEMO_SALARY_SETUPS,
          deductionSetups: DEMO_DEDUCTION_SETUPS,
          taxReferences: DEFAULT_TAX_REFERENCES,
        },
      };
    } catch {
      return {
        '२०८१/८२': {
          employees: DEMO_EMPLOYEES,
          salarySetups: DEMO_SALARY_SETUPS,
          deductionSetups: DEMO_DEDUCTION_SETUPS,
          taxReferences: DEFAULT_TAX_REFERENCES,
        },
      };
    }
  });

  // Active Scoped Data States
  const currentFyData = fyDatabase[activeFiscalYear] || {
    employees: [],
    salarySetups: {},
    deductionSetups: {},
    taxReferences: DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: activeFiscalYear })),
  };

  const [employees, setEmployees] = useState<Employee[]>(currentFyData.employees);
  const [salarySetups, setSalarySetups] = useState<Record<string, SalarySetup>>(currentFyData.salarySetups);
  const [deductionSetups, setDeductionSetups] = useState<Record<string, DeductionSetup>>(currentFyData.deductionSetups);
  const [taxReferences, setTaxReferences] = useState<TaxReference[]>(currentFyData.taxReferences);

  const [organization, setOrganization] = useState<OrganizationSetup>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORG);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_ORGANIZATION, ...parsed };
      }
      return DEFAULT_ORGANIZATION;
    } catch {
      return DEFAULT_ORGANIZATION;
    }
  });

  const [googleSheetsConfig, setGoogleSheetsConfig] = useState<GoogleSheetsConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GSHEETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.autoSync === undefined) {
          parsed.autoSync = true;
          parsed.syncMode = 'auto';
        }
        return parsed;
      }
      return DEFAULT_GOOGLE_SHEETS_CONFIG;
    } catch {
      return DEFAULT_GOOGLE_SHEETS_CONFIG;
    }
  });

  const [isGoogleAccountConnected, setIsGoogleAccountConnected] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GSHEETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.connectedAccountEmail) return true;
      }
      const savedUser = localStorage.getItem('nepal_payroll_connected_google_user');
      if (savedUser) return true;
    } catch {}
    return false;
  });
  const [googleConnectedEmail, setGoogleConnectedEmail] = useState<string | undefined>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GSHEETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.connectedAccountEmail) return parsed.connectedAccountEmail;
      }
      const savedUser = localStorage.getItem('nepal_payroll_connected_google_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.email) return parsed.email;
      }
    } catch {}
    return undefined;
  });
  const [isAutoLoadingGoogleData, setIsAutoLoadingGoogleData] = useState(false);
  const postLoginSheetsAutomationRef = useRef<((loggedUser: User) => Promise<void>) | null>(null);

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setIsGoogleAccountConnected(true);
        setGoogleConnectedEmail(user.email || undefined);
        setGoogleSheetsConfig((prev) => ({
          ...prev,
          connectedAccountEmail: user.email || prev.connectedAccountEmail || undefined,
          authMethod: prev.webAppUrl ? 'both' : 'oauth',
        }));
      },
      () => {
        // Only clear if neither local state nor config has connected email
        setGoogleSheetsConfig((prev) => {
          if (!prev.connectedAccountEmail) {
            setIsGoogleAccountConnected(false);
            setGoogleConnectedEmail(undefined);
          }
          return prev;
        });
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Helper to remove legacy dummy demo text from support contact
  const cleanSupportContact = (c: any): SystemSupportContact => {
    if (!c || typeof c !== 'object') {
      return { phone: '', email: '', whatsapp: '', supportNote: '' };
    }
    const isDemo = (val?: any) => {
      if (!val) return true;
      const t = String(val).trim();
      return (
        t === '०१-४२०००००, ९८५१०००००१' ||
        t === 'support.payroll@gov.np' ||
        t === '+९७७-९८५१०००००१' ||
        t === 'कार्यालय समय (१०:०० देखि ५:०० सम्म) प्राविधिक तथा प्रणाली सहायताका लागि सम्पर्क गर्नुहोस्।'
      );
    };
    return {
      phone: isDemo(c.phone) ? '' : String(c.phone || '').trim(),
      email: isDemo(c.email) ? '' : String(c.email || '').trim(),
      whatsapp: isDemo(c.whatsapp) ? '' : String(c.whatsapp || '').trim(),
      supportNote: isDemo(c.supportNote) ? '' : String(c.supportNote || '').trim(),
    };
  };

  // Multi-Device Cloud State Sync on Mount & Real-time Listeners
  useEffect(() => {
    let isMounted = true;

    // 1. High-Priority Independent Support Contact Sync
    getCloudSupportContact().then((cloudSupport) => {
      if (cloudSupport && isMounted) {
        const cleaned = cleanSupportContact(cloudSupport);
        if (cleaned.phone || cleaned.email || cleaned.whatsapp || cleaned.supportNote) {
          setSupportContact(cleaned);
          try {
            localStorage.setItem(STORAGE_KEYS.SUPPORT_CONTACT, JSON.stringify(cleaned));
          } catch {}
        }
      }
    }).catch((e) => console.warn('Support contact sync notice:', e));

    // Real-time Firestore Listener for Support Contact (Instant Cross-Device Updates)
    let unsubscribeSupport: (() => void) | undefined;
    try {
      const contactDocRef = doc(db, 'system_connections', 'system_support_contact');
      unsubscribeSupport = onSnapshot(contactDocRef, (snap) => {
        if (snap.exists() && isMounted) {
          const d = snap.data();
          if (d) {
            const cleaned = cleanSupportContact(d as SystemSupportContact);
            if (cleaned.phone || cleaned.email || cleaned.whatsapp || cleaned.supportNote) {
              setSupportContact(cleaned);
              try {
                localStorage.setItem(STORAGE_KEYS.SUPPORT_CONTACT, JSON.stringify(cleaned));
              } catch {}
            }
          }
        }
      }, (err) => console.warn('Support contact onSnapshot notice:', err));
    } catch (listenerErr) {
      console.warn('Real-time listener setup notice:', listenerErr);
    }

    // 2. Multi-Organization Cloud Sync across Devices
    getCloudOrganizations().then((cloudOrgs) => {
      if (cloudOrgs && cloudOrgs.length > 0 && isMounted) {
        setOrganizations((prev) => {
          const merged = [...prev];
          for (const co of cloudOrgs) {
            const idx = merged.findIndex((o) => o.id === co.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...co };
            } else {
              merged.push(co);
            }
          }
          return merged;
        });

        // Ensure org databases exist for all loaded organizations
        setOrgDatabases((prev) => {
          const updated = { ...prev };
          for (const co of cloudOrgs) {
            if (!updated[co.id]) {
              updated[co.id] = {
                organization: { ...co },
                fiscalYears: DEFAULT_FY_LIST,
                activeFiscalYear: '२०८१/८२',
                fyDatabase: {
                  '२०८१/८२': {
                    employees: [],
                    salarySetups: {},
                    deductionSetups: {},
                    taxReferences: DEFAULT_TAX_REFERENCES,
                  },
                },
                googleSheetsConfig: DEFAULT_GOOGLE_SHEETS_CONFIG,
              };
            }
          }
          return updated;
        });
      }
    }).catch((e) => console.warn('Cloud organizations sync notice:', e));

    // 3. User Accounts Cloud Sync
    getCloudUsers().then((cloudUsers) => {
      if (cloudUsers && cloudUsers.length > 0 && isMounted) {
        setUsers((prev) => {
          const merged = [...prev];
          for (const cu of cloudUsers) {
            const idx = merged.findIndex(
              (u) => u.id === cu.id || u.username.toLowerCase() === cu.username.toLowerCase()
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...cu };
            } else {
              merged.push(cu);
            }
          }
          return merged;
        });
      }
    }).catch((e) => console.warn('Cloud users sync notice:', e));

    // 4. Google Sheets Configuration Sync
    getCloudAppConnection(currentUser?.username || currentUser?.id).then((cloudConn) => {
      if (cloudConn && isMounted) {
        if (cloudConn.connectedAccountEmail) {
          setIsGoogleAccountConnected(true);
          setGoogleConnectedEmail(cloudConn.connectedAccountEmail);
        }
        if (cloudConn.webAppUrl || cloudConn.spreadsheetId || cloudConn.connectedAccountEmail || cloudConn.spreadsheetName) {
          setGoogleSheetsConfig((prev) => {
            const updated = {
              ...prev,
              webAppUrl: cloudConn.webAppUrl || prev.webAppUrl,
              spreadsheetId: cloudConn.spreadsheetId || prev.spreadsheetId,
              spreadsheetUrl: cloudConn.spreadsheetUrl || prev.spreadsheetUrl,
              spreadsheetName: cloudConn.spreadsheetName || prev.spreadsheetName,
              connectedAccountEmail: cloudConn.connectedAccountEmail || prev.connectedAccountEmail,
              autoSync: cloudConn.autoSync ?? true,
              syncMode: cloudConn.syncMode || 'auto',
              authMethod: prev.authMethod || (cloudConn.webAppUrl ? (cloudConn.connectedAccountEmail ? 'both' : 'apps_script') : 'oauth'),
            };
            return updated;
          });
        }
        if (cloudConn.organization) {
          setOrganization((prev) => ({
            ...prev,
            ...cloudConn.organization,
          }));
        }
      }
    }).catch((e) => console.warn('Cloud app connection sync notice:', e));

    return () => {
      isMounted = false;
      if (unsubscribeSupport) {
        unsubscribeSupport();
      }
    };
  }, [currentUser]);

  const [auditEmployeeId, setAuditEmployeeId] = useState<string | null>(null);
  const [isUnauthorizedDomainModalOpen, setIsUnauthorizedDomainModalOpen] = useState(false);
  const openUnauthorizedDomainModal = useCallback(() => setIsUnauthorizedDomainModalOpen(true), []);
  const closeUnauthorizedDomainModal = useCallback(() => setIsUnauthorizedDomainModalOpen(false), []);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Organizations & Multi-tenancy State
  const [organizations, setOrganizations] = useState<OrganizationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORGANIZATIONS);
      return saved ? JSON.parse(saved) : DEFAULT_ORGANIZATIONS;
    } catch {
      return DEFAULT_ORGANIZATIONS;
    }
  });

  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_ORG_ID);
      return saved || 'org_default';
    } catch {
      return 'org_default';
    }
  });

  const [orgDatabases, setOrgDatabases] = useState<Record<string, OrganizationDataStore>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORG_DATABASES);
      if (saved) return JSON.parse(saved);
      return initializeDefaultOrgDatabases();
    } catch {
      return initializeDefaultOrgDatabases();
    }
  });

  const [supportContact, setSupportContact] = useState<SystemSupportContact>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUPPORT_CONTACT);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleaned = cleanSupportContact(parsed);
        // Persist cleaned version if changed
        try {
          localStorage.setItem(STORAGE_KEYS.SUPPORT_CONTACT, JSON.stringify(cleaned));
        } catch {}
        return cleaned;
      }
      return DEFAULT_SUPPORT_CONTACT;
    } catch {
      return DEFAULT_SUPPORT_CONTACT;
    }
  });

  const activeOrganization = useMemo(() => {
    return organizations.find((o) => o.id === activeOrganizationId) || organizations[0];
  }, [organizations, activeOrganizationId]);

  // Sync active scoped data to fyDatabase when local states change
  useEffect(() => {
    setFyDatabase((prev) => ({
      ...prev,
      [activeFiscalYear]: {
        employees,
        salarySetups,
        deductionSetups,
        taxReferences,
      },
    }));
  }, [employees, salarySetups, deductionSetups, taxReferences, activeFiscalYear]);

  // Persist fyDatabase to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FY_DATABASE, JSON.stringify(fyDatabase));
    } catch (e) {
      console.error('Failed to save FY database', e);
    }
  }, [fyDatabase]);

  // Persist users and current user
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      // Persist to Cloud Firestore for cross-device availability
      if (users && users.length > 0) {
        saveCloudUsers(users).catch(() => {});
      }
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } catch {}
  }, [currentUser]);

  // Persist fiscal years list
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FISCAL_YEARS, JSON.stringify(fiscalYears));
    } catch {}
  }, [fiscalYears]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_FY, activeFiscalYear);
  }, [activeFiscalYear]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, activeMonth);
  }, [activeMonth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEVANAGARI, String(useDevanagariNumerals));
  }, [useDevanagariNumerals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, String(isDemoData));
  }, [isDemoData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORG, JSON.stringify(organization));
    } catch {}
  }, [organization]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(organizations));
    } catch {}
  }, [organizations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ORG_ID, activeOrganizationId);
    } catch {}
  }, [activeOrganizationId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORG_DATABASES, JSON.stringify(orgDatabases));
    } catch {}
  }, [orgDatabases]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SUPPORT_CONTACT, JSON.stringify(supportContact));
    } catch {}
  }, [supportContact]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GSHEETS, JSON.stringify(googleSheetsConfig));
      // Save configuration to Cloud Firestore so other devices can discover and auto-load it
      if (googleSheetsConfig.webAppUrl || googleSheetsConfig.spreadsheetId) {
        saveCloudAppConnection(
          googleSheetsConfig,
          organization,
          activeOrganizationId,
          currentUser?.username
        ).catch(() => {});
      }
    } catch {}
  }, [googleSheetsConfig, organization, activeOrganizationId, currentUser]);

  // Toast Helpers
  const addToast = (type: ToastMessage['type'], title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showConfirmation = (config: Omit<ConfirmationDialogState, 'isOpen'>) => {
    setConfirmationDialog({
      ...config,
      isOpen: true,
    });
  };

  const hideConfirmation = () => {
    setConfirmationDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // RBAC Permission Checker
  const hasPermission = (permission: PermissionType): boolean => {
    if (!currentUser || !currentUser.isActive) return false;
    const role = currentUser.role;

    if (role === 'SUPER_ADMIN') return true;

    if (role === 'ADMIN') {
      switch (permission) {
        case 'MANAGE_USERS':
          // Full user management (including super admin / other admin creation) is restricted to SUPER_ADMIN
          return false;
        case 'MANAGE_GENERAL_USERS':
        case 'MANAGE_SETTINGS':
        case 'MANAGE_TAX_SLABS':
        case 'MANAGE_DEDUCTIONS':
        case 'EDIT_EMPLOYEE_SALARY':
        case 'DELETE_EMPLOYEE':
        case 'DELETE_DATA':
        case 'EDIT_DATA':
        case 'CARRY_FORWARD':
        case 'RESET_DATA':
        case 'VIEW_DATA':
        case 'PRINT_REPORTS':
          return true;
        default:
          return false;
      }
    }

    if (role === 'GENERAL_USER' || role === 'ACCOUNTANT') {
      switch (permission) {
        case 'EDIT_EMPLOYEE_SALARY':
        case 'EDIT_DATA':
        case 'VIEW_DATA':
        case 'PRINT_REPORTS':
          return true;
        // GENERAL_USER and VIEWER are strictly FORBIDDEN from deleting records/employees or reset/admin operations
        case 'DELETE_EMPLOYEE':
        case 'DELETE_DATA':
        case 'RESET_DATA':
        case 'MANAGE_USERS':
        case 'MANAGE_GENERAL_USERS':
        case 'MANAGE_SETTINGS':
        case 'MANAGE_TAX_SLABS':
        case 'MANAGE_DEDUCTIONS':
        case 'CARRY_FORWARD':
        default:
          return false;
      }
    }

    if (role === 'VIEWER') {
      switch (permission) {
        case 'VIEW_DATA':
        case 'PRINT_REPORTS':
          return true;
        default:
          return false;
      }
    }

    return false;
  };

  // User Management functions (Hardened with Rate-limiting, Hashing & Audit Trails)
  const login = (
    userIdOrUsername: string,
    password?: string
  ): { success: boolean; mustChangePassword?: boolean; user?: User; message?: string } => {
    const trimmedInput = sanitizeInput(userIdOrUsername).trim().toLowerCase();

    // 1. Brute-force Rate Limit Verification
    const rateCheck = checkRateLimit(trimmedInput);
    if (!rateCheck.allowed) {
      const msg = `अत्यधिक असफल प्रयासहरूका कारण सुरक्षाको लागि खाता अस्थायी रूपमा ${rateCheck.retryAfterSeconds} सेकेन्डका लागि लक गरिएको छ।`;
      addToast('error', 'खाता अस्थायी रूपमा लक', msg);
      logSecurityEvent({
        action: 'RATE_LIMIT_EXCEEDED',
        category: 'SECURITY',
        username: userIdOrUsername,
        description: `अत्यधिक असफल लगइन प्रयास। ${rateCheck.retryAfterSeconds}s का लागि थप प्रयास रोकियो।`,
        status: 'WARNING',
      });
      return { success: false, message: msg };
    }

    // 2. Identify User
    const found = users.find(
      (u) =>
        (u.id === userIdOrUsername ||
          u.username.toLowerCase() === trimmedInput ||
          (u.email && u.email.toLowerCase() === trimmedInput)) &&
        u.isActive
    );

    if (!found) {
      const attempt = recordFailedAttempt(trimmedInput);
      logSecurityEvent({
        action: 'USER_LOGIN_FAILED',
        category: 'AUTH',
        username: userIdOrUsername,
        description: `अज्ञात वा निष्क्रिय प्रयोगकर्ता नामबाट लगइन प्रयास (बाँकी प्रयास: ${attempt.remainingAttempts})`,
        status: 'FAILED',
      });
      const msg = 'प्रविष्टि गरिएको प्रयोगकर्ता नाम (User ID) फेला परेन वा खाता निष्क्रिय छ।';
      addToast('error', 'लगइन असफल', msg);
      return { success: false, message: msg };
    }

    // 3. Password Verification (supports backward-compatible plain or salted SHA-256)
    if (password !== undefined && password !== '') {
      const userPass =
        found.password ||
        (found.role === 'SUPER_ADMIN'
          ? 'admin123'
          : found.role === 'ACCOUNTANT'
          ? 'account123'
          : 'viewer123');

      const passCheck = verifyPasswordSync(password, userPass);
      if (!passCheck.isValid) {
        const attempt = recordFailedAttempt(trimmedInput);
        logSecurityEvent({
          action: 'USER_LOGIN_FAILED',
          category: 'AUTH',
          userId: found.id,
          username: found.username,
          userRole: found.role,
          description: `गलत पासवर्ड प्रविष्टि (बाँकी प्रयास: ${attempt.remainingAttempts})`,
          status: 'FAILED',
        });
        const msg = attempt.isLocked
          ? `अत्यधिक गलत पासवर्ड प्रविष्ट भएकाले खाता ${attempt.retryAfterSeconds} सेकेन्डका लागि लक गरिएको छ।`
          : `गलत पासवर्ड प्रविष्ट भयो। (बाँकी प्रयास: ${attempt.remainingAttempts})`;
        addToast('error', 'पासवर्ड मिलेन', msg);
        return { success: false, message: msg };
      }

      // Upgrade plain password to secure SHA-256 hash if needed
      if (passCheck.needsUpgrade) {
        const hashed = hashPasswordSync(password);
        found.password = hashed.encoded;
      }
    }

    // 4. Success: Reset rate limit & register login audit
    resetRateLimit(trimmedInput);

    // Check if user must change password on first login
    if (found.mustChangePassword) {
      logSecurityEvent({
        action: 'USER_LOGIN_SUCCESS',
        category: 'AUTH',
        userId: found.id,
        username: found.username,
        userRole: found.role,
        description: 'पहिलो पटक लगइन सफल - अनिवार्य पासवर्ड परिवर्तन आवश्यक',
        status: 'SUCCESS',
      });
      return {
        success: false,
        mustChangePassword: true,
        user: found,
        message: 'पहिलो पटक लगइन गर्दा नयाँ पासवर्ड परिवर्तन गर्नुपर्नेछ।',
      };
    }

    const updatedUser: User = {
      ...found,
      lastLogin: new Date().toLocaleString('ne-NP'),
    };
    setCurrentUser(updatedUser);
    setIsAuthenticated(true);
    setIsScreenLocked(false);
    setUsers((prev) => prev.map((u) => (u.id === found.id ? updatedUser : u)));
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
      sessionStorage.removeItem(STORAGE_KEYS.SCREEN_LOCKED);
    } catch {
      // Storage error ignore
    }

    logSecurityEvent({
      action: 'USER_LOGIN_SUCCESS',
      category: 'AUTH',
      userId: found.id,
      username: found.username,
      userRole: found.role,
      description: 'प्रणालीमा सफलतापूर्वक लगइन गरियो',
      status: 'SUCCESS',
    });

    addToast('success', 'लगइन सफल भयो', `${found.fullName} (${found.role}) को रूपमा लगइन हुनुभयो।`);
    setAuthModal((prev) => ({ ...prev, isOpen: false }));

    // Switch organization if user belongs to a specific organization
    if (found.organizationId && found.organizationId !== 'all' && found.organizationId !== activeOrganizationId) {
      setActiveOrganizationId(found.organizationId);
    }

    // Automated Google Sheets setup & sync upon successful login
    setTimeout(() => {
      if (postLoginSheetsAutomationRef.current) {
        postLoginSheetsAutomationRef.current(found).catch((err) => {
          console.warn('Post login sheets automation notice:', err);
        });
      }
    }, 150);

    return { success: true, user: updatedUser, message: 'लगइन सफल भयो।' };
  };

  const completeFirstTimePasswordChange = ({
    userId,
    newPassword,
    securityPin,
    securityQuestion,
    securityAnswer,
  }: {
    userId: string;
    newPassword: string;
    securityPin?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }): { success: boolean; message: string } => {
    const target = users.find((u) => u.id === userId);
    if (!target) {
      const msg = 'प्रयोगकर्ता फेला परेन।';
      addToast('error', 'त्रुटि', msg);
      return { success: false, message: msg };
    }
    if (!newPassword || newPassword.length < 4) {
      const msg = 'नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्दछ।';
      addToast('error', 'कमजोर पासवर्ड', msg);
      return { success: false, message: msg };
    }

    const hashed = hashPasswordSync(newPassword);

    const updatedUser: User = {
      ...target,
      password: hashed.encoded,
      mustChangePassword: false,
      isFirstLogin: false,
      securityPin: securityPin || target.securityPin || '1234',
      securityQuestion: securityQuestion || target.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: securityAnswer || target.securityAnswer || 'नेपाल',
      passwordChangedAt: new Date().toLocaleDateString('ne-NP'),
      lastLogin: new Date().toLocaleString('ne-NP'),
    };

    setUsers((prev) => {
      const updatedList = prev.map((u) => (u.id === userId ? updatedUser : u));
      saveCloudUsers(updatedList).catch((e) => console.warn('Could not save updated user to cloud:', e));
      return updatedList;
    });
    setCurrentUser(updatedUser);
    setIsAuthenticated(true);
    setIsScreenLocked(false);

    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
      sessionStorage.removeItem(STORAGE_KEYS.SCREEN_LOCKED);
    } catch {
      // Storage error ignore
    }

    // Switch organization if user belongs to a specific organization
    if (updatedUser.organizationId && updatedUser.organizationId !== 'all' && updatedUser.organizationId !== activeOrganizationId) {
      setActiveOrganizationId(updatedUser.organizationId);
    }

    // Automated Google Sheets setup & sync upon first-time password setup completion
    setTimeout(() => {
      if (postLoginSheetsAutomationRef.current) {
        postLoginSheetsAutomationRef.current(updatedUser).catch((err) => {
          console.warn('Post first-time password setup automation notice:', err);
        });
      }
    }, 150);

    logSecurityEvent({
      action: 'PASSWORD_CHANGED',
      category: 'AUTH',
      userId: target.id,
      username: target.username,
      userRole: target.role,
      description: 'पहिलो पटक लगइनमा नयाँ पासवर्ड तथा सुरक्षा विवरण सुरक्षित गरियो',
      status: 'SUCCESS',
    });

    addToast(
      'success',
      'पासवर्ड परिवर्तन सफल भयो',
      `${updatedUser.fullName} (${updatedUser.role}) को पासवर्ड सुरक्षित भयो र प्रणालीमा लगइन गरियो।`
    );
    return { success: true, message: 'पासवर्ड परिवर्तन सफल भयो।' };
  };

  const logout = () => {
    if (currentUser) {
      logSecurityEvent({
        action: 'USER_LOGOUT',
        category: 'AUTH',
        userId: currentUser.id,
        username: currentUser.username,
        userRole: currentUser.role,
        description: 'सत्र समाप्त गरी प्रयोगकर्ता लगआउट भयो',
      });
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsScreenLocked(false);
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      sessionStorage.removeItem(STORAGE_KEYS.SCREEN_LOCKED);
    } catch {
      // Storage error ignore
    }
    setActiveTab('dashboard');
    addToast('info', 'लगआउट भयो', 'तपाईं सफलतापूर्वक प्रणालीबाट लगआउट हुनुभयो।');
  };

  const addUser = (userData: Omit<User, 'id' | 'createdAt'>): boolean => {
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!isSuperAdmin && !isAdmin) {
      addToast('error', 'अनाधिकृत कार्य', 'नयाँ प्रयोगकर्ता थप्न सुपर एडमिन वा एडमिनको अधिकार आवश्यक पर्दछ।');
      return false;
    }

    // Admin can ONLY create General Users (GENERAL_USER, ACCOUNTANT) or Viewers (VIEWER), NOT Super Admin or Admin!
    if (isAdmin && (userData.role === 'SUPER_ADMIN' || userData.role === 'ADMIN')) {
      addToast(
        'error',
        'अधिकार सीमा',
        'प्रशासक (Admin) लाई सुपर एडमिन वा अर्को एडमिन बनाउने अधिकार छैन। केवल General User र Viewer मात्र सिर्जना गर्न सकिन्छ।'
      );
      return false;
    }

    const cleanUsername = sanitizeInput(userData.username || '').trim().toLowerCase();
    const exists = users.some((u) => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      addToast('error', 'प्रयोगकर्ता नाम उपलब्ध छैन', 'यो प्रयोगकर्ता नाम (Username) पहिले नै दर्ता भइसकेको छ।');
      return false;
    }

    const rawPassword = userData.password || 'user123';
    const hashed = hashPasswordSync(rawPassword);

    const newUser: User = {
      ...userData,
      fullName: sanitizeInput(userData.fullName),
      username: cleanUsername,
      email: userData.email ? sanitizeInput(userData.email).toLowerCase() : undefined,
      password: hashed.encoded,
      securityPin: userData.securityPin || '1234',
      securityQuestion: userData.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: userData.securityAnswer || 'नेपाल',
      mustChangePassword: userData.mustChangePassword ?? true,
      isFirstLogin: true,
      id: `user_${Date.now()}`,
      createdAt: new Date().toLocaleDateString('ne-NP'),
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    } catch {
      // Storage error ignore
    }

    saveCloudUsers(updatedUsers).catch(console.warn);
    triggerAutoSyncOnSave({ overrideUsers: updatedUsers });

    logSecurityEvent({
      action: 'USER_CREATED',
      category: 'USER_MGMT',
      userId: currentUser?.id,
      username: currentUser?.username,
      userRole: currentUser?.role,
      description: `नयाँ प्रयोगकर्ता '${newUser.fullName}' (${newUser.username}, भूमिका: ${newUser.role}) दर्ता गरियो`,
    });

    addToast(
      'success',
      'प्रयोगकर्ता दर्ता भयो',
      `${newUser.fullName} लाई ${newUser.role} भूमिका सहित दर्ता गरियो। गुगल सिटमा रेकर्ड सुरक्षित भयो।`
    );
    return true;
  };

  const updateUser = (updatedUser: User): boolean => {
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!isSuperAdmin && !isAdmin && currentUser?.id !== updatedUser.id) {
      addToast('error', 'अनाधिकृत कार्य', 'प्रयोगकर्ता परिमार्जन गर्न सुपर एडमिन वा एडमिनको अधिकार आवश्यक पर्दछ।');
      return false;
    }

    const existingTarget = users.find((u) => u.id === updatedUser.id);
    if (!existingTarget) {
      addToast('error', 'त्रुटि', 'प्रयोगकर्ता फेला परेन।');
      return false;
    }

    // If current user is ADMIN, cannot edit SUPER_ADMIN or other ADMINs (except editing their own profile)
    if (isAdmin && currentUser?.id !== updatedUser.id) {
      if (existingTarget.role === 'SUPER_ADMIN' || existingTarget.role === 'ADMIN') {
        addToast(
          'error',
          'अधिकार सीमा',
          'प्रशासक (Admin) ले सुपर एडमिन वा अन्य एडमिन प्रयोगकर्ताको विवरण परिमार्जन गर्न पाउँदैन।'
        );
        return false;
      }
      // Admin cannot escalate a role to SUPER_ADMIN or ADMIN
      if (updatedUser.role === 'SUPER_ADMIN' || updatedUser.role === 'ADMIN') {
        addToast(
          'error',
          'अधिकार सीमा',
          'प्रशासकले प्रयोगकर्तालाई Super Admin वा Admin भूमिकामा पदोन्नति गर्न पाउँदैन।'
        );
        return false;
      }
    }

    // General user / Viewer can only update their own contact details, cannot change their own role or active status
    if (!isSuperAdmin && !isAdmin && currentUser?.id === updatedUser.id) {
      updatedUser.role = existingTarget.role;
      updatedUser.isActive = existingTarget.isActive;
    }

    const updatedUsers = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setUsers(updatedUsers);
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      } catch {
        // Storage error ignore
      }
    }
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    } catch {
      // Storage error ignore
    }

    saveCloudUsers(updatedUsers).catch(console.warn);
    triggerAutoSyncOnSave({ overrideUsers: updatedUsers });

    logSecurityEvent({
      action: 'USER_UPDATED',
      category: 'USER_MGMT',
      userId: currentUser?.id,
      username: currentUser?.username,
      userRole: currentUser?.role,
      description: `प्रयोगकर्ता '${updatedUser.fullName}' (${updatedUser.username}) को विवरण परिमार्जन गरियो`,
    });

    addToast('success', 'प्रयोगकर्ता अपडेट भयो', `${updatedUser.fullName} को विवरण सुरक्षित गरियो।`);
    return true;
  };

  const changeUserPassword = (userId: string, newPassword: string): boolean => {
    const target = users.find((u) => u.id === userId);
    if (!target) {
      addToast('error', 'त्रुटि', 'प्रयोगकर्ता फेला परेन।');
      return false;
    }
    if (!newPassword || newPassword.length < 4) {
      addToast('error', 'कमजोर पासवर्ड', 'पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्दछ।');
      return false;
    }

    const hashed = hashPasswordSync(newPassword);
    const updatedUser: User = {
      ...target,
      password: hashed.encoded,
      mustChangePassword: false,
      passwordChangedAt: new Date().toLocaleDateString('ne-NP'),
    };
    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    if (currentUser?.id === userId) {
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      } catch {
        // Storage error ignore
      }
    }

    logSecurityEvent({
      action: 'PASSWORD_CHANGED',
      category: 'AUTH',
      userId: target.id,
      username: target.username,
      userRole: target.role,
      description: `${target.fullName} को पासवर्ड सुरक्षित तरिकाले परिवर्तन गरियो`,
    });

    addToast('success', 'पासवर्ड परिवर्तन सफल', `${target.fullName} को नयाँ पासवर्ड सुरक्षित भयो।`);
    return true;
  };

  const resetPassword = ({
    usernameOrEmail,
    method,
    verificationValue,
    newPassword,
  }: {
    usernameOrEmail: string;
    method: 'pin' | 'securityQuestion' | 'masterKey';
    verificationValue: string;
    newPassword: string;
  }): { success: boolean; message: string } => {
    const trimmedInput = sanitizeInput(usernameOrEmail).trim().toLowerCase();
    const target = users.find(
      (u) =>
        u.username.toLowerCase() === trimmedInput ||
        (u.email && u.email.toLowerCase() === trimmedInput)
    );

    if (!target) {
      const msg = 'प्रविष्ट गरिएको User ID वा इमेल ठेगाना प्रणालीमा फेला परेन।';
      addToast('error', 'प्रयोगकर्ता फेला परेन', msg);
      return { success: false, message: msg };
    }

    if (!newPassword || newPassword.length < 4) {
      const msg = 'नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्दछ।';
      addToast('error', 'कमजोर पासवर्ड', msg);
      return { success: false, message: msg };
    }

    const trimmedVer = sanitizeInput(verificationValue).trim().toLowerCase();

    if (method === 'pin') {
      const validPin = target.securityPin || '1234';
      if (trimmedVer !== validPin.toLowerCase()) {
        const msg = 'सुरक्षा पिन मिलेन। कृपया सही ४-अङ्कको सुरक्षा पिन राख्नुहोस् वा मास्टर कुञ्जी प्रयोग गर्नुहोस्।';
        addToast('error', 'प्रमाणीकरण असफल', msg);
        logSecurityEvent({
          action: 'PASSWORD_RESET',
          category: 'AUTH',
          userId: target.id,
          username: target.username,
          description: 'सुरक्षा पिन नमिलेको कारण पासवर्ड रिसेट असफल',
          status: 'WARNING',
        });
        return { success: false, message: msg };
      }
    } else if (method === 'securityQuestion') {
      const validAnswer = target.securityAnswer || 'नेपाल';
      if (trimmedVer !== validAnswer.toLowerCase()) {
        const msg = 'सुरक्षा प्रश्नको उत्तर मिलेन।';
        addToast('error', 'प्रमाणीकरण असफल', msg);
        logSecurityEvent({
          action: 'PASSWORD_RESET',
          category: 'AUTH',
          userId: target.id,
          username: target.username,
          description: 'सुरक्षा प्रश्न उत्तर नमिलेको कारण पासवर्ड रिसेट असफल',
          status: 'WARNING',
        });
        return { success: false, message: msg };
      }
    } else if (method === 'masterKey') {
      const validMasterKeys = ['nepal@gov2081', 'admin@gov.np', 'nepal2081', 'admin123'];
      if (!validMasterKeys.includes(trimmedVer)) {
        const msg = 'मास्टर रिकभरी कुञ्जी (Master Key) मिलेन।';
        addToast('error', 'प्रमाणीकरण असफल', msg);
        logSecurityEvent({
          action: 'PASSWORD_RESET',
          category: 'AUTH',
          userId: target.id,
          username: target.username,
          description: 'गलत मास्टर कुञ्जी प्रविष्टि - पासवर्ड रिसेट असफल',
          status: 'WARNING',
        });
        return { success: false, message: msg };
      }
    }

    const hashed = hashPasswordSync(newPassword);

    const updatedUser: User = {
      ...target,
      password: hashed.encoded,
      mustChangePassword: false,
      passwordChangedAt: new Date().toLocaleDateString('ne-NP'),
    };

    setUsers((prev) => prev.map((u) => (u.id === target.id ? updatedUser : u)));
    if (currentUser?.id === target.id) {
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      } catch {
        // Storage error ignore
      }
    }

    logSecurityEvent({
      action: 'PASSWORD_RESET',
      category: 'AUTH',
      userId: target.id,
      username: target.username,
      userRole: target.role,
      description: `${method} विधिबाट पासवर्ड रिसेट सम्पन्न गरियो`,
      status: 'SUCCESS',
    });

    addToast(
      'success',
      'पासवर्ड रिसेट सफल भयो',
      `${target.fullName} को नयाँ पासवर्ड सफलतासाथ सेट गरियो। अब तपाईं नयाँ पासवर्डबाट लगइन गर्न सक्नुहुन्छ।`
    );
    return { success: true, message: 'पासवर्ड सफलतासाथ रिसेट भयो।' };
  };

  const deleteUser = (id: string): boolean => {
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!isSuperAdmin && !isAdmin) {
      addToast('error', 'अनाधिकृत कार्य', 'प्रयोगकर्ता हटाउन सुपर एडमिन वा एडमिनको अधिकार आवश्यक पर्दछ।');
      return false;
    }
    if (id === currentUser?.id) {
      addToast('error', 'हटाउन नमिल्ने', 'हाल लगइन भइरहेको प्रयोगकर्ता आफैंलाई हटाउन सकिंदैन।');
      return false;
    }
    const target = users.find((u) => u.id === id);
    if (!target) return false;

    if (isAdmin && (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN')) {
      addToast('error', 'अधिकार सीमा', 'प्रशासक (Admin) ले सुपर एडमिन वा अन्य एडमिनलाई हटाउन पाउँदैन।');
      return false;
    }

    if (target.role === 'SUPER_ADMIN' && users.filter((u) => u.role === 'SUPER_ADMIN').length <= 1) {
      addToast('error', 'हटाउन नमिल्ने', 'प्रणालीमा कम्तिमा एक जना Super Admin हुनैपर्छ।');
      return false;
    }

    const updatedUsers = users.filter((u) => u.id !== id);
    setUsers(updatedUsers);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    } catch {
      // Storage error ignore
    }

    deleteCloudUser(id).catch(console.warn);
    saveCloudUsers(updatedUsers).catch(console.warn);
    triggerAutoSyncOnSave({ overrideUsers: updatedUsers });

    logSecurityEvent({
      action: 'USER_DELETED',
      category: 'USER_MGMT',
      userId: currentUser?.id,
      username: currentUser?.username,
      userRole: currentUser?.role,
      description: `प्रयोगकर्ता '${target.fullName}' (${target.username}) लाई प्रणालीबाट मेटाइयो`,
      status: 'WARNING',
    });

    addToast(
      'info',
      'प्रयोगकर्ता हटाइयो र सुरक्षित भयो',
      `प्रयोगकर्ता ${target.fullName} लाई सफलतापूर्वक हटाइयो र गुगल सिटमा स्वतः रेकर्ड अद्यावधिक भयो।`
    );
    return true;
  };

  const changeUserRole = (id: string, newRole: UserRole): boolean => {
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!isSuperAdmin && !isAdmin) {
      addToast('error', 'अनाधिकृत कार्य', 'भूमिका परिवर्तन गर्न सुपर एडमिन वा एडमिनको अधिकार आवश्यक पर्दछ।');
      return false;
    }

    const target = users.find((u) => u.id === id);
    if (!target) return false;

    if (isAdmin) {
      if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
        addToast('error', 'अधिकार सीमा', 'प्रशासक (Admin) ले सुपर एडमिन वा एडमिनको भूमिका परिवर्तन गर्न पाउँदैन।');
        return false;
      }
      if (newRole === 'SUPER_ADMIN' || newRole === 'ADMIN') {
        addToast('error', 'अधिकार सीमा', 'प्रशासकले Super Admin वा Admin भूमिकामा परिवर्तन गर्न पाउँदैन।');
        return false;
      }
    }

    const prevRole = target.role;
    const updatedUsers = users.map((u) => (u.id === id ? { ...u, role: newRole } : u));
    setUsers(updatedUsers);
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, role: newRole } : null));
    }
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    } catch {
      // Storage error ignore
    }

    saveCloudUsers(updatedUsers).catch(console.warn);
    triggerAutoSyncOnSave({ overrideUsers: updatedUsers });

    logSecurityEvent({
      action: 'ROLE_CHANGED',
      category: 'USER_MGMT',
      userId: currentUser?.id,
      username: currentUser?.username,
      userRole: currentUser?.role,
      description: `प्रयोगकर्ता '${target.fullName}' को भूमिका ${prevRole} बाट ${newRole} मा परिवर्तन गरियो`,
    });

    addToast('success', 'भूमिका परिवर्तन', `प्रयोगकर्ताको भूमिका ${newRole} मा परिवर्तन गरियो।`);
    return true;
  };

  // Fiscal Year Switching & Isolation
  const setActiveFiscalYear = (newFy: string) => {
    if (newFy === activeFiscalYear) return;

    // Load data from FY database or fallback
    const targetData = fyDatabase[newFy];
    if (targetData) {
      setEmployees(targetData.employees || []);
      setSalarySetups(targetData.salarySetups || {});
      setDeductionSetups(targetData.deductionSetups || {});
      setTaxReferences(targetData.taxReferences || DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: newFy })));
    } else {
      // Initialize new empty FY entry with default tax slabs
      const newTaxRefs = DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: newFy }));
      setEmployees([]);
      setSalarySetups({});
      setDeductionSetups({});
      setTaxReferences(newTaxRefs);
      setFyDatabase((prev) => ({
        ...prev,
        [newFy]: {
          employees: [],
          salarySetups: {},
          deductionSetups: {},
          taxReferences: newTaxRefs,
        },
      }));
    }

    setActiveFiscalYearState(newFy);
    addToast('info', 'आर्थिक वर्ष परिवर्तन', `सक्रिय आर्थिक वर्ष ${newFy} चयन गरियो।`);
  };

  // Create a new Fiscal Year
  const createFiscalYear = (newFy: string, copyFromPreviousFy?: string): boolean => {
    if (!newFy.trim()) {
      addToast('error', 'त्रुटि', 'आर्थिक वर्षको नाम खाली हुन सक्दैन।');
      return false;
    }
    if (fiscalYears.includes(newFy)) {
      addToast('warning', 'पहिले नै अवस्थित', `आर्थिक वर्ष ${newFy} पहिले नै सिर्जना भइसकेको छ।`);
      return false;
    }

    let initialData: FiscalYearData;
    if (copyFromPreviousFy && fyDatabase[copyFromPreviousFy]) {
      const source = fyDatabase[copyFromPreviousFy];
      initialData = {
        employees: JSON.parse(JSON.stringify(source.employees || [])),
        salarySetups: JSON.parse(JSON.stringify(source.salarySetups || {})),
        deductionSetups: JSON.parse(JSON.stringify(source.deductionSetups || {})),
        taxReferences: (source.taxReferences || DEFAULT_TAX_REFERENCES).map((tr) => ({
          ...tr,
          fiscalYear: newFy,
        })),
      };
    } else {
      initialData = {
        employees: [],
        salarySetups: {},
        deductionSetups: {},
        taxReferences: DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: newFy })),
      };
    }

    setFiscalYears((prev) => sortFiscalYearsDescending([newFy, ...prev]));
    setFyDatabase((prev) => ({
      ...prev,
      [newFy]: initialData,
    }));

    setActiveFiscalYear(newFy);
    addToast('success', 'नयाँ आर्थिक वर्ष सिर्जना', `आर्थिक वर्ष ${newFy} सफलतापूर्वक सिर्जना गरी सक्रिय गरियो।`);
    return true;
  };

  // Update / Rename an existing Fiscal Year
  const updateFiscalYear = (oldFy: string, newFy: string): boolean => {
    if (!hasPermission('MANAGE_SETTINGS')) {
      addToast('error', 'अनाधिकृत कार्य', 'आर्थिक वर्ष सम्पादन गर्न एडमिन वा सुपर एडमिनको अधिकार चाहिन्छ।');
      return false;
    }
    const trimmedNewFy = newFy.trim();
    if (!trimmedNewFy) {
      addToast('error', 'त्रुटि', 'कृपया आर्थिक वर्षको नाम खाली नराख्नुहोस्।');
      return false;
    }
    if (oldFy === trimmedNewFy) {
      addToast('info', 'कुनै परिवर्तन भएन', 'आर्थिक वर्षको नाम उही रहेको छ।');
      return true;
    }
    if (fiscalYears.includes(trimmedNewFy)) {
      addToast('error', 'दोहोरिएको नाम', `आर्थिक वर्ष "${trimmedNewFy}" पहिले नै उपलब्ध छ।`);
      return false;
    }

    // 1. Update fiscalYears list
    const updatedList = sortFiscalYearsDescending(
      fiscalYears.map((fy) => (fy === oldFy ? trimmedNewFy : fy))
    );
    setFiscalYears(updatedList);

    // 2. Update fyDatabase mapping
    setFyDatabase((prev) => {
      const updated = { ...prev };
      const oldData = updated[oldFy] || {
        employees: [],
        salarySetups: {},
        deductionSetups: {},
        taxReferences: DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: trimmedNewFy })),
      };

      const updatedTaxRefs = (oldData.taxReferences || []).map((tr) => ({
        ...tr,
        fiscalYear: trimmedNewFy,
      }));

      updated[trimmedNewFy] = {
        ...oldData,
        taxReferences: updatedTaxRefs,
      };
      delete updated[oldFy];
      return updated;
    });

    // 3. If activeFiscalYear was oldFy, update active state & tax references
    if (activeFiscalYear === oldFy) {
      setActiveFiscalYearState(trimmedNewFy);
      setTaxReferences((prev) =>
        prev.map((tr) => ({
          ...tr,
          fiscalYear: trimmedNewFy,
        }))
      );
    }

    // 4. Update multi-tenancy orgDatabases if applicable
    setOrgDatabases((prev) => {
      const nextOrgDbs = { ...prev };
      Object.keys(nextOrgDbs).forEach((orgId) => {
        const store = nextOrgDbs[orgId];
        if (store) {
          const newFys = store.fiscalYears?.map((f) => (f === oldFy ? trimmedNewFy : f)) || [];
          const newActive = store.activeFiscalYear === oldFy ? trimmedNewFy : store.activeFiscalYear;
          const newFyDb = { ...(store.fyDatabase || {}) };
          if (newFyDb[oldFy]) {
            newFyDb[trimmedNewFy] = {
              ...newFyDb[oldFy],
              taxReferences: (newFyDb[oldFy].taxReferences || []).map((tr) => ({
                ...tr,
                fiscalYear: trimmedNewFy,
              })),
            };
            delete newFyDb[oldFy];
          }
          nextOrgDbs[orgId] = {
            ...store,
            fiscalYears: sortFiscalYearsDescending(newFys),
            activeFiscalYear: newActive,
            fyDatabase: newFyDb,
          };
        }
      });
      return nextOrgDbs;
    });

    addToast(
      'success',
      'आर्थिक वर्ष सम्पादन सफल',
      `आर्थिक वर्ष "${oldFy}" लाई सफलतापूर्वक "${trimmedNewFy}" मा परिवर्तन गरियो।`
    );
    return true;
  };

  // Carry Forward Fiscal Year Data
  const carryForwardFiscalYear = (
    sourceFy: string,
    targetFy: string,
    options = {
      copyEmployees: true,
      promoteGrades: true,
      copyDeductions: true,
      copyTaxSlabs: true,
    }
  ): boolean => {
    if (!hasPermission('CARRY_FORWARD')) {
      addToast('error', 'अनाधिकृत कार्य', 'डाटा सार्न (Carry Forward) एडमिन वा सुपर एडमिनको अधिकार आवश्यक पर्दछ।');
      return false;
    }

    const sourceData = fyDatabase[sourceFy];
    if (!sourceData || !sourceData.employees || sourceData.employees.length === 0) {
      addToast('warning', 'डाटा फेला परेन', `स्रोत आर्थिक वर्ष (${sourceFy}) मा सार्नका लागि कुनै कर्मचारी डाटा छैन।`);
      return false;
    }

    // Process employees and salaries with optional Grade Promotion (खाइपाई आएको ग्रेड अघिल्लो वर्षको जोडेर लैजाने)
    const newEmployees: Employee[] = options.copyEmployees
      ? sourceData.employees.map((emp) => {
          const empSal = sourceData.salarySetups[emp.id];
          const prevGradeCount = options.promoteGrades
            ? (empSal?.currentGradeCount || (emp.previousGradeCount || 0) + (emp.addedGradeCount || 0))
            : (emp.previousGradeCount || 0);

          return {
            ...emp,
            previousGradeCount: prevGradeCount,
            addedGradeCount: 1, // Start with 1 added grade for the new FY
          };
        })
      : [];

    const newSalarySetups: Record<string, SalarySetup> = {};
    if (options.copyEmployees) {
      newEmployees.forEach((emp) => {
        const oldSal = sourceData.salarySetups[emp.id];
        if (oldSal) {
          const prevG = emp.previousGradeCount || 0;
          const addG = emp.addedGradeCount || 1;
          newSalarySetups[emp.id] = {
            ...oldSal,
            previousGradeCount: prevG,
            addedGradeCount: addG,
            currentGradeCount: prevG + addG,
            gradeIncreaseCount: addG,
            updatedAt: new Date().toISOString(),
          };
        }
      });
    }

    const newDeductionSetups: Record<string, DeductionSetup> = {};
    if (options.copyDeductions) {
      newEmployees.forEach((emp) => {
        const oldDed = sourceData.deductionSetups[emp.id];
        if (oldDed) {
          newDeductionSetups[emp.id] = {
            ...oldDed,
            updatedAt: new Date().toISOString(),
          };
        }
      });
    }

    const newTaxRefs = options.copyTaxSlabs
      ? (sourceData.taxReferences || DEFAULT_TAX_REFERENCES).map((tr) => ({
          ...tr,
          fiscalYear: targetFy,
        }))
      : DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: targetFy }));

    const updatedTargetData: FiscalYearData = {
      employees: newEmployees,
      salarySetups: newSalarySetups,
      deductionSetups: newDeductionSetups,
      taxReferences: newTaxRefs,
    };

    setFyDatabase((prev) => ({
      ...prev,
      [targetFy]: updatedTargetData,
    }));

    if (activeFiscalYear === targetFy) {
      setEmployees(newEmployees);
      setSalarySetups(newSalarySetups);
      setDeductionSetups(newDeductionSetups);
      setTaxReferences(newTaxRefs);
    }

    addToast(
      'success',
      'डाटा स्थानान्तरण (Carry Forward) सम्पन्न',
      `आ.व. ${sourceFy} बाट ${newEmployees.length} जना कर्मचारीको विवरण आ.व. ${targetFy} मा सफलतापूर्वक सारियो।`
    );
    return true;
  };

  // Delete a Fiscal Year completely
  const deleteFiscalYear = (fy: string): boolean => {
    if (!hasPermission('MANAGE_SETTINGS')) {
      addToast('error', 'अनाधिकृत कार्य', 'आर्थिक वर्ष मेटाउन एडमिन वा सुपर एडमिनको अधिकार चाहिन्छ।');
      return false;
    }
    if (fiscalYears.length <= 1) {
      addToast('error', 'हटाउन मिल्दैन', 'प्रणालीमा कम्तिमा एउटा आर्थिक वर्ष हुनु अनिवार्य छ।');
      return false;
    }

    showConfirmation({
      title: `आर्थिक वर्ष ${fy} मेटाउने पुष्टि`,
      message: `के तपाईं आर्थिक वर्ष "${fy}" र यस अन्तर्गतका सम्पूर्ण कर्मचारी, तलब तथा कर डाटा प्रणालीबाट पूर्ण रूपमा हटाउन निश्चित हुनुहुन्छ? यो कार्य पूर्ववत गर्न सकिने छैन।`,
      isDangerous: true,
      confirmText: 'हो, यो आर्थिक वर्ष पूर्ण मेटाउनुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        const remaining = sortFiscalYearsDescending(fiscalYears.filter((item) => item !== fy));
        setFiscalYears(remaining);

        setFyDatabase((prev) => {
          const updated = { ...prev };
          delete updated[fy];
          return updated;
        });

        if (activeFiscalYear === fy) {
          const nextActive = remaining[0];
          setActiveFiscalYearState(nextActive);
          const targetData = fyDatabase[nextActive];
          if (targetData) {
            setEmployees(targetData.employees || []);
            setSalarySetups(targetData.salarySetups || {});
            setDeductionSetups(targetData.deductionSetups || {});
            setTaxReferences(
              targetData.taxReferences ||
                DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: nextActive }))
            );
          }
        }

        hideConfirmation();
        addToast('success', 'आर्थिक वर्ष हटाइयो', `आर्थिक वर्ष ${fy} प्रणालीबाट सफलतापूर्वक हटाइयो।`);
      },
    });
    return true;
  };

  // Clear data for a specific Fiscal Year
  const clearFiscalYearData = (fy: string) => {
    if (!hasPermission('MANAGE_SETTINGS')) {
      addToast('error', 'अनाधिकृत कार्य', 'डाटा मेटाउन एडमिन वा सुपर एडमिनको अधिकार चाहिन्छ।');
      return;
    }

    showConfirmation({
      title: `आ.व. ${fy} को डाटा मेटाउने पुष्टि`,
      message: `के तपाईं छानिएको आर्थिक वर्ष "${fy}" का सम्पूर्ण कर्मचारी, तलब तथा कर विवरण मेटाउन (All Clear गर्न) निश्चित हुनुहुन्छ? यो कार्य पूर्ववत गर्न सकिने छैन।`,
      isDangerous: true,
      confirmText: `हो, आ.व. ${fy} को सबै डाटा मेटाउनुहोस्`,
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        const emptyData: FiscalYearData = {
          employees: [],
          salarySetups: {},
          deductionSetups: {},
          taxReferences: DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: fy })),
        };

        setFyDatabase((prev) => ({
          ...prev,
          [fy]: emptyData,
        }));

        if (activeFiscalYear === fy) {
          setEmployees([]);
          setSalarySetups({});
          setDeductionSetups({});
          setTaxReferences(emptyData.taxReferences);
        }

        hideConfirmation();
        addToast('warning', 'डाटा खाली गरियो', `आर्थिक वर्ष ${fy} को स्टोर भएका सम्पूर्ण डाटा पूर्ण रूपमा मेटाइएको छ।`);
      },
    });
  };

  // Self-healing synchronization: Ensure every employee in employees has a matching salarySetup and deductionSetup
  useEffect(() => {
    if (employees.length > 0) {
      let salaryUpdated = false;
      const nextSalary = { ...salarySetups };
      let deductionUpdated = false;
      const nextDeduction = { ...deductionSetups };

      employees.forEach((emp) => {
        if (!nextSalary[emp.id]) {
          salaryUpdated = true;
          const prevG = Number(emp.previousGradeCount || 0);
          const addG = Number(emp.addedGradeCount || 0);
          nextSalary[emp.id] = {
            id: `sal_${emp.id}`,
            employeeId: emp.id,
            basicSalary: 35000,
            technicalGradeAmount: Number(emp.technicalGradeAmount || 0),
            salaryMonthsCount: 12,
            gradeRate: 1100,
            previousGradeCount: prevG,
            addedGradeCount: addG,
            currentGradeCount: prevG + addG,
            gradeIncreaseCount: addG,
            gradeIncreaseMonth: ((emp.gradeIncreaseMonthText || 'श्रावण देखि').replace(' देखि', '') as NepaliMonth) || 'श्रावण',
            festivalBonusMonth: emp.festivalBonusMonth || 'असोज',
            lifeInsuranceFund: 400,
            dearnessAllowance: 2000,
            uniformAllowance: 10000,
            uniformAllowanceMonth: emp.uniformAllowanceMonth || 'चैत्र',
            remoteAllowance: 0,
            incentiveAllowance: 0,
            otherIncome: 0,
            updatedAt: new Date().toISOString(),
          };
        }
        if (!nextDeduction[emp.id]) {
          deductionUpdated = true;
          nextDeduction[emp.id] = {
            id: `ded_${emp.id}`,
            employeeId: emp.id,
            loanDeduction: 0,
            citizenInvestmentTrust: 0,
            investmentInsuranceDeduction: 0,
            otherDeduction: 0,
            medicalExpenseActual: 0,
            updatedAt: new Date().toISOString(),
          };
        }
      });

      if (salaryUpdated) {
        setSalarySetups(nextSalary);
      }
      if (deductionUpdated) {
        setDeductionSetups(nextDeduction);
      }
    }
  }, [employees]);

  // Helper to fetch matching tax reference for an employee
  const getActiveTaxReference = (filingType: 'एकल' | 'दम्पत्ती'): TaxReference => {
    const match = taxReferences.find(
      (tr) => tr.fiscalYear === activeFiscalYear && tr.filingType === filingType
    );
    if (match) return match;

    const fallback = taxReferences.find((tr) => tr.filingType === filingType) || taxReferences[0];
    return fallback;
  };

  // Derived Calculations for all employees in active fiscal year
  const annualTaxResults = useMemo(() => {
    const results: Record<string, AnnualTaxCalculationResult> = {};
    for (const emp of employees) {
      const sal = salarySetups[emp.id] || {
        id: `sal_${emp.id}`,
        employeeId: emp.id,
        basicSalary: 30000,
        salaryMonthsCount: 12,
        gradeRate: 1000,
        currentGradeCount: 1,
        gradeIncreaseCount: 0,
        gradeIncreaseMonth: 'श्रावण',
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        remoteAllowance: 0,
        incentiveAllowance: 0,
        otherIncome: 0,
        updatedAt: new Date().toISOString(),
      };

      const ded = deductionSetups[emp.id] || {
        id: `ded_${emp.id}`,
        employeeId: emp.id,
        loanDeduction: 0,
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        otherDeduction: 0,
        updatedAt: new Date().toISOString(),
      };

      const taxRef = getActiveTaxReference(emp.filingType);
      results[emp.id] = calculateAnnualSalaryAndTax(emp, sal, ded, taxRef);
    }
    return results;
  }, [employees, salarySetups, deductionSetups, taxReferences, activeFiscalYear]);

  // Derived Monthly Salary Items for Active Month
  const monthlySalaryItems = useMemo(() => {
    return employees.map((emp) => {
      const sal = salarySetups[emp.id] || {
        id: `sal_${emp.id}`,
        employeeId: emp.id,
        basicSalary: 30000,
        salaryMonthsCount: 12,
        gradeRate: 1000,
        currentGradeCount: 1,
        gradeIncreaseCount: 0,
        gradeIncreaseMonth: 'श्रावण',
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        remoteAllowance: 0,
        incentiveAllowance: 0,
        otherIncome: 0,
        updatedAt: new Date().toISOString(),
      };

      const ded = deductionSetups[emp.id] || {
        id: `ded_${emp.id}`,
        employeeId: emp.id,
        loanDeduction: 0,
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        otherDeduction: 0,
        updatedAt: new Date().toISOString(),
      };

      const taxResult = annualTaxResults[emp.id];
      return calculateMonthlySalaryItem(emp, sal, ded, taxResult, activeMonth);
    });
  }, [employees, salarySetups, deductionSetups, annualTaxResults, activeMonth]);

  // Dashboard Aggregates
  const dashboardMetrics = useMemo(() => {
    let totalEmployees = employees.length;
    let permanentEmployees = 0;
    let temporaryEmployees = 0;
    let contractEmployees = 0;

    let totalAnnualIncome = 0;
    let totalAnnualTaxLiability = 0;
    let totalAnnualDeductions = 0;
    let totalAnnualNetSalary = 0;

    employees.forEach((emp) => {
      if (emp.serviceType === 'स्थायी') permanentEmployees++;
      else if (emp.serviceType === 'अस्थायी') temporaryEmployees++;
      else if (emp.serviceType === 'करार') contractEmployees++;

      const res = annualTaxResults[emp.id];
      if (res) {
        totalAnnualIncome += res.totalAnnualIncome;
        totalAnnualTaxLiability += res.netAnnualTaxLiability;
        totalAnnualDeductions += res.totalAnnualDeductions;
        totalAnnualNetSalary += (res.totalAnnualIncome - res.totalAnnualDeductions - res.netAnnualTaxLiability);
      }
    });

    let totalMonthlyGross = 0;
    let totalMonthlyTax = 0;
    let totalMonthlyNet = 0;

    monthlySalaryItems.forEach((item) => {
      totalMonthlyGross += item.grossSalary;
      totalMonthlyTax += item.taxDeduction;
      totalMonthlyNet += item.netSalary;
    });

    return {
      totalEmployees,
      permanentEmployees,
      temporaryEmployees,
      contractEmployees,
      totalAnnualIncome,
      totalAnnualTaxLiability,
      totalAnnualDeductions,
      totalAnnualNetSalary,
      totalMonthlyGross,
      totalMonthlyTax,
      totalMonthlyNet,
    };
  }, [employees, annualTaxResults, monthlySalaryItems]);

  // Employee CRUD Operations
  const addEmployee = (
    empData: Omit<Employee, 'id' | 'createdAt'>,
    salaryInit?: Partial<SalarySetup>,
    deductionInit?: Partial<DeductionSetup>
  ): boolean => {
    if (!hasPermission('EDIT_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर्मचारी विवरण थप्न अधिकार आवश्यक पर्दछ।');
      return false;
    }

    const codeExists = employees.some(
      (e) => String(e.code || '').trim().toLowerCase() === String(empData.code || '').trim().toLowerCase()
    );
    if (codeExists) {
      addToast('error', 'संकेत नम्बर दोहोरियो', `संकेत नम्बर '${empData.code}' पहिले नै प्रयोगमा छ।`);
      return false;
    }

    const newId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const newEmployee: Employee = {
      ...empData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    const prevG = Number(empData.previousGradeCount || 0);
    const addG = Number(empData.addedGradeCount || 0);

    const defaultSalary: SalarySetup = {
      id: `sal_${newId}`,
      employeeId: newId,
      basicSalary: 35000,
      technicalGradeAmount: Number(empData.technicalGradeAmount || 0),
      salaryMonthsCount: 12,
      gradeRate: 1100,
      previousGradeCount: prevG,
      addedGradeCount: addG,
      currentGradeCount: prevG + addG,
      gradeIncreaseCount: addG,
      gradeIncreaseMonth: ((empData.gradeIncreaseMonthText || 'श्रावण देखि').replace(' देखि', '') as NepaliMonth) || 'श्रावण',
      festivalBonusMonth: empData.festivalBonusMonth || 'असोज',
      lifeInsuranceFund: 400,
      dearnessAllowance: 2000,
      uniformAllowance: 10000,
      uniformAllowanceMonth: empData.uniformAllowanceMonth || 'चैत्र',
      remoteAllowance: 0,
      incentiveAllowance: 0,
      otherIncome: 0,
      updatedAt: new Date().toISOString(),
      ...salaryInit,
    };

    const defaultDeduction: DeductionSetup = {
      id: `ded_${newId}`,
      employeeId: newId,
      loanDeduction: 0,
      citizenInvestmentTrust: 0,
      investmentInsuranceDeduction: 0,
      otherDeduction: 0,
      medicalExpenseActual: 0,
      updatedAt: new Date().toISOString(),
      ...deductionInit,
    };

    setEmployees((prev) => [...prev, newEmployee]);
    setSalarySetups((prev) => ({ ...prev, [newId]: defaultSalary }));
    setDeductionSetups((prev) => ({ ...prev, [newId]: defaultDeduction }));

    addToast('success', 'कर्मचारी सुरक्षित भयो', `${newEmployee.name} को विवरण सफलतापूर्वक थपियो।`);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideEmployees: [...employees, newEmployee],
      overrideSalarySetups: { ...salarySetups, [newId]: defaultSalary },
      overrideDeductionSetups: { ...deductionSetups, [newId]: defaultDeduction },
    });

    return true;
  };

  const updateEmployee = (
    emp: Employee,
    salaryUpdate?: Partial<SalarySetup>,
    deductionUpdate?: Partial<DeductionSetup>
  ): boolean => {
    if (!hasPermission('EDIT_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर्मचारी विवरण परिमार्जन गर्न अधिकार छैन।');
      return false;
    }

    const codeConflict = employees.some(
      (e) => e.id !== emp.id && String(e.code || '').trim().toLowerCase() === String(emp.code || '').trim().toLowerCase()
    );
    if (codeConflict) {
      addToast('error', 'संकेत नम्बर दोहोरियो', `संकेत नम्बर '${emp.code}' अर्को कर्मचारीमा प्रयोगमा छ।`);
      return false;
    }

    const updatedEmployees = employees.map((e) => (e.id === emp.id ? emp : e));
    setEmployees(updatedEmployees);

    let updatedSalarySetups = salarySetups;
    if (salaryUpdate) {
      const existing = salarySetups[emp.id] || {
        id: `sal_${emp.id}`,
        employeeId: emp.id,
        basicSalary: 35000,
        salaryMonthsCount: 12,
        gradeRate: 1100,
        currentGradeCount: (emp.previousGradeCount || 0) + (emp.addedGradeCount || 0),
        gradeIncreaseCount: emp.addedGradeCount || 0,
        gradeIncreaseMonth: 'श्रावण',
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        remoteAllowance: 0,
        incentiveAllowance: 0,
        otherIncome: 0,
        updatedAt: new Date().toISOString(),
      };
      updatedSalarySetups = {
        ...salarySetups,
        [emp.id]: {
          ...existing,
          ...salaryUpdate,
          updatedAt: new Date().toISOString(),
        },
      };
      setSalarySetups(updatedSalarySetups);
    }

    let updatedDeductionSetups = deductionSetups;
    if (deductionUpdate) {
      const existing = deductionSetups[emp.id] || {
        id: `ded_${emp.id}`,
        employeeId: emp.id,
        loanDeduction: 0,
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        otherDeduction: 0,
        updatedAt: new Date().toISOString(),
      };
      updatedDeductionSetups = {
        ...deductionSetups,
        [emp.id]: {
          ...existing,
          ...deductionUpdate,
          updatedAt: new Date().toISOString(),
        },
      };
      setDeductionSetups(updatedDeductionSetups);
    }

    addToast('success', 'अपडेट सफल', `${emp.name} को विवरण सफलतापूर्वक अपडेट गरियो।`);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideEmployees: updatedEmployees,
      overrideSalarySetups: updatedSalarySetups,
      overrideDeductionSetups: updatedDeductionSetups,
    });

    return true;
  };

  const bulkImportEmployees = (
    items: Array<{
      employee: Omit<Employee, 'id' | 'createdAt'>;
      salary?: Partial<SalarySetup>;
      deduction?: Partial<DeductionSetup>;
      isExisting?: boolean;
      existingId?: string;
    }>,
    updateExisting: boolean = true
  ): { added: number; updated: number; skipped: number; total: number } => {
    if (!hasPermission('EDIT_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर्मचारी विवरण थप्न वा परिमार्जन गर्न अधिकार आवश्यक पर्दछ।');
      return { added: 0, updated: 0, skipped: items.length, total: items.length };
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const newEmployeesList: Employee[] = [...employees];
    const newSalarySetups: Record<string, SalarySetup> = { ...salarySetups };
    const newDeductionSetups: Record<string, DeductionSetup> = { ...deductionSetups };

    for (const item of items) {
      const codeClean = toEnglishDigits(String(item.employee.code || '')).trim().toLowerCase();
      const existingIdx = newEmployeesList.findIndex(
        (e) => toEnglishDigits(String(e.code || '')).trim().toLowerCase() === codeClean
      );

      if (existingIdx !== -1) {
        if (updateExisting) {
          const existingEmp = newEmployeesList[existingIdx];
          const empId = existingEmp.id;

          newEmployeesList[existingIdx] = {
            ...item.employee,
            id: empId,
            createdAt: existingEmp.createdAt || new Date().toISOString(),
          };

          const prevSal = newSalarySetups[empId] || ({} as Partial<SalarySetup>);
          const prevDed = newDeductionSetups[empId] || ({} as Partial<DeductionSetup>);

          const prevG = Number(item.employee.previousGradeCount ?? prevSal.previousGradeCount ?? 0);
          const addG = Number(item.employee.addedGradeCount ?? prevSal.addedGradeCount ?? 0);

          newSalarySetups[empId] = {
            id: `sal_${empId}`,
            employeeId: empId,
            basicSalary: 35000,
            technicalGradeAmount: Number(item.employee.technicalGradeAmount || 0),
            salaryMonthsCount: 12,
            gradeRate: 1100,
            previousGradeCount: prevG,
            addedGradeCount: addG,
            currentGradeCount: prevG + addG,
            gradeIncreaseCount: addG,
            gradeIncreaseMonth: ((item.employee.gradeIncreaseMonthText || 'श्रावण देखि').replace(' देखि', '') as NepaliMonth) || 'श्रावण',
            festivalBonusMonth: item.employee.festivalBonusMonth || 'असोज',
            lifeInsuranceFund: 400,
            dearnessAllowance: 2000,
            uniformAllowance: 10000,
            uniformAllowanceMonth: item.employee.uniformAllowanceMonth || 'चैत्र',
            remoteAllowance: 0,
            incentiveAllowance: 0,
            otherIncome: 0,
            ...prevSal,
            ...item.salary,
            updatedAt: new Date().toISOString(),
          };

          newDeductionSetups[empId] = {
            id: `ded_${empId}`,
            employeeId: empId,
            loanDeduction: 0,
            citizenInvestmentTrust: 0,
            investmentInsuranceDeduction: 0,
            otherDeduction: 0,
            medicalExpenseActual: 0,
            ...prevDed,
            ...item.deduction,
            updatedAt: new Date().toISOString(),
          };

          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // Add new employee
        const newId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newEmp: Employee = {
          ...item.employee,
          id: newId,
          createdAt: new Date().toISOString(),
        };

        const prevG = Number(item.employee.previousGradeCount || 0);
        const addG = Number(item.employee.addedGradeCount || 0);

        newEmployeesList.push(newEmp);

        newSalarySetups[newId] = {
          id: `sal_${newId}`,
          employeeId: newId,
          basicSalary: 35000,
          technicalGradeAmount: Number(item.employee.technicalGradeAmount || 0),
          salaryMonthsCount: 12,
          gradeRate: 1100,
          previousGradeCount: prevG,
          addedGradeCount: addG,
          currentGradeCount: prevG + addG,
          gradeIncreaseCount: addG,
          gradeIncreaseMonth: ((item.employee.gradeIncreaseMonthText || 'श्रावण देखि').replace(' देखि', '') as NepaliMonth) || 'श्रावण',
          festivalBonusMonth: item.employee.festivalBonusMonth || 'असोज',
          lifeInsuranceFund: 400,
          dearnessAllowance: 2000,
          uniformAllowance: 10000,
          uniformAllowanceMonth: item.employee.uniformAllowanceMonth || 'चैत्र',
          remoteAllowance: 0,
          incentiveAllowance: 0,
          otherIncome: 0,
          ...item.salary,
          updatedAt: new Date().toISOString(),
        };

        newDeductionSetups[newId] = {
          id: `ded_${newId}`,
          employeeId: newId,
          loanDeduction: 0,
          citizenInvestmentTrust: 0,
          investmentInsuranceDeduction: 0,
          otherDeduction: 0,
          medicalExpenseActual: 0,
          ...item.deduction,
          updatedAt: new Date().toISOString(),
        };

        addedCount++;
      }
    }

    setEmployees(newEmployeesList);
    setSalarySetups(newSalarySetups);
    setDeductionSetups(newDeductionSetups);

    addToast(
      'success',
      'Excel डाटा Import सम्पन्न',
      `कुल ${items.length} रेकर्ड मध्ये ${addedCount} नयाँ थपियो, ${updatedCount} अपडेट भयो र ${skippedCount} छाडियो।`
    );

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideEmployees: newEmployeesList,
      overrideSalarySetups: newSalarySetups,
      overrideDeductionSetups: newDeductionSetups,
    });

    return { added: addedCount, updated: updatedCount, skipped: skippedCount, total: items.length };
  };

  const deleteEmployee = (id: string) => {
    if (!hasPermission('DELETE_EMPLOYEE')) {
      addToast(
        'error',
        'अनाधिकृत कार्य (Access Denied)',
        'कर्मचारी हटाउने (Delete) अधिकार केवल Super Admin र Admin लाई मात्र छ। General User र Viewer लाई Delete गर्ने अधिकार छैन।'
      );
      return;
    }

    const emp = employees.find((e) => e.id === id);
    if (!emp) return;

    showConfirmation({
      title: 'कर्मचारी हटाउने पुष्टि',
      message: `के तपाईं '${emp.name}' (संकेत नं: ${emp.code}) को सम्पूर्ण तलब तथा कर विवरण हटाउन निश्चित हुनुहुन्छ?`,
      isDangerous: true,
      confirmText: 'हटाउनुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        const updatedEmployees = employees.filter((e) => e.id !== id);
        const updatedSalaries = { ...salarySetups };
        delete updatedSalaries[id];
        const updatedDeductions = { ...deductionSetups };
        delete updatedDeductions[id];

        setEmployees(updatedEmployees);
        setSalarySetups(updatedSalaries);
        setDeductionSetups(updatedDeductions);
        hideConfirmation();
        addToast('info', 'कर्मचारी हटाइयो', `${emp.name} को विवरण सफलतापूर्वक हटाइयो।`);

        // Auto-sync deletion immediately to Google Sheets
        triggerAutoSyncOnSave({
          overrideEmployees: updatedEmployees,
          overrideSalarySetups: updatedSalaries,
          overrideDeductionSetups: updatedDeductions,
        });
      },
    });
  };

  const getEmployeeById = (id: string): Employee | undefined => {
    return employees.find((e) => e.id === id);
  };

  const updateSalarySetup = (empId: string, setup: Partial<SalarySetup>) => {
    if (!hasPermission('EDIT_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'तलब विवरण परिमार्जन गर्न अधिकार छैन।');
      return;
    }

    const current = salarySetups[empId] || {
      id: `sal_${empId}`,
      employeeId: empId,
      basicSalary: 35000,
      salaryMonthsCount: 12,
      gradeRate: 1100,
      currentGradeCount: 1,
      gradeIncreaseCount: 0,
      gradeIncreaseMonth: 'शत्रावण',
      lifeInsuranceFund: 400,
      dearnessAllowance: 2000,
      uniformAllowance: 10000,
      remoteAllowance: 0,
      incentiveAllowance: 0,
      otherIncome: 0,
      updatedAt: new Date().toISOString(),
    };
    const updatedSalarySetups = {
      ...salarySetups,
      [empId]: {
        ...current,
        ...setup,
        updatedAt: new Date().toISOString(),
      },
    };
    setSalarySetups(updatedSalarySetups);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideSalarySetups: updatedSalarySetups,
    });
  };

  const updateDeductionSetup = (empId: string, setup: Partial<DeductionSetup>) => {
    if (!hasPermission('EDIT_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'कट्टी विवरण परिमार्जन गर्न अधिकार छैन।');
      return;
    }

    const current = deductionSetups[empId] || {
      id: `ded_${empId}`,
      employeeId: empId,
      loanDeduction: 0,
      citizenInvestmentTrust: 0,
      investmentInsuranceDeduction: 0,
      otherDeduction: 0,
      updatedAt: new Date().toISOString(),
    };
    const updatedDeductionSetups = {
      ...deductionSetups,
      [empId]: {
        ...current,
        ...setup,
        updatedAt: new Date().toISOString(),
      },
    };
    setDeductionSetups(updatedDeductionSetups);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideDeductionSetups: updatedDeductionSetups,
    });
  };

  const saveTaxReference = (taxRef: TaxReference) => {
    if (!hasPermission('MANAGE_TAX_SLABS')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर स्ल्याब परिवर्तन गर्न अधिकार छैन।');
      return;
    }

    let updatedTaxReferences: TaxReference[];
    const idx = taxReferences.findIndex(
      (t) => t.id === taxRef.id || (t.fiscalYear === taxRef.fiscalYear && t.filingType === taxRef.filingType)
    );
    if (idx >= 0) {
      const copy = [...taxReferences];
      copy[idx] = taxRef;
      updatedTaxReferences = copy;
    } else {
      updatedTaxReferences = [...taxReferences, taxRef];
    }
    setTaxReferences(updatedTaxReferences);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideTaxReferences: updatedTaxReferences,
    });
  };

  const deleteTaxReference = (id: string) => {
    if (!hasPermission('MANAGE_TAX_SLABS')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर स्ल्याब हटाउन अधिकार छैन।');
      return;
    }
    const updated = taxReferences.filter((t) => t.id !== id);
    setTaxReferences(updated);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideTaxReferences: updated,
    });
  };

  const setActiveOrganizationId = (orgId: string) => {
    if (orgId === activeOrganizationId) return;

    // 1. Sync current active data into orgDatabases
    setOrgDatabases((prev) => ({
      ...prev,
      [activeOrganizationId]: {
        organization,
        fiscalYears,
        activeFiscalYear,
        fyDatabase: {
          ...fyDatabase,
          [activeFiscalYear]: {
            employees,
            salarySetups,
            deductionSetups,
            taxReferences,
          },
        },
        googleSheetsConfig,
      },
    }));

    // 2. Load target organization's data
    const targetStore = orgDatabases[orgId];
    if (targetStore) {
      const targetOrg = targetStore.organization || DEFAULT_ORGANIZATION;
      const targetFys =
        targetStore.fiscalYears && targetStore.fiscalYears.length > 0
          ? targetStore.fiscalYears
          : DEFAULT_FY_LIST;
      const targetActiveFy = targetStore.activeFiscalYear || targetFys[0] || '२०८१/८२';
      const targetFyDb = targetStore.fyDatabase || {};
      const targetFyData = targetFyDb[targetActiveFy] || {
        employees: [],
        salarySetups: {},
        deductionSetups: {},
        taxReferences: DEFAULT_TAX_REFERENCES.map((tr) => ({ ...tr, fiscalYear: targetActiveFy })),
      };

      setOrganization(targetOrg);
      setFiscalYears(sortFiscalYearsDescending(targetFys));
      setActiveFiscalYearState(targetActiveFy);
      setFyDatabase(targetFyDb);
      setEmployees(targetFyData.employees || []);
      setSalarySetups(targetFyData.salarySetups || {});
      setDeductionSetups(targetFyData.deductionSetups || {});
      setTaxReferences(targetFyData.taxReferences || DEFAULT_TAX_REFERENCES);
      if (targetStore.googleSheetsConfig) {
        setGoogleSheetsConfig(targetStore.googleSheetsConfig);
      }
    }

    setActiveOrganizationIdState(orgId);
    const orgObj = organizations.find((o) => o.id === orgId);
    addToast('info', 'कार्यालय परिवर्तन', `${orgObj?.officeName || orgObj?.name || 'कार्यालय'} को डाटा सक्रिय गरियो।`);
  };

  const addOrganization = (
    orgData: Omit<OrganizationItem, 'id' | 'createdAt'>,
    initialAdmin?: {
      username: string;
      password?: string;
      fullName: string;
      email?: string;
      phone?: string;
      designation?: string;
      securityPin?: string;
    }
  ): { success: boolean; organization?: OrganizationItem; message: string } => {
    if (!hasPermission('MANAGE_USERS') && currentUser?.role !== 'SUPER_ADMIN') {
      const msg = 'नयाँ कार्यालय सिर्जना गर्न सुपर एडमिनको अधिकार आवश्यक पर्दछ।';
      addToast('error', 'अनाधिकृत कार्य', msg);
      return { success: false, message: msg };
    }

    const orgId = `org_${Date.now()}`;
    const newOrg: OrganizationItem = {
      ...orgData,
      id: orgId,
      createdAt: new Date().toLocaleDateString('ne-NP'),
      isActive: true,
    };

    const initialSheetsConfig: GoogleSheetsConfig = {
      ...DEFAULT_GOOGLE_SHEETS_CONFIG,
      webAppUrl: orgData.webAppUrl || googleSheetsConfig.webAppUrl || '',
      spreadsheetId: orgData.spreadsheetId || '',
      spreadsheetUrl: orgData.spreadsheetUrl || '',
      spreadsheetName: `stcs_${newOrg.officeName}`,
      autoSync: true,
      syncMode: 'auto',
    };

    const newOrgStore: OrganizationDataStore = {
      organization: { ...newOrg },
      fiscalYears: DEFAULT_FY_LIST,
      activeFiscalYear: '२०८१/८२',
      fyDatabase: {
        '२०८१/८२': {
          employees: [],
          salarySetups: {},
          deductionSetups: {},
          taxReferences: DEFAULT_TAX_REFERENCES,
        },
      },
      googleSheetsConfig: initialSheetsConfig,
    };

    setOrganizations((prev) => {
      const updated = [...prev, newOrg];
      saveCloudOrganizations(updated).catch(() => {});
      return updated;
    });
    setOrgDatabases((prev) => ({ ...prev, [orgId]: newOrgStore }));
    saveCloudOrganization(newOrg).catch((e) => console.warn('Cloud save org notice:', e));
    saveOrgSheetsConfig(orgId, initialSheetsConfig).catch(() => {});

    if (initialAdmin && initialAdmin.username.trim()) {
      const adminUser: User = {
        id: `user_${Date.now() + 1}`,
        username: initialAdmin.username.trim(),
        password: initialAdmin.password || 'admin123',
        fullName: initialAdmin.fullName || `${newOrg.officeName} प्रशासक`,
        role: 'ADMIN',
        organizationId: orgId,
        organizationName: newOrg.officeName,
        email: initialAdmin.email || newOrg.email,
        phone: initialAdmin.phone || newOrg.phone || newOrg.mobile,
        designation: initialAdmin.designation || 'कार्यालय प्रशासक / लेखा अधिकृत',
        securityPin: initialAdmin.securityPin || '1234',
        securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: 'नेपाल',
        isActive: true,
        mustChangePassword: true,
        isFirstLogin: true,
        createdAt: new Date().toLocaleDateString('ne-NP'),
      };
      setUsers((prev) => {
        const updatedUsers = [...prev, adminUser];
        saveCloudUsers(updatedUsers).catch((e) => console.warn('Cloud save user notice:', e));
        return updatedUsers;
      });
    }

    addToast(
      'success',
      'कार्यालय दर्ता भयो',
      `'${newOrg.officeName}' सफलतापूर्वक दर्ता गरियो${
        initialAdmin?.username ? ` र एडमिन प्रयोगकर्ता '${initialAdmin.username}' सिर्जना गरियो` : ''
      }।`
    );
    return { success: true, organization: newOrg, message: 'कार्यालय सफलतापूर्वक सिर्जना गरियो।' };
  };

  const updateOrganizationDetails = (orgId: string, orgData: Partial<OrganizationItem>): boolean => {
    if (!hasPermission('MANAGE_SETTINGS') && currentUser?.role !== 'SUPER_ADMIN') {
      addToast('error', 'अनाधिकृत कार्य', 'कार्यालय विवरण परिमार्जन गर्न सुपर एडमिन वा एडमिनको अधिकार आवश्यक छ।');
      return false;
    }

    setOrganizations((prev) => {
      const updated = prev.map((o) => (o.id === orgId ? { ...o, ...orgData } : o));
      saveCloudOrganizations(updated).catch(() => {});
      return updated;
    });

    const existingOrg = organizations.find((o) => o.id === orgId);
    if (existingOrg) {
      saveCloudOrganization({ ...existingOrg, ...orgData, id: orgId }).catch(() => {});
    }

    if (orgId === activeOrganizationId) {
      setOrganization((prev) => ({ ...prev, ...orgData }));
    }

    setOrgDatabases((prev) => {
      if (!prev[orgId]) return prev;
      return {
        ...prev,
        [orgId]: {
          ...prev[orgId],
          organization: { ...prev[orgId].organization, ...orgData },
        },
      };
    });

    addToast('success', 'कार्यालय विवरण अपडेट भयो', 'कार्यालयको विवरण सफलतापूर्वक सुरक्षित गरियो।');
    return true;
  };

  const deleteOrganization = (orgId: string): { success: boolean; message: string } => {
    if (currentUser?.role !== 'SUPER_ADMIN') {
      const msg = 'कार्यालय मेटाउन केवल सुपर एडमिनलाई मात्र अधिकार छ।';
      addToast('error', 'अनाधिकृत कार्य', msg);
      return { success: false, message: msg };
    }

    if (organizations.length <= 1) {
      const msg = 'प्रणालीमा कम्तिमा एउटा कार्यालय रहनु अनिवार्य छ।';
      addToast('error', 'मेटाउन नमिल्ने', msg);
      return { success: false, message: msg };
    }

    const orgToDelete = organizations.find((o) => o.id === orgId);
    if (!orgToDelete) {
      return { success: false, message: 'कार्यालय फेला परेन।' };
    }

    // If active org is being deleted, switch to another first
    if (activeOrganizationId === orgId) {
      const nextOrg = organizations.find((o) => o.id !== orgId);
      if (nextOrg) {
        setActiveOrganizationId(nextOrg.id);
      }
    }

    setOrganizations((prev) => {
      const filtered = prev.filter((o) => o.id !== orgId);
      saveCloudOrganizations(filtered).catch(() => {});
      return filtered;
    });
    deleteCloudOrganization(orgId).catch(() => {});
    setOrgDatabases((prev) => {
      const copy = { ...prev };
      delete copy[orgId];
      return copy;
    });

    addToast('info', 'कार्यालय हटाइयो', `'${orgToDelete.officeName}' प्रणालीबाट हटाइयो।`);
    return { success: true, message: 'कार्यालय हटाइयो।' };
  };

  const updateSupportContact = (contact: Partial<SystemSupportContact>) => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN') {
      addToast('error', 'अनाधिकृत कार्य', 'सहायता तथा सम्पर्क विवरण सम्पादन गर्न सुपर एडमिन वा एडमिनको अधिकार आवश्यक छ।');
      return;
    }
    const updated: SystemSupportContact = {
      phone: (contact.phone !== undefined ? contact.phone : supportContact.phone || '').trim(),
      email: (contact.email !== undefined ? contact.email : supportContact.email || '').trim(),
      whatsapp: (contact.whatsapp !== undefined ? contact.whatsapp : supportContact.whatsapp || '').trim(),
      supportNote: (contact.supportNote !== undefined ? contact.supportNote : supportContact.supportNote || '').trim(),
    };

    setSupportContact(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.SUPPORT_CONTACT, JSON.stringify(updated));
    } catch {}

    // Persist to Cloud SQL and Firestore across all devices
    saveCloudSupportContact(updated, currentUser?.username || 'admin').catch((err) => {
      console.warn('Could not save support contact to cloud:', err);
    });

    addToast('success', 'सम्पर्क विवरण सुरक्षित भयो', 'लगइन पृष्ठ तथा सहायता सन्देशको सम्पर्क विवरण सफलतापूर्वक सुरक्षित गरियो।');
  };

  const updateOrganization = (org: Partial<OrganizationSetup>) => {
    if (!hasPermission('MANAGE_SETTINGS')) {
      addToast('error', 'अनाधिकृत कार्य', 'कार्यालय विवरण परिवर्तन गर्न एडमिनको अधिकार आवश्यक पर्दछ।');
      return;
    }
    const updatedOrg = { ...organization, ...org };
    setOrganization(updatedOrg);
    updateOrganizationDetails(activeOrganizationId, org);

    // Auto-sync immediately to Google Sheets
    triggerAutoSyncOnSave({
      overrideOrganization: updatedOrg,
    });
  };

  const updateGoogleSheetsConfig = (cfg: Partial<GoogleSheetsConfig>) => {
    setGoogleSheetsConfig((prev) => ({ ...prev, ...cfg }));
  };

  // Connect Google Account via Firebase GoogleAuthProvider with Sheets & Drive scopes
  const connectGoogleAccount = async (): Promise<boolean> => {
    try {
      const res = await googleSignIn();
      if (res) {
        setIsGoogleAccountConnected(true);
        setGoogleConnectedEmail(res.user.email || undefined);

        let currentSpreadsheetId = googleSheetsConfig.spreadsheetId;
        let currentSpreadsheetUrl = googleSheetsConfig.spreadsheetUrl;

        // If no spreadsheet ID currently set and we have an access token, search existing spreadsheets in Drive first
        if (!currentSpreadsheetId && res.accessToken) {
          try {
            const existingSheet = await findAppSpreadsheetInDrive(res.accessToken);
            if (existingSheet) {
              currentSpreadsheetId = existingSheet.id;
              currentSpreadsheetUrl = existingSheet.url;
              addToast('info', 'गुगल सिट भेटियो', `तपाईंको ड्राइभमा उपलब्ध '${existingSheet.name}' फेला पारी पुनः लिंक गरियो।`);
            } else {
              const newSheet = await createAppSpreadsheet(
                res.accessToken,
                organization.officeName || organization.name,
                activeFiscalYear
              );
              currentSpreadsheetId = newSheet.id;
              currentSpreadsheetUrl = newSheet.url;
              addToast('success', 'गुगल सिट सिर्जना भयो', `नयाँ स्प्रेडसिट तयार भयो: ${newSheet.title}`);
            }
          } catch (driveErr: any) {
            console.warn('Drive search / create spreadsheet error:', driveErr);
          }
        }

        const updatedConfig: GoogleSheetsConfig = {
          ...googleSheetsConfig,
          connectedAccountEmail: res.user.email || undefined,
          spreadsheetId: currentSpreadsheetId || googleSheetsConfig.spreadsheetId,
          spreadsheetUrl: currentSpreadsheetUrl || googleSheetsConfig.spreadsheetUrl,
          authMethod: googleSheetsConfig.webAppUrl ? 'both' : 'oauth',
          autoSync: true,
          syncMode: 'auto',
        };

        setGoogleSheetsConfig(updatedConfig);

        // Persist connection to cloud for cross-device loading
        saveCloudAppConnection(
          updatedConfig,
          organization,
          activeOrganizationId,
          currentUser?.username || res.user.email || undefined
        ).catch(() => {});

        addToast(
          'success',
          'गुगल खाता जडान भयो',
          `${res.user.email || 'गुगल खाता'} सँग जडान सफल भयो। अब यो यन्त्र तथा अन्य यन्त्रहरूमा डाटा स्वतः लोड र सुरक्षित हुनेछ।`
        );

        // Auto-pull existing data from the Google Sheet into the app
        if (currentSpreadsheetId) {
          setIsAutoLoadingGoogleData(true);
          setTimeout(async () => {
            await syncWithGoogleSheets('pull', {
              isAutoSync: true,
              spreadsheetIdOverride: currentSpreadsheetId,
            });
            setIsAutoLoadingGoogleData(false);
          }, 350);
        }

        return true;
      }
      return false;
    } catch (err: any) {
      console.error('connectGoogleAccount error:', err);
      const errCode = err?.code || '';
      const errMsg = String(err?.message || '');

      const isAccessDenied403 =
        errMsg.includes('403') ||
        errMsg.includes('access_denied') ||
        errMsg.includes('inner-volt-dxfhk') ||
        errCode === 'auth/popup-closed-by-user';

      const isUnauthorizedDomain =
        errCode === 'auth/unauthorized-domain' ||
        errCode === 'origin_mismatch' ||
        errMsg.includes('auth/unauthorized-domain') ||
        errMsg.includes('unauthorized-domain') ||
        errMsg.includes('origin_mismatch') ||
        errMsg.includes('redirect_uri_mismatch');

      if (isAccessDenied403 || isUnauthorizedDomain) {
        setIsUnauthorizedDomainModalOpen(true);
        if (isAccessDenied403) {
          addToast(
            'error',
            'Google OAuth अनुमति (Error 403: access_denied)',
            'Google Cloud Console मा rbthapamgr09@gmail.com लाई "Test users" मा थप्नुहोस् वा Google Apps Script विधि प्रयोग गर्नुहोस्।'
          );
        } else {
          const host = typeof window !== 'undefined' ? window.location.hostname : 'होस्ट';
          addToast(
            'error',
            'होस्ट डोमेन / Origin अधिकृत गर्न आवश्यक',
            `तपाईंको होस्ट डोमेन (${host}) अधिकृत नभएकोले Error 400: origin_mismatch देखा पर्यो। स्क्रिनमा देखिएको समाधान हेर्नुहोस् वा Google Apps Script विधि प्रयोग गर्नुहोस्।`
          );
        }
        return false;
      }

      const msg = err?.message || 'गुगल खाता जडान हुन सकेन।';
      addToast('error', 'गुगल जडान असफल', msg);
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const res = await googleSignIn();
      if (res) {
        setIsGoogleAccountConnected(true);
        setGoogleConnectedEmail(res.user.email || undefined);

        // Look for existing user with this email or create/link one
        const emailLower = (res.user.email || '').toLowerCase();
        let matchedUser = users.find(
          (u) => (u.email && u.email.toLowerCase() === emailLower) || u.username.toLowerCase() === emailLower
        );

        if (!matchedUser) {
          // If superadmin or general user
          matchedUser = {
            id: `guser_${Date.now()}`,
            username: emailLower.split('@')[0] || 'google_user',
            fullName: res.user.displayName || 'Google User',
            email: res.user.email || undefined,
            role: users.length === 0 ? 'SUPER_ADMIN' : 'GENERAL_USER',
            organizationId: activeOrganizationId,
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toLocaleString('ne-NP'),
          };
          setUsers((prev) => [...prev, matchedUser!]);
        }

        setCurrentUser(matchedUser);
        setIsAuthenticated(true);
        try {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(matchedUser));
          localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
        } catch {}

        addToast('success', 'गुगल मार्फत लगइन सफल', `${matchedUser.fullName} का रूपमा प्रणालीमा प्रवेश भयो।`);
        setAuthModal((prev) => ({ ...prev, isOpen: false }));

        // Search Drive & Firestore for previously configured Google Sheet
        let sheetId = googleSheetsConfig.spreadsheetId;
        if (!sheetId) {
          try {
            const driveSheet = await findAppSpreadsheetInDrive(res.accessToken);
            if (driveSheet) {
              sheetId = driveSheet.id;
              setGoogleSheetsConfig((prev) => ({
                ...prev,
                spreadsheetId: driveSheet.id,
                spreadsheetUrl: driveSheet.url,
                connectedAccountEmail: res.user.email || undefined,
                autoSync: true,
                syncMode: 'auto',
              }));
            }
          } catch {}
        }

        // Pull existing data from Google Sheet into the app
        if (sheetId) {
          setIsAutoLoadingGoogleData(true);
          setTimeout(async () => {
            await syncWithGoogleSheets('pull', {
              isAutoSync: true,
              spreadsheetIdOverride: sheetId,
            });
            setIsAutoLoadingGoogleData(false);
          }, 300);
        }

        return true;
      }
      return false;
    } catch (err: any) {
      console.error('loginWithGoogle error:', err);
      const errCode = err?.code || '';
      const errMsg = String(err?.message || '');

      const isAccessDenied403 =
        errMsg.includes('403') ||
        errMsg.includes('access_denied') ||
        errMsg.includes('inner-volt-dxfhk') ||
        errCode === 'auth/popup-closed-by-user';

      const isUnauthorizedDomain =
        errCode === 'auth/unauthorized-domain' ||
        errCode === 'origin_mismatch' ||
        errMsg.includes('auth/unauthorized-domain') ||
        errMsg.includes('unauthorized-domain') ||
        errMsg.includes('origin_mismatch') ||
        errMsg.includes('redirect_uri_mismatch');

      if (isAccessDenied403 || isUnauthorizedDomain) {
        setIsUnauthorizedDomainModalOpen(true);
        if (isAccessDenied403) {
          addToast(
            'error',
            'Google OAuth अनुमति (Error 403: access_denied)',
            'Google Cloud Console मा rbthapamgr09@gmail.com लाई "Test users" मा थप्नुहोस् वा Google Apps Script विधि प्रयोग गर्नुहोस्।'
          );
        } else {
          const host = typeof window !== 'undefined' ? window.location.hostname : 'होस्ट';
          addToast(
            'error',
            'होस्ट डोमेन / Origin अधिकृत गर्न आवश्यक',
            `तपाईंको होस्ट डोमेन (${host}) अधिकृत नभएकोले Error 400: origin_mismatch देखा पर्यो। स्क्रिनमा देखिएको समाधान हेर्नुहोस्।`
          );
        }
        return false;
      }

      addToast('error', 'गुगल लगइन असफल', err?.message || 'गुगल खाता मार्फत लगइन हुन सकेन।');
      return false;
    }
  };

  const pullDataFromGoogle = async (isSilent = false): Promise<boolean> => {
    setIsAutoLoadingGoogleData(true);
    try {
      const res = await syncWithGoogleSheets('pull', { isAutoSync: isSilent });
      setIsAutoLoadingGoogleData(false);
      return res.success;
    } catch (e) {
      setIsAutoLoadingGoogleData(false);
      return false;
    }
  };

  const connectDirectAccount = async (
    email: string = 'rbthapamgr09@gmail.com',
    displayName: string = 'RB Thapa Magar'
  ): Promise<boolean> => {
    try {
      const res = directConnectAdminAccount(email, displayName);
      setIsGoogleAccountConnected(true);
      setGoogleConnectedEmail(res.user.email || email);

      const targetOffice = organization.officeName || organization.name || 'कार्यालय';
      const cleanOfficeName = targetOffice.trim().replace(/\s+/g, '_').toLowerCase();
      const defaultSpreadsheetName = `stcs_${cleanOfficeName}`;

      const updatedConfig: GoogleSheetsConfig = {
        ...googleSheetsConfig,
        connectedAccountEmail: res.user.email || email,
        spreadsheetName: googleSheetsConfig.spreadsheetName || defaultSpreadsheetName,
        authMethod: googleSheetsConfig.webAppUrl ? 'both' : 'oauth',
        autoSync: true,
        syncMode: 'auto',
      };

      setGoogleSheetsConfig(updatedConfig);

      // Persist connection to cloud for cross-device loading
      saveCloudAppConnection(
        updatedConfig,
        organization,
        activeOrganizationId,
        currentUser?.username || email
      ).catch(() => {});

      addToast(
        'success',
        'गुगल खाता सिधै जडान भयो',
        `${email} खाता सफलतापूर्वक जडान भयो। गुगल ड्राइभ फोल्डर र स्प्रेडसिट लिंक सक्रिय छ।`
      );

      return true;
    } catch (err: any) {
      addToast('error', 'जडान असफल', err?.message || 'खाता जडान गर्न सकिएन।');
      return false;
    }
  };

  const disconnectGoogleAccount = async (): Promise<void> => {
    await googleSignOut();
    try {
      localStorage.removeItem('nepal_payroll_connected_google_user');
    } catch {}
    setIsGoogleAccountConnected(false);
    setGoogleConnectedEmail(undefined);
    setGoogleSheetsConfig((prev) => ({
      ...prev,
      connectedAccountEmail: undefined,
      authMethod: prev.webAppUrl ? 'apps_script' : undefined,
    }));
    addToast('info', 'गुगल खाता विच्छेद भयो', 'गुगल खाता सफलतापूर्वक विच्छेद गरियो।');
  };

  const createGoogleSpreadsheetForApp = async (options?: {
    officeNameOverride?: string;
    orgIdOverride?: string;
    webAppUrlOverride?: string;
  }): Promise<{
    success: boolean;
    isScopeError?: boolean;
    spreadsheetId?: string;
    url?: string;
    message: string;
  }> => {
    const targetOrgId = options?.orgIdOverride || activeOrganizationId;
    const targetOrgObj = organizations.find((o) => o.id === targetOrgId) || organization;
    const officeName = options?.officeNameOverride || targetOrgObj.officeName || targetOrgObj.name || 'कार्यालय';
    const targetTitle = `stcs_${officeName}`;

    // 1. If webAppUrl is present, attempt creation via Google Apps Script Web App
    const rawWebAppUrl = (options?.webAppUrlOverride || googleSheetsConfig.webAppUrl || '').trim();
    if (rawWebAppUrl) {
      try {
        addToast('info', 'Apps Script मार्फत प्रयास...', 'Google Apps Script बाट सिट सिर्जना गरिँदै...');
        const res = await fetch(rawWebAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'createSpreadsheet',
            officeName: officeName,
            folderId: TARGET_GOOGLE_DRIVE_FOLDER_ID,
            fiscalYear: activeFiscalYear,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.success && data?.spreadsheetId) {
            const sheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`;
            const title = data.spreadsheetName || targetTitle;
            const updatedConfig: GoogleSheetsConfig = {
              ...googleSheetsConfig,
              webAppUrl: rawWebAppUrl,
              spreadsheetId: data.spreadsheetId,
              spreadsheetUrl: sheetUrl,
              spreadsheetName: title,
              autoSync: true,
              syncMode: 'auto',
            };
            setGoogleSheetsConfig(updatedConfig);
            saveOrgSheetsConfig(targetOrgId, updatedConfig).catch(() => {});
            saveCloudAppConnection(
              updatedConfig,
              targetOrgObj,
              targetOrgId,
              currentUser?.username || googleConnectedEmail || 'admin'
            ).catch(() => {});
            addToast('success', 'नयाँ सिट सिर्जना भयो', `Apps Script मार्फत '${title}' तयार भयो र लिंक गरियो।`);
            return {
              success: true,
              spreadsheetId: data.spreadsheetId,
              url: sheetUrl,
              message: 'नयाँ सिट सिर्जना र लिंक सम्पन्न',
            };
          }
        }
      } catch (scriptErr) {
        console.warn('Apps Script createSpreadsheet notice:', scriptErr);
      }
    }

    // 2. Try REST API if access token is available
    const token = await getAccessToken();
    if (token) {
      try {
        addToast('info', 'सिट तयार गरिँदै...', 'गुगल ड्राइभमा नयाँ स्प्रेडसिट सिर्जना हुँदैछ...');
        const sheet = await createAppSpreadsheet(
          token,
          officeName,
          activeFiscalYear
        );

        const updatedConfig: GoogleSheetsConfig = {
          ...googleSheetsConfig,
          webAppUrl: rawWebAppUrl || googleSheetsConfig.webAppUrl,
          spreadsheetId: sheet.id,
          spreadsheetUrl: sheet.url,
          spreadsheetName: sheet.title,
          autoSync: true,
          syncMode: 'auto',
        };

        setGoogleSheetsConfig(updatedConfig);
        saveOrgSheetsConfig(targetOrgId, updatedConfig).catch(() => {});
        saveCloudAppConnection(
          updatedConfig,
          targetOrgObj,
          targetOrgId,
          currentUser?.username || googleConnectedEmail || 'admin'
        ).catch(() => {});

        addToast('success', 'नयाँ सिट सिर्जना भयो', `गुगल ड्राइभमा '${sheet.title}' तयार भयो र लिंक गरियो।`);

        // Push all current data immediately
        await syncWithGoogleSheets('push', { spreadsheetIdOverride: sheet.id });

        return {
          success: true,
          spreadsheetId: sheet.id,
          url: sheet.url,
          message: 'नयाँ सिट सिर्जना र डाटा सिंक सम्पन्न',
        };
      } catch (err: any) {
        const msg = String(err?.message || 'गुगल सिट सिर्जना गर्न सकिएन');
        const isScope =
          msg.toLowerCase().includes('scope') ||
          msg.toLowerCase().includes('insufficient') ||
          msg.includes('अनुमति');

        if (isScope) {
          addToast(
            'warning',
            'सिट सिर्जना सहायक',
            'गुगल खातामा प्रत्यक्ष सिट सिर्जना OAuth अनुमति नभएकाले नयाँ सिट खोल्ने सहायक प्रयोग गर्नुहोस्।'
          );
          return { success: false, isScopeError: true, message: msg };
        }

        addToast('error', 'सिट सिर्जना असफल', msg);
        return { success: false, message: msg };
      }
    }

    addToast(
      'info',
      'नयाँ सिट खोल्नुहोस्',
      'गुगल ड्राइभमा नयाँ स्प्रेडसिट खोलेर लिंक गर्न सिट सिर्जना सहायक प्रयोग गर्नुहोस्।'
    );
    return {
      success: false,
      isScopeError: true,
      message: 'नयाँ सिट खोलेर लिंक गर्नुहोस्।',
    };
  };

  const syncWithGoogleSheets = async (
    mode: 'push' | 'pull' | 'all' = 'push',
    options?: {
      isAutoSync?: boolean;
      spreadsheetIdOverride?: string;
      overrideEmployees?: Employee[];
      overrideSalarySetups?: Record<string, SalarySetup>;
      overrideDeductionSetups?: Record<string, DeductionSetup>;
      overrideTaxReferences?: TaxReference[];
      overrideOrganization?: OrganizationSetup;
      overrideUsers?: User[];
    }
  ): Promise<{ success: boolean; message: string }> => {
    const targetEmployees = options?.overrideEmployees || employees;
    const targetSalarySetups = options?.overrideSalarySetups || salarySetups;
    const targetDeductionSetups = options?.overrideDeductionSetups || deductionSetups;
    const targetTaxReferences = options?.overrideTaxReferences || taxReferences;
    const targetOrg = options?.overrideOrganization || organization;
    const targetUsers = options?.overrideUsers || users;
    const targetSpreadsheetId = options?.spreadsheetIdOverride || googleSheetsConfig.spreadsheetId;
    let url = (googleSheetsConfig.webAppUrl || '').trim();

    const token = await getAccessToken();
    const hasDirectGoogle = Boolean(token && targetSpreadsheetId);
    const hasWebApp = Boolean(url);

    if (!hasDirectGoogle && !hasWebApp) {
      if (!options?.isAutoSync) {
        addToast(
          'warning',
          'गुगल सिट जडान आवश्यक',
          'पहिले "गुगल खाता जडान (Sign in with Google)" गर्नुहोस् वा Web App URL प्रविष्ट गर्नुहोस्।'
        );
      }
      return { success: false, message: 'Google Sheets link missing' };
    }

    setGoogleSheetsConfig((prev) => ({ ...prev, syncStatus: 'syncing', errorMessage: undefined }));

    // Prepare fresh calculated values for payload
    const calculatedResults: Record<string, AnnualTaxCalculationResult> = {};
    for (const emp of targetEmployees) {
      const sal = targetSalarySetups[emp.id] || {
        id: `sal_${emp.id}`,
        employeeId: emp.id,
        basicSalary: 35000,
        salaryMonthsCount: 12,
        gradeRate: 1100,
        currentGradeCount: 1,
        gradeIncreaseCount: 0,
        gradeIncreaseMonth: 'श्रावण',
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        remoteAllowance: 0,
        incentiveAllowance: 0,
        otherIncome: 0,
        updatedAt: new Date().toISOString(),
      };
      const ded = targetDeductionSetups[emp.id] || {
        id: `ded_${emp.id}`,
        employeeId: emp.id,
        loanDeduction: 0,
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        otherDeduction: 0,
        updatedAt: new Date().toISOString(),
      };
      const taxRef = getActiveTaxReference(emp.filingType);
      calculatedResults[emp.id] = calculateAnnualSalaryAndTax(emp, sal, ded, taxRef);
    }

    const monthlyItems: MonthlySalaryItem[] = targetEmployees.map((emp) => {
      const sal = targetSalarySetups[emp.id] || {
        id: `sal_${emp.id}`,
        employeeId: emp.id,
        basicSalary: 35000,
        salaryMonthsCount: 12,
        gradeRate: 1100,
        currentGradeCount: 1,
        gradeIncreaseCount: 0,
        gradeIncreaseMonth: 'श्रावण',
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        remoteAllowance: 0,
        incentiveAllowance: 0,
        otherIncome: 0,
        updatedAt: new Date().toISOString(),
      };
      const ded = targetDeductionSetups[emp.id] || {
        id: `ded_${emp.id}`,
        employeeId: emp.id,
        loanDeduction: 0,
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        otherDeduction: 0,
        updatedAt: new Date().toISOString(),
      };
      const annualRes = calculatedResults[emp.id];
      return calculateMonthlySalaryItem(emp, sal, ded, annualRes, activeMonth);
    });

    // Sanitize organization images & normalize Google Drive URLs safely
    const sanitizedOrg = { ...targetOrg };
    if (sanitizedOrg.logoUrl) {
      sanitizedOrg.logoUrl = normalizeLogoUrl(sanitizedOrg.logoUrl);
    }

    const payload: AppSyncDataPayload = {
      fiscalYear: activeFiscalYear,
      month: activeMonth,
      organization: sanitizedOrg,
      employees: targetEmployees,
      salarySetups: targetSalarySetups,
      deductionSetups: targetDeductionSetups,
      taxReferences: targetTaxReferences,
      users: targetUsers,
      calculatedResults,
      monthlyItems,
      timestamp: new Date().toISOString(),
    };

    let directSyncSuccess = false;
    let webAppSyncSuccess = false;
    let successMessage = '';
    let errorMessage = '';

    // 1. Direct Google Sheets API Sync via OAuth
    if (hasDirectGoogle && token && targetSpreadsheetId) {
      try {
        if (mode === 'pull') {
          const directPullRes = await pullDataFromGoogleSpreadsheet(token, targetSpreadsheetId);
          if (directPullRes.success && directPullRes.data) {
            const pullData = directPullRes.data;
            if (pullData.organization && typeof pullData.organization === 'object') {
              if (pullData.organization.logoUrl) {
                pullData.organization.logoUrl = normalizeLogoUrl(pullData.organization.logoUrl);
              }
              setOrganization((prev) => ({
                ...prev,
                ...pullData.organization,
              }));
              if (pullData.organization.officeName || pullData.organization.name) {
                updateOrganizationDetails(activeOrganizationId, pullData.organization);
              }
            }
            if (Array.isArray(pullData.employees) && pullData.employees.length > 0) {
              setEmployees(pullData.employees);
            }
            if (pullData.salarySetups && Object.keys(pullData.salarySetups).length > 0) {
              setSalarySetups(pullData.salarySetups);
            }
            if (pullData.deductionSetups && Object.keys(pullData.deductionSetups).length > 0) {
              setDeductionSetups(pullData.deductionSetups);
            }
            if (Array.isArray(pullData.taxReferences) && pullData.taxReferences.length > 0) {
              setTaxReferences(pullData.taxReferences);
            }
            if (Array.isArray(pullData.users) && pullData.users.length > 0) {
              setUsers((prev) => {
                const ignoredIds = ['user_rbthapa_mgr', 'user_rbthapa_mgf'];
                const ignoredUsernames = ['rbthapamgr09', 'rbthapamgf09'];
                const validIncoming = pullData.users!.filter(
                  (u) =>
                    !ignoredIds.includes(u.id) &&
                    !ignoredUsernames.includes((u.username || '').toLowerCase())
                );
                const merged = [...prev];
                for (const u of validIncoming) {
                  const idx = merged.findIndex(
                    (m) => m.id === u.id || (m.username && u.username && m.username.toLowerCase() === u.username.toLowerCase())
                  );
                  if (idx >= 0) {
                    merged[idx] = { ...merged[idx], ...u };
                  } else {
                    merged.push(u);
                  }
                }
                try {
                  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
            directSyncSuccess = true;
            successMessage = directPullRes.message || 'गुगल सिट्सबाट डाटा प्राप्त भयो।';
          } else {
            errorMessage = directPullRes.message || 'गुगल सिटबाट डाटा पढ्न सकिएन';
          }
        } else {
          const directRes = await pushDataToGoogleSpreadsheet(token, targetSpreadsheetId, payload);
          if (directRes.success) {
            directSyncSuccess = true;
            successMessage = directRes.message;
          }
        }
      } catch (directErr: any) {
        console.error('Direct Google Sheets sync error:', directErr);
        errorMessage = directErr?.message || 'Google Sheets API त्रुटि';
      }
    }

    // 2. Apps Script Web App Sync (if configured)
    if (hasWebApp) {
      try {
        if (url.includes('script.google.com/macros/s/')) {
          if (url.endsWith('/edit') || url.endsWith('/dev')) {
            url = url.replace(/\/(edit|dev)(\?.*)?$/, '/exec');
          } else if (!url.endsWith('/exec') && !url.includes('/exec?')) {
            url = url.replace(/\/?$/, '/exec');
          }
        }

        const webAppPayload = {
          action: mode,
          ...payload,
        };

        let response: Response | null = null;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(webAppPayload),
            redirect: 'follow',
          });
        } catch (postFetchErr) {
          // If browser CORS blocked the redirect during push, execute via no-cors fallback
          if (mode === 'push') {
            await fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(webAppPayload),
            });
            webAppSyncSuccess = true;
            if (!successMessage) {
              successMessage = 'Web App मार्फत गुगल सिट्समा डाटा सफलतापूर्वक पठाइयो।';
            }
          } else {
            throw postFetchErr;
          }
        }

        if (response && (response.ok || response.status === 0)) {
          let resData: any = {};
          try {
            const txt = await response.text();
            if (txt) resData = JSON.parse(txt);
          } catch {
            resData = { success: true };
          }

          if (mode === 'pull' && resData.data) {
            if (resData.data.organization && typeof resData.data.organization === 'object') {
              if (resData.data.organization.logoUrl) {
                resData.data.organization.logoUrl = normalizeLogoUrl(resData.data.organization.logoUrl);
              }
              setOrganization((prev) => ({
                ...prev,
                ...resData.data.organization,
              }));
              if (resData.data.organization.officeName || resData.data.organization.name) {
                updateOrganizationDetails(activeOrganizationId, resData.data.organization);
              }
            }
            if (Array.isArray(resData.data.employees) && resData.data.employees.length > 0) {
              setEmployees(resData.data.employees);
            }
            if (resData.data.salarySetups) {
              setSalarySetups(resData.data.salarySetups);
            }
            if (resData.data.deductionSetups) {
              setDeductionSetups(resData.data.deductionSetups);
            }
            if (Array.isArray(resData.data.taxReferences) && resData.data.taxReferences.length > 0) {
              setTaxReferences(resData.data.taxReferences);
            }
            if (Array.isArray(resData.data.users) && resData.data.users.length > 0) {
              setUsers((prev) => {
                const ignoredIds = ['user_rbthapa_mgr', 'user_rbthapa_mgf'];
                const ignoredUsernames = ['rbthapamgr09', 'rbthapamgf09'];
                const validIncoming = resData.data.users.filter(
                  (u: any) =>
                    !ignoredIds.includes(u.id) &&
                    !ignoredUsernames.includes((u.username || '').toLowerCase())
                );
                const merged = [...prev];
                for (const u of validIncoming) {
                  const idx = merged.findIndex(
                    (m) => m.id === u.id || (m.username && u.username && m.username.toLowerCase() === u.username.toLowerCase())
                  );
                  if (idx >= 0) {
                    merged[idx] = { ...merged[idx], ...u };
                  } else {
                    merged.push(u);
                  }
                }
                try {
                  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
          }

          webAppSyncSuccess = true;
          if (!successMessage) {
            successMessage = resData.message || 'Web App मार्फत गुगल सिट्समा सिंक सफल भयो।';
          }
        }
      } catch (webErr: any) {
        console.error('Web App sync error:', webErr);
        if (!errorMessage) {
          errorMessage = webErr?.message || 'Web App मार्फत जडान हुन सकेन';
        }
      }
    }

    const overallSuccess = directSyncSuccess || webAppSyncSuccess;

    if (overallSuccess) {
      setGoogleSheetsConfig((prev) => ({
        ...prev,
        syncStatus: 'success',
        lastSyncTime: getKathmanduTimestamp(),
        errorMessage: undefined,
      }));

      if (options?.isAutoSync) {
        addToast(
          'success',
          'गुगल सिटमा स्वतः सुरक्षित भयो',
          'फाराममा सुरक्षित गरिएको डाटा लिंक भएको गुगल सिटमा तुरुन्तै सुरक्षित (Store/Sync) भयो।'
        );
      } else {
        addToast('success', 'सिंक सफल', successMessage || 'गुगल सिट्ससँग डाटा सफलतापूर्वक सिंक भयो।');
      }

      return { success: true, message: successMessage || 'डाटा सिंक सम्पन्न भयो।' };
    } else {
      setGoogleSheetsConfig((prev) => ({
        ...prev,
        syncStatus: 'error',
        errorMessage: errorMessage || 'सिंक असफल भयो',
      }));

      if (!options?.isAutoSync) {
        addToast('error', 'सिंक असफल', errorMessage || 'गुगल सिट्समा सुरक्षित गर्न सकिएन।');
      }
      return { success: false, message: errorMessage || 'सिंक असफल भयो' };
    }
  };

  // Immediate Auto-Sync trigger when user saves any data in the app
  const triggerAutoSyncOnSave = async (overrides?: {
    overrideEmployees?: Employee[];
    overrideSalarySetups?: Record<string, SalarySetup>;
    overrideDeductionSetups?: Record<string, DeductionSetup>;
    overrideTaxReferences?: TaxReference[];
    overrideOrganization?: OrganizationSetup;
    overrideUsers?: User[];
  }) => {
    // Only proceed if autoSync is not explicitly disabled
    if (googleSheetsConfig.autoSync === false) return;

    const token = await getAccessToken();
    const hasDirectGoogle = Boolean(token && googleSheetsConfig.spreadsheetId);
    const hasWebApp = Boolean((googleSheetsConfig.webAppUrl || '').trim());

    if (!hasDirectGoogle && !hasWebApp) {
      // Nothing is connected yet; no sync destination
      return;
    }

    try {
      await syncWithGoogleSheets('push', {
        isAutoSync: true,
        ...overrides,
      });
    } catch (err) {
      console.warn('Auto sync on save error:', err);
    }
  };

  // Automated Google Sheets setup & sync upon successful Admin login
  const handlePostLoginSheetsAutomation = useCallback(
    async (loggedUser: User) => {
      try {
        const userOrgId = loggedUser.organizationId;
        if (!userOrgId || userOrgId === 'all') {
          const cloudConn = await getCloudAppConnection(loggedUser.username || loggedUser.id);
          if (cloudConn && (cloudConn.webAppUrl || cloudConn.spreadsheetId)) {
            setGoogleSheetsConfig((prev) => ({
              ...prev,
              webAppUrl: cloudConn.webAppUrl || prev.webAppUrl,
              spreadsheetId: cloudConn.spreadsheetId || prev.spreadsheetId,
              spreadsheetUrl: cloudConn.spreadsheetUrl || prev.spreadsheetUrl,
              autoSync: cloudConn.autoSync ?? true,
            }));
          }
          return;
        }

        const orgDetails = organizations.find((o) => o.id === userOrgId);
        const officeName = orgDetails?.officeName || loggedUser.organizationName || 'कार्यालय';
        const orgConfig = await getOrgSheetsConfig(userOrgId);
        const userCloudConn = await getCloudAppConnection(loggedUser.username || loggedUser.id);

        let currentConfig: GoogleSheetsConfig = {
          ...googleSheetsConfig,
          webAppUrl:
            orgConfig?.webAppUrl ||
            userCloudConn?.webAppUrl ||
            orgDetails?.webAppUrl ||
            googleSheetsConfig.webAppUrl ||
            '',
          spreadsheetId:
            orgConfig?.spreadsheetId ||
            userCloudConn?.spreadsheetId ||
            orgDetails?.spreadsheetId ||
            '',
          spreadsheetUrl:
            orgConfig?.spreadsheetUrl ||
            userCloudConn?.spreadsheetUrl ||
            orgDetails?.spreadsheetUrl ||
            '',
          spreadsheetName: orgConfig?.spreadsheetName || `stcs_${officeName}`,
          autoSync: true,
          syncMode: 'auto',
        };

        // If spreadsheetId is not yet created, automate spreadsheet creation
        if (!currentConfig.spreadsheetId && currentConfig.webAppUrl) {
          addToast(
            'info',
            'सिट स्वचालित सेटअप हुँदैछ',
            `'stcs_${officeName}' गुगल ड्राइभमा सिर्जना तथा जडान गरिँदैछ...`
          );

          const created = await createGoogleSpreadsheetForApp({
            officeNameOverride: officeName,
            orgIdOverride: userOrgId,
            webAppUrlOverride: currentConfig.webAppUrl,
          });

          if (created.success && created.spreadsheetId) {
            currentConfig = {
              ...currentConfig,
              spreadsheetId: created.spreadsheetId,
              spreadsheetUrl:
                created.url ||
                `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
              spreadsheetName: `stcs_${officeName}`,
            };
            setGoogleSheetsConfig(currentConfig);
            await saveOrgSheetsConfig(userOrgId, currentConfig);
            updateOrganizationDetails(userOrgId, {
              spreadsheetId: currentConfig.spreadsheetId,
              spreadsheetUrl: currentConfig.spreadsheetUrl,
              webAppUrl: currentConfig.webAppUrl,
            });
          }
        } else {
          setGoogleSheetsConfig(currentConfig);
        }

        // Connection test and sync
        if (currentConfig.webAppUrl || currentConfig.spreadsheetId) {
          setIsAutoLoadingGoogleData(true);
          if (currentConfig.webAppUrl) {
            try {
              const testRes = await fetch(
                `${currentConfig.webAppUrl}${
                  currentConfig.webAppUrl.includes('?') ? '&' : '?'
                }action=status&spreadsheetId=${encodeURIComponent(
                  currentConfig.spreadsheetId || ''
                )}&_t=${Date.now()}`,
                {
                  method: 'GET',
                  redirect: 'follow',
                }
              );
              if (testRes.ok) {
                setGoogleSheetsConfig((prev) => ({
                  ...prev,
                  syncStatus: 'success',
                  errorMessage: undefined,
                }));
              }
            } catch (testErr) {
              console.warn('Silent connection test notice:', testErr);
            }
          }

          const pullRes = await syncWithGoogleSheets('pull', {
            isAutoSync: true,
            spreadsheetIdOverride: currentConfig.spreadsheetId,
          });

          if (!pullRes.success) {
            await syncWithGoogleSheets('push', {
              isAutoSync: true,
              spreadsheetIdOverride: currentConfig.spreadsheetId,
            });
          }
          setIsAutoLoadingGoogleData(false);
        }
      } catch (automationErr) {
        console.warn('Post login sheets automation error:', automationErr);
        setIsAutoLoadingGoogleData(false);
      }
    },
    [
      organizations,
      googleSheetsConfig,
      createGoogleSpreadsheetForApp,
      syncWithGoogleSheets,
      updateOrganizationDetails,
      addToast,
    ]
  );

  useEffect(() => {
    postLoginSheetsAutomationRef.current = handlePostLoginSheetsAutomation;
  }, [handlePostLoginSheetsAutomation]);

  const resetToDemoData = () => {
    showConfirmation({
      title: 'डेमो डाटा रिसेट पुष्टि',
      message: 'के तपाईं सबै विवरणलाई आधिकारिक डेमो डाटा (८ जना कर्मचारी, २०८१/८२ कर स्ल्याब) मा रिसेट गर्न चाहनुहुन्छ?',
      confirmText: 'रिसेट गर्नुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        const demoData: FiscalYearData = {
          employees: DEMO_EMPLOYEES,
          salarySetups: DEMO_SALARY_SETUPS,
          deductionSetups: DEMO_DEDUCTION_SETUPS,
          taxReferences: DEFAULT_TAX_REFERENCES,
        };

        setEmployees(DEMO_EMPLOYEES);
        setSalarySetups(DEMO_SALARY_SETUPS);
        setDeductionSetups(DEMO_DEDUCTION_SETUPS);
        setTaxReferences(DEFAULT_TAX_REFERENCES);
        setOrganization(DEFAULT_ORGANIZATION);
        setIsDemoData(true);
        setActiveFiscalYearState('२०८१/८२');

        setFyDatabase((prev) => ({
          ...prev,
          '२०८१/८२': demoData,
        }));

        hideConfirmation();
        addToast('success', 'डेमो डाटा लोड भयो', '८ जना कर्मचारी सहित मानक डाटा सफलतासाथ लोड भयो।');
      },
    });
  };

  const clearAllData = () => {
    showConfirmation({
      title: 'सम्पूर्ण प्रणाली डाटा खाली गर्ने पुष्टि',
      message: 'के तपाईं सबै कार्यालय/संस्था, प्रयोगकर्ता, आर्थिक वर्ष, कर्मचारी तथा सेटिङ्स विवरण पूर्ण रूपमा मेटाउन निश्चित हुनुहुन्छ? यो कार्य फिर्ता गर्न सकिने छैन।',
      isDangerous: true,
      confirmText: 'सबै मेटाउनुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        // Reset active scoped states
        setEmployees([]);
        setSalarySetups({});
        setDeductionSetups({});
        setTaxReferences(DEFAULT_TAX_REFERENCES);
        setOrganization(DEFAULT_ORGANIZATION);
        
        // Reset multi-tenancy states
        setOrganizations(DEFAULT_ORGANIZATIONS);
        setActiveOrganizationIdState('org_default');
        
        const freshDb: Record<string, FiscalYearData> = {
          '२०८१/८२': {
            employees: [],
            salarySetups: {},
            deductionSetups: {},
            taxReferences: DEFAULT_TAX_REFERENCES,
          },
        };
        setFyDatabase(freshDb);
        
        setOrgDatabases({
          org_default: {
            organization: DEFAULT_ORGANIZATION,
            fiscalYears: DEFAULT_FISCAL_YEARS_LIST,
            activeFiscalYear: '२०८१/८२',
            fyDatabase: freshDb,
            googleSheetsConfig: DEFAULT_GOOGLE_SHEETS_CONFIG,
          }
        });

        // Reset users back to initial default users
        setUsers(DEFAULT_USERS);
        setIsDemoData(false);
        
        // Manually clear all relevant localStorage items to ensure no stale browser data persists
        try {
          localStorage.removeItem(STORAGE_KEYS.ORGANIZATIONS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_ORG_ID);
          localStorage.removeItem(STORAGE_KEYS.ORG_DATABASES);
          localStorage.removeItem(STORAGE_KEYS.ORG);
          localStorage.removeItem(STORAGE_KEYS.FY_DATABASE);
          localStorage.removeItem(STORAGE_KEYS.FISCAL_YEARS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_FY);
          localStorage.removeItem(STORAGE_KEYS.USERS);
        } catch (e) {
          console.error('Failed to clear some localStorage items', e);
        }

        hideConfirmation();
        addToast('warning', 'प्रणाली पूर्ण रूपमा रिसेट गरियो', 'सम्पूर्ण कार्यालय/संस्था तथा डाटा मेटाइएको छ। तपाईं नयाँ कार्यालय र कर्मचारी थप्न सक्नुहुन्छ।');
      },
    });
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        navigationHistory,
        historyIndex,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        previousTab,
        getTabLabel,
        getTabShortLabel,
        activeFiscalYear,
        setActiveFiscalYear,
        activeMonth,
        setActiveMonth,
        useDevanagariNumerals,
        setUseDevanagariNumerals,
        organizations,
        activeOrganizationId,
        activeOrganization,
        setActiveOrganizationId,
        addOrganization,
        updateOrganizationDetails,
        deleteOrganization,
        supportContact,
        updateSupportContact,
        fiscalYears,
        fyDatabase,
        createFiscalYear,
        updateFiscalYear,
        deleteFiscalYear,
        carryForwardFiscalYear,
        clearFiscalYearData,
        isAuthenticated,
        users,
        currentUser,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        changeUserRole,
        changeUserPassword,
        completeFirstTimePasswordChange,
        resetPassword,
        hasPermission,
        authModal,
        openLoginModal,
        openResetPasswordModal,
        closeAuthModal,
        employees,
        salarySetups,
        deductionSetups,
        taxReferences,
        organization,
        googleSheetsConfig,
        updateGoogleSheetsConfig,
        syncWithGoogleSheets,
        isGoogleAccountConnected,
        googleConnectedEmail,
        connectGoogleAccount,
        connectDirectAccount,
        disconnectGoogleAccount,
        createGoogleSpreadsheetForApp,
        triggerAutoSyncOnSave,
        isAutoLoadingGoogleData,
        pullDataFromGoogle,
        loginWithGoogle,
        isUnauthorizedDomainModalOpen,
        openUnauthorizedDomainModal,
        closeUnauthorizedDomainModal,
        annualTaxResults,
        monthlySalaryItems,
        dashboardMetrics,
        addEmployee,
        updateEmployee,
        bulkImportEmployees,
        deleteEmployee,
        getEmployeeById,
        updateSalarySetup,
        updateDeductionSetup,
        saveTaxReference,
        deleteTaxReference,
        getActiveTaxReference,
        updateOrganization,
        auditEmployeeId,
        setAuditEmployeeId,
        toasts,
        addToast,
        removeToast,
        confirmationDialog,
        showConfirmation,
        hideConfirmation,
        resetToDemoData,
        clearAllData,
        isDemoData,
        isPrivacyMasked,
        togglePrivacyMasking,
        setIsPrivacyMasked,
        isScreenLocked,
        lockScreen,
        unlockScreen,
        inactivityTimeoutMinutes,
        setInactivityTimeoutMinutes,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
