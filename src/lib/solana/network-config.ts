import { PublicKey } from '@solana/web3.js';

/**
 * Get USDC mint address based on current network configuration
 * Network is determined by NEXT_PUBLIC_SOLANA_NETWORK environment variable
 */
export function getUsdcMint(): PublicKey {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'localnet';

  switch (network) {
    case 'mainnet-beta':
      return new PublicKey(
        process.env.NEXT_PUBLIC_USDC_MINT_MAINNET ||
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // Official USDC on mainnet
      );
    case 'devnet':
      return new PublicKey(
        process.env.NEXT_PUBLIC_USDC_MINT_DEVNET ||
        '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // USDC on devnet
      );
    case 'localnet':
    default:
      // Localnet must be configured via env var since it's created during setup
      const localMint = process.env.NEXT_PUBLIC_USDC_MINT_LOCALNET;
      if (!localMint) {
        throw new Error('NEXT_PUBLIC_USDC_MINT_LOCALNET must be set for localnet');
      }
      return new PublicKey(localMint);
  }
}

/**
 * Get network display name
 */
export function getNetworkName(): string {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'localnet';
}

/**
 * Get RPC endpoint
 */
export function getRpcEndpoint(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
}

/**
 * Get program ID
 */
export function getProgramId(): PublicKey {
  const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;
  if (!programId) {
    throw new Error('NEXT_PUBLIC_VERITAS_PROGRAM_ID must be set');
  }
  return new PublicKey(programId);
}
