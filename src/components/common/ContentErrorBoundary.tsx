'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  contentType?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ContentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Content Error Boundary caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Error Icon */}
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>

                {/* Error Title */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Oops! Something went wrong
                </h2>

                {/* Error Message */}
                <p className="text-gray-600 dark:text-gray-400">
                  {this.props.contentType 
                    ? `We encountered an error loading this ${this.props.contentType} content.`
                    : 'We encountered an error loading this content.'
                  }
                </p>

                {/* Error Details (Development only) */}
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="w-full text-left">
                    <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                      Show error details
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 overflow-auto">
                      {this.state.error.toString()}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 w-full">
                  <button
                    onClick={this.handleReset}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-veritas-blue hover:bg-veritas-dark-blue text-white rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for specific content types
export const ContentTypeErrorBoundary: React.FC<{
  children: ReactNode;
  contentType: 'news' | 'opinion' | 'conversation' | 'blog';
}> = ({ children, contentType }) => {
  const fallbackMessages = {
    news: 'Unable to load news article. Please try refreshing the page.',
    opinion: 'Unable to load opinion poll. Please try again later.',
    conversation: 'Unable to load conversation. The discussion may have been moved or deleted.',
    blog: 'Unable to load blog post. The content may be temporarily unavailable.'
  };

  return (
    <ContentErrorBoundary 
      contentType={contentType}
      fallback={
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                {fallbackMessages[contentType]}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 underline"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ContentErrorBoundary>
  );
};