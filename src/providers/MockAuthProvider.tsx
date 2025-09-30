'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: string;
  agent_id: string;
  auth_id: string;
  auth_provider: string;
}

interface AuthContextValue {
  user: User | null;
  hasAccess: boolean;
  needsInvite: boolean;
  isLoading: boolean;
  activateInvite: (code: string) => Promise<{ success: boolean; error?: string }>;
  joinWaitlist: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Mock Privy hooks for development
export function usePrivy() {
  return {
    authenticated: false,
    ready: true,
    login: () => {
      alert('AUTH BYPASS MODE: Privy is disabled in development due to Brave browser issues. Use Chrome/Safari for full auth testing.');
    },
    logout: () => console.log('Mock logout'),
    getAccessToken: async () => null,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user] = useState<User | null>(null);
  const [hasAccess] = useState(false);
  const [needsInvite] = useState(false);
  const [isLoading] = useState(false);

  const activateInvite = async (code: string): Promise<{ success: boolean; error?: string }> => {
    console.log('Mock activate invite:', code);
    return { success: false, error: 'Auth is disabled in development mode' };
  };

  const joinWaitlist = async (email: string): Promise<{ success: boolean; error?: string }> => {
    console.log('Mock join waitlist:', email);
    return { success: true };
  };

  const logout = () => {
    console.log('Mock logout');
  };

  const authValue: AuthContextValue = {
    user,
    hasAccess,
    needsInvite,
    isLoading,
    activateInvite,
    joinWaitlist,
    logout,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-1 text-sm z-50">
        ⚠️ AUTH BYPASS MODE - Privy disabled due to Brave issues. Use Chrome/Safari for auth testing.
      </div>
      {children}
    </AuthContext.Provider>
  );
}