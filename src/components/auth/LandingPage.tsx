'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

export function LandingPage() {
  const { login, logout: privyLogout, authenticated, ready } = usePrivy();
  const { joinWaitlist, activateInvite, hasAccess, needsInvite, isLoading } = useAuth();
  const router = useRouter();
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [isActivatingInvite, setIsActivatingInvite] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [buttonWidth, setButtonWidth] = useState<number | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && buttonWidth === null && !showWaitlistForm) {
      setButtonWidth(containerRef.current.offsetWidth);
    }
  }, [buttonWidth, showWaitlistForm]);

  // Handle authentication state changes
  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return;

    // Always redirect to feed if user has access
    if (authenticated && hasAccess) {
      console.log('User has access, redirecting to feed');
      router.replace('/feed');
      return;
    }

    // Don't auto-show invite form - wait for explicit LOGIN click
  }, [authenticated, hasAccess, isLoading, router]);

  // Handle showing invite form after login attempt
  useEffect(() => {
    if (loginAttempted && authenticated && needsInvite && !isLoading) {
      setShowInviteForm(true);
      setLoginAttempted(false);
    }
  }, [loginAttempted, authenticated, needsInvite, isLoading]);

  const handleJoinWaitlistClick = () => {
    if (containerRef.current && buttonWidth) {
      setShowWaitlistForm(true);
    }
  };

  const handleBackClick = () => {
    setShowWaitlistForm(false);
    setShowInviteForm(false);
    setEmail('');
    setInviteCode('');
    setWaitlistMessage('');
    setInviteMessage('');
  };

  const handleWaitlistJoin = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!email || !email.trim()) {
      setWaitlistMessage('Please enter an email address');
      return;
    }

    setIsJoiningWaitlist(true);
    setWaitlistMessage('');

    const result = await joinWaitlist(email);

    if (result.success) {
      setWaitlistMessage('Successfully joined the waitlist!');
      setEmail('');
    } else {
      setWaitlistMessage(result.error || 'Failed to join waitlist.');
    }

    setIsJoiningWaitlist(false);
  };

  const handleLoginClick = () => {
    if (!ready) {
      setInviteMessage('Authentication service is loading. Please try again.');
      return;
    }

    console.log('Login clicked, authenticated:', authenticated);

    if (authenticated) {
      // Already authenticated
      if (hasAccess) {
        // Has access, go to feed
        router.push('/feed');
      } else if (needsInvite) {
        // Needs invite, show form
        setShowInviteForm(true);
      }
    } else {
      // Not authenticated, trigger login
      setLoginAttempted(true);
      login();
    }
  };

  const handleActivateInvite = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsActivatingInvite(true);
    setInviteMessage('');

    try {
      console.log('Starting invite activation, authenticated:', authenticated);

      if (!authenticated) {
        setInviteMessage('Please authenticate first by clicking LOGIN.');
        setIsActivatingInvite(false);
        return;
      }

      console.log('Calling activateInvite...');
      const result = await activateInvite(inviteCode);
      console.log('activateInvite result:', result);

      if (result.success) {
        setInviteMessage('Invite activated successfully!');
        setTimeout(() => {
          router.push('/feed');
        }, 1000);
      } else {
        setInviteMessage(result.error || 'Failed to activate invite.');
      }
    } catch (error) {
      console.error('Error in handleActivateInvite:', error);
      setInviteMessage('An error occurred during activation.');
    }

    setIsActivatingInvite(false);
  };

  // Show loading state while checking auth
  if (isLoading || !ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B9D9EB]"></div>
      </div>
    );
  }

  // If user has access, they'll be redirected - show loading
  if (authenticated && hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B9D9EB]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Logo in top left */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <img
          src="/icons/logo.png"
          alt="Veritas Logo"
          className="w-8 h-8"
        />
        <span className="text-[#F0EAD6] font-bold text-xl tracking-wider font-mono">VERITAS</span>
      </div>

      {/* Main content */}
      <div className="text-center">
        <h1 className="text-[#F0EAD6] text-2xl font-medium mb-12 tracking-wide font-mono">
          DISCOVER WHAT HUMANITY TRULY BELIEVES.
        </h1>
        <div className="flex justify-between w-full max-w-2xl mx-auto">
          <div
            ref={containerRef}
            className="relative bg-black border border-[#F0EAD6] hover:border-[#B9D9EB] rounded font-mono transition-all duration-300 ease-in-out"
            style={{
              width: (showWaitlistForm || showInviteForm) ? 'calc(100% - 120px)' : buttonWidth ? `${buttonWidth}px` : 'fit-content',
              marginRight: (showWaitlistForm || showInviteForm) ? '1rem' : '0'
            }}
          >
            {!showWaitlistForm && !showInviteForm ? (
              <button
                onClick={handleJoinWaitlistClick}
                className="text-[#F0EAD6] hover:text-[#B9D9EB] font-medium py-4 px-8 transition-colors whitespace-nowrap"
              >
                JOIN WAITLIST
              </button>
            ) : showWaitlistForm ? (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-transparent text-[#F0EAD6] font-medium py-4 px-8 placeholder-[#F0EAD6] placeholder-opacity-50 focus:outline-none"
                />
                <button
                  onClick={handleBackClick}
                  className="absolute -bottom-8 left-0 text-[#F0EAD6] hover:text-[#B9D9EB] text-sm font-mono transition-colors flex items-center gap-1"
                >
                  <span className="animate-pulse text-base">←</span>
                  BACK
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="INVITE CODE"
                  required
                  className="w-full bg-transparent text-[#F0EAD6] font-medium py-4 px-8 placeholder-[#F0EAD6] placeholder-opacity-50 focus:outline-none uppercase"
                />
                <button
                  onClick={handleBackClick}
                  className="absolute -bottom-8 left-0 text-[#F0EAD6] hover:text-[#B9D9EB] text-sm font-mono transition-colors flex items-center gap-1"
                >
                  <span className="animate-pulse text-base">←</span>
                  BACK
                </button>
              </>
            )}
          </div>
          <button
            onClick={showWaitlistForm ? handleWaitlistJoin : showInviteForm ? handleActivateInvite : handleLoginClick}
            disabled={(showWaitlistForm && isJoiningWaitlist) || (showInviteForm && isActivatingInvite)}
            className="bg-[#B9D9EB] hover:bg-[#0C1D51] text-[#0C1D51] hover:text-[#B9D9EB] border border-[#0C1D51] hover:border-[#B9D9EB] font-medium py-4 px-8 rounded font-mono disabled:opacity-50 transition-all duration-300 ease-in-out"
          >
            {showWaitlistForm ? (isJoiningWaitlist ? 'SUBMITTING...' : 'SUBMIT') :
             showInviteForm ? (isActivatingInvite ? 'ACTIVATING...' : 'ACTIVATE') :
             'LOGIN'}
          </button>
        </div>
        {showWaitlistForm && waitlistMessage && (
          <p className={`text-sm mt-8 ${waitlistMessage.includes('Successfully') ? 'text-green-400' : 'text-red-400'}`}>
            {waitlistMessage}
          </p>
        )}
        {showInviteForm && inviteMessage && (
          <p className={`text-sm mt-8 ${inviteMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>
            {inviteMessage}
          </p>
        )}
      </div>
    </div>
  );
}