/**
 * usePoolAddresses Hook
 * Client-side PDA derivation for pool addresses
 */

import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { derivePoolAddresses } from '@/lib/solana/sdk/transaction-builders';

export function usePoolAddresses(postId: string | null) {
  return useMemo(() => {
    if (!postId) return null;

    const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;
    if (!programId) {
      console.error('NEXT_PUBLIC_VERITAS_PROGRAM_ID not configured');
      return null;
    }

    try {
      return derivePoolAddresses(postId, new PublicKey(programId));
    } catch (error) {
      console.error('Failed to derive pool addresses:', error);
      return null;
    }
  }, [postId]);
}
