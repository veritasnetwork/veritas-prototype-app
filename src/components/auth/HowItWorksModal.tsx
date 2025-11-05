'use client';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay that extends beyond safe area */}
      <div
        className="fixed z-40 bg-black/50 backdrop-blur-md"
        style={{
          top: '-100px',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: '100px',
          minHeight: 'calc(100vh + 100px)',
          minHeight: 'calc(100dvh + 100px)'
        }}
      />

      {/* Modal container - shifted up more on mobile with pt-8 and pb-24 for nav clearance */}
      <div className="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-start sm:items-center justify-center pt-8 sm:pt-0 pb-24 sm:pb-0 overflow-y-auto">
        <div className="bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-6 sm:p-10 max-w-lg w-full mx-4 shadow-2xl backdrop-blur-xl">
        {/* Title with logo aligned to numbered list */}
        <div className="mb-6">
          <div className="flex items-start gap-4">
            {/* Logo container matching numbered circle size and alignment */}
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center mt-1">
              <img
                src="/icons/logo.png"
                alt="Veritas Logo"
                className="w-8 h-8"
              />
            </div>
            <h2 className="text-white text-2xl sm:text-3xl font-bold font-mono tracking-wide">How Veritas Works</h2>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B9D9EB]/20 border border-[#B9D9EB]/40 flex items-center justify-center">
              <span className="text-[#B9D9EB] text-sm font-bold font-mono">1</span>
            </div>
            <div>
              <p className="text-white text-base">
                <span className="font-semibold">Post content</span> → Earn 0.5% of all trading volume on it.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B9D9EB]/20 border border-[#B9D9EB]/40 flex items-center justify-center">
              <span className="text-[#B9D9EB] text-sm font-bold font-mono">2</span>
            </div>
            <div>
              <p className="text-white text-base">
                <span className="font-semibold">Trade relevance</span> → Go LONG or SHORT. Prices reflect the market&apos;s opinion.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B9D9EB]/20 border border-[#B9D9EB]/40 flex items-center justify-center">
              <span className="text-[#B9D9EB] text-sm font-bold font-mono">3</span>
            </div>
            <div>
              <p className="text-white text-base">
                <span className="font-semibold">Submit beliefs</span> → Every buy includes your relevance judgment.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B9D9EB]/20 border border-[#B9D9EB]/40 flex items-center justify-center">
              <span className="text-[#B9D9EB] text-sm font-bold font-mono">4</span>
            </div>
            <div>
              <p className="text-white text-base">
                <span className="font-semibold">Consensus forms</span> → Veritas removes bias, rewarding truth and quality over hype.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B9D9EB]/20 border border-[#B9D9EB]/40 flex items-center justify-center">
              <span className="text-[#B9D9EB] text-sm font-bold font-mono">5</span>
            </div>
            <div>
              <p className="text-white text-base">
                <span className="font-semibold">Market resolves</span> → Bonding curve reserves rebase. Losers pay, winners earn.
              </p>
            </div>
          </div>

          {/* Buttons Row - Equal width buttons */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Learn More Button */}
            <a
              href="https://veritas.computer/knowledge-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#F5F5DC] hover:bg-[#E5E5CC] text-[#0C1D51] font-semibold py-3 px-4 rounded-xl transition-all duration-300 ease-in-out shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Learn more</span>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-[#B9D9EB] to-[#a8c8d8] hover:from-[#0C1D51] hover:to-[#162d5f] text-[#0C1D51] hover:text-white font-semibold py-3 px-4 rounded-xl font-mono transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
            >
              GOT IT
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
