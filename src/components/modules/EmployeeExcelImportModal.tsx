import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
  FileText,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  parseEmployeeExcelFile,
  downloadEmployeeRegistrationTemplate,
  ParsedEmployeeRow,
} from '../../services/employeeExcelTemplateService';
import { toDisplayDigits, formatNepaliNumber } from '../../utils/nepaliCalendar';

interface EmployeeExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EmployeeExcelImportModal: React.FC<EmployeeExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    activeFiscalYear,
    organization,
    activeOrganization,
    employees,
    salarySetups,
    deductionSetups,
    bulkImportEmployees,
    hasPermission,
    addToast,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<{
    rows: ParsedEmployeeRow[];
    totalRows: number;
    validCount: number;
    errorCount: number;
    existingCount: number;
    newCount: number;
  } | null>(null);

  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'update' | 'error'>('all');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      addToast('error', 'अमान्य फाइल ढाँचा', 'कृपया .xlsx, .xls वा .csv फाइल मात्र अपलोड गर्नुहोस्।');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseEmployeeExcelFile(buffer, employees);
      setParseResult(result);
      if (result.errorCount > 0) {
        setActiveFilter('error');
      } else {
        setActiveFilter('all');
      }
    } catch (err: any) {
      console.error('Failed to parse Excel file:', err);
      addToast('error', 'फाइल पढ्न असफल', err?.message || 'एक्सेल फाइल पार्स गर्न सकिएन। कृपया सही टेम्प्लेट प्रयोग गर्नुहोस्।');
      setParseResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleImportSubmit = () => {
    if (!parseResult) return;
    if (!hasPermission('EDIT_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर्मचारी विवरण थप्न वा सम्पादन गर्न अधिकार आवश्यक पर्दछ।');
      return;
    }

    const validRows = parseResult.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      addToast('warning', 'कुनै मान्य डाटा छैन', 'अपलोड गरिएको फाइलमा कुनै पनि मान्य कर्मचारी डाटा छैन।');
      return;
    }

    const itemsToImport = validRows.map((r) => ({
      employee: r.employee,
      salary: r.salary,
      deduction: r.deduction,
      isExisting: r.isExisting,
      existingId: r.existingId,
    }));

    const result = bulkImportEmployees(itemsToImport, updateExisting);
    if (result.added > 0 || result.updated > 0) {
      if (onSuccess) onSuccess();
      onClose();
    }
  };

  const filteredRows = (parseResult?.rows || []).filter((r) => {
    if (activeFilter === 'new') return r.isValid && !r.isExisting;
    if (activeFilter === 'update') return r.isValid && r.isExisting;
    if (activeFilter === 'error') return !r.isValid;
    return true;
  });

  const handleDownloadBlankTemplate = () => {
    downloadEmployeeRegistrationTemplate({
      fiscalYear: activeFiscalYear,
      organization,
      activeOrganization,
    });
    addToast('success', 'टेम्प्लेट डाउनलोड भयो', 'खाली कर्मचारी दर्ता एक्सेल टेम्प्लेट डाउनलोड भएको छ।');
    setShowTemplateMenu(false);
  };

  const handleDownloadPrefilledTemplate = () => {
    downloadEmployeeRegistrationTemplate({
      fiscalYear: activeFiscalYear,
      organization,
      activeOrganization,
      prefillEmployees: employees,
      salarySetups,
      deductionSetups,
    });
    addToast('success', 'टेम्प्लेट डाउनलोड भयो', `हालका ${employees.length} जना कर्मचारीको विवरण भरिएको टेम्प्लेट डाउनलोड भएको छ।`);
    setShowTemplateMenu(false);
  };

  return (
    <div
      id="employee-excel-import-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="employee-excel-import-modal-card"
        className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                कर्मचारी विवरण तथा तलब/आय Excel Import
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  आ.व. {toDisplayDigits(activeFiscalYear)}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                नयाँ कर्मचारी दर्ता तथा तलब/कट्टी सम्बन्धी सम्पूर्ण विवरणहरू Excel फाइलबाट एकमुष्ठ Import गर्नुहोस्
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Template Download Button Dropdown */}
            <div className="relative">
              <button
                id="btn-template-download-menu"
                type="button"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>टेम्प्लेट डाउनलोड</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {showTemplateMenu && (
                <div
                  id="template-dropdown-menu"
                  className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-20"
                >
                  <button
                    type="button"
                    onClick={handleDownloadBlankTemplate}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="font-semibold">खाली दर्ता टेम्प्लेट (नमुना सहित)</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">नयाँ कर्मचारीहरूको विवरण भर्नका लागि</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPrefilledTemplate}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-700/50"
                  >
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-semibold">हालका कर्मचारीहरूको डाटा भरिएको टेम्प्लेट</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        विद्यमान {toDisplayDigits(employees.length)} जना कर्मचारीहरूको विवरण सम्पादन गर्न
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              id="btn-close-excel-import-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!parseResult ? (
            /* Upload Zone State */
            <div className="space-y-6">
              <div
                id="excel-drop-zone"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-4 ring-emerald-500/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>

                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                  कर्मचारी दर्ता एक्सेल (.xlsx, .xls) फाइल यहाँ ड्रप गर्नुहोस्
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-md">
                  अथवा आफ्नो कम्प्युटरबाट फाइल छनोट गर्न यहाँ क्लिक गर्नुहोस्। फाइलमा कर्मचारीको व्यक्तिगत विवरण, पद, तलब, ग्रेड, भत्ता र कट्टी समावेश हुनुपर्छ।
                </p>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span className="flex flex-col text-left leading-tight">
                    <span>फाइल छनोट गर्नुहोस्</span>
                    <span className="text-[9px] font-normal opacity-85">(Browse File)</span>
                  </span>
                </div>
              </div>

              {/* Instructions & Template Assistance Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Excel Template सम्बन्धी महत्वपूर्ण निर्देशनहरू:</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px]">
                        १
                      </span>
                      <span>अनिवार्य फिल्डहरू</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      कर्मचारी संकेत नं., पूरा नाम, पद, श्रेणी/तह, सेवा प्रकार (स्थायी/अस्थायी/करार) र लिङ्ग अनिवार्य छन्।
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">
                        २
                      </span>
                      <span>अंक र मिति ढाँचा</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      तलब, भत्ता र कट्टीमा नेपाली वा अंग्रेजी दुबै अंक प्रविष्ट गर्न सकिन्छ। मितिमा YYYY/MM/DD (जस्तै: २०७०/०४/०१) प्रयोग गर्नुहोस्।
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[10px]">
                        ३
                      </span>
                      <span>संकेत नं. मिलान र अपडेट</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      पहिले नै प्रणालीमा रहेको कर्मचारी संकेत नं. भेटिएमा सो कर्मचारीको डाटा स्वतः अपडेट हुन्छ (वा आवश्यकता अनुसार स्किप गर्न सकिन्छ)।
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    यदि तपाईंसँग आधिकारिक ढाँचाको Excel Template छैन भने:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadBlankTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>नमुना टेम्प्लेट डाउनलोड गर्नुहोस्</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Parsed & Validation Preview State */
            <div className="space-y-4">
              {/* File Info & Quick Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span>{selectedFile?.name}</span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        ({((selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      कुल {toDisplayDigits(parseResult.totalRows)} रेकर्डहरू फेला परे
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParseResult(null);
                      setSelectedFile(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>अर्को फाइल छान्नुहोस्</span>
                  </button>
                </div>
              </div>

              {/* Statistics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeFilter === 'all'
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">कुल कर्मचारी डाटा</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {toDisplayDigits(parseResult.totalRows)} जना
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilter('new')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeFilter === 'new'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />
                    <span>नयाँ थपिने</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {toDisplayDigits(parseResult.newCount)} जना
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilter('update')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeFilter === 'update'
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    <span>अपडेट हुने</span>
                  </div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    {toDisplayDigits(parseResult.existingCount)} जना
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilter('error')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeFilter === 'error'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    <span>त्रुटि / अधुरो</span>
                  </div>
                  <div className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                    {toDisplayDigits(parseResult.errorCount)} जना
                  </div>
                </button>
              </div>

              {/* Conflict Options & Settings */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
                  />
                  <span>विद्यमान कर्मचारी संकेत नं. मिलेमा अद्यावधिक (Update) गर्ने</span>
                </label>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  देखाइएको रेकर्ड: <span className="font-bold text-slate-700 dark:text-slate-200">{toDisplayDigits(filteredRows.length)}</span>
                </div>
              </div>

              {/* Parsed Rows Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/90 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">क्र.सं.</th>
                        <th className="py-2.5 px-3">संकेत नं.</th>
                        <th className="py-2.5 px-3">कर्मचारीको नाम</th>
                        <th className="py-2.5 px-3">पद तथा तह</th>
                        <th className="py-2.5 px-3">सेवा / लिङ्ग</th>
                        <th className="py-2.5 px-3 text-right">शुरु तलब स्केल</th>
                        <th className="py-2.5 px-3 text-center">ग्रेड संख्या</th>
                        <th className="py-2.5 px-3 text-center">स्थिति (Status)</th>
                        <th className="py-2.5 px-3 text-center w-16">विवरण</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-900">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                            यस फिल्टर अन्तर्गत कुनै डाटा फेला परेन।
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => {
                          const isExpanded = expandedRowIndex === row.rowIndex;
                          return (
                            <React.Fragment key={`row-${row.rowIndex}-${idx}`}>
                              <tr
                                className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                                  !row.isValid
                                    ? 'bg-rose-50/30 dark:bg-rose-950/10'
                                    : row.isExisting
                                    ? 'bg-amber-50/20 dark:bg-amber-950/10'
                                    : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                                  {toDisplayDigits(idx + 1)}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100 font-mono">
                                  {toDisplayDigits(row.employee.code)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                                    {row.employee.name}
                                  </div>
                                  {row.employee.panNumber && (
                                    <div className="text-[10px] text-slate-500">
                                      PAN: {toDisplayDigits(row.employee.panNumber)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="text-slate-700 dark:text-slate-300 font-medium">
                                    {row.employee.designation}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {row.employee.level}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mr-1.5">
                                    {row.employee.serviceType}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {row.employee.gender}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {formatNepaliNumber(row.salary.basicSalary || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">
                                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    {toDisplayDigits(Number(row.salary.previousGradeCount || 0) + Number(row.salary.addedGradeCount || 0))}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    ({toDisplayDigits(row.salary.previousGradeCount || 0)}+{toDisplayDigits(row.salary.addedGradeCount || 0)})
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {!row.isValid ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                                      <XCircle className="w-3 h-3" />
                                      <span>त्रुटि ({toDisplayDigits(row.errors.length)})</span>
                                    </span>
                                  ) : row.isExisting ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                      <RefreshCw className="w-3 h-3" />
                                      <span>अपडेट</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>नयाँ</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRowIndex(isExpanded ? null : row.rowIndex)}
                                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                                  >
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Row Detail */}
                              {isExpanded && (
                                <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                                  <td colSpan={9} className="p-4 border-t border-b border-slate-200 dark:border-slate-700 space-y-3">
                                    {!row.isValid && row.errors.length > 0 && (
                                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                                        <div className="font-bold mb-1 flex items-center gap-1.5">
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          <span>सच्याउनुपर्ने त्रुटिहरू:</span>
                                        </div>
                                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                          {row.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1.5">
                                          व्यक्तिगत तथा बैंकिङ विवरण
                                        </div>
                                        <div><span className="text-slate-500">वैवाहिक स्थिति:</span> {row.employee.filingType}</div>
                                        <div><span className="text-slate-500">दुर्गम वर्ग:</span> {row.employee.remoteArea}</div>
                                        <div><span className="text-slate-500">अपाङ्गता:</span> {row.employee.disability}</div>
                                        <div><span className="text-slate-500">निवृत्तिभरण:</span> {row.employee.pension}</div>
                                        <div><span className="text-slate-500">बैंक:</span> {row.employee.bankName || 'राष्ट्रिय वाणिज्य बैंक'}</div>
                                        <div><span className="text-slate-500">खाता नं:</span> {row.employee.bankAccount || '-'}</div>
                                        <div><span className="text-slate-500">नियुक्ति मिति (BS):</span> {toDisplayDigits(row.employee.joinedDateBS)}</div>
                                      </div>

                                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1.5">
                                          तलब, ग्रेड तथा भत्ता विवरण
                                        </div>
                                        <div><span className="text-slate-500">ग्रेड दर:</span> {formatNepaliNumber(row.salary.gradeRate || 0)}</div>
                                        <div><span className="text-slate-500">प्राविधिक ग्रेड:</span> {formatNepaliNumber(row.salary.technicalGradeAmount || 0)}</div>
                                        <div><span className="text-slate-500">ग्रेड वृद्धि महिना:</span> {row.salary.gradeIncreaseMonth}</div>
                                        <div><span className="text-slate-500">सा.जी.वि. कोष (मासिक):</span> {formatNepaliNumber(row.salary.lifeInsuranceFund || 0)}</div>
                                        <div><span className="text-slate-500">महङ्गी भत्ता (मासिक):</span> {formatNepaliNumber(row.salary.dearnessAllowance || 0)}</div>
                                        <div><span className="text-slate-500">पोशाक भत्ता (वार्षिक):</span> {formatNepaliNumber(row.salary.uniformAllowance || 0)} ({row.salary.uniformAllowanceMonth || 'चैत्र'} महिना)</div>
                                        <div><span className="text-slate-500">चाडपर्व खर्च महिना:</span> {row.salary.festivalBonusMonth}</div>
                                      </div>

                                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1.5">
                                          कट्टी तथा कर छुट विवरण
                                        </div>
                                        <div><span className="text-slate-500">ना.ल.कोष (मासिक):</span> {formatNepaliNumber(row.deduction.citizenInvestmentTrust || 0)}</div>
                                        <div><span className="text-slate-500">जीवन बिमा प्रिमियम (वार्षिक):</span> {formatNepaliNumber(row.deduction.investmentInsuranceDeduction || 0)}</div>
                                        <div><span className="text-slate-500">स्वास्थ्य बिमा छुट (वार्षिक):</span> {formatNepaliNumber(row.deduction.healthInsuranceDeduction || 0)}</div>
                                        <div><span className="text-slate-500">घर बिमा छुट (वार्षिक):</span> {formatNepaliNumber(row.deduction.homeInsuranceDeduction || 0)}</div>
                                        <div><span className="text-slate-500">सापटी/ऋण कट्टी (मासिक):</span> {formatNepaliNumber(row.deduction.loanDeduction || 0)}</div>
                                        <div><span className="text-slate-500">विविध कट्टी (मासिक):</span> {formatNepaliNumber(row.deduction.otherDeduction || 0)}</div>
                                        <div><span className="text-slate-500">औषधी उपचार खर्च मिलान:</span> {formatNepaliNumber(row.deduction.medicalExpenseActual || 0)}</div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            {parseResult && (
              <button
                type="button"
                onClick={() => {
                  setParseResult(null);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
              >
                रद्द गरी पुन: छान्नुहोस्
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-cancel-excel-import"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              बन्द गर्नुहोस्
            </button>

            {parseResult && (
              <button
                id="btn-confirm-excel-import"
                type="button"
                disabled={parseResult.validCount === 0 || isProcessing}
                onClick={handleImportSubmit}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {toDisplayDigits(parseResult.validCount)} जना कर्मचारी डाटा Import गर्नुहोस्
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
