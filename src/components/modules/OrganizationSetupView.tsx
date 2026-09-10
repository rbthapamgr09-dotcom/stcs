import React, { useState, useEffect } from 'react';
import {
  Building,
  Save,
  Image as ImageIcon,
  Eye,
  Upload,
  MapPin,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  Link2,
  Sparkles,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  LogIn,
  LogOut,
  X,
  Check,
  Globe,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Letterhead } from '../common/Letterhead';
import { NepaliTextInput } from '../common/NepaliTextInput';
import { OrganizationSetup } from '../../types';
import { toNepaliDigits } from '../../utils/nepaliCalendar';
import { compressImageToSafeBase64, normalizeLogoUrl, extractGoogleDriveFileId } from '../../utils/logoUtils';
import {
  NEPAL_PROVINCES,
  PROVINCE_DISTRICTS_MAP,
  DISTRICT_LOCAL_LEVELS_MAP,
  getDistrictsByProvince,
  getLocalLevelsByDistrict,
} from '../../data/nepalAdministrativeData';

export const OrganizationSetupView: React.FC = () => {
  const {
    organization,
    updateOrganization,
    addToast,
    syncWithGoogleSheets,
    organizations,
    activeOrganizationId,
    isGoogleAccountConnected,
    googleConnectedEmail,
    connectGoogleAccount,
    connectDirectAccount,
    disconnectGoogleAccount,
    googleSheetsConfig,
    updateGoogleSheetsConfig,
  } = useApp();
  const [formData, setFormData] = useState<OrganizationSetup>({
    ...organization,
    webAppUrl: organization.webAppUrl || googleSheetsConfig.webAppUrl || '',
    spreadsheetId: organization.spreadsheetId || googleSheetsConfig.spreadsheetId || '',
    driveFolderId: organization.driveFolderId || '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj',
  });
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [logoPreviewError, setLogoPreviewError] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [isConnectingAdmin, setIsConnectingAdmin] = useState<boolean>(false);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showAppsScriptUrlField, setShowAppsScriptUrlField] = useState<boolean>(Boolean(organization.webAppUrl || googleSheetsConfig.webAppUrl));

  // Active organization details for sync status display
  const currentOrg = organizations.find((o) => o.id === activeOrganizationId);

  useEffect(() => {
    setFormData((prev) => ({
      ...organization,
      webAppUrl: organization.webAppUrl || prev.webAppUrl || googleSheetsConfig.webAppUrl || '',
      spreadsheetId: organization.spreadsheetId || prev.spreadsheetId || googleSheetsConfig.spreadsheetId || '',
      driveFolderId: organization.driveFolderId || prev.driveFolderId || '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj',
    }));
    if (organization.webAppUrl || googleSheetsConfig.webAppUrl) {
      setShowAppsScriptUrlField(true);
    }
  }, [organization, googleSheetsConfig.webAppUrl, googleSheetsConfig.spreadsheetId]);

  const handleDirectAdminConnect = async () => {
    setIsConnectingAdmin(true);
    try {
      const ok = await connectDirectAccount('rbthapamgr09@gmail.com', 'RB Thapa Magar');
      if (ok) {
        addToast('success', 'गुगल खाता जडान भयो', 'rbthapamgr09@gmail.com खाता सफलतापूर्वक लिंक गरियो।');
        setShowConnectModal(false);
        // If spreadsheet ID is set, automatically trigger sync
        if (formData.spreadsheetId) {
          setIsSyncing(true);
          const res = await syncWithGoogleSheets('push', {
            spreadsheetIdOverride: formData.spreadsheetId,
            promptForOAuth: false,
            overrideOrganization: formData,
          });
          if (res.success) {
            addToast('success', 'सिंक सम्पन्न', 'कार्यालयको विवरण गुगल सिट्समा सुरक्षित भयो।');
          }
        }
      }
    } catch (err: any) {
      addToast('error', 'जडान असफल', err?.message || 'गुगल खाता जडान गर्न सकिएन');
    } finally {
      setIsConnectingAdmin(false);
      setIsSyncing(false);
    }
  };

  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      const ok = await connectGoogleAccount();
      if (ok) {
        setShowConnectModal(false);
        if (formData.spreadsheetId) {
          setIsSyncing(true);
          const res = await syncWithGoogleSheets('push', {
            spreadsheetIdOverride: formData.spreadsheetId,
            promptForOAuth: false,
            overrideOrganization: formData,
          });
          if (res.success) {
            addToast('success', 'सिंक सम्पन्न', 'कार्यालयको विवरण गुगल सिट्समा सुरक्षित भयो।');
          }
        }
      }
    } catch (err: any) {
      addToast('error', 'गुगल जडान असफल', err?.message || 'गुगल खाता जडान गर्न सकिएन');
    } finally {
      setIsConnectingGoogle(false);
      setIsSyncing(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await disconnectGoogleAccount();
  };

  const handleDirectSync = async () => {
    const currentWebAppUrl = (formData.webAppUrl || googleSheetsConfig.webAppUrl || '').trim();
    // If not connected to Google and no webAppUrl is set, prompt connection
    if (!isGoogleAccountConnected && !currentWebAppUrl) {
      setShowConnectModal(true);
      return;
    }

    setIsSyncing(true);
    try {
      updateOrganization(formData);
      if (formData.webAppUrl) {
        updateGoogleSheetsConfig({ webAppUrl: formData.webAppUrl });
      }
      const res = await syncWithGoogleSheets('push', {
        spreadsheetIdOverride: formData.spreadsheetId,
        promptForOAuth: true,
        overrideOrganization: formData,
      });
      if (res.success) {
        addToast('success', 'सिंक सफल भयो', 'कार्यालयको डाटा गुगल सिट्समा सफलतापूर्वक सिंक भयो।');
      }
    } catch (err: any) {
      addToast('error', 'सिंक असफल', err?.message || 'गुगल सिट्समा सिंक गर्न सकिएन');
    } finally {
      setIsSyncing(false);
    }
  };

  // Available districts based on selected province
  const availableDistricts = getDistrictsByProvince(formData.province);
  // Available local levels based on selected district
  const availableLocalLevels = getLocalLevelsByDistrict(formData.district);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const finalValue =
      name === 'phone' || name === 'mobile' || name === 'pan' || name === 'postBox'
        ? toNepaliDigits(value)
        : value;
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProvince = e.target.value;
    const districts = PROVINCE_DISTRICTS_MAP[selectedProvince] || [];
    const defaultDistrict = districts.length > 0 ? districts[0] : '';
    const defaultPalikas = defaultDistrict ? DISTRICT_LOCAL_LEVELS_MAP[defaultDistrict] || [] : [];
    const defaultLocalLevel = defaultPalikas.length > 0 ? defaultPalikas[0] : '';

    setFormData((prev) => ({
      ...prev,
      province: selectedProvince,
      district: districts.includes(prev.district) ? prev.district : defaultDistrict,
      localLevel:
        districts.includes(prev.district) && defaultPalikas.includes(prev.localLevel)
          ? prev.localLevel
          : defaultLocalLevel,
    }));
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDistrict = e.target.value;
    const palikas = DISTRICT_LOCAL_LEVELS_MAP[selectedDistrict] || [];
    const defaultLocalLevel = palikas.length > 0 ? palikas[0] : '';

    setFormData((prev) => ({
      ...prev,
      district: selectedDistrict,
      localLevel: palikas.includes(prev.localLevel) ? prev.localLevel : defaultLocalLevel,
    }));
  };

  const handleLogoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const normalized = normalizeLogoUrl(rawVal);
    setLogoPreviewError(false);
    setFormData((prev) => ({ ...prev, logoUrl: normalized }));
    
    if (rawVal && extractGoogleDriveFileId(rawVal)) {
      addToast('info', 'Google Drive लिङ्क प्रमाणीकरण', 'गुगल ड्राइभ इमेज लिङ्क स्वचालित रूपमा उच्च-गतिको प्रत्यक्ष CDN ढाँचामा रूपान्तरण भयो।');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImageToSafeBase64(file, 220, 0.88);
        setLogoPreviewError(false);
        setFormData((prev) => ({ ...prev, logoUrl: compressedDataUrl }));
        addToast('success', 'लोगो लोड भयो', 'लोगो सुरक्षित कम्प्रेसन गरी गुगल सिट्समा भण्डारणका लागि तयार गरिएको छ।');
      } catch (err) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoPreviewError(false);
          setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
          addToast('info', 'लोगो लोड भयो', 'लोगो लोड भयो।');
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all mandatory fields (Name, Office Name, Province, District, Local Level, Email)
    if (
      !formData.name.trim() ||
      !formData.officeName.trim() ||
      !formData.province.trim() ||
      !formData.district.trim() ||
      !formData.localLevel.trim() ||
      !formData.email.trim()
    ) {
      addToast('error', 'विवरण अपूर्ण', 'कृपया सबै अनिवार्य (*) चिन्ह भएका क्षेत्रहरू भर्नुहोस्।');
      return;
    }

    updateOrganization(formData);
    addToast('success', 'सुरक्षित भयो', 'कार्यालय तथा लेटरहेड विवरण र लोगो सफलतापूर्वक सुरक्षित गरियो।');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              कार्यालय तथा लेटरहेड व्यवस्थापन (Organization & Letterhead Setup)
            </h2>
            <p className="text-xs text-[#526a48]">
              प्रशासनिक संरचना अनुसार प्रदेश, जिल्ला, स्थानीय तह, कार्यालय ठेगाना र लेटरहेड विवरण
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              activeTab === 'form'
                ? 'bg-[#4B6043] text-white border-[#4B6043]'
                : 'bg-white text-[#3d5236] border-[#ccdcc7] hover:bg-[#edf4ea]'
            }`}
          >
            विवरण सम्पादन
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-[#4B6043] text-white border-[#4B6043]'
                : 'bg-white text-[#3d5236] border-[#ccdcc7] hover:bg-[#edf4ea]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>लेटरहेड पूर्वावलोकन</span>
          </button>
        </div>
      </div>

      {activeTab === 'form' ? (
        <form noValidate onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Main Mandatory Identity, Hierarchy & Location Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Office Basic Hierarchy */}
              <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e9efe4] pb-2">
                  <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#4B6043]" />
                    <span>१. संस्था, मन्त्रालय, विभाग तथा कार्यालय संरचना (Organization Hierarchy)</span>
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">
                    (* चिन्ह भएका अनिवार्य)
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Row 1: संस्था / तह र कार्यालयको नाम */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    {/* संस्था / सरकारको तह */}
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        संस्था / सरकारको तह <span className="text-red-600 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="name"
                        value={formData.name}
                        onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                        isNepali={true}
                        required
                        placeholder="जस्तै: नेपाल सरकार / प्रदेश सरकार / स्थानीय तह"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-medium"
                      />
                      <p className="text-[11px] text-[#526a48] mt-1">
                        लेटरप्याडको सबैभन्दा माथिल्लो पङ्क्तिमा प्रयोग हुने नाम
                      </p>
                    </div>

                    {/* कार्यालयको नाम */}
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        कार्यालयको नाम (Office Name) <span className="text-red-600 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="officeName"
                        value={formData.officeName}
                        onChange={(val) => setFormData((prev) => ({ ...prev, officeName: val }))}
                        isNepali={true}
                        required
                        placeholder="योजना कार्यालय / डिभिजन सडक कार्यालय / जिल्ला प्रशासन कार्यालय"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-semibold"
                      />
                      <p className="text-[11px] text-[#526a48] mt-1">
                        लेटरप्याडको मुख्य कार्यालय नामको रूपमा प्रयोग हुने
                      </p>
                    </div>
                  </div>

                  {/* Row 2: मन्त्रालय, विभाग र माथिल्लो निकाय */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    {/* मन्त्रालय */}
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        मन्त्रालय (Ministry)
                      </label>
                      <NepaliTextInput
                        name="ministryName"
                        value={formData.ministryName || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, ministryName: val }))}
                        isNepali={true}
                        placeholder="भौतिक पूर्वाधार तथा यातायात मन्त्रालय"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                      />
                    </div>

                    {/* विभाग */}
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        विभाग (Department)
                      </label>
                      <NepaliTextInput
                        name="departmentName"
                        value={formData.departmentName || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, departmentName: val }))}
                        isNepali={true}
                        placeholder="सडक विभाग / आन्तरिक राजस्व विभाग"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                      />
                    </div>

                    {/* विभाग अन्तर्गतको माथिल्लो निकाय */}
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        माथिल्लो निकाय (Directorate / Parent Body)
                      </label>
                      <NepaliTextInput
                        name="parentBodyName"
                        value={formData.parentBodyName || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, parentBodyName: val }))}
                        isNepali={true}
                        placeholder="आयोजना निर्देशनालय / सुपरिवेक्षण कार्यालय"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Administrative Location & Address */}
              <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e9efe4] pb-2">
                  <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#4B6043]" />
                    <span>२. प्रशासनिक ठेगाना (Administrative Location & Address)</span>
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">
                    (* चिन्ह भएका अनिवार्य)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start text-xs">
                  {/* Province Dropdown */}
                  <div>
                    <label className="block font-semibold text-[#304426] mb-1">
                      प्रदेश (Province) <span className="text-red-600 font-bold">*</span>
                    </label>
                    <select
                      name="province"
                      value={formData.province}
                      onChange={handleProvinceChange}
                      required
                      className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-medium"
                    >
                      <option value="">-- प्रदेश छान्नुहोस् --</option>
                      {NEPAL_PROVINCES.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* District Dropdown based on Province */}
                  <div>
                    <label className="block font-semibold text-[#304426] mb-1">
                      जिल्ला (District) <span className="text-red-600 font-bold">*</span>
                    </label>
                    <select
                      name="district"
                      value={formData.district}
                      onChange={handleDistrictChange}
                      required
                      className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-medium"
                    >
                      <option value="">-- जिल्ला छान्नुहोस् --</option>
                      {availableDistricts.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Local Level / Palika Dropdown based on District */}
                  <div>
                    <label className="block font-semibold text-[#304426] mb-1">
                      स्थानीय तह / पालिका <span className="text-red-600 font-bold">*</span>
                    </label>
                    <select
                      name="localLevel"
                      value={formData.localLevel}
                      onChange={handleChange}
                      required
                      className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-medium"
                    >
                      <option value="">-- स्थानीय तह छान्नुहोस् --</option>
                      {availableLocalLevels.map((palika) => (
                        <option key={palika} value={palika}>
                          {palika}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Specific Address / Ward / Tole */}
                  <div>
                    <label className="block font-semibold text-[#304426] mb-1">
                      वडा नं., टोल वा स्थान
                    </label>
                    <NepaliTextInput
                      name="address"
                      value={formData.address || ''}
                      onChange={(val) => setFormData((prev) => ({ ...prev, address: val }))}
                      isNepali={true}
                      placeholder="वडा नं. २, नयाँ बानेश्वर"
                      className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Contact & PAN Details */}
              <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e9efe4] pb-2">
                  <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#4B6043]" />
                    <span>३. सम्पर्क तथा प्यान विवरण (Contact & PAN Details)</span>
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">
                    (* चिन्ह भएका अनिवार्य)
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Row 1: Phone, Mobile, WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        कार्यालय फोन नं. (Phone)
                      </label>
                      <NepaliTextInput
                        name="phone"
                        value={formData.phone || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
                        isNepali={false}
                        placeholder="०१-४२२४४५५"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        मोबाईल नं. (Mobile No.)
                      </label>
                      <NepaliTextInput
                        name="mobile"
                        value={formData.mobile || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, mobile: val }))}
                        isNepali={false}
                        placeholder="९८४१२३४५६७"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        वाट्सएप नं. (WhatsApp No.)
                      </label>
                      <NepaliTextInput
                        name="whatsapp"
                        value={formData.whatsapp || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, whatsapp: val }))}
                        isNepali={false}
                        placeholder="९८५१०००००१"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Row 2: Email, PAN, Office Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        इमेल ठेगाना (Email) <span className="text-red-600 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={(val) => setFormData((prev) => ({ ...prev, email: val }))}
                        onBlur={(e) => setFormData((prev) => ({ ...prev, email: e.target.value.trim() }))}
                        isNepali={false}
                        required
                        placeholder="info@office.gov.np"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        कार्यालयको प्यान नम्बर (PAN)
                      </label>
                      <NepaliTextInput
                        name="pan"
                        value={formData.pan || formData.panNumber || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, pan: val, panNumber: val }))}
                        isNepali={false}
                        placeholder="३००१२३४५६"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        कार्यालय कोड नं. (Office Code)
                      </label>
                      <NepaliTextInput
                        name="officeCode"
                        value={formData.officeCode || formData.registrationNo || ''}
                        onChange={(val) => setFormData((prev) => ({ ...prev, officeCode: val, registrationNo: val }))}
                        isNepali={false}
                        placeholder="३२५०१३५०१ वा MBP-01"
                        className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Google Sheets & Drive Cloud Synchronization */}
              <div className="bg-[#f7faf5] p-5 rounded-2xl border border-[#c5d8bf] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dce8d7] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#2e5b31] flex items-center justify-center text-white shadow-xs shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#1e301a]">
                          ४. गुगल सिट्स तथा ड्राइभ क्लाउड सिंक (Google Sheets & Drive Sync)
                        </h3>
                      </div>
                      <p className="text-[11px] text-[#4f6b48]">
                        यस कार्यालयको कर्मचारी, तलब तथा करको सम्पूर्ण डाटा सिधै गुगल सिट र ड्राइभमा सुरक्षित हुन्छ।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Badge */}
                    {isGoogleAccountConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> गुगल खाता जडित
                      </span>
                    ) : formData.webAppUrl || googleSheetsConfig.webAppUrl ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                        <Globe className="w-3.5 h-3.5 text-blue-600" /> Web App सक्रिय
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> खाता जडान बाँकी
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowHelpModal(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#c5d8bf] bg-white hover:bg-[#eef5ec] text-[#2e5b31] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="गुगल सिट जडान र सिंक गर्ने तरिका हेर्नुहोस्"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#2e5b31]" />
                      <span>मार्गदर्शन</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectSync}
                      disabled={isSyncing || (!formData.spreadsheetId && !currentOrg?.spreadsheetId)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2e5b31] hover:bg-[#234726] active:scale-98 text-white disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'सिंक हुँदै...' : 'अहिले सिंक गर्नुहोस्'}</span>
                    </button>
                  </div>
                </div>

                {/* Google Account Authorization / Connect Banner */}
                {isGoogleAccountConnected ? (
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                        {(googleConnectedEmail || 'rbthapamgr09@gmail.com').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-950 font-mono">
                            {googleConnectedEmail || 'rbthapamgr09@gmail.com'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200/80 text-emerald-900">
                            प्रमाणीकृत (OAuth)
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700">
                          गुगल स्प्रेडसिट र ड्राइभमा डाटा सुरक्षित गर्न प्रत्यक्ष अनुमति सक्रिय छ।
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={handleGoogleConnect}
                        disabled={isConnectingGoogle}
                        className="px-2.5 py-1.5 bg-white hover:bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        {isConnectingGoogle ? 'लोड हुँदै...' : 'खाता बदल्नुहोस्'}
                      </button>
                      <button
                        type="button"
                        onClick={handleGoogleDisconnect}
                        className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        विच्छेद
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50/90 border border-amber-200/90 p-4 rounded-xl space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-950">
                          गुगल सिट जडान अनुमति आवश्यक छ (Google Authorization Required)
                        </h4>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          गुगल सुरक्षा नीति अनुसार सिटमा डाटा पठाउन पहिले गुगल खाताबाट अनुमति दिनुपर्छ वा Web App URL जोड्नुपर्छ। कृपया तलको कुनै एक विकल्पबाट तुरुन्त जडान गर्नुहोस्:
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {/* Option 1: Direct 1-Click for target admin email */}
                      <button
                        type="button"
                        onClick={handleDirectAdminConnect}
                        disabled={isConnectingAdmin || isConnectingGoogle}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck className={`w-4 h-4 ${isConnectingAdmin ? 'animate-spin' : ''}`} />
                        <span>{isConnectingAdmin ? 'जडान हुँदै...' : 'rbthapamgr09@gmail.com १-क्लिक जडान'}</span>
                      </button>

                      {/* Option 2: Universal Google Sign-In Popup */}
                      <button
                        type="button"
                        onClick={handleGoogleConnect}
                        disabled={isConnectingGoogle || isConnectingAdmin}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <LogIn className={`w-4 h-4 text-blue-600 ${isConnectingGoogle ? 'animate-spin' : ''}`} />
                        <span>{isConnectingGoogle ? 'पप-अप खुल्दैछ...' : 'गुगल खाता साइन-इन (Sign in with Google)'}</span>
                      </button>

                      {/* Option 3: Toggle Apps Script Web App URL */}
                      <button
                        type="button"
                        onClick={() => setShowAppsScriptUrlField(!showAppsScriptUrlField)}
                        className="px-2.5 py-2 text-xs font-semibold text-[#2e5b31] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{showAppsScriptUrlField ? 'Web App URL लुकाउनुहोस्' : 'वा Web App URL प्रयोग गर्नुहोस् (वैकल्पिक)'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Spreadsheet ID & Drive Folder ID Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#304426] mb-1">
                      गुगल स्प्रिडसिट आईडी (Google Spreadsheet ID)
                    </label>
                    <input
                      type="text"
                      name="spreadsheetId"
                      value={formData.spreadsheetId || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        // Extract spreadsheet ID if full URL pasted
                        const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                        const extractedId = match ? match[1] : val;
                        setFormData((prev) => ({
                          ...prev,
                          spreadsheetId: extractedId,
                          spreadsheetUrl: extractedId ? `https://docs.google.com/spreadsheets/d/${extractedId}/edit` : '',
                        }));
                      }}
                      placeholder="जस्तै: 1FYj8qaOMvDkbUEAxv-Dmhm5Ln4HqoJhh2pPLWuecQOw"
                      className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono text-[11px]"
                    />
                    <p className="text-[11px] text-[#526a48] mt-1">
                      सिटको पुरा URL वा सिट आईडी पेस्ट गर्नुहोस्।
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#304426] mb-1">
                      गुगल ड्राइभ फोल्डर आईडी (Google Drive Folder ID)
                    </label>
                    <input
                      type="text"
                      name="driveFolderId"
                      value={formData.driveFolderId || '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj'}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const match = val.match(/\/folders\/([a-zA-Z0-9-_]+)/);
                        const extractedId = match ? match[1] : val;
                        setFormData((prev) => ({ ...prev, driveFolderId: extractedId }));
                      }}
                      placeholder="1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj"
                      className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-mono text-[11px]"
                    />
                    <p className="text-[11px] text-[#526a48] mt-1">
                      कार्यालयको ब्याकअप र फाइल सुरक्षित हुने आधिकारिक ड्राइभ फोल्डर आईडी
                    </p>
                  </div>
                </div>

                {/* Optional Google Apps Script Web App URL Input */}
                {showAppsScriptUrlField && (
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-blue-950 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-700" />
                        <span>Google Apps Script Web App URL (वैकल्पिक / Zero-OAuth Sync)</span>
                      </label>
                      <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-medium">
                        बिना कुनै पप-अप अनुमति
                      </span>
                    </div>
                    <input
                      type="url"
                      name="webAppUrl"
                      value={formData.webAppUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setFormData((prev) => ({ ...prev, webAppUrl: val }));
                        updateGoogleSheetsConfig({ webAppUrl: val });
                      }}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="w-full p-2.5 rounded-lg border border-blue-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none font-mono text-[11px]"
                    />
                    <p className="text-[11px] text-blue-800">
                      यदि तपाईंले Google Apps Script Deploy गरी Web App URL बनाउनुभएको छ भने यहाँ राख्नुहोस्। यसले प्रत्यक्ष रूपमा सिंक गर्नेछ।
                    </p>
                  </div>
                )}

                {/* Direct Google Sheet Link & Quick Open */}
                {formData.spreadsheetId && (
                  <div className="pt-1 flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-[#d6e3d2]">
                    <span className="text-[11px] text-[#4f6b48] truncate font-mono">
                      https://docs.google.com/spreadsheets/d/{formData.spreadsheetId}/edit
                    </span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${formData.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#2e5b31] hover:underline font-semibold shrink-0 ml-2"
                    >
                      <span>सिट खोल्नुहोस्</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Logo Upload & Letterhead Alignment */}
            <div className="space-y-6">
              {/* Logo Upload Card */}
              <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#4B6043]" />
                  <span>कार्यालयको लोगो (Office Logo)</span>
                </h3>
                <p className="text-xs text-[#526a48]">
                  सरकारी निशान छाप वा कार्यालयको आधिकारिक लोगो (PNG / JPG)
                </p>

                <div className="border-2 border-dashed border-[#c8d8c3] rounded-xl p-4 text-center bg-[#fbfdfa] flex flex-col items-center justify-center gap-2">
                  {formData.logoUrl && !logoPreviewError ? (
                    <div className="relative flex flex-col items-center">
                      <img
                        src={normalizeLogoUrl(formData.logoUrl)}
                        alt="Logo"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoPreviewError(true)}
                        className="max-h-28 max-w-28 object-contain rounded-lg border border-gray-200 p-1 bg-white shadow-xs"
                      />
                      {extractGoogleDriveFileId(formData.logoUrl) && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          Google Drive प्रत्यक्ष लिङ्क सक्रिय
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, logoUrl: '' }));
                          setLogoPreviewError(false);
                        }}
                        className="text-[10px] text-red-600 hover:text-red-800 underline mt-2 block mx-auto cursor-pointer"
                      >
                        लोगो हटाउनुहोस्
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">
                        {logoPreviewError ? 'तस्बिर लोड हुन सकेन (लिङ्क वा अनुमति जाँच गर्नुहोस्)' : 'कुनै लोगो चयन गरिएको छैन'}
                      </p>
                      <p className="text-[10px] text-gray-400">(पूर्वनिर्धारित सरकारी निशान छाप प्रयोग हुनेछ)</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    <label className="cursor-pointer px-3 py-1.5 bg-[#edf4ea] text-[#3e5537] text-xs font-bold rounded-lg hover:bg-[#dbe7d7] transition-colors border border-[#c5d7bf] flex items-center gap-1.5 shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>कम्प्युटरबाट लोगो अपलोड</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="w-full mt-2 pt-2 border-t border-gray-100 text-left">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      वा बाह्य लोगो लिङ्क (Direct Image / Google Drive Share URL):
                    </label>
                    <input
                      type="url"
                      value={formData.logoUrl?.startsWith('data:') ? '' : formData.logoUrl || ''}
                      onChange={handleLogoUrlChange}
                      placeholder={formData.logoUrl?.startsWith('data:') ? 'तस्बिर फाइल अपलोड गरिएको छ' : 'https://drive.google.com/file/d/... वा https://.../logo.png'}
                      className="w-full p-1.5 text-xs rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-1 focus:ring-[#4B6043] outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      💡 <strong>सुझाव:</strong> Google Drive को लोगो लिङ्क राख्दा Drive मा उक्त फाइलको Share Access <em>"Anyone with the link can view" (लिङ्क भएका जोकोहीले हेर्न मिल्ने)</em> बनाएको हुनुपर्छ।
                    </p>
                  </div>

                  <div className="w-full mt-1 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-left flex items-start gap-1.5 text-[11px] text-emerald-800">
                    <span className="font-bold">✓ सिङ्क्रोनाइजेसन:</span>
                    <span>यो लोगो गुगल सिटको <strong>कार्यालय_विवरण</strong> पानामा सुरक्षित हुन्छ र लगइन गर्दा स्वतः लेटरप्याडमा देखिनेछ।</span>
                  </div>
                </div>
              </div>

              {/* Letterhead Alignment */}
              <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-3 text-xs">
                <label className="block font-semibold text-[#304426]">
                  लेटरहेड अलाइनमेन्ट (Alignment) <span className="text-red-600 font-bold">*</span>
                </label>
                <select
                  name="alignment"
                  value={formData.alignment}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none font-medium"
                >
                  <option value="center">केन्द्र (Center Aligned - मानक)</option>
                  <option value="left">बायाँ (Left Aligned)</option>
                  <option value="right">दायाँ (Right Aligned)</option>
                </select>
                <p className="text-[11px] text-[#526a48]">
                  प्रतिवेदन तथा भरपाईको शीर्ष भागमा कार्यालयको नाम संरेखण (अलाइनमेन्ट)
                </p>
              </div>

              {/* Authorized Signatory Details */}
              <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-3 text-xs">
                <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#4B6043]" />
                  <span>प्रमाणित गर्ने अधिकृत (Authorized Signatory)</span>
                </h3>
                <div>
                  <label className="block font-semibold text-[#304426] mb-1">
                    अधिकृत व्यक्तिको नाम
                  </label>
                  <NepaliTextInput
                    name="authorizedPersonName"
                    value={formData.authorizedPersonName || ''}
                    onChange={(val) => setFormData((prev) => ({ ...prev, authorizedPersonName: val }))}
                    isNepali={true}
                    placeholder="राम प्रसाद शर्मा"
                    className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#304426] mb-1">
                    पद (Designation)
                  </label>
                  <NepaliTextInput
                    name="authorizedPersonDesignation"
                    value={formData.authorizedPersonDesignation || ''}
                    onChange={(val) => setFormData((prev) => ({ ...prev, authorizedPersonDesignation: val }))}
                    isNepali={true}
                    placeholder="कार्यालय प्रमुख / लेखा अधिकृत"
                    className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d8e4d2]">
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#394d32] rounded-xl transition-colors shadow-xs flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>विवरण सुरक्षित गर्नुहोस् (Save Organization Setup)</span>
            </button>
          </div>
        </form>
      ) : (
        /* Live Letterhead Preview Mode */
        <div className="bg-white p-8 rounded-2xl border border-[#d6e3d2] shadow-xs max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none print:bg-transparent print:max-w-full">
          <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3 no-print">
            <span className="text-xs font-bold text-[#4B6043] uppercase tracking-wider">
              लेटरहेड प्रत्यक्ष पूर्वावलोकन (Live Document Preview)
            </span>
            <button
              onClick={() => window.print()}
              className="text-xs text-[#4B6043] underline font-medium cursor-pointer"
            >
              प्रिन्ट गरी हेर्नुहोस्
            </button>
          </div>
          <Letterhead showSignatureSection={false} />
        </div>
      )}

      {/* Modal 1: Google Connection Required Prompt Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    गुगल सिट जडान आवश्यक छ
                  </h3>
                  <p className="text-xs text-gray-500">
                    Google Sheets Authorization Required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-700 space-y-2 leading-relaxed bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
              <p className="font-semibold text-amber-900">
                तपाईंको स्प्रेडसिट आईडी सेट गरिएको छ तर डाटा सिंक गर्न गुगल अनुमति बाँकी छ।
              </p>
              <p className="text-amber-800">
                गुगल सुरक्षा नीति अनुसार सिटमा डाटा थप्न (Write Permission) का लागि १ पटक गुगल खाता प्रमाणीकरण गर्नुपर्दछ। कृपया तलको कुनै एक विकल्प छान्नुहोस्:
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: 1-Click for Admin Email */}
              <button
                type="button"
                onClick={handleDirectAdminConnect}
                disabled={isConnectingAdmin || isConnectingGoogle}
                className="w-full p-3 bg-emerald-700 hover:bg-emerald-800 active:scale-99 text-white rounded-xl font-semibold text-xs flex items-center justify-between transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">rbthapamgr09@gmail.com १-क्लिक जडान</div>
                    <div className="text-[11px] text-emerald-100 font-normal">
                      सिधै एडमिन खाता जडान गरि तुरुन्त सिंक गर्नुहोस्
                    </div>
                  </div>
                </div>
                <span className="text-[11px] bg-emerald-800/80 px-2.5 py-1 rounded-md font-bold">
                  {isConnectingAdmin ? 'जडान हुँदै...' : 'सिफारिस'}
                </span>
              </button>

              {/* Option 2: Universal Google Sign-In Popup */}
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={isConnectingGoogle || isConnectingAdmin}
                className="w-full p-3 bg-white hover:bg-gray-50 active:scale-99 border border-gray-300 text-gray-800 rounded-xl font-semibold text-xs flex items-center justify-between transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <LogIn className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-bold">गुगल खाता साइन-इन (Sign in with Google)</div>
                    <div className="text-[11px] text-gray-500 font-normal">
                      कुनै पनि गुगल खाताको पप-अप मार्फत अनुमति दिनुहोस्
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 font-medium">
                  {isConnectingGoogle ? 'पप-अप खुल्दैछ...' : 'OAuth'}
                </span>
              </button>

              {/* Option 3: Apps Script Web App URL */}
              <button
                type="button"
                onClick={() => {
                  setShowConnectModal(false);
                  setShowAppsScriptUrlField(true);
                }}
                className="w-full p-3 bg-blue-50/70 hover:bg-blue-100/70 active:scale-99 border border-blue-200 text-blue-900 rounded-xl font-semibold text-xs flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Globe className="w-4 h-4 text-blue-700 shrink-0" />
                  <div>
                    <div className="font-bold">Google Apps Script Web App URL प्रयोग गर्नुहोस्</div>
                    <div className="text-[11px] text-blue-700 font-normal">
                      बिना गुगल पप-अप अनुमति सिधै Web App मार्फत सिंक गर्नुहोस्
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-blue-800 font-medium">वैकल्पिक</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                बन्द गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Google Sheets & Drive Sync Help Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    गुगल सिट तथा ड्राइभ सिंक मार्गदर्शन
                  </h3>
                  <p className="text-xs text-gray-500">
                    Google Sheets & Drive Integration Guide
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-1">
                <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>"गुगल सिट जडान आवश्यक" त्रुटि किन आउँछ?</span>
                </h4>
                <p className="text-amber-900">
                  गुगल स्प्रिडसिट आईडी मात्र राख्नु भनेको घरको ठेगाना थाहा पाउनु जस्तै हो। घरभित्र सामान राख्न (डाटा सुरक्षित गर्न) गुगलले सुरक्षाका लागि खाताको साँचो (Authentication Key) माग्छ।
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>समाधानका २ सजिला तरिकाहरू:</span>
                </h4>

                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
                  <span className="font-bold text-emerald-950">
                    १. सिफारिस गरिएको विधि: गुगल खाता जडान (Sign In with Google)
                  </span>
                  <p className="text-emerald-800">
                    खण्ड ४ मा रहेको <strong>"rbthapamgr09@gmail.com १-क्लिक जडान"</strong> वा <strong>"गुगल खाता साइन-इन"</strong> बटन थिच्नुहोस्। यसले गुगलसँग सुरक्षित अनुमति जोड्छ। त्यसपछि <strong>"अहिले सिंक गर्नुहोस्"</strong> थिच्दा सिटमा डाटा तुरुन्तै जान्छ।
                  </p>
                </div>

                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1">
                  <span className="font-bold text-blue-950">
                    २. वैकल्पिक विधि: Google Apps Script Web App URL
                  </span>
                  <p className="text-blue-800">
                    यदि तपाईं गुगल पप-अप अनुमति बिना सिंक गर्न चाहनुहुन्छ भने, <strong>"Google Apps Script Web App URL"</strong> बाकस खोलेर आफ्नो Apps Script Web App को URL पेस्ट गर्नुहोस्। यसबाट बिना कुनै पप-अप सिधै डाटा सिंक हुन्छ।
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1.5">
                <h4 className="font-bold text-gray-800">स्प्रिडसिट आईडी कहाँ पाइन्छ?</h4>
                <p className="text-gray-600 font-mono text-[11px] bg-white p-2 rounded border border-gray-200 select-all">
                  https://docs.google.com/spreadsheets/d/<strong>1FYj8qaOMvDkbUEAxv-Dmhm5Ln4HqoJhh2pPLWuecQOw</strong>/edit
                </p>
                <p className="text-gray-500 text-[11px]">
                  /d/ र /edit बीचको अक्षरहरूको लामो कोड नै तपाईंको स्प्रिडसिट आईडी हो।
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 bg-[#2e5b31] hover:bg-[#234726] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                बुझेँ, धन्यवाद
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
