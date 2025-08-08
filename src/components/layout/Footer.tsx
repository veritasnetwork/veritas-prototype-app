'use client';

import Image from 'next/image';

const VeritasFooter = () => {
  const socialLinks = [
    { 
      label: 'X', 
      href: 'https://x.com/veritas_layer',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    { 
      label: 'Discord', 
      href: 'https://discord.gg/kBacKwCQXF',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      )
    },
    { 
      label: 'Telegram', 
      href: 'https://t.me/+2lo2u1nRyV9iMDlk',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
        </svg>
      )
    },
    { 
      label: 'Forum', 
      href: 'https://veritas.discourse.group/',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.19.22 2.34.6 3.41L2 22l6.59-.6c1.07.38 2.22.6 3.41.6 5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.08 0-2.14-.24-3.11-.68l-.22-.14-3.48.32.32-3.48-.14-.22A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="1.5"/>
          <circle cx="8" cy="12" r="1.5"/>
          <circle cx="16" cy="12" r="1.5"/>
        </svg>
      )
    },
    { 
      label: 'Github', 
      href: 'https://github.com/veritasnetwork',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      )
    },
  ];

  return (
    <footer className="relative bg-white dark:bg-veritas-darker-blue border-t border-gray-200 dark:border-veritas-eggshell/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-6">
        {/* Main footer content */}
        <div className="flex flex-col items-center space-y-6 md:space-y-0 md:flex-row md:justify-between">
          {/* Brand section */}
          <div className="flex flex-col items-center space-y-5 md:flex-row md:items-center md:space-y-0 md:space-x-8">
            {/* Logo and name - matching DockNavbar style */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 relative">
                <Image
                  src="/icons/logo.png"
                  alt="Veritas"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                  priority
                  sizes="32px"
                />
              </div>
              <span className="font-semibold text-veritas-dark-blue dark:text-veritas-eggshell font-mono uppercase text-sm sm:text-base">
                Veritas
              </span>
            </div>
            
            {/* Social links - mobile optimized with icons */}
            <div className="flex items-center">
              {/* Mobile: Show as icon buttons */}
              <div className="flex sm:hidden items-center gap-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 dark:text-veritas-eggshell/70 hover:text-veritas-dark-blue dark:hover:text-veritas-eggshell transition-all duration-300 p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-veritas-eggshell/10"
                    aria-label={social.label}
                    title={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
              
              {/* Desktop: Show as text links */}
              <div className="hidden sm:flex items-center gap-x-4">
                {socialLinks.map((social, index) => (
                  <div key={social.label} className="flex items-center">
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-gray-600 dark:text-veritas-eggshell/70 hover:text-veritas-dark-blue dark:hover:text-veritas-eggshell transition-colors duration-300"
                      aria-label={social.label}
                    >
                      {social.label}
                    </a>
                    {index < socialLinks.length - 1 && (
                      <span className="ml-4 text-gray-300 dark:text-veritas-eggshell/30">·</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Copyright section - compact on mobile */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex flex-col sm:flex-row items-center text-[11px] sm:text-sm font-mono text-gray-600 dark:text-veritas-eggshell/60">
              <span className="flex items-center">
                Made with&nbsp;<span className="text-red-500 dark:text-blue-500 text-[10px] sm:text-xs">❤️</span>&nbsp;for truth
              </span>
              <span className="hidden sm:inline mx-2 sm:mx-3 text-gray-300 dark:text-veritas-eggshell/30">·</span>
              <span className="mt-1 sm:mt-0">© {new Date().getFullYear()} Veritas</span>
            </div>
            {/* Mobile-only tagline */}
            <p className="sm:hidden text-[10px] font-mono text-gray-500 dark:text-veritas-eggshell/40">
              Decentralized truth verification
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default VeritasFooter;