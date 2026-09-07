import React, { useState } from 'react';
import {
  AlertTriangle,
  Globe,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Sparkles,
  Key,
  CheckCircle2,
  ArrowRight,
  Users,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getCustomOAuthClientId,
  saveCustomOAuthClientId,
} from '../../services/googleAuthService';
import firebaseConfig from '../../../firebase-applet-config.json';

export const UnauthorizedDomainModal: React.FC = () => {
  const {
    isUnauthorizedDomainModalOpen,
    closeUnauthorizedDomainModal,
    connectGoogleAccount,
    setActiveTab,
    addToast,
  } = useApp();

  const [activeErrorTab, setActiveErrorTab] = useState<'403' | '400' | 'apps_script'>('403');
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customClientId, setCustomClientId] = useState(getCustomOAuthClientId() || '');
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isUnauthorizedDomainModalOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const firebaseProjectId = firebaseConfig.projectId || 'inner-volt-dxfhk';
  const targetEmail = 'rbthapamgr09@gmail.com';

  // Direct Console URLs
  const gcpConsentUrl = `https://console.cloud.google.com/apis/credentials/consent?project=${firebaseProjectId}`;
  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;
  const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;
  const gcpSheetsApiUrl = `https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=${firebaseProjectId}`;
  const gcpDriveApiUrl = `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${firebaseProjectId}`;

  const handleCopyEmail = () => {
    try {
      navigator.clipboard.writeText(targetEmail);
      setCopiedEmail(true);
      addToast('info', 'इमेल कपी भयो', `${targetEmail} क्लिपबोर्डमा कपी गरियो।`);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = targetEmail;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  const handleCopyOrigin = () => {
    try {
      navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      addToast('info', 'Origin कपी भयो', `${currentOrigin} क्लिपबोर्डमा कपी गरियो।`);
      setTimeout(() => setCopiedOrigin(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = currentOrigin;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2500);
    }
  };

  const handleCopyDomain = () => {
    try {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      addToast('info', 'डोमेन कपी भयो', `${currentHostname} क्लिपबोर्डमा कपी गरियो।`);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = currentHostname;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const success = await connectGoogleAccount();
      if (success) {
        closeUnauthorizedDomainModal();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveCustomClientId = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomOAuthClientId(customClientId.trim() || null);
    addToast('success', 'कन्फिगरेसन सुरक्षित भयो', 'Custom OAuth Client ID सुरक्षित गरियो। अब पुनः प्रयास गर्नुहोस्।');
  };

  const handleGoToAppsScript = () => {
    closeUnauthorizedDomainModal();
    setActiveTab('google_sheets');
    setTimeout(() => {
      const target = document.getElementById('section-apps-script');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 500, behavior: 'smooth' });
      }
    }, 200);
  };

  return (
    <div
      id="unauthorized-domain-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-red-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 p-4 sm:p-5 border-b border-red-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 bg-red-600 text-white rounded">
                  Error 403: access_denied
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-mono">
                  inner-volt-dxfhk.firebaseapp.com
                </span>
              </div>
              <h2 className="text-base font-bold text-[#24331C] mt-1">
                गुगल साइन-इन तथा OAuth अनुमति समाधान (Fix Access Denied)
              </h2>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Google Cloud को OAuth Consent Screen 'Testing' मोडमा हुँदा अनधिकृत इमेललाई Google ले रोक्दछ। तलका चरणहरू पूरा गर्नुहोस्:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeUnauthorizedDomainModal}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-gray-50/75 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveErrorTab('403')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeErrorTab === '403'
                ? 'border-red-600 text-red-700 font-bold bg-white rounded-t-lg'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Error 403: access_denied (मुख्य समाधान)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveErrorTab('400')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeErrorTab === '400'
                ? 'border-amber-600 text-amber-800 font-bold bg-white rounded-t-lg'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Error 400: origin_mismatch</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveErrorTab('apps_script')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeErrorTab === 'apps_script'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white rounded-t-lg'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Google Apps Script (१००% झन्झटरहित)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: ERROR 403: ACCESS_DENIED */}
          {activeErrorTab === '403' && (
            <div className="space-y-3.5">
              {/* Root cause explanation */}
              <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-1.5">
                <div className="font-bold text-red-950 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>समस्याको मुख्य कारण (Root Cause of Error 403):</span>
                </div>
                <p className="text-red-900 text-[11.5px] leading-relaxed">
                  Google Cloud Project <strong>`inner-volt-dxfhk`</strong> मा OAuth Consent Screen को Publishing Status <strong>"Testing"</strong> मोडमा छ। Testing मोडमा हुँदा Google ले केवल <strong>"Test users"</strong> सूचीमा दर्ता भएका इमेलहरूलाई मात्र पहुँच दिन्छ। अन्य खाताबाट लगइन गर्न खोज्दा Google ले <code>Error 403: access_denied</code> देखाउँछ।
                </p>
              </div>

              {/* Step-by-Step Fix */}
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-3 bg-white">
                <div className="font-bold text-[#24331C] text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>२ मिनेटमा समाधान गर्ने तरिका (Step-by-Step Fix):</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                    Project: {firebaseProjectId}
                  </span>
                </div>

                <div className="space-y-2.5 text-[11.5px] text-gray-700">
                  {/* Step 1 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>चरण १: Google Cloud OAuth Consent Screen खोल्नुहोस्</span>
                      <a
                        href={gcpConsentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10.5px] rounded transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>OAuth Consent Screen खोल्नुहोस् ↗</span>
                      </a>
                    </div>
                    <p className="text-gray-600 text-[11px]">
                      माथिको नीलो बटन थिची Google Cloud Project <strong>`{firebaseProjectId}`</strong> को OAuth Consent Screen मा जानुहोस्।
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200 space-y-2">
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-700" />
                      <span>चरण २: 'Test users' सूचीमा आफ्नो इमेल थप्नुहोस् (Add Test User)</span>
                    </div>
                    <p className="text-emerald-900 text-[11px] leading-relaxed">
                      खुलेको पृष्ठको तल स्क्रोल गरी <strong>"Test users"</strong> खण्डमा <strong>"+ ADD USERS"</strong> थिच्नुहोस् र आफ्नो इमेल पेस्ट गरी <strong>SAVE</strong> गर्नुहोस्:
                    </p>
                    <div className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded border border-emerald-300 font-mono text-[11px] text-emerald-950 font-bold">
                      <span>{targetEmail}</span>
                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {copiedEmail ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedEmail ? 'कपी भयो' : 'इमेल कपी'}</span>
                      </button>
                    </div>
                    <p className="text-[10.5px] text-gray-500 italic">
                      💡 विकल्प: माथि रहेको <strong>"PUBLISH APP"</strong> बटन थिचेर एपलाई 'In production' बनाइदिएमा जोसुकैले पनि सिधै लगइन गर्न सक्छन्।
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>चरण ३: Firebase मा Google Provider Enable रहेको सुनिश्चित गर्नुहोस्</span>
                      <a
                        href={firebaseProvidersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] rounded transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Firebase Providers ↗</span>
                      </a>
                    </div>
                    <p className="text-gray-600 text-[11px]">
                      Firebase Authentication मा 'Google' प्रदायक (Sign-in provider) 'Enabled' भएको र Support email मा <code>{targetEmail}</code> चयन गरिएको निश्चित गर्नुहोस्।
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>चरण ४: Google Sheets API र Drive API सक्रिय (Enable) गर्नुहोस्</span>
                      <div className="flex gap-1.5">
                        <a
                          href={gcpSheetsApiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-[10.5px] rounded"
                        >
                          <span>Sheets API ↗</span>
                        </a>
                        <a
                          href={gcpDriveApiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-[10.5px] rounded"
                        >
                          <span>Drive API ↗</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Jump to Apps Script Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-emerald-950 text-xs">
                    कन्सोलमा सेटिङ गर्न झन्झट लागेको छ?
                  </div>
                  <div className="text-emerald-800 text-[11px]">
                    Google Apps Script प्रयोग गर्नुहोस् — यसमा Google Cloud वा 403 को कुनै समस्या आउँदैन।
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveErrorTab('apps_script')}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg shrink-0 cursor-pointer shadow-xs"
                >
                  Apps Script हेर्नुहोस् ↗
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ERROR 400: ORIGIN_MISMATCH */}
          {activeErrorTab === '400' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                  <Globe className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Error 400: origin_mismatch / auth/unauthorized-domain</span>
                </div>
                <p className="text-amber-900 text-[11.5px] leading-relaxed">
                  एप चलिरहेको डोमेन वा Origin गुगलको Authorized Domains वा Authorized JavaScript Origins मा समावेश नहुँदा यो त्रुटि आउँदछ।
                </p>
              </div>

              {/* Current JavaScript Origin & Domain display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Origin (for Google Cloud Console) */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-700 block">
                    १. JavaScript Origin (Google Cloud का लागि):
                  </span>
                  <div className="flex items-center justify-between gap-1 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200 font-mono text-[11px] text-emerald-900">
                    <span className="truncate">{currentOrigin}</span>
                    <button
                      type="button"
                      onClick={handleCopyOrigin}
                      className="px-2 py-1 bg-[#4B6043] hover:bg-[#384a32] text-white text-[10px] font-bold rounded transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedOrigin ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOrigin ? 'कपी भयो' : 'कपी'}</span>
                    </button>
                  </div>
                </div>

                {/* Hostname (for Firebase Console) */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-700 block">
                    २. Host Domain (Firebase का लागि):
                  </span>
                  <div className="flex items-center justify-between gap-1 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200 font-mono text-[11px] text-emerald-900">
                    <span className="truncate">{currentHostname}</span>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2 py-1 bg-[#4B6043] hover:bg-[#384a32] text-white text-[10px] font-bold rounded transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedDomain ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDomain ? 'कपी भयो' : 'कपी'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct links */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`https://console.cloud.google.com/apis/credentials?project=${firebaseProjectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 text-[11px] font-bold rounded-lg border border-gray-300 transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3 h-3 text-blue-600" />
                  <span>Google Cloud Credentials खोल्नुहोस् ↗</span>
                </a>
                <a
                  href={firebaseAuthSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 text-[11px] font-bold rounded-lg border border-gray-300 transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3 h-3 text-amber-600" />
                  <span>Firebase Authorized Domains खोल्नुहोस् ↗</span>
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: RECOMMENDED SOLUTION: Google Apps Script Web App */}
          {activeErrorTab === 'apps_script' && (
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-emerald-100/50 border-2 border-emerald-500/50 p-4 rounded-xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    ✓
                  </span>
                  <span className="font-bold text-emerald-950 text-sm">
                    सिफारिश गरिएको १००% समाधान (No Google Cloud Setup Needed)
                  </span>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-bold text-[11px] rounded-full shadow-2xs">
                  कुनै डोमेन वा 403 प्रतिबन्ध छैन
                </span>
              </div>

              <p className="text-xs text-emerald-900 leading-relaxed">
                Google को <strong>Error 403: access_denied</strong> र <strong>Error 400: origin_mismatch</strong> दुवैबाट पूर्ण मुक्ति पाउन <strong>Google Apps Script Web App</strong> विधि प्रयोग गर्नुहोस्। यसमा कुनै पनि Google Cloud कन्सोल सेटिङ वा प्रमाणीकरण चाहिँदैन।
              </p>

              <div className="bg-white/90 border border-emerald-300/80 p-3 rounded-lg space-y-1.5 text-emerald-900 text-[11.5px]">
                <div className="font-bold text-emerald-950">३ मिनेटमा सुरु गर्नुहोस्:</div>
                <ol className="list-decimal list-inside space-y-1 text-emerald-800">
                  <li>आफ्नो Google Sheet मा <strong>Extensions &gt; Apps Script</strong> खोल्नुहोस्।</li>
                  <li>एपमा उपलब्ध स्क्रिप्ट कोड पेस्ट गरी <strong>Deploy &gt; New deployment &gt; Web app</strong> गर्नुहोस्।</li>
                  <li><strong>"Who has access"</strong> मा <strong>"Anyone"</strong> चयन गरी Deploy गर्नुहोस्।</li>
                  <li>प्राप्त Web App URL एपमा राख्नुहोस् — तुरुन्त सिंक सुरु हुन्छ!</li>
                </ol>
              </div>

              <button
                type="button"
                id="btn-goto-apps-script"
                onClick={handleGoToAppsScript}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Google Apps Script सेटिङ खोल्नुहोस् (कोड कपी गर्न)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Advanced: Custom OAuth Client ID */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 text-left font-bold text-gray-700 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-gray-500" />
                <span>उन्नत विकल्प: आफ्नै Google OAuth Client ID प्रयोग गर्ने</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAdvanced && (
              <form onSubmit={handleSaveCustomClientId} className="p-3.5 space-y-2.5 bg-white text-xs">
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  यदि तपाईंसँग आफ्नै Google Cloud Project को OAuth 2.0 Web Client ID छ (जसमा तपाईंको origin अधिकृत गरिएको छ) भने यहाँ राख्नुहोस्:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    className="flex-1 p-2 border border-gray-300 rounded-lg font-mono text-[11px] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-[#4B6043] text-white font-bold rounded-lg text-xs hover:bg-[#394c33] cursor-pointer shrink-0"
                  >
                    सुरक्षित गर्नुहोस्
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 p-3 sm:p-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-gray-500 truncate max-w-xs">
            Project: <code className="font-mono text-gray-700">{firebaseProjectId}</code>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeUnauthorizedDomainModal}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-medium rounded-xl border border-gray-300 text-xs transition-colors cursor-pointer"
            >
              बन्द गर्नुहोस्
            </button>
            <button
              type="button"
              id="btn-retry-google-signin"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-4 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'जाँच हुँदैछ...' : 'पुनः प्रयास (Retry)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
