'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Transaction } from '@solana/web3.js';

// Mock Privy context types
interface MockPrivyUser {
  id: string;
  linkedAccounts: Array<{
    type: string;
    chainType: string;
    address: string;
  }>;
}

interface MockPrivyContext {
  authenticated: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
  user: MockPrivyUser | null;
  getAccessToken: () => Promise<string>;
  linkWallet: () => void;
}

interface MockWalletsContext {
  wallets: Array<{
    address: string;
    chainType: string;
  }>;
}

interface MockSolanaWallet {
  address: string;
  chainType: 'solana';
  signTransaction: (tx: any) => Promise<any>;
  signAllTransactions: (txs: any[]) => Promise<any[]>;
}

interface MockSolanaWalletsContext {
  wallets: MockSolanaWallet[];
}

// Create contexts
const MockPrivyContext = createContext<MockPrivyContext | null>(null);
const MockWalletsContext = createContext<MockWalletsContext | null>(null);
const MockSolanaWalletsContext = createContext<MockSolanaWalletsContext | null>(null);

const MOCK_WALLET_ADDRESS = process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS ||
  process.env.MOCK_WALLET_ADDRESS ||
  'Gv9DB9frBw9XgVeThDvCALwHuvnYDopZ12Jt4rquqBhi';

// Mock signing functions - use server-side API to sign with real keypair
const signTransaction = async (tx: Transaction) => {
  try {
    // Serialize transaction
    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

    // Send to server for signing
    const response = await fetch('/api/mock/sign-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serializedTransaction: serialized }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sign transaction');
    }

    const { signedTransaction } = await response.json();

    // Deserialize signed transaction
    const buffer = Buffer.from(signedTransaction, 'base64');
    return Transaction.from(buffer);
  } catch (error) {
    console.error('Mock transaction signing failed:', error);
    throw error;
  }
};

const signAllTransactions = async (txs: Transaction[]) => {
  // Sign transactions sequentially
  const signed = [];
  for (const tx of txs) {
    signed.push(await signTransaction(tx));
  }
  return signed;
};

// Mock wallet object
const mockSolanaWallet: MockSolanaWallet = {
  address: MOCK_WALLET_ADDRESS,
  chainType: 'solana',
  signTransaction,
  signAllTransactions,
};

// Mock user
const mockUser: MockPrivyUser = {
  id: 'mock-user-' + MOCK_WALLET_ADDRESS,
  linkedAccounts: [
    {
      type: 'wallet',
      chainType: 'solana',
      address: MOCK_WALLET_ADDRESS,
    },
  ],
};

// Provider component
export function MockPrivyProvider({ children }: { children: ReactNode }) {
  const privyValue: MockPrivyContext = {
    authenticated: true,
    ready: true,
    user: mockUser,
    getAccessToken: async () => 'mock-jwt-token',
    login: () => {},
    logout: () => {},
    linkWallet: () => {},
  };

  const walletsValue: MockWalletsContext = {
    wallets: [
      {
        address: MOCK_WALLET_ADDRESS,
        chainType: 'solana',
      },
    ],
  };

  const solanaWalletsValue: MockSolanaWalletsContext = {
    wallets: [mockSolanaWallet],
  };

  return (
    <MockPrivyContext.Provider value={privyValue}>
      <MockWalletsContext.Provider value={walletsValue}>
        <MockSolanaWalletsContext.Provider value={solanaWalletsValue}>
          {children}
        </MockSolanaWalletsContext.Provider>
      </MockWalletsContext.Provider>
    </MockPrivyContext.Provider>
  );
}

// Hooks
export function usePrivy(): MockPrivyContext {
  const context = useContext(MockPrivyContext);
  if (!context) {
    throw new Error('usePrivy must be used within MockPrivyProvider');
  }
  return context;
}

export function useWallets(): MockWalletsContext {
  const context = useContext(MockWalletsContext);
  if (!context) {
    throw new Error('useWallets must be used within MockPrivyProvider');
  }
  return context;
}

export function useSolanaWallets(): MockSolanaWalletsContext {
  const context = useContext(MockSolanaWalletsContext);
  if (!context) {
    throw new Error('useSolanaWallets must be used within MockPrivyProvider');
  }
  return context;
}
