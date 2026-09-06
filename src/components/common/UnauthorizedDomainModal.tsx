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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getCustomOAuthClientId,
  saveCustomOAuthClientId,
} from '../../services/googleAuthService';

export const UnauthorizedDomainModal: React.FC = () => {
  const {
    isUnauthorizedDomainModalOpen,
    closeUnauthorizedDomainModal,
    connectGoogleAccount,
    setActiveTab,
    addToast,
  } = useApp();

  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customClientId, setCustomClientId] = useState(getCustomOAuthClientId() || '');
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isUnauthorizedDomainModalOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const firebaseProjectId = 'gen-lang-client-0345331855';
  const gcpCredentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${firebaseProjectId}`;
  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;

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
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 bg-red-200/80 text-red-900 rounded">
                  Error 400: origin_mismatch
                </span>
                <span className="text-[10px] text-gray-500 font-mono">auth/unauthorized-domain</span>
              </div>
              <h2 className="text-base font-bold text-[#24331C] mt-1">
                गुगल साइन-इन तथा स्प्रेडसिट जडान समस्या समाधान
              </h2>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                क्लाउडफ्लेयर (Cloudflare) वा नयाँ डोमेन गुगलको अधिकृत सूचीमा पूर्व-दर्ता नहुँदा यो त्रुटि देखा परेको हो।
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* RECOMMENDED SOLUTION: Google Apps Script Web App */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-emerald-100/50 border-2 border-emerald-500/50 p-4 rounded-xl space-y-2.5 shadow-xs">
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
                कुनै डोमेन प्रतिबन्ध छैन
              </span>
            </div>

            <p className="text-xs text-emerald-900 leading-relaxed">
              गुगलको <strong>Error 400: origin_mismatch</strong> बाट पूर्ण मुक्ति पाउन र Cloudflare बाट सिधै Google Sheets मा डाटा सिंक गर्न <strong>Google Apps Script Web App</strong> विधि प्रयोग गर्नुहोस्। यसमा कुनै पनि कन्सोल सेटिङ चाहिँदैन।
            </p>

            <div className="bg-white/90 border border-emerald-300/80 p-3 rounded-lg space-y-1 text-emerald-900 text-[11.5px]">
              <div className="font-bold text-emerald-950">३ मिनेटमा सुरु गर्नुहोस्:</div>
              <ol className="list-decimal list-inside space-y-0.5 text-emerald-800">
                <li>आफ्नो Google Sheet मा <strong>Extensions &gt; Apps Script</strong> खोल्नुहोस्।</li>
                <li>एपमा तयार पारिएको स्क्रिप्ट पेस्ट गरि <strong>Deploy &gt; Web App</strong> गर्नुहोस्।</li>
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
              <span>Google Apps Script विधि खोल्नुहोस् (निर्देशन र कोड हेर्नुहोस्)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* SECONDARY OPTION: If user wants direct OAuth */}
          <div className="border border-gray-200 rounded-xl p-3.5 space-y-3 bg-[#fafbfa]">
            <div className="font-bold text-[#24331C] text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#4B6043]" />
              <span>वैकल्पिक विधि: Google Cloud / Firebase मा JavaScript Origin दर्ता गर्ने</span>
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
                    className="px-2 py-1 bg-[#4B6043] hover:bg-[#384a32] text-white text-[10px] font-bold rounded transition-colors shrink-0 flex items-center gap-1"
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
                    className="px-2 py-1 bg-[#4B6043] hover:bg-[#384a32] text-white text-[10px] font-bold rounded transition-colors shrink-0 flex items-center gap-1"
                  >
                    {copiedDomain ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDomain ? 'कपी भयो' : 'कपी'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Direct console links */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={gcpCredentialsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 text-[11px] font-bold rounded-lg border border-gray-300 transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3 h-3 text-blue-600" />
                <span>Google Cloud Credentials खोल्नुहोस् ↗</span>
              </a>
              <a
                href={firebaseConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 text-[11px] font-bold rounded-lg border border-gray-300 transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3 h-3 text-amber-600" />
                <span>Firebase Authorized Domains खोल्नुहोस् ↗</span>
              </a>
            </div>
          </div>

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
                  यदि तपाईंसँग आफ्नै Google Cloud Project को OAuth 2.0 Web Client ID छ (जसमा तपाईंको Cloudflare origin अधिकृत गरिएको छ) भने यहाँ राख्नुहोस्:
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
            Origin: <code className="font-mono text-gray-700">{currentOrigin}</code>
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

