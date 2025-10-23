/**
 * Central export for all Privy hooks
 * Automatically switches between real Privy and mock implementation based on env
 */

import { usePrivy as useRealPrivy } from '@privy-io/react-auth';
import { useWallets as useRealWallets } from '@privy-io/react-auth';
import { useCreateWallet as useRealCreateWallet } from '@privy-io/react-auth';
import { useConnectWallet as useRealConnectWallet } from '@privy-io/react-auth';
import { useConnectOrCreateWallet as useRealConnectOrCreateWallet } from '@privy-io/react-auth';
import { useSolanaWallets as useRealSolanaWallets } from '@privy-io/react-auth/solana';

import {
  usePrivy as useMockPrivy,
  useWallets as useMockWallets,
  useSolanaWallets as useMockSolanaWallets,
} from '@/providers/MockPrivyProvider';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

// Mock version of useCreateWallet (not needed in mock mode)
const useMockCreateWallet = () => ({
  createWallet: async () => ({ address: 'mock', chainType: 'solana' } as any)
});

// Mock version of useConnectWallet
const useMockConnectWallet = () => ({
  connectWallet: async () => ({ address: 'mock', chainType: 'solana' } as any)
});

// Mock version of useConnectOrCreateWallet
const useMockConnectOrCreateWallet = () => ({
  connectOrCreateWallet: async () => ({ address: 'mock', chainType: 'solana' } as any)
});

export const usePrivy = isMockMode ? useMockPrivy : useRealPrivy;
export const useWallets = isMockMode ? useMockWallets : useRealWallets;
export const useSolanaWallets = isMockMode ? useMockSolanaWallets : useRealSolanaWallets;
export const useCreateWallet = isMockMode ? useMockCreateWallet : useRealCreateWallet;
export const useConnectWallet = isMockMode ? useMockConnectWallet : useRealConnectWallet;
export const useConnectOrCreateWallet = isMockMode ? useMockConnectOrCreateWallet : useRealConnectOrCreateWallet;
