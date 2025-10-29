'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PrivyErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Privy error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isBrave = (navigator as { brave?: unknown }).brave !== undefined;

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h2 className="text-[#F0EAD6] text-xl font-bold mb-4">
              Authentication Error
            </h2>

            {this.state.error?.message?.includes('Origin not allowed') && (
              <div className="text-[#B9D9EB] space-y-4">
                <p>
                  Your browser&apos;s privacy settings are blocking authentication.
                </p>

                {isBrave && (
                  <div className="bg-[#0C1D51] border border-[#B9D9EB] rounded-lg p-4 text-left">
                    <p className="font-bold mb-2">For Brave Browser:</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Click the Brave shield icon in your address bar</li>
                      <li>Turn shields OFF for this site</li>
                      <li>Or change &ldquo;Cross-site cookies&rdquo; to &ldquo;All cookies allowed&rdquo;</li>
                      <li>Refresh the page</li>
                    </ol>
                  </div>
                )}

                <p className="text-sm mt-4">
                  Alternatively, try using Chrome, Safari, or Firefox.
                </p>
              </div>
            )}

            {!this.state.error?.message?.includes('Origin not allowed') && (
              <div className="text-[#B9D9EB]">
                <p>Something went wrong with authentication.</p>
                <p className="text-sm mt-2">Error: {this.state.error?.message}</p>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-6 bg-[#B9D9EB] hover:bg-[#0C1D51] text-[#0C1D51] hover:text-[#B9D9EB] border border-[#0C1D51] hover:border-[#B9D9EB] font-medium py-2 px-6 rounded font-mono transition-all"
            >
              RETRY
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}