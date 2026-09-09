import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Settings,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  Hash,
  FileJson,
  Layers,
  ArrowRightLeft,
  Plus,
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  Edit2,
  CheckCircle,
  XCircle,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  LogIn,
  CheckCircle2,
  X,
  Phone,
  Mail,
  MessageSquare,
  Building2,
  Building,
  MapPin,
  ExternalLink,
  PhoneCall,
  Globe,
  Save,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserRole, OrganizationItem, SystemSupportContact } from '../../types';
import { sortFiscalYearsDescending } from '../../utils/nepaliCalendar';
import {
  NEPAL_PROVINCES,
  getDistrictsByProvince,
  getLocalLevelsByDistrict
} from '../../data/nepalAdministrativeData';
import { SecuritySettingsPanel } from './SecuritySettingsPanel';

export const SettingsView: React.FC = () => {
  const {
    resetToDemoData,
    clearAllData,
    clearFiscalYearData,
    useDevanagariNumerals,
    setUseDevanagariNumerals,
    activeFiscalYear,
    setActiveFiscalYear,
    fiscalYears,
    createFiscalYear,
    updateFiscalYear,
    carryForwardFiscalYear,
    showConfirmation,
    hideConfirmation,
    addToast,
    employees,
    organization,
    salarySetups,
    deductionSetups,
    taxReferences,
    currentUser,
    users,
    login,
    addUser,
    updateUser,
    deleteUser,
    changeUserRole,
    changeUserPassword,
    hasPermission,
    openLoginModal,
    // Multi-tenancy & Support Contact
    organizations,
    activeOrganizationId,
    activeOrganization,
    setActiveOrganizationId,
    addOrganization,
    updateOrganizationDetails,
    deleteOrganization,
    toggleOrganizationActive,
    supportContact,
    updateSupportContact,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'organizations' | 'users' | 'security' | 'backup' | 'support'>('system');

  // Support Contact Form State
  const [supportForm, setSupportForm] = useState<SystemSupportContact>({
    phone: supportContact?.phone || '',
    email: supportContact?.email || '',
    whatsapp: supportContact?.whatsapp || '',
    supportNote: supportContact?.supportNote || '',
  });

  useEffect(() => {
    if (supportContact) {
      setSupportForm({
        phone: supportContact.phone || '',
        email: supportContact.email || '',
        whatsapp: supportContact.whatsapp || '',
        supportNote: supportContact.supportNote || '',
      });
    }
  }, [supportContact]);

  const handleSaveSupportContact = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupportContact(supportForm);
  };

  // Organization Management State
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationItem | null>(null);
  const [orgFormData, setOrgFormData] = useState({
    name: 'नेपाल सरकार',
    officeName: '',
    ministryName: '',
    departmentName: '',
    parentBodyName: '',
    province: 'गण्डकी प्रदेश',
    district: '',
    localLevel: '',
    address: '',
    phone: '',
    mobile: '',
    email: '',
    whatsapp: '',
    pan: '',
    registrationNo: '',
    // Initial Admin User creation fields (Optional during org creation)
    createAdminUser: false,
    adminUsername: '',
    adminPassword: '',
    adminFullName: '',
    adminEmail: '',
    adminPhone: '',
    adminDesignation: 'कार्यालय प्रशासक / लेखा अधिकृत',
    adminSecurityPin: '1234',
  });

  const handleOpenAddOrg = () => {
    setEditingOrg(null);
    setOrgFormData({
      name: 'नेपाल सरकार',
      officeName: '',
      ministryName: '',
      departmentName: '',
      parentBodyName: '',
      province: 'गण्डकी प्रदेश',
      district: 'कास्की',
      localLevel: 'पोखरा महानगरपालिका',
      address: '',
      phone: '',
      mobile: '',
      email: '',
      whatsapp: '',
      pan: '',
      registrationNo: '',
      createAdminUser: false,
      adminUsername: '',
      adminPassword: 'admin' + Math.floor(100 + Math.random() * 900),
      adminFullName: '',
      adminEmail: '',
      adminPhone: '',
      adminDesignation: 'कार्यालय प्रशासक / लेखा अधिकृत',
      adminSecurityPin: '1234',
    });
    setShowOrgModal(true);
  };

  const handleOpenEditOrg = (org: OrganizationItem) => {
    setEditingOrg(org);
    setOrgFormData({
      name: org.name || 'नेपाल सरकार',
      officeName: org.officeName || '',
      ministryName: org.ministryName || '',
      departmentName: org.departmentName || '',
      parentBodyName: org.parentBodyName || '',
      province: org.province || '',
      district: org.district || '',
      localLevel: org.localLevel || '',
      address: org.address || '',
      phone: org.phone || '',
      mobile: org.mobile || '',
      email: org.email || '',
      whatsapp: org.whatsapp || '',
      pan: org.pan || '',
      registrationNo: org.registrationNo || '',
      createAdminUser: false,
      adminUsername: '',
      adminPassword: '',
      adminFullName: '',
      adminEmail: '',
      adminPhone: '',
      adminDesignation: '',
      adminSecurityPin: '1234',
    });
    setShowOrgModal(true);
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgFormData.officeName.trim()) {
      addToast('error', 'फाराम अधुरो', 'कृपया कार्यालयको नाम अनिवार्य प्रविष्ट गर्नुहोस्।');
      return;
    }

    if (editingOrg) {
      updateOrganizationDetails(editingOrg.id, {
        name: orgFormData.name,
        officeName: orgFormData.officeName,
        ministryName: orgFormData.ministryName,
        departmentName: orgFormData.departmentName,
        parentBodyName: orgFormData.parentBodyName,
        province: orgFormData.province,
        district: orgFormData.district,
        localLevel: orgFormData.localLevel,
        address: orgFormData.address,
        phone: orgFormData.phone,
        mobile: orgFormData.mobile,
        email: orgFormData.email,
        whatsapp: orgFormData.whatsapp,
        pan: orgFormData.pan,
        registrationNo: orgFormData.registrationNo,
      });
      setShowOrgModal(false);
    } else {
      let initialAdmin = undefined;
      if (orgFormData.createAdminUser && orgFormData.adminUsername.trim()) {
        initialAdmin = {
          username: orgFormData.adminUsername.trim(),
          password: orgFormData.adminPassword || 'admin123',
          fullName: orgFormData.adminFullName || `${orgFormData.officeName} प्रशासक`,
          email: orgFormData.adminEmail || orgFormData.email,
          phone: orgFormData.adminPhone || orgFormData.phone || orgFormData.mobile,
          designation: orgFormData.adminDesignation,
          securityPin: orgFormData.adminSecurityPin || '1234',
        };
      }

      const res = addOrganization(
        {
          name: orgFormData.name || orgFormData.officeName,
          officeName: orgFormData.officeName,
          ministryName: orgFormData.ministryName,
          departmentName: orgFormData.departmentName,
          parentBodyName: orgFormData.parentBodyName,
          province: orgFormData.province,
          district: orgFormData.district,
          localLevel: orgFormData.localLevel,
          address: orgFormData.address,
          phone: orgFormData.phone,
          mobile: orgFormData.mobile,
          email: orgFormData.email,
          whatsapp: orgFormData.whatsapp,
          pan: orgFormData.pan,
          registrationNo: orgFormData.registrationNo,
          isActive: true,
        },
        initialAdmin
      );

      if (res.success) {
        setShowOrgModal(false);
      }
    }
  };

  const handleDeleteOrg = (orgId: string, orgName: string) => {
    showConfirmation({
      title: 'कार्यालय मेटाउने पुष्टि',
      message: `के तपाईं '${orgName}' र यस अन्तर्गतका सम्पूर्ण डाटा मेटाउन निश्चित हुनुहुन्छ? यो कार्य फिर्ता गर्न सकिने छैन।`,
      isDangerous: true,
      confirmText: 'मेटाउनुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        const res = deleteOrganization(orgId);
        if (res.success) {
          hideConfirmation();
        }
      },
    });
  };

  // New Fiscal Year Modal State
  const [showNewFyModal, setShowNewFyModal] = useState(false);
  const [newFyName, setNewFyName] = useState('');
  const [copyFromFy, setCopyFromFy] = useState(activeFiscalYear);
  const [shouldCopyData, setShouldCopyData] = useState(true);

  // Edit Fiscal Year Modal State
  const [showEditFyModal, setShowEditFyModal] = useState(false);
  const [editingFy, setEditingFy] = useState('');
  const [editFyName, setEditFyName] = useState('');

  // Carry Forward State
  const [sourceFy, setSourceFy] = useState(activeFiscalYear);
  const [targetFy, setTargetFy] = useState('');
  const [carryEmployees, setCarryEmployees] = useState(true);
  const [carryPromoteGrades, setCarryPromoteGrades] = useState(true);
  const [carryDeductions, setCarryDeductions] = useState(true);
  const [carryTaxSlabs, setCarryTaxSlabs] = useState(true);

  // User Management Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserFormPassword, setShowUserFormPassword] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'ACCOUNTANT' as UserRole,
    organizationId: activeOrganizationId || (organizations[0]?.id ?? 'default_org'),
    email: '',
    phone: '',
    designation: '',
    securityPin: '1234',
    securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
    securityAnswer: 'नेपाल',
    mustChangePassword: true,
    isActive: true,
  });

  // Dedicated Password Reset Modal State (for Admin in Settings)
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [resetMustChangePassword, setResetMustChangePassword] = useState(true);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Filter users based on currentUser role: Admin cannot view or manage SUPER_ADMIN profile
  const visibleUsers = useMemo(() => {
    return users.filter((u) => {
      if (currentUser?.role === 'ADMIN') {
        return u.role !== 'SUPER_ADMIN';
      }
      return true;
    });
  }, [users, currentUser?.role]);

  // Filter organizations based on currentUser role: only show owned office for non-superadmin
  const visibleOrganizations = useMemo(() => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      return organizations;
    }
    const userOrgId = currentUser?.organizationId || 'default_org';
    return organizations.filter((org) => org.id === userOrgId);
  }, [organizations, currentUser]);

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      password: 'user123',
      fullName: '',
      role: 'ACCOUNTANT',
      organizationId: activeOrganizationId || (organizations[0]?.id ?? 'default_org'),
      email: '',
      phone: '',
      designation: '',
      securityPin: '1234',
      securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: 'नेपाल',
      mustChangePassword: true,
      isActive: true,
    });
    setShowUserFormPassword(false);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      password: u.password || 'user123',
      fullName: u.fullName,
      role: u.role,
      organizationId: u.organizationId || activeOrganizationId || (organizations[0]?.id ?? 'default_org'),
      email: u.email || '',
      phone: u.phone || '',
      designation: u.designation || '',
      securityPin: u.securityPin || '1234',
      securityQuestion: u.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: u.securityAnswer || 'नेपाल',
      mustChangePassword: u.mustChangePassword ?? false,
      isActive: u.isActive,
    });
    setShowUserFormPassword(false);
    setShowUserModal(true);
  };

  const handleOpenResetPassword = (u: User) => {
    setPasswordTargetUser(u);
    const defPass =
      u.role === 'SUPER_ADMIN' ? 'admin123' : u.role === 'ACCOUNTANT' ? 'account123' : 'viewer123';
    setNewPasswordInput(defPass);
    setConfirmPasswordInput(defPass);
    setResetMustChangePassword(true);
    setShowPasswordText(true);
    setShowPasswordModal(true);
  };

  const handleSaveResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    if (!newPasswordInput || newPasswordInput.length < 4) {
      addToast('error', 'कमजोर पासवर्ड', 'पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्दछ।');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      addToast('error', 'पासवर्ड मिलेन', 'नयाँ पासवर्ड र पुष्टि गरिएको पासवर्ड एउटै हुनुपर्दछ।');
      return;
    }
    const success = changeUserPassword(passwordTargetUser.id, newPasswordInput);
    if (success) {
      if (resetMustChangePassword) {
        updateUser({
          ...passwordTargetUser,
          password: newPasswordInput,
          mustChangePassword: true,
        });
      }
      setShowPasswordModal(false);
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !userFormData.fullName.trim() ||
      !userFormData.username.trim() ||
      !userFormData.password.trim() ||
      !userFormData.securityPin.trim() ||
      !userFormData.securityQuestion.trim() ||
      !userFormData.securityAnswer.trim() ||
      !userFormData.role ||
      !userFormData.designation.trim() ||
      !userFormData.email.trim() ||
      !userFormData.phone.trim()
    ) {
      addToast(
        'error',
        'फाराम अधुरो (Incomplete Form)',
        'कृपया फारामका सम्पूर्ण अनिवार्य विवरणहरू (*) पूरा भर्नुहोस्।'
      );
      return;
    }

    if (userFormData.securityPin.trim().length < 4) {
      addToast('error', 'पिन त्रुटि', 'सुरक्षा पिन कम्तिमा ४ अंकको हुनुपर्दछ।');
      return;
    }

    if (
      !editingUser &&
      users.some(
        (u) => u.username.toLowerCase() === userFormData.username.trim().toLowerCase()
      )
    ) {
      addToast(
        'error',
        'प्रयोगकर्ता आइडी दोहोरियो',
        'यो User ID पहिले नै प्रयोगमा छ। कृपया अर्को नाम छान्नुहोस्।'
      );
      return;
    }

    if (
      currentUser?.role === 'ADMIN' &&
      (userFormData.role === 'SUPER_ADMIN' || userFormData.role === 'ADMIN')
    ) {
      addToast(
        'error',
        'अधिकार सीमा (Access Denied)',
        'Admin प्रयोगकर्ताले Super Admin वा Admin बनाउन सक्नुहुन्न। कृपया Accountant, General User वा Viewer मात्र छान्नुहोस्।'
      );
      return;
    }

    if (editingUser) {
      const ok = updateUser({
        ...editingUser,
        ...userFormData,
      });
      if (ok) setShowUserModal(false);
    } else {
      const ok = addUser(userFormData);
      if (ok) setShowUserModal(false);
    }
  };

  const handleCreateFySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFyName.trim()) {
      addToast('error', 'त्रुटि', 'कृपया आर्थिक वर्षको नाम प्रविष्ट गर्नुहोस्।');
      return;
    }
    const success = createFiscalYear(newFyName.trim(), shouldCopyData ? copyFromFy : undefined);
    if (success) {
      setNewFyName('');
      setShowNewFyModal(false);
    }
  };

  const handleEditFySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFyName.trim()) {
      addToast('error', 'त्रुटि', 'कृपया आर्थिक वर्षको नाम प्रविष्ट गर्नुहोस्।');
      return;
    }
    const success = updateFiscalYear(editingFy, editFyName.trim());
    if (success) {
      setShowEditFyModal(false);
      setEditingFy('');
      setEditFyName('');
    }
  };

  const handleCarryForwardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFy) {
      addToast('error', 'त्रुटि', 'कृपया गन्तव्य आर्थिक वर्ष चयन गर्नुहोस्।');
      return;
    }
    if (sourceFy === targetFy) {
      addToast('error', 'त्रुटि', 'स्रोत र गन्तव्य आर्थिक वर्ष एउटै हुन सक्दैन।');
      return;
    }

    showConfirmation({
      title: 'डाटा स्थानान्तरण (Carry Forward) पुष्टि',
      message: `के तपाईं आर्थिक वर्ष ${sourceFy} बाट ${targetFy} मा कर्मचारी तथा तलब विवरणहरू स्थानान्तरण गर्न निश्चित हुनुहुन्छ?`,
      confirmText: 'हो, स्थानान्तरण गर्नुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      onConfirm: () => {
        carryForwardFiscalYear(sourceFy, targetFy, {
          copyEmployees: carryEmployees,
          promoteGrades: carryPromoteGrades,
          copyDeductions: carryDeductions,
          copyTaxSlabs: carryTaxSlabs,
        });
      },
    });
  };

  const handleResetDemo = () => {
    showConfirmation({
      title: 'डेमो डाटा पुनः लोड गर्ने?',
      message:
        'यसले हालको सम्पूर्ण विवरणलाई ८ जना आधिकारिक सरकारी कर्मचारी तथा मानक कर स्ल्याबहरू सहितको डेमो डाटामा रिसेट गर्नेछ।',
      confirmText: 'हो, डेमो डाटा लोड गर्नुहोस्',
      cancelText: 'रद्द गर्नुहोस्',
      isDangerous: false,
      onConfirm: () => {
        resetToDemoData();
      },
    });
  };

  const handleExportBackup = () => {
    const backupData = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      activeFiscalYear,
      fiscalYears,
      organization,
      employees,
      salarySetups,
      deductionSetups,
      taxReferences,
      users,
      useDevanagariNumerals,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NepalGov_Payroll_Backup_${activeFiscalYear}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'ब्याकअप डाउनलोड भयो', 'सम्पूर्ण डाटा JSON फाइलको रूपमा सुरक्षित गरियो।');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.organization && (json.employees || json.fyDatabase)) {
          if (json.organization) localStorage.setItem('np_payroll_org_v3', JSON.stringify(json.organization));
          if (json.activeFiscalYear) localStorage.setItem('np_payroll_active_fy_v3', json.activeFiscalYear);
          if (json.fiscalYears) {
            const sortedFys = sortFiscalYearsDescending(json.fiscalYears);
            localStorage.setItem('np_payroll_available_fys_v3', JSON.stringify(sortedFys));
          }
          if (json.users) localStorage.setItem('np_payroll_users_v3', JSON.stringify(json.users));

          addToast('success', 'ब्याकअप लोड भयो', 'डाटा सफलतापूर्वक रिस्टोर गरियो। पृष्ठ ताजा हुँदैछ...');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          addToast('error', 'अमान्य फाइल', 'यो उपयुक्त ब्याकअप JSON फाइल होइन।');
        }
      } catch (err) {
        addToast('error', 'त्रुटि', 'फाइल पढ्न सकिएन।');
      }
    };
    reader.readAsText(file);
  };

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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              प्रणाली सेटिङ्स तथा ब्याकअप व्यवस्थापन (System Settings)
            </h2>
            <p className="text-xs text-[#526a48]">
              आर्थिक वर्ष व्यवस्थापन, अघिल्लो वर्षबाट डाटा स्थानान्तरण (Carry Forward), प्रयोगकर्ता तथा भूमिका (RBAC)
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center bg-[#f4f8f1] p-1 rounded-xl border border-[#cddcc8] gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('system')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'system'
                ? 'bg-[#4B6043] text-white shadow-xs'
                : 'text-[#34472c] hover:bg-[#e4ede0]'
            }`}
          >
            आर्थिक वर्ष तथा सेटिङ्स
          </button>
          <button
            onClick={() => setActiveSubTab('organizations')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'organizations'
                ? 'bg-[#4B6043] text-white shadow-xs'
                : 'text-[#34472c] hover:bg-[#e4ede0]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>कार्यालय / संस्था</span>
            <span className="text-[10px] bg-[#dbe8d6] text-[#24331C] px-1.5 py-0.2 rounded-full font-bold">
              {organizations.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'users'
                ? 'bg-[#4B6043] text-white shadow-xs'
                : 'text-[#34472c] hover:bg-[#e4ede0]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>प्रयोगकर्ता तथा भूमिका</span>
          </button>
          <button
            onClick={() => setActiveSubTab('security')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'security'
                ? 'bg-[#4B6043] text-white shadow-xs'
                : 'text-[#34472c] hover:bg-[#e4ede0]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>सुरक्षा तथा अडिट (Security)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'backup'
                ? 'bg-[#4B6043] text-white shadow-xs'
                : 'text-[#34472c] hover:bg-[#e4ede0]'
            }`}
          >
            ब्याकअप तथा रिसेट
          </button>
          <button
            onClick={() => setActiveSubTab('support')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'support'
                ? 'bg-[#4B6043] text-white shadow-xs'
                : 'text-[#34472c] hover:bg-[#e4ede0]'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>सहायता तथा सम्पर्क</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Fiscal Year & System Settings */}
      {activeSubTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Fiscal Year Management */}
            <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[#e9efe4] pb-2">
                <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#4B6043]" />
                  <span>१. आर्थिक वर्ष व्यवस्थापन (Fiscal Year Management)</span>
                </h3>
                <button
                  onClick={() => setShowNewFyModal(true)}
                  className="px-3 py-1 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344c2c] font-bold rounded-lg border border-[#c5d7bf] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>नयाँ आ.व. सिर्जना</span>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#f8faf6] p-3 rounded-xl border border-[#e2ece0]">
                  <div>
                    <p className="font-bold text-[#24331C]">सक्रिय आर्थिक वर्ष (Active Fiscal Year):</p>
                    <p className="text-[11px] text-gray-500">
                      हाल प्रणालीमा प्रविष्ट र गणना भइरहेको वर्ष
                    </p>
                  </div>
                  <select
                    value={activeFiscalYear}
                    onChange={(e) => setActiveFiscalYear(e.target.value)}
                    className="py-1 px-3 rounded-lg border border-[#c8d7c2] bg-white font-bold text-[#24331C] text-xs cursor-pointer"
                  >
                    {fiscalYears.map((fy) => (
                      <option key={fy} value={fy}>
                        {fy}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-[#f8faf6] p-3 rounded-xl border border-[#e2ece0]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-[#24331C]">उपलब्ध आर्थिक वर्ष सूची:</p>
                    <span className="text-[10px] font-semibold text-[#4B6043] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      घट्दो क्रम (Descending Order)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fiscalYears.map((fy) => (
                      <div
                        key={fy}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all ${
                          activeFiscalYear === fy
                            ? 'bg-[#4B6043] text-white border-[#4B6043]'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span>{fy}</span>
                        {activeFiscalYear === fy && (
                          <span className="text-[9px] bg-white/20 px-1 rounded">सक्रिय</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFy(fy);
                            setEditFyName(fy);
                            setShowEditFyModal(true);
                          }}
                          className={`p-0.5 rounded transition-colors cursor-pointer ml-1 ${
                            activeFiscalYear === fy
                              ? 'text-white/80 hover:text-white hover:bg-white/25'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title="सच्याउनुहोस् / सम्पादन गर्नुहोस् (Edit Fiscal Year)"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Display & Preferences */}
            <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2 flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#4B6043]" />
                <span>२. प्रदर्शन तथा गणना प्राथमिकता (Preferences)</span>
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#f8faf6] p-3 rounded-xl border border-[#e2ece0]">
                  <div>
                    <p className="font-bold text-[#24331C]">अंक लिपि ढाँचा (Numeral Script):</p>
                    <p className="text-[11px] text-gray-500">
                      संख्याहरू नेपाली देवनागरी (१,२,३) वा अंग्रेजी (1,2,3) मा देखाउने
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseDevanagariNumerals(!useDevanagariNumerals)}
                    className={`px-3 py-1.5 font-bold rounded-lg border transition-all cursor-pointer ${
                      useDevanagariNumerals
                        ? 'bg-[#4B6043] text-white border-[#4B6043]'
                        : 'bg-white text-[#344b2d] border-[#c8d7c2]'
                    }`}
                  >
                    {useDevanagariNumerals ? 'नेपाली अंक (१२३)' : 'English (123)'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-[#f8faf6] p-3 rounded-xl border border-[#e2ece0]">
                  <div>
                    <p className="font-bold text-[#24331C]">मुद्रा एकाइ (Currency Symbol):</p>
                    <p className="text-[11px] text-gray-500">रु. (नेपाली रुपैयाँ मानक)</p>
                  </div>
                  <span className="font-bold text-[#4B6043] bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                    रु. (NPR)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Carry Forward Section (अघिल्लो वर्षबाट नयाँ वर्षमा डाटा सारेर लैजाने) */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#4B6043]" />
              <span>३. अघिल्लो वर्षबाट नयाँ वर्षमा डाटा सारेर लैजाने (Carry Forward Data)</span>
            </h3>

            <form onSubmit={handleCarryForwardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">स्रोत आर्थिक वर्ष (Source Fiscal Year):</label>
                  <select
                    value={sourceFy}
                    onChange={(e) => setSourceFy(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold text-xs"
                  >
                    {fiscalYears.map((fy) => (
                      <option key={fy} value={fy}>
                        {fy}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500">जुन वर्षबाट डाटा कपी गर्न चाहनुहुन्छ</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">गन्तव्य आर्थिक वर्ष (Target Fiscal Year):</label>
                  <select
                    value={targetFy}
                    onChange={(e) => setTargetFy(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold text-xs"
                  >
                    <option value="">-- गन्तव्य आर्थिक वर्ष चयन गर्नुहोस् --</option>
                    {fiscalYears
                      .filter((fy) => fy !== sourceFy)
                      .map((fy) => (
                        <option key={fy} value={fy}>
                          {fy}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-gray-500">जुन नयाँ वर्षमा डाटा स्थानान्तरण गर्नु पर्ने हो</p>
                </div>
              </div>

              {/* Carry forward options checkboxes */}
              <div className="bg-[#f8faf6] p-4 rounded-xl border border-[#d8e4d3] space-y-3">
                <p className="font-bold text-[#24331C]">स्थानान्तरण विकल्पहरू (Carry Forward Options):</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carryEmployees}
                      onChange={(e) => setCarryEmployees(e.target.checked)}
                      className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                    />
                    <span>कर्मचारी व्यक्तिगत विवरणहरू कपी गर्ने (Copy Employee Master)</span>
                  </label>

                  <label className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carryPromoteGrades}
                      onChange={(e) => setCarryPromoteGrades(e.target.checked)}
                      className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                    />
                    <span>खाइपाई आएको ग्रेड संख्या अद्यावधिक गर्ने (Promote Grade Count)</span>
                  </label>

                  <label className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carryDeductions}
                      onChange={(e) => setCarryDeductions(e.target.checked)}
                      className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                    />
                    <span>कट्टी तथा ना.ल.कोष विवरण सार्ने (Copy Deductions)</span>
                  </label>

                  <label className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carryTaxSlabs}
                      onChange={(e) => setCarryTaxSlabs(e.target.checked)}
                      className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                    />
                    <span>कर स्ल्याब तथा वैधानिक नियमहरू सार्ने (Copy Tax Reference)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!targetFy}
                  className="px-5 py-2.5 bg-[#4B6043] hover:bg-[#384c31] disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>डाटा स्थानान्तरण गर्नुहोस् (Execute Carry Forward)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Organizations & Multi-Tenancy Management */}
      {activeSubTab === 'organizations' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9efe4] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#4B6043]" />
                  <span>कार्यालय तथा संस्था व्यवस्थापन (Multi-Office / Multi-Tenancy Hub)</span>
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  प्रत्येक फरक फरक कार्यालय/संस्थाको अलग-अलग दर्ता, प्रशासक (Admin) प्रयोगकर्ता सिर्जना र डाटा पृथकीकरण (Data Isolation)।
                </p>
              </div>

              {currentUser?.role === 'SUPER_ADMIN' && (
                <button
                  onClick={handleOpenAddOrg}
                  className="px-3.5 py-1.5 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>नयाँ कार्यालय / संस्था दर्ता गर्नुहोस् (Add Office)</span>
                </button>
              )}
            </div>

            {/* Current Active Org Context Banner */}
            <div className="p-4 bg-[#f4f8f1] rounded-xl border border-[#cddcc8] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4B6043] text-white flex items-center justify-center font-bold shadow-xs">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-300">
                      हाल सक्रिय कार्यालय (Active Context)
                    </span>
                    <span className="text-gray-400 font-mono text-[10px]">ID: {activeOrganizationId}</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#24331C] mt-0.5">
                    {activeOrganization?.officeName || organization.officeName}
                  </h4>
                  <p className="text-gray-600 text-[11px]">
                    {activeOrganization?.parentBodyName || activeOrganization?.ministryName || organization.ministryName}
                    {activeOrganization?.district ? ` • ${activeOrganization.district}` : ''}
                    {activeOrganization?.address ? ` • ${activeOrganization.address}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#34472c]">
                  कुल कार्यालय संख्या: <b>{visibleOrganizations.length}</b>
                </span>
              </div>
            </div>

            {/* Organizations Grid */}
            {visibleOrganizations.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-[#ccdcc7] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#edf4ea] text-[#4B6043] flex items-center justify-center mx-auto">
                  <Building className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#24331C]">कुनै कार्यालय दर्ता गरिएको छैन</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  प्रणालीमा हाल कुनै पनि कार्यालय सेटअप गरिएको छैन। तलको बटन थिचेर नयाँ कार्यालय दर्ता गर्नुहोस्।
                </p>
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <button
                    onClick={handleOpenAddOrg}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#4B6043] hover:bg-[#394a33] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>नयाँ कार्यालय दर्ता गर्नुहोस्</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {visibleOrganizations.map((org, index) => {
                const isCurrentWorkspace = org.id === activeOrganizationId;
                const isOrgOperative = org.isActive !== false;
                const orgUsers = users.filter((u) => u.organizationId === org.id || (!u.organizationId && org.id === 'default_org'));
                const orgAdmins = orgUsers.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
                const sheetTitle = org.spreadsheetId ? (org.officeName ? `stcs_${org.officeName}_${org.district || ''}` : `stcs_office`) : null;
                const sheetUrl = org.spreadsheetUrl || (org.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${org.spreadsheetId}/edit` : null);

                return (
                  <div
                    key={org.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrentWorkspace
                        ? 'bg-[#fbfdfa] border-[#4B6043] shadow-md ring-1 ring-[#4B6043]/30'
                        : isOrgOperative
                        ? 'bg-white border-[#d6e3d2] hover:border-[#a8c4a1] shadow-xs'
                        : 'bg-gray-50 border-gray-200 opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-gray-400 font-bold">#{index + 1}</span>
                          <h4 className="text-sm font-bold text-[#24331C]">{org.officeName}</h4>
                          {/* Independent Status Badge */}
                          {isOrgOperative ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                              <Check className="w-3 h-3" /> सक्रिय (Active)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                              <XCircle className="w-3 h-3" /> निष्क्रिय (Inactive)
                            </span>
                          )}
                          {isCurrentWorkspace && (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-300">
                              चालू कार्यक्षेत्र
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600">
                          {org.ministryName || org.parentBodyName || 'नेपाल सरकार'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditOrg(org)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="कार्यालय विवरण सम्पादन गर्नुहोस्"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {currentUser?.role === 'SUPER_ADMIN' && organizations.length > 1 && (
                          <button
                            onClick={() => handleDeleteOrg(org.id, org.officeName)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="कार्यालय तथा डाटा मेटाउनुहोस्"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Org Details Info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] py-2.5 text-gray-700">
                      <div>
                        <span className="text-gray-400 block text-[10px]">प्रदेश र जिल्ला:</span>
                        <span className="font-medium">{org.province || '-'}, {org.district || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">स्थानीय तह र ठेगाना:</span>
                        <span className="font-medium truncate block">
                          {org.localLevel ? `${org.localLevel}${org.address ? `, ${org.address}` : ''}` : org.address || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">फोन नं. (Phone):</span>
                        <span className="font-medium">{org.phone || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">मोबाइल नं. (Mobile):</span>
                        <span className="font-medium">{org.mobile || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">इमेल (Email):</span>
                        <span className="font-medium truncate block">{org.email || '-'}</span>
                      </div>
                      {org.pan && (
                        <div>
                          <span className="text-gray-400 block text-[10px]">स्थायी लेखा नं. (PAN):</span>
                          <span className="font-mono font-bold text-gray-800">{org.pan}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400 block text-[10px]">सम्बद्ध प्रयोगकर्ताहरू:</span>
                        <span className="font-medium text-emerald-800">
                          {orgUsers.length} जना (प्रशासक: {orgAdmins.length})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">गुगल ड्राइभ सिट (Drive Sheet):</span>
                        {sheetUrl ? (
                          <a
                            href={sheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:text-emerald-900 font-mono font-semibold flex items-center gap-1 text-[10px] hover:underline"
                            title="गुगल सिट खोल्नुहोस्"
                          >
                            <ExternalLink className="w-3 h-3 inline" />
                            <span className="truncate">{sheetTitle || 'सिट खोल्नुहोस्'}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[10px]">सिट सिर्जना हुँदैछ...</span>
                        )}
                      </div>
                    </div>

                    {/* Action Bar with Independent Activation & Workspace Switching */}
                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      {/* Independent Activate/Deactivate Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleOrganizationActive(org.id)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          isOrgOperative
                            ? 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
                            : 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title="यस कार्यालयको सक्रिय/निष्क्रिय अवस्था परिवर्तन गर्नुहोस् (अन्य कार्यालय यथावत रहनेछन्)"
                      >
                        {isOrgOperative ? (
                          <>
                            <XCircle className="w-3 h-3 text-amber-600" />
                            <span>निष्क्रिय गर्नुहोस्</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>सक्रिय गर्नुहोस्</span>
                          </>
                        )}
                      </button>

                      {/* Workspace Switcher */}
                      {!isCurrentWorkspace ? (
                        <button
                          onClick={() => setActiveOrganizationId(org.id)}
                          className="px-3 py-1 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>कार्यक्षेत्र खोल्नुहोस् (Open Workspace)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          ✓ वर्तमान सक्रिय कार्यक्षेत्र
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* Multi-Tenancy Explanatory Box */}
            <div className="p-4 bg-[#f8faf6] rounded-xl border border-[#d8e4d3] text-xs space-y-1.5">
              <h5 className="font-bold text-[#24331C] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#4B6043]" />
                <span>कार्यालयगत डाटा पृथकीकरण व्यवस्था (Data Isolation Architecture):</span>
              </h5>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                १. प्रत्येक संस्था/कार्यालयको कर्मचारी विवरण, तलब स्केल, कट्टी सेटअप, कर स्ल्याब तथा गुगल सिट ब्याकअप पूर्णतया अलग-अलग भण्डारण र लोड हुन्छ।<br />
                २. कार्यालयका प्रशासक (Admin) प्रयोगकर्ताले आफ्नो कार्यालयको डाटा मात्र हेर्न र सम्पादन गर्न सक्नुहुन्छ।<br />
                ३. Super Admin ले कुनै पनि कार्यालयको डाटा स्विच गरी व्यवस्थापन वा नयाँ कार्यालय दर्ता गर्न सक्नुहुन्छ।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: User & Role Management (Super Admin only view/control) */}
      {activeSubTab === 'users' && (
        <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9efe4] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#4B6043]" />
                <span>प्रयोगकर्ता तथा भूमिका व्यवस्थापन (User & Role Management - RBAC)</span>
              </h3>
              <p className="text-gray-500 text-[11px]">
                {currentUser?.role === 'ADMIN'
                  ? 'Admin ले Super Admin र Admin बाहेक बाँकी प्रयोगकर्ता (Accountant, General User, Viewer) दर्ता तथा व्यवस्थापन गर्न सक्नुहुन्छ।'
                  : 'Super Admin ले सम्पूर्ण प्रयोगकर्ताहरू थप्न, भूमिका (Role) तोक्न तथा सक्रिय/निष्क्रिय गर्न सक्छन्।'}
              </p>
            </div>

            {(hasPermission('MANAGE_USERS') || hasPermission('MANAGE_GENERAL_USERS')) && (
              <button
                onClick={handleOpenAddUser}
                className="px-3.5 py-1.5 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>नयाँ प्रयोगकर्ता थप्नुहोस् (Add User)</span>
              </button>
            )}
          </div>

          {!hasPermission('MANAGE_USERS') && !hasPermission('MANAGE_GENERAL_USERS') ? (
            /* Non-Super Admin: Show ONLY the logged-in user's profile card */
            <div className="bg-[#f8faf6] border border-[#d6e3d2] p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#4B6043] text-white flex items-center justify-center text-lg font-bold shadow-xs">
                  {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#24331C]">{currentUser?.fullName}</h4>
                  <p className="text-gray-500 text-xs">{currentUser?.designation || 'कर्मचारी'}</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(
                      currentUser?.role || 'VIEWER'
                    )}`}
                  >
                    {currentUser?.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-3 rounded-xl border border-[#e2ece0]">
                  <p className="text-gray-400 text-[10px]">User ID / प्रयोगकर्ता कोड</p>
                  <p className="font-mono font-bold text-[#24331C] mt-0.5">{currentUser?.username}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e2ece0]">
                  <p className="text-gray-400 text-[10px]">इमेल ठेगाना</p>
                  <p className="text-[#24331C] font-medium mt-0.5 truncate">{currentUser?.email || '-'}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e2ece0]">
                  <p className="text-gray-400 text-[10px]">सम्पर्क नम्बर</p>
                  <p className="text-[#24331C] font-medium mt-0.5">{currentUser?.phone || '-'}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e2ece0]">
                  <p className="text-gray-400 text-[10px]">खाता स्थिति</p>
                  <p className="text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> सक्रिय (Active)
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e2ece0]">
                  <p className="text-gray-400 text-[10px]">सुरक्षा स्थिति</p>
                  <p className="text-emerald-700 font-medium mt-0.5">
                    {currentUser?.mustChangePassword ? 'पासवर्ड परिवर्तन बाँकी' : 'पासवर्ड सुरक्षित'}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e2ece0] flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-[10px]">पासवर्ड व्यवस्थापन</p>
                    <p className="text-[#24331C] font-semibold mt-0.5">गोप्य कुञ्जी</p>
                  </div>
                  {currentUser && (
                    <button
                      onClick={() => handleOpenResetPassword(currentUser)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>पासवर्ड परिवर्तन</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Super Admin: User Management Table */
            <div className="overflow-x-auto border border-[#d6e3d2] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#edf4ea] text-[#24331C] font-bold border-b border-[#d6e3d2]">
                    <th className="p-3">क्र.सं.</th>
                    <th className="p-3">पूरा नाम (Full Name)</th>
                    <th className="p-3">प्रयोगकर्ता आइडी (User ID)</th>
                    <th className="p-3">सम्बद्ध कार्यालय (Office)</th>
                    <th className="p-3">पद (Designation)</th>
                    <th className="p-3">भूमिका (Role)</th>
                    <th className="p-3">पासवर्ड तथा सुरक्षा अवस्था</th>
                    <th className="p-3">सम्पर्क / इमेल</th>
                    <th className="p-3 text-center">स्थिति</th>
                    <th className="p-3 text-center">कार्य (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleUsers.map((u, idx) => {
                    const userOrg = organizations.find((o) => o.id === u.organizationId);
                    return (
                      <tr key={u.id} className="hover:bg-[#f8faf6] transition-colors">
                        <td className="p-3 font-semibold text-gray-500">{idx + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#4B6043] text-white flex items-center justify-center text-xs font-bold">
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-[#24331C]">{u.fullName}</p>
                              {currentUser?.id === u.id && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                  हालको लगइन
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-[#24331C] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {u.username}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                            <Building2 className="w-3 h-3 text-[#4B6043]" />
                            <span className="truncate max-w-[140px]">
                              {userOrg?.officeName || (u.role === 'SUPER_ADMIN' ? 'सबै कार्यालय (Global)' : organization.officeName)}
                            </span>
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{u.designation || '-'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border ${getRoleBadgeStyle(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {u.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
                                पहिलो लगइन परिवर्तन बाँकी
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-200">
                                <CheckCircle className="w-2.5 h-2.5" /> सुरक्षित
                              </span>
                            )}
                          </div>
                          {u.securityPin && (
                            <p className="text-[10px] text-gray-400 font-mono">
                              PIN: {u.securityPin}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 text-[11px]">
                        <div>{u.email || '-'}</div>
                        <div className="text-gray-400">{u.phone || ''}</div>
                      </td>
                      <td className="p-3 text-center">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> सक्रिय
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-200">
                            <XCircle className="w-3 h-3" /> निष्क्रिय
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Password Reset Button */}
                          <button
                            onClick={() => handleOpenResetPassword(u)}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="पासवर्ड परिवर्तन / रिसेट गर्नुहोस्"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit User Button */}
                          {(hasPermission('MANAGE_USERS') ||
                            (hasPermission('MANAGE_GENERAL_USERS') &&
                              (u.id === currentUser?.id ||
                                (u.role !== 'SUPER_ADMIN' && u.role !== 'ADMIN')))) && (
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="विवरण सम्पादन गर्नुहोस्"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete User Button (Cannot delete self, and Admin cannot delete Super Admin or Admin) */}
                          {u.id !== currentUser?.id &&
                            (hasPermission('MANAGE_USERS') ||
                              (hasPermission('MANAGE_GENERAL_USERS') &&
                                u.role !== 'SUPER_ADMIN' &&
                                u.role !== 'ADMIN')) && (
                              <button
                                onClick={() => {
                                  showConfirmation({
                                    title: 'प्रयोगकर्ता हटाउने पुष्टि',
                                    message: `के तपाईं प्रयोगकर्ता '${u.fullName}' (${u.username}) लाई हटाउन निश्चित हुनुहुन्छ? हटाए पश्चात सम्बन्धित कार्यालयको गुगल सिटमा पनि यो रेकर्ड स्वतः अद्यावधिक (Auto Save) हुनेछ।`,
                                    confirmText: 'मेटाउनुहोस्',
                                    cancelText: 'रद्द गर्नुहोस्',
                                    isDangerous: true,
                                    onConfirm: () => {
                                      deleteUser(u.id);
                                      hideConfirmation();
                                    },
                                  });
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="प्रयोगकर्ता हटाउनुहोस्"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
            </div>
          )}

          {/* Role Permission Matrix Card */}
          <div className="bg-[#f8faf6] p-4 rounded-xl border border-[#d8e4d3] space-y-2 mt-4">
            <h4 className="font-bold text-[#24331C] text-xs">भूमिका अधिकार विवरण (Role Permission Matrix):</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              {currentUser?.role === 'SUPER_ADMIN' && (
                <div className="bg-white p-3 rounded-lg border border-purple-200">
                  <p className="font-bold text-purple-900 mb-1">SUPER_ADMIN</p>
                  <p className="text-gray-600">प्रयोगकर्ता व्यवस्थापन, नयाँ आ.व. सिर्जना, डाटा सार्ने, मेटाउने, तलब तथा कर सम्पादन।</p>
                </div>
              )}
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <p className="font-bold text-emerald-900 mb-1">ADMIN</p>
                <p className="text-gray-600">कार्यालय विवरण, कर्मचारी थप/सम्पादन, तलब र कर प्रतिवेदन, ब्याकअप डाउनलोड।</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-200">
                <p className="font-bold text-blue-900 mb-1">ACCOUNTANT</p>
                <p className="text-gray-600">कर्मचारी, मासिक तलब विवरण, वार्षिक कर गणना, कर स्ल्याब विवरण सम्पादन तथा प्रिन्ट।</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <p className="font-bold text-amber-900 mb-1">GENERAL_USER</p>
                <p className="text-gray-600">कर्मचारी विवरण, मासिक तलब विवरण प्रविष्टि तथा पेरोल अवलोकन।</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900 mb-1">VIEWER</p>
                <p className="text-gray-600">ड्यासबोर्ड, तलबी विवरण, कर कट्टी र किताबखाना फाराम अवलोकन तथा प्रिन्ट मात्र।</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Backup & Reset */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Backup & Restore */}
            <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-[#4B6043]" />
                <span>ब्याकअप तथा पुनःस्थापना (Backup & Restore)</span>
              </h3>

              <div className="space-y-3">
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  तपाईंको सम्पूर्ण डाटा (कर्मचारी, तलब, कट्टी, कर स्ल्याब तथा कार्यालय विवरण) सुरक्षित JSON फाइलमा ब्याकअप लिन वा पहिलेको ब्याकअप फाइल लोड गर्न सक्नुहुन्छ।
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="py-2.5 px-3 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344c2c] font-bold rounded-xl border border-[#c5d7bf] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>JSON ब्याकअप डाउनलोड</span>
                  </button>

                  <label className="py-2.5 px-3 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344c2c] font-bold rounded-xl border border-[#c5d7bf] transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>JSON ब्याकअप रिस्टोर</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Card 2: Reset to Nepal Gov Demo Data */}
            <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#4B6043]" />
                <span>मानक डेमो डाटा पुनः लोड</span>
              </h3>

              <div className="space-y-3">
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  ८ जना आधिकारिक निजामती कर्मचारीहरू (सहसचिव, उपसचिव, शाखा अधिकृत, सहायक, लेखापाल, श्रेणीविहीन, अपाङ्गता तथा महिला कर्मचारी) को यथार्थपरक तलब र कर स्ल्याबहरू लोड गर्नुहोस्।
                </p>

                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="mt-2 px-4 py-2.5 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>डेमो डाटा पुनः लोड गर्नुहोस्</span>
                </button>
              </div>
            </div>

            {/* Card 3: Delete Current FY Data */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-amber-900 border-b border-amber-100 pb-2 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-600" />
                <span>चालु आ.व. ({activeFiscalYear}) को डाटा मेटाउने</span>
              </h3>

              <div className="space-y-3">
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  हाल सक्रिय रहेको आर्थिक वर्ष <strong>{activeFiscalYear}</strong> को मात्र सम्पूर्ण कर्मचारी तथा तलब डाटा खाली गर्दछ। अन्य आर्थिक वर्ष सुरक्षित रहन्छ।
                </p>

                <button
                  type="button"
                  onClick={() => clearFiscalYearData(activeFiscalYear)}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>आ.व. {activeFiscalYear} को डाटा मेटाउनुहोस्</span>
                </button>
              </div>
            </div>

            {/* Card 4: All Clear / Factory Reset */}
            <div className="bg-red-50/50 p-5 rounded-2xl border border-red-200 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-red-900 border-b border-red-200 pb-2 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>सम्पूर्ण प्रणाली डाटा खाली गर्ने (All Clear / Factory Reset)</span>
              </h3>

              <div className="space-y-3">
                <p className="text-red-700 text-[11px] leading-relaxed">
                  सबै आर्थिक वर्षहरू, कर्मचारी, तलब र कर विवरण पूर्ण रूपमा मेटाउँछ। यो कार्य अपरिवर्तनीय छ।
                </p>

                <button
                  type="button"
                  onClick={clearAllData}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>सबै डाटा मेटाउनुहोस् (All Clear)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Support & Contact Setup */}
      {activeSubTab === 'support' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs">
            <div className="border-b border-[#e9efe4] pb-3">
              <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#4B6043]" />
                <span>सहायता तथा सम्पर्क व्यवस्थापन (Login & System Support Contact)</span>
              </h3>
              <p className="text-gray-500 text-[11px] mt-0.5">
                लगइन पृष्ठ तथा प्रणालीभित्र देखिने सहायता तथा सम्पर्क विवरण (फोन नम्बर, इमेल, वाट्सएप) यहाँबाट व्यवस्थापन गर्नुहोस्।
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Form Column */}
              <form onSubmit={handleSaveSupportContact} className="lg:col-span-7 space-y-4">
                <div className="p-4 bg-[#f8faf6] rounded-xl border border-[#d8e4d3] space-y-3.5">
                  <p className="font-bold text-[#24331C] text-xs flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-[#4B6043]" />
                    <span>सम्पर्क विवरणहरू (Support Contact Information):</span>
                  </p>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[#4B6043]" />
                      <span>सम्पर्क नं. (Contact No. / Phone):</span>
                    </label>
                    <input
                      type="text"
                      value={supportForm.phone}
                      onChange={(e) => setSupportForm({ ...supportForm, phone: e.target.value })}
                      placeholder="जस्तै: ९८५६०६१५६५ वा ०६४-४२०१२३"
                      className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                    <p className="text-[10px] text-gray-500">लगइन पृष्ठमा प्रदर्शित हुने सम्पर्क फोन वा मोबाइल नम्बर</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>इमेल (Email):</span>
                    </label>
                    <input
                      type="email"
                      value={supportForm.email}
                      onChange={(e) => setSupportForm({ ...supportForm, email: e.target.value })}
                      placeholder="जस्तै: info.payroll@office.gov.np"
                      className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                    <p className="text-[10px] text-gray-500">लगइन पृष्ठमा प्रदर्शित हुने आधिकारिक सहायता इमेल</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>वाट्सएप (WhatsApp No.):</span>
                    </label>
                    <input
                      type="text"
                      value={supportForm.whatsapp}
                      onChange={(e) => setSupportForm({ ...supportForm, whatsapp: e.target.value })}
                      placeholder="जस्तै: ९८५६०६१५६५ वा 9856061565"
                      className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                    <p className="text-[10px] text-emerald-700">प्रयोगकर्ताले एक क्लिकमा WhatsApp च्याट सुरु गर्न सक्ने नम्बर</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      सहायता सूचना / सन्देश (Support Note / Message):
                    </label>
                    <textarea
                      rows={3}
                      value={supportForm.supportNote}
                      onChange={(e) => setSupportForm({ ...supportForm, supportNote: e.target.value })}
                      placeholder="जस्तै: कार्यालय समय (१०:०० देखि ५:०० सम्म) प्राविधिक सहायताका लागि सम्पर्क गर्नुहोस्।"
                      className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>सम्पर्क विवरण सुरक्षित गर्नुहोस् (Save Contact Info)</span>
                  </button>
                </div>
              </form>

              {/* Live Preview Column */}
              <div className="lg:col-span-5 space-y-3">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>लगइन पृष्ठमा देखिने प्रत्यक्ष रूप (Live Login Page Preview)</span>
                </div>

                {/* Login Page Card Replica matching LoginPage.tsx */}
                <div className="bg-[#1A2616] rounded-xl p-4 border border-white/10 text-white text-xs space-y-2 shadow-inner">
                  <h5 className="font-bold text-xs text-emerald-200 tracking-wide border-b border-white/10 pb-1 flex items-center justify-between">
                    <span>सहायता तथा सम्पर्क</span>
                    <span className="text-[9px] font-mono text-emerald-300/80 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                      Support
                    </span>
                  </h5>

                  <div className="space-y-2 font-medium text-[11px] leading-relaxed text-emerald-50 pt-1">
                    {Boolean(supportForm.phone?.trim()) && (
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-white shrink-0">सम्पर्क नं. (Contact No.):</span>
                        <a href={`tel:${supportForm.phone.trim()}`} className="font-mono text-emerald-100 hover:underline">
                          {supportForm.phone.trim()}
                        </a>
                      </div>
                    )}

                    {Boolean(supportForm.email?.trim()) && (
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-white shrink-0">इमेल (Email):</span>
                        <a href={`mailto:${supportForm.email.trim()}`} className="font-mono text-[10px] text-emerald-100 hover:underline">
                          {supportForm.email.trim()}
                        </a>
                      </div>
                    )}

                    {Boolean(supportForm.whatsapp?.trim()) && (
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-white shrink-0">वाट्सएप (WhatsApp):</span>
                        <a
                          href={`https://wa.me/${supportForm.whatsapp.trim().replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-emerald-100 hover:underline"
                        >
                          {supportForm.whatsapp.trim()}
                        </a>
                      </div>
                    )}

                    {Boolean(supportForm.supportNote?.trim()) && (
                      <p className="text-[10px] text-emerald-100/90 leading-tight pt-0.5 italic">
                        {supportForm.supportNote.trim()}
                      </p>
                    )}

                    {!supportForm.phone?.trim() && !supportForm.email?.trim() && !supportForm.whatsapp?.trim() && !supportForm.supportNote?.trim() && (
                      <div className="text-[10px] text-emerald-100/75 py-2 text-center bg-white/5 rounded-lg border border-white/5">
                        कुनै सहायता सम्पर्क विवरण भरिएको छैन। लगइन पृष्ठमा सामान्य सहायता सन्देश मात्र देखिनेछ।
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security & Audit Logs */}
      {activeSubTab === 'security' && <SecuritySettingsPanel />}

      {/* Modal 1: Create New Fiscal Year Modal */}
      {showNewFyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d6e3d2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#e9efe4] pb-3">
              <h3 className="text-base font-bold text-[#24331C] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#4B6043]" />
                <span>नयाँ आर्थिक वर्ष सिर्जना (Create New Fiscal Year)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFyModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="बन्द गर्नुहोस् (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFySubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">नयाँ आर्थिक वर्षको नाम (e.g. २०८४/८५):</label>
                <input
                  type="text"
                  required
                  value={newFyName}
                  onChange={(e) => setNewFyName(e.target.value)}
                  placeholder="जस्तै: २०८४/८५"
                  className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-semibold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043]"
                />
              </div>

              <div className="bg-[#f8faf6] p-3 rounded-xl border border-[#d8e4d3] space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shouldCopyData}
                    onChange={(e) => setShouldCopyData(e.target.checked)}
                    className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                  />
                  <span>अघिल्लो वर्षबाट डाटा कपी गर्ने?</span>
                </label>

                {shouldCopyData && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] text-gray-600">स्रोत आर्थिक वर्ष:</label>
                    <select
                      value={copyFromFy}
                      onChange={(e) => setCopyFromFy(e.target.value)}
                      className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white font-semibold"
                    >
                      {fiscalYears.map((fy) => (
                        <option key={fy} value={fy}>
                          {fy}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFyModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs"
                >
                  सिर्जना गर्नुहोस्
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 1.5: Edit Fiscal Year Modal */}
      {showEditFyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d6e3d2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#e9efe4] pb-3">
              <h3 className="text-base font-bold text-[#24331C] flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#4B6043]" />
                <span>आर्थिक वर्ष सम्पादन (Edit Fiscal Year)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditFyModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="बन्द गर्नुहोस् (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditFySubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">हालको आर्थिक वर्ष:</label>
                <input
                  type="text"
                  disabled
                  value={editingFy}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">नयाँ नाम (New Fiscal Year Name - e.g. २०८३/८४): <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  required
                  value={editFyName}
                  onChange={(e) => setEditFyName(e.target.value)}
                  placeholder="जस्तै: २०८३/८४"
                  className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-bold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043]"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  नोट: आर्थिक वर्ष परिवर्तन गर्दा उक्त आर्थिक वर्षका सम्पूर्ण दरबन्दी, तलब सेटअप, कट्टा विवरण तथा करका स्ल्याबहरूको आ.व. नाम पनि स्वचालित रूपमा अद्यावधिक हुनेछ।
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditFyModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  परिवर्तन सुरक्षित गर्नुहोस्
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit User Modal (With User ID, Password & Security Settings) */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d6e3d2] shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#e9efe4] pb-3">
              <h3 className="text-base font-bold text-[#24331C] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#4B6043]" />
                <span>
                  {editingUser ? 'प्रयोगकर्ता विवरण तथा लगइन सम्पादन' : 'नयाँ प्रयोगकर्ता दर्ता (Add User & Login ID)'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="बन्द गर्नुहोस् (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    पूरा नाम (Full Name): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.fullName}
                    onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    placeholder="जस्तै: राम प्रसाद रिजाल"
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    प्रयोगकर्ता आइडी / नाम (User ID): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    placeholder="जस्तै: ram.rijal वा account1"
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-mono font-bold disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>
              </div>

              {/* Password and PIN Settings */}
              <div className="p-3.5 bg-[#f8faf6] rounded-xl border border-[#d8e4d3] space-y-3">
                <p className="font-bold text-[#24331C] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#4B6043]" />
                  <span>लगइन पासवर्ड तथा सुरक्षा सेटिङ्स (Login Credentials):</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 flex items-center justify-between">
                      <span>
                        पासवर्ड (Password): <span className="text-red-500 font-bold">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const rand = 'pass' + Math.floor(1000 + Math.random() * 9000);
                          setUserFormData({ ...userFormData, password: rand });
                          setShowUserFormPassword(true);
                        }}
                        className="text-[10px] text-[#4B6043] font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>स्वतः बनाउनुहोस्</span>
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type={showUserFormPassword ? 'text' : 'password'}
                        required
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        placeholder="नयाँ पासवर्ड"
                        className="w-full p-2 pr-8 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUserFormPassword(!showUserFormPassword)}
                        className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showUserFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      ४-अंकको सुरक्षा पिन (4-Digit PIN): <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={userFormData.securityPin}
                      onChange={(e) => setUserFormData({ ...userFormData, securityPin: e.target.value })}
                      placeholder="जस्तै: 1234"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                    <p className="text-[10px] text-gray-500">पासवर्ड बिर्सिएमा PIN बाट रिसेट गर्न प्रयोग हुन्छ</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      सुरक्षा प्रश्न (Security Question): <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      required
                      value={userFormData.securityQuestion}
                      onChange={(e) => setUserFormData({ ...userFormData, securityQuestion: e.target.value })}
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium text-gray-800"
                    >
                      <option value="तपाईंको पहिलो विद्यालयको नाम के हो?">तपाईंको पहिलो विद्यालयको नाम के हो?</option>
                      <option value="तपाईंको जन्मस्थान कुन जिल्ला हो?">तपाईंको जन्मस्थान कुन जिल्ला हो?</option>
                      <option value="तपाईंको मनपर्ने रङ्ग कुन हो?">तपाईंको मनपर्ने रङ्ग कुन हो?</option>
                      <option value="तपाईंको पहिलो सवारी साधन कुन थियो?">तपाईंको पहिलो सवारी साधन कुन थियो?</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      सुरक्षा उत्तर (Security Answer): <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={userFormData.securityAnswer}
                      onChange={(e) => setUserFormData({ ...userFormData, securityAnswer: e.target.value })}
                      placeholder="जस्तै: काठमाडौं वा नेपाल"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    सम्बद्ध कार्यालय / संस्था (Office / Organization): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    required
                    value={userFormData.organizationId}
                    onChange={(e) => setUserFormData({ ...userFormData, organizationId: e.target.value })}
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold text-[#24331C]"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.officeName} {org.district ? `(${org.district})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500">
                    यो प्रयोगकर्ता यस कार्यालयको डाटा प्रविष्टि र व्यवस्थापनसँग सम्बन्धित हुनेछ।
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    भूमिका (User Role): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    required
                    value={userFormData.role}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, role: e.target.value as UserRole })
                    }
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-bold text-[#24331C]"
                  >
                    {currentUser?.role === 'SUPER_ADMIN' ? (
                      <>
                        <option value="SUPER_ADMIN">SUPER_ADMIN (सुपर एडमिन - सम्पूर्ण अधिकार)</option>
                        <option value="ADMIN">ADMIN (प्रशासक - कार्यालय सेटिङ्स र कर्मचारी)</option>
                        <option value="ACCOUNTANT">ACCOUNTANT (लेखापाल - तलब र कर)</option>
                        <option value="GENERAL_USER">GENERAL_USER (सामान्य प्रयोगकर्ता - तलब प्रविष्टि)</option>
                        <option value="VIEWER">VIEWER (अवलोकनकर्ता - हेर्न मात्र मिल्ने)</option>
                      </>
                    ) : (
                      <>
                        <option value="ACCOUNTANT">ACCOUNTANT (लेखापाल - तलब र कर)</option>
                        <option value="GENERAL_USER">GENERAL_USER (सामान्य प्रयोगकर्ता - तलब प्रविष्टि)</option>
                        <option value="VIEWER">VIEWER (अवलोकनकर्ता - हेर्न मात्र मिल्ने)</option>
                      </>
                    )}
                  </select>
                  {currentUser?.role === 'ADMIN' && (
                    <p className="text-[10px] text-emerald-800 font-medium">
                      ✓ Admin ले Super Admin र Admin बाहेक अन्य प्रयोगकर्ता सिर्जना गर्न सक्नुहुन्छ।
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    पद / पदनाम (Designation): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.designation}
                    onChange={(e) => setUserFormData({ ...userFormData, designation: e.target.value })}
                    placeholder="जस्तै: लेखा अधिकृत"
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    इमेल (Email): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="account@gov.np"
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">
                    सम्पर्क फोन (Phone): <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="9851000000"
                    className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <label className="flex items-center gap-2 font-bold text-amber-900 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={userFormData.mustChangePassword}
                      onChange={(e) => setUserFormData({ ...userFormData, mustChangePassword: e.target.checked })}
                      className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                    />
                    <span>पहिलो लगइनमा अनिवार्य पासवर्ड परिवर्तन (Force Password Change on First Login)</span>
                  </label>
                  <p className="text-[10px] text-amber-800 mt-1 pl-5">
                    प्रशासकले दिएको प्रारम्भिक पासवर्ड प्रयोग गरी प्रयोगकर्ताले पहिलो पटक लगइन गर्दा आफ्नो नयाँ पासवर्ड अनिवार्य सेट गर्नुपर्नेछ।
                  </p>
                </div>

                <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userFormData.isActive}
                    onChange={(e) => setUserFormData({ ...userFormData, isActive: e.target.checked })}
                    className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                  />
                  <span>सक्रिय प्रयोगकर्ता (Active User)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  सुरक्षित गर्नुहोस्
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Admin Quick Password Reset Modal */}
      {showPasswordModal && passwordTargetUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d6e3d2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#e9efe4] pb-3">
              <h3 className="text-base font-bold text-[#24331C] flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <span>पासवर्ड परिवर्तन / रिसेट (Reset Password)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="बन्द गर्नुहोस् (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
              <p className="font-bold text-amber-900">{passwordTargetUser.fullName}</p>
              <p className="text-amber-800 font-mono">User ID: {passwordTargetUser.username} | Role: {passwordTargetUser.role}</p>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">नयाँ पासवर्ड (New Password): *</label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="कम्तिमा ४ अक्षरको पासवर्ड"
                    className="w-full p-2.5 pr-8 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-2 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">पासवर्ड पुष्टि गर्नुहोस् (Confirm Password): *</label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="पुनः नयाँ पासवर्ड टाइप गर्नुहोस्"
                  className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-mono font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <label className="flex items-center gap-2 font-bold text-amber-900 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={resetMustChangePassword}
                    onChange={(e) => setResetMustChangePassword(e.target.checked)}
                    className="rounded text-[#4B6043] focus:ring-[#4B6043]"
                  />
                  <span>अर्को लगइनमा प्रयोगकर्ताले अनिवार्य पासवर्ड परिवर्तन गर्नुपर्ने</span>
                </label>
              </div>

              {/* Preset suggestions */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-gray-600">पूर्वनिर्धारित पासवर्डहरू (Quick Presets):</p>
                <div className="flex flex-wrap gap-1.5">
                  {['admin123', 'account123', 'viewer123', 'nepal2081'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setNewPasswordInput(preset);
                        setConfirmPasswordInput(preset);
                      }}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-[#edf4ea] text-gray-700 hover:text-[#24331C] rounded-lg font-mono text-[11px] font-semibold border border-gray-200 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>पासवर्ड सुरक्षित गर्नुहोस्</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Add / Edit Organization (Multi-Tenancy) */}
      {showOrgModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d6e3d2] shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#e9efe4] pb-3">
              <h3 className="text-base font-bold text-[#24331C] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#4B6043]" />
                <span>
                  {editingOrg ? 'कार्यालय / संस्था विवरण सम्पादन' : 'नयाँ कार्यालय / संस्था दर्ता (Add New Organization)'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowOrgModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="बन्द गर्नुहोस् (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrg} className="space-y-4 text-xs">
              {/* Basic Org Info */}
              <div className="p-3.5 bg-[#f8faf6] rounded-xl border border-[#d8e4d3] space-y-3">
                <p className="font-bold text-[#24331C] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#4B6043]" />
                  <span>कार्यालयको नाम तथा निकाय (Office Identity):</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      संस्था / सरकारको तह (Govt / Org Level): <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={orgFormData.name}
                      onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
                      placeholder="जस्तै: नेपाल सरकार / प्रदेश सरकार / स्थानीय तह / संस्थाको नाम"
                      className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-bold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                    <p className="text-[10px] text-gray-500">
                      लेटरप्याडको सबैभन्दा माथिल्लो पङ्क्तिमा यही नाम देखिनेछ।
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      कार्यालय / संस्थाको नाम (Office Name): <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={orgFormData.officeName}
                      onChange={(e) => setOrgFormData({ ...orgFormData, officeName: e.target.value })}
                      placeholder="जस्तै: जलस्रोत तथा सिँचाइ विकास डिभिजन कार्यालय"
                      className="w-full p-2.5 rounded-xl border border-[#c8d7c2] bg-white font-bold text-[#24331C] outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      मन्त्रालयको नाम (Ministry Name):
                    </label>
                    <input
                      type="text"
                      value={orgFormData.ministryName}
                      onChange={(e) => setOrgFormData({ ...orgFormData, ministryName: e.target.value })}
                      placeholder="जस्तै: ऊर्जा, जलस्रोत तथा सिँचाइ मन्त्रालय"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      विभागको नाम (Department Name):
                    </label>
                    <input
                      type="text"
                      value={orgFormData.departmentName}
                      onChange={(e) => setOrgFormData({ ...orgFormData, departmentName: e.target.value })}
                      placeholder="जस्तै: जलस्रोत तथा सिँचाइ विभाग"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">
                      माथिल्लो निकाय (Parent Body):
                    </label>
                    <input
                      type="text"
                      value={orgFormData.parentBodyName}
                      onChange={(e) => setOrgFormData({ ...orgFormData, parentBodyName: e.target.value })}
                      placeholder="जस्तै: आयोजना निर्देशनालय"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>
              </div>

              {/* Geographic and Location info */}
              <div className="p-3.5 bg-[#f8faf6] rounded-xl border border-[#d8e4d3] space-y-3">
                <p className="font-bold text-[#24331C] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#4B6043]" />
                  <span>भौगोलिक ठेगाना (Location Details):</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">प्रदेश (Province):</label>
                    <select
                      value={orgFormData.province}
                      onChange={(e) => {
                        const prov = e.target.value;
                        const dists = getDistrictsByProvince(prov);
                        const firstDist = dists[0] || '';
                        const locals = getLocalLevelsByDistrict(firstDist);
                        const firstLocal = locals[0] || '';
                        setOrgFormData({
                          ...orgFormData,
                          province: prov,
                          district: firstDist,
                          localLevel: firstLocal,
                        });
                      }}
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-semibold outline-none focus:ring-2 focus:ring-[#4B6043]"
                    >
                      {NEPAL_PROVINCES.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">जिल्ला (District):</label>
                    <select
                      value={orgFormData.district}
                      onChange={(e) => {
                        const dist = e.target.value;
                        const locals = getLocalLevelsByDistrict(dist);
                        const firstLocal = locals[0] || '';
                        setOrgFormData({
                          ...orgFormData,
                          district: dist,
                          localLevel: firstLocal,
                        });
                      }}
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    >
                      {getDistrictsByProvince(orgFormData.province).map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">स्थानीय तह (Local Level):</label>
                    <select
                      value={orgFormData.localLevel}
                      onChange={(e) => {
                        setOrgFormData({
                          ...orgFormData,
                          localLevel: e.target.value,
                        });
                      }}
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    >
                      {getLocalLevelsByDistrict(orgFormData.district).map((local) => (
                        <option key={local} value={local}>
                          {local}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">वडा नं., टोल वा स्थान:</label>
                    <input
                      type="text"
                      value={orgFormData.address}
                      onChange={(e) => setOrgFormData({ ...orgFormData, address: e.target.value })}
                      placeholder="जस्तै: वडा नं. ६, रानीवन"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="p-3.5 bg-[#f8faf6] rounded-xl border border-[#d8e4d3] space-y-3">
                <p className="font-bold text-[#24331C] flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#4B6043]" />
                  <span>सम्पर्क तथा दर्ता विवरण (Contact & Registration):</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">फोन नं. (Phone):</label>
                    <input
                      type="text"
                      value={orgFormData.phone}
                      onChange={(e) => setOrgFormData({ ...orgFormData, phone: e.target.value })}
                      placeholder="०६४-४२०१२३"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">इमेल (Email):</label>
                    <input
                      type="email"
                      value={orgFormData.email}
                      onChange={(e) => setOrgFormData({ ...orgFormData, email: e.target.value })}
                      placeholder="office@gov.np"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">मोबाइल नं. (Mobile No.):</label>
                    <input
                      type="text"
                      value={orgFormData.mobile || orgFormData.whatsapp}
                      onChange={(e) => setOrgFormData({ ...orgFormData, mobile: e.target.value, whatsapp: e.target.value })}
                      placeholder="९८५६०६१५६५"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">स्थायी लेखा नं. (PAN):</label>
                    <input
                      type="text"
                      value={orgFormData.pan}
                      onChange={(e) => setOrgFormData({ ...orgFormData, pan: e.target.value })}
                      placeholder="३०४९२८१७२"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-mono outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">कार्यालय कोड नं.:</label>
                    <input
                      type="text"
                      value={orgFormData.registrationNo}
                      onChange={(e) => setOrgFormData({ ...orgFormData, registrationNo: e.target.value })}
                      placeholder="जस्तै: MBP-KNP-01"
                      className="w-full p-2 rounded-xl border border-[#c8d7c2] bg-white font-mono outline-none focus:ring-2 focus:ring-[#4B6043]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingOrg ? 'विवरण अद्यावधिक गर्नुहोस्' : 'कार्यालय दर्ता गर्नुहोस्'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
