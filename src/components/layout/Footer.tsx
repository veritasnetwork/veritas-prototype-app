'use client';

import Image from 'next/image';
import { 
  Twitter, 
  Github, 
  Linkedin, 
  Mail,
  Heart
} from 'lucide-react';

const VeritasFooter = () => {

  const socialLinks = [
    { icon: Twitter, href: 'https://twitter.com/veritas', label: 'Twitter' },
    { icon: Github, href: 'https://github.com/veritas', label: 'GitHub' },
    { icon: Linkedin, href: 'https://linkedin.com/company/veritas', label: 'LinkedIn' },
    { icon: Mail, href: 'mailto:hello@veritas.com', label: 'Email' },
  ];

  return (
    <footer className="hidden md:block relative bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-t border-slate-200 dark:border-slate-700">
      {/* Premium gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 via-transparent to-[#1B365D]/5" />
      
      <div className="relative max-w-7xl mx-auto px-6 py-6">
        {/* Main footer content */}
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* Brand section */}
          <div className="flex items-center space-x-6">
            {/* Logo */}
            <div className="flex items-center">
              <div className="relative w-8 h-8">
                <div className="w-full h-full bg-[#1B365D] rounded-xl flex items-center justify-center p-1.5">
                  <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                    <Image
                      src="/icons/veritas-logo.png"
                      alt="Veritas"
                      width={16}
                      height={16}
                      className="w-full h-full object-contain rounded-full"
                      priority
                      unoptimized
                    />
                  </div>
                </div>
              </div>
              <span className="ml-2 text-lg font-bold text-[#1B365D] dark:text-[#D4A574]">
                Veritas
              </span>
            </div>
            
            {/* Social links */}
            <div className="flex space-x-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-2 rounded-xl bg-gradient-to-br from-[#FFB800]/10 to-[#1B365D]/5 hover:from-[#FFB800]/20 hover:to-[#1B365D]/10 transition-all duration-300 hover:scale-110"
                    aria-label={social.label}
                  >
                    <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:text-[#1B365D] dark:group-hover:text-[#D4A574] transition-colors duration-300" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Copyright section */}
          <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
            <span>Made with</span>
            <Heart className="w-3 h-3 mx-1.5 text-red-500 fill-current" />
            <span>for decentralized truth</span>
            <span className="mx-3">•</span>
            <span>© {new Date().getFullYear()} Veritas</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default VeritasFooter;