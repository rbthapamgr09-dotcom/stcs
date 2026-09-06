import React from 'react';
import { ArrowLeft, ArrowRight, Home, ChevronRight, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { APP_TAB_DEFINITIONS } from '../../context/AppContext';

interface PageNavigationHeaderProps {
  title?: string;
  subtitle?: string;
  customBackAction?: () => void;
  customBackLabel?: string;
  className?: string;
  hideHomeButton?: boolean;
}

export const PageNavigationHeader: React.FC<PageNavigationHeaderProps> = ({
  title,
  subtitle,
  customBackAction,
  customBackLabel,
  className = '',
  hideHomeButton = false,
}) => {
  const {
    activeTab,
    setActiveTab,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    previousTab,
    getTabLabel,
    getTabShortLabel,
  } = useApp();

  const currentTabInfo = APP_TAB_DEFINITIONS[activeTab];
  const displayTitle = title || currentTabInfo?.label || activeTab;
  const previousTabTitle = previousTab ? getTabShortLabel(previousTab) : 'ड्यासबोर्ड';

  const handleBack = () => {
    if (customBackAction) {
      customBackAction();
    } else {
      goBack();
    }
  };

  return (
    <div
      className={`bg-white/95 backdrop-blur-xs border border-[#d6e3d2] rounded-xl p-3 sm:p-3.5 shadow-xs mb-4 flex flex-wrap items-center justify-between gap-3 no-print ${className}`}
    >
      {/* Left: Back/Forward Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-1.5 bg-[#f0f6ee] p-1 rounded-lg border border-[#cbe0c6]">
          {/* Back Button */}
          <button
            onClick={handleBack}
            disabled={!canGoBack && !customBackAction}
            title={
              customBackLabel
                ? customBackLabel
                : canGoBack
                ? `अघिल्लो पृष्ठ (${previousTabTitle}) मा फर्कनुहोस् (Alt + ←)`
                : 'पछाडि जाने कुनै पृष्ठ छैन'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              canGoBack || customBackAction
                ? 'bg-[#4B6043] text-white hover:bg-[#3d5137] shadow-xs active:scale-95 cursor-pointer'
                : 'bg-gray-200/80 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>
              {customBackLabel ? customBackLabel : `पछाडि (${previousTabTitle})`}
            </span>
            <span className="hidden md:inline-block text-[10px] opacity-75 ml-0.5 font-normal">
              Alt+←
            </span>
          </button>

          {/* Forward Button */}
          {canGoForward && (
            <button
              onClick={goForward}
              title="अगाडिको पृष्ठमा जानुहोस् (Alt + →)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold bg-white text-[#24331C] border border-[#cbe0c6] hover:bg-[#e4efe0] transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span>अगाडि</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs text-[#526a48]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1 hover:text-[#24331C] font-semibold hover:underline cursor-pointer ${
              activeTab === 'dashboard' ? 'text-[#4B6043] font-bold' : ''
            }`}
            title="गृहपृष्ठ (Dashboard) मा जानुहोस्"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">गृहपृष्ठ</span>
          </button>

          {activeTab !== 'dashboard' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#9ab392] shrink-0" />
              {currentTabInfo?.category && (
                <>
                  <span className="text-[#6c8562] font-medium hidden md:inline">
                    {currentTabInfo.category}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9ab392] shrink-0 hidden md:inline" />
                </>
              )}
              <span className="font-bold text-[#24331C] bg-[#eef5eb] px-2 py-0.5 rounded border border-[#cde0c8] truncate max-w-[220px] sm:max-w-none">
                {currentTabInfo?.shortLabel || displayTitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Quick Home / Dashboard Jump if not on Dashboard */}
      {!hideHomeButton && activeTab !== 'dashboard' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbe0c6] bg-[#f7faf5] hover:bg-[#ebf4e7] text-[#3b4e34] hover:text-[#24331C] text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title="सिधै ड्यासबोर्डमा जानुहोस्"
          >
            <Home className="w-3.5 h-3.5 text-[#4B6043]" />
            <span className="hidden sm:inline">ड्यासबोर्ड (Dashboard)</span>
          </button>
        </div>
      )}
    </div>
  );
};
