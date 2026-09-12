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
  } = useApp();
  const [formData, setFormData] = useState<OrganizationSetup>({
    ...organization,
  });
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [logoPreviewError, setLogoPreviewError] = useState<boolean>(false);

  useEffect(() => {
    setFormData((prev) => ({
      ...organization,
      spreadsheetId: organization.spreadsheetId || prev.spreadsheetId,
      webAppUrl: organization.webAppUrl || prev.webAppUrl,
      driveFolderId: organization.driveFolderId || prev.driveFolderId,
    }));
  }, [organization]);

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
              className="px-6 py-2 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#394d32] rounded-xl transition-colors shadow-xs flex items-center gap-2.5 cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span className="flex flex-col items-start leading-tight">
                <span>विवरण सुरक्षित गर्नुहोस्</span>
                <span className="text-[10px] font-normal opacity-90">(Save Organization Setup)</span>
              </span>
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
    </div>
  );
};
