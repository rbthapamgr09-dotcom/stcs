import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ToastNotification: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success':
              return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
            case 'error':
              return <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
            case 'warning':
              return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
            case 'info':
            default:
              return <Info className="w-5 h-5 text-[#4B6043] shrink-0" />;
          }
        };

        const getBgBorder = () => {
          switch (toast.type) {
            case 'success':
              return 'bg-white border-emerald-300 text-emerald-950 shadow-emerald-100';
            case 'error':
              return 'bg-white border-red-300 text-red-950 shadow-red-100';
            case 'warning':
              return 'bg-white border-amber-300 text-amber-950 shadow-amber-100';
            case 'info':
            default:
              return 'bg-white border-[#b9cfaf] text-[#24331C] shadow-[#eef5eb]';
          }
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all transform duration-300 animate-slideInRight ${getBgBorder()}`}
          >
            <div className="mt-0.5">{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold">{toast.title}</h4>
              <p className="text-xs text-[#526649] mt-0.5 leading-relaxed break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
