import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ConfirmationModal: React.FC = () => {
  const { confirmationDialog, hideConfirmation } = useApp();

  if (!confirmationDialog.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#d8e3d0] overflow-hidden animate-scaleUp"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between pb-4 border-b border-[#e9efe4]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                confirmationDialog.isDangerous
                  ? 'bg-red-100 text-red-600'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#24331C]">
              {confirmationDialog.title}
            </h3>
          </div>
          <button
            onClick={hideConfirmation}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#415538] my-5 leading-relaxed">
          {confirmationDialog.message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e9efe4]">
          <button
            type="button"
            onClick={hideConfirmation}
            className="px-4 py-2 text-sm font-medium text-[#415538] bg-[#F6F8F3] hover:bg-[#e4ecde] rounded-lg transition-colors border border-[#d4e0ce]"
          >
            {confirmationDialog.cancelText || 'रद्द गर्नुहोस्'}
          </button>
          <button
            type="button"
            onClick={confirmationDialog.onConfirm}
            className={`px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors text-white ${
              confirmationDialog.isDangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#4B6043] hover:bg-[#3d5036]'
            }`}
          >
            {confirmationDialog.confirmText || 'स्वीकार गर्नुहोस्'}
          </button>
        </div>
      </div>
    </div>
  );
};
