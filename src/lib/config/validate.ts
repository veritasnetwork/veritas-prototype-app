/**
 * Configuration Validation Utility
 *
 * Validates all required environment variables on app startup
 * Prevents hard-to-debug runtime errors from misconfiguration
 *
 * Usage: Call validateConfig() in pages/_app.tsx or middleware
 */

import { PublicKey } from '@solana/web3.js';

export interface ConfigValidationError {
  field: string;
  value: string | undefined;
  error: string;
  fix: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationError[];
}

/**
 * Validate Solana public key format
 */
function isValidPublicKey(address: string | undefined): boolean {
  if (!address) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Supabase JWT format (basic check)
 */
function isValidSupabaseJWT(jwt: string | undefined): boolean {
  if (!jwt) return false;
  // JWT format: header.payload.signature
  const parts = jwt.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

/**
 * Validate Privy App ID format
 */
function isValidPrivyAppId(appId: string | undefined): boolean {
  if (!appId) return false;
  // Privy App IDs are typically alphanumeric
  return /^[a-z0-9]{20,40}$/i.test(appId);
}

/**
 * Validate network name
 */
function isValidNetwork(network: string | undefined): boolean {
  return network === 'localnet' || network === 'devnet' || network === 'mainnet-beta';
}

/**
 * Main configuration validation function
 *
 * Returns validation result with errors and warnings
 * Errors = must fix, Warnings = should fix
 */
export function validateConfig(): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationError[] = [];

  // ============================================================================
  // SUPABASE VALIDATION
  // ============================================================================

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    errors.push({
      field: 'NEXT_PUBLIC_SUPABASE_URL',
      value: undefined,
      error: 'Supabase URL is required',
      fix: 'Run `npx supabase status` and copy the API URL to .env.local'
    });
  } else if (!isValidUrl(supabaseUrl)) {
    errors.push({
      field: 'NEXT_PUBLIC_SUPABASE_URL',
      value: supabaseUrl,
      error: 'Invalid URL format',
      fix: 'Must be a valid URL like http://localhost:54321 or https://project.supabase.co'
    });
  }

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    errors.push({
      field: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      value: undefined,
      error: 'Supabase anon key is required',
      fix: 'Run `npx supabase status` and copy the anon key to .env.local'
    });
  } else if (!isValidSupabaseJWT(supabaseAnonKey)) {
    errors.push({
      field: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      value: supabaseAnonKey.slice(0, 20) + '...',
      error: 'Invalid JWT format',
      fix: 'Check that you copied the complete anon key from Supabase'
    });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    warnings.push({
      field: 'SUPABASE_SERVICE_ROLE_KEY',
      value: undefined,
      error: 'Service role key not set (required for API routes)',
      fix: 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local if using API routes'
    });
  } else if (!isValidSupabaseJWT(serviceRoleKey)) {
    errors.push({
      field: 'SUPABASE_SERVICE_ROLE_KEY',
      value: serviceRoleKey.slice(0, 20) + '...',
      error: 'Invalid JWT format',
      fix: 'Check that you copied the complete service_role key from Supabase'
    });
  }

  // ============================================================================
  // PRIVY VALIDATION
  // ============================================================================

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

  if (!privyAppId) {
    if (!bypassAuth) {
      errors.push({
        field: 'NEXT_PUBLIC_PRIVY_APP_ID',
        value: undefined,
        error: 'Privy App ID is required for authentication',
        fix: 'Get your App ID from https://dashboard.privy.io/apps or set NEXT_PUBLIC_BYPASS_AUTH=true for development'
      });
    }
  } else if (!isValidPrivyAppId(privyAppId)) {
    errors.push({
      field: 'NEXT_PUBLIC_PRIVY_APP_ID',
      value: privyAppId,
      error: 'Invalid Privy App ID format',
      fix: 'Check that you copied the correct App ID from Privy dashboard'
    });
  }

  const privyAppSecret = process.env.PRIVY_APP_SECRET;
  if (!privyAppSecret && privyAppId && !bypassAuth) {
    warnings.push({
      field: 'PRIVY_APP_SECRET',
      value: undefined,
      error: 'Privy App Secret not set (required for server-side auth verification)',
      fix: 'Add PRIVY_APP_SECRET to .env.local if using API routes with Privy'
    });
  }

  if (bypassAuth) {
    warnings.push({
      field: 'NEXT_PUBLIC_BYPASS_AUTH',
      value: 'true',
      error: 'Authentication is bypassed (DEVELOPMENT ONLY)',
      fix: 'Set NEXT_PUBLIC_BYPASS_AUTH=false before deploying to production'
    });
  }

  // ============================================================================
  // SOLANA VALIDATION
  // ============================================================================

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'localnet';
  if (!isValidNetwork(network)) {
    errors.push({
      field: 'NEXT_PUBLIC_SOLANA_NETWORK',
      value: network,
      error: 'Invalid network selection',
      fix: 'Must be one of: localnet, devnet, mainnet-beta'
    });
  }

  const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT;
  if (!rpcEndpoint) {
    errors.push({
      field: 'NEXT_PUBLIC_SOLANA_RPC_ENDPOINT',
      value: undefined,
      error: 'Solana RPC endpoint is required',
      fix: 'Set to http://127.0.0.1:8899 for localnet or your RPC provider URL'
    });
  } else if (!isValidUrl(rpcEndpoint)) {
    errors.push({
      field: 'NEXT_PUBLIC_SOLANA_RPC_ENDPOINT',
      value: rpcEndpoint,
      error: 'Invalid RPC URL format',
      fix: 'Must be a valid HTTP/HTTPS URL'
    });
  }

  const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID;
  if (!programId) {
    errors.push({
      field: 'NEXT_PUBLIC_VERITAS_PROGRAM_ID',
      value: undefined,
      error: 'Veritas Program ID is required',
      fix: 'Run setup-local-test.sh or anchor deploy, then copy Program ID to .env.local'
    });
  } else if (!isValidPublicKey(programId)) {
    errors.push({
      field: 'NEXT_PUBLIC_VERITAS_PROGRAM_ID',
      value: programId,
      error: 'Invalid Solana public key format',
      fix: 'Check that you copied the complete Program ID (base58 encoded)'
    });
  }

  // Network-specific USDC validation
  const usdcMintVar = `NEXT_PUBLIC_USDC_MINT_${network.toUpperCase()}`;
  const usdcMint = process.env[usdcMintVar];

  if (network === 'localnet' && !usdcMint) {
    errors.push({
      field: usdcMintVar,
      value: undefined,
      error: 'Localnet USDC mint address is required',
      fix: 'Run setup-local-test.sh to create a USDC mint and copy address to .env.local'
    });
  } else if (usdcMint && !isValidPublicKey(usdcMint)) {
    errors.push({
      field: usdcMintVar,
      value: usdcMint,
      error: 'Invalid USDC mint address',
      fix: 'Check that you copied the complete mint address (base58 encoded)'
    });
  }

  // Warn about mainnet/devnet USDC if custom values set
  if (network === 'mainnet-beta' && usdcMint) {
    const officialMainnetUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    if (usdcMint !== officialMainnetUSDC) {
      warnings.push({
        field: 'NEXT_PUBLIC_USDC_MINT_MAINNET',
        value: usdcMint,
        error: 'Using non-standard USDC mint on mainnet',
        fix: `Official Circle USDC is ${officialMainnetUSDC}. Only use different address for testing.`
      });
    }
  }

  if (network === 'devnet' && usdcMint) {
    const officialDevnetUSDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    if (usdcMint !== officialDevnetUSDC) {
      warnings.push({
        field: 'NEXT_PUBLIC_USDC_MINT_DEVNET',
        value: usdcMint,
        error: 'Using non-standard USDC mint on devnet',
        fix: `Official devnet USDC is ${officialDevnetUSDC}. Only use different address for testing.`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate configuration and throw if invalid
 * Use this version in pages/_app.tsx to fail fast on misconfiguration
 */
export function validateConfigOrThrow(): void {
  const result = validateConfig();

  if (!result.valid) {
    console.error('\n❌ Configuration Validation Failed\n');
    console.error('Errors found in .env.local:\n');

    result.errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error.field}`);
      console.error(`   Problem: ${error.error}`);
      console.error(`   Current value: ${error.value || '(not set)'}`);
      console.error(`   Fix: ${error.fix}\n`);
    });

    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Configuration Warnings:\n');
      result.warnings.forEach((warning, index) => {
        console.warn(`${index + 1}. ${warning.field}`);
        console.warn(`   ${warning.error}`);
        console.warn(`   Fix: ${warning.fix}\n`);
      });
    }

    throw new Error(
      `Configuration validation failed with ${result.errors.length} error(s). ` +
      `Check console output above for details. ` +
      `See .env.local.example for setup guide.`
    );
  }

  // Show warnings even if valid
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:\n');
    result.warnings.forEach((warning, index) => {
      console.warn(`${index + 1}. ${warning.field}: ${warning.error}`);
      console.warn(`   Fix: ${warning.fix}\n`);
    });
  } else {
    console.log('✅ Configuration validation passed');
  }
}

/**
 * Get current configuration summary for debugging
 */
export function getConfigSummary() {
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    privy: {
      appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
      hasSecret: !!process.env.PRIVY_APP_SECRET,
      bypassAuth: process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true',
    },
    solana: {
      network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'localnet',
      rpcEndpoint: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT,
      programId: process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID,
      usdcMint: process.env[`NEXT_PUBLIC_USDC_MINT_${(process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'localnet').toUpperCase()}`],
    },
  };
}
