'use client';

import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Twitter, 
  Github, 
  Linkedin, 
  Mail, 
  ExternalLink,
  Heart
} from 'lucide-react';

const VeritasFooter = () => {
  const { isDark } = useTheme();

  const footerLinks = {
    product: [
      { label: 'How it Works', href: '/about' },
      { label: 'Explore Beliefs', href: '/explore' },
      { label: 'Submit Belief', href: '/submit' },
      { label: 'Analytics', href: '/analytics' },
    ],
    resources: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API Reference', href: '/api' },
      { label: 'White Paper', href: '/whitepaper' },
      { label: 'Blog', href: '/blog' },
    ],
    community: [
      { label: 'Discord', href: 'https://discord.gg/veritas' },
      { label: 'Telegram', href: 'https://t.me/veritas' },
      { label: 'Forum', href: '/forum' },
      { label: 'Governance', href: '/governance' },
    ],
    company: [
      { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  };

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
      
      <div className="relative max-w-7xl mx-auto px-6 py-16">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand section */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <div className="flex items-center mb-6">
              <div className="relative w-12 h-12">
                <div className="w-full h-full bg-[#1B365D] rounded-2xl flex items-center justify-center p-2">
                  <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                    <Image
                      src="/icons/veritas-logo.png"
                      alt="Veritas"
                      width={24}
                      height={24}
                      className="w-full h-full object-contain rounded-full"
                      priority
                      unoptimized
                    />
                  </div>
                </div>
              </div>
              <span className="ml-3 text-2xl font-bold text-[#1B365D] dark:text-[#D4A574]">
                Veritas
              </span>
            </div>
            
            {/* Description */}
            <p className="text-slate-600 dark:text-slate-300 text-lg mb-8 leading-relaxed">
              Decentralized truth-finding through collective intelligence and economic incentives. 
              Building a future where accurate information is rewarded.
            </p>
            
            {/* Social links */}
            <div className="flex space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/10 to-[#1B365D]/5 hover:from-[#FFB800]/20 hover:to-[#1B365D]/10 transition-all duration-300 hover:scale-110"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-[#1B365D] dark:group-hover:text-[#D4A574] transition-colors duration-300" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links sections */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[#1B365D] dark:text-[#D4A574] font-semibold text-lg mb-6 capitalize">
                {category}
              </h3>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="group flex items-center text-slate-600 dark:text-slate-300 hover:text-[#1B365D] dark:hover:text-[#D4A574] transition-colors duration-300"
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      <span>{link.label}</span>
                      {link.href.startsWith('http') && (
                        <ExternalLink className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter signup */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-12 mb-12">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold text-[#1B365D] dark:text-[#D4A574] mb-4">
              Stay Updated
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Get the latest updates on new features, market insights, and the future of decentralized truth-finding.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                placeholder="Enter your email address"
                className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FFB800] focus:border-transparent transition-all duration-300"
              />
              <button className="px-8 py-4 rounded-2xl bg-[#1B365D] hover:bg-[#2D4A6B] text-white font-semibold shadow-sm hover:shadow-md transform hover:scale-105 transition-all duration-300 whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center text-slate-600 dark:text-slate-300 mb-4 md:mb-0">
              <span>Made with</span>
              <Heart className="w-4 h-4 mx-2 text-red-500 fill-current" />
              <span>for decentralized truth</span>
            </div>
            
            <div className="text-slate-600 dark:text-slate-300">
              © {new Date().getFullYear()} Veritas. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default VeritasFooter;