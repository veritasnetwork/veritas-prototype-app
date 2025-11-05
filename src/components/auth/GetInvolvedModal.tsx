'use client';

interface GetInvolvedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GetInvolvedModal({ isOpen, onClose }: GetInvolvedModalProps) {
  if (!isOpen) return null;

  const socialLinks = [
    {
      name: 'Telegram',
      url: 'https://t.me/+2lo2u1nRyV9iMDlk',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.094.037.308.021.475z"/>
        </svg>
      ),
      color: 'from-[#0088cc] to-[#006699]',
      hoverColor: 'hover:from-[#0077b3] hover:to-[#005580]',
    },
    {
      name: 'Discord',
      url: 'https://discord.gg/2YWQm3Dw',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      ),
      color: 'from-[#5865F2] to-[#4752C4]',
      hoverColor: 'hover:from-[#4752C4] hover:to-[#3C45A5]',
    },
    {
      name: 'X',
      url: 'https://x.com/veritas_layer',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: 'from-[#000000] to-[#1a1a1a]',
      hoverColor: 'hover:from-[#1a1a1a] hover:to-[#2a2a2a]',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      <div className="bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-10 max-w-lg w-full mx-4 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img
              src="/icons/logo.png"
              alt="Veritas Logo"
              className="w-12 h-12"
            />
            <h2 className="text-white text-3xl font-bold font-mono tracking-wide">Get Involved</h2>
          </div>
          <p className="text-gray-400 text-sm">Join our community and stay connected</p>
        </div>

        <div className="space-y-4 mb-6">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 bg-gradient-to-r ${link.color} ${link.hoverColor} text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className="flex-shrink-0">
                {link.icon}
              </div>
              <span className="flex-1 text-left">{link.name}</span>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-[#B9D9EB] to-[#a8c8d8] hover:from-[#0C1D51] hover:to-[#162d5f] text-[#0C1D51] hover:text-white font-semibold py-3 px-4 rounded-xl font-mono transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
