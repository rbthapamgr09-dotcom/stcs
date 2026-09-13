import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      window.location.hash = 'dashboard';
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  private handleGoHome = () => {
    try {
      window.location.hash = 'dashboard';
      this.setState({ hasError: false, error: null, errorInfo: null });
    } catch {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'अज्ञात त्रुटि';

      return (
        <div className="min-h-screen bg-[#F6F8F3] text-[#24331C] flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl border border-red-200 shadow-xl p-6 sm:p-8 space-y-5 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                पृष्ठ लोड गर्दा समस्या देखा पर्यो
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                ब्राउजर वा गुगल प्रमाणीकरण सम्बन्धी अवरोधका कारण यो पृष्ठ खोल्न कठिनाइ भयो। तलको बटन थिचेर प्रणाली पुनः सुरु गर्न सक्नुहुन्छ।
              </p>
            </div>

            {errorMsg && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left">
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                  त्रुटि विवरण (Error Details):
                </span>
                <code className="text-xs text-red-700 font-mono break-all line-clamp-3">
                  {errorMsg}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#4B6043] hover:bg-[#384c31] text-white text-xs font-bold rounded-xl transition-all shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>पृष्ठ पुनः लोड गर्नुहोस् (Reload)</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>गृहपृष्ठमा जानुहोस् (Dashboard)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
