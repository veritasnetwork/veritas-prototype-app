/**
 * Configuration Validation Tests
 *
 * Tests the config validation utility with various valid/invalid values
 */

import { validateConfig, validateConfigOrThrow, getConfigSummary } from '../validate';

describe('Configuration Validation', () => {
  // Save original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset to clean state before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should pass with valid configuration', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.abc123',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.xyz789',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        PRIVY_APP_SECRET: 'secret123',
        NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'http://127.0.0.1:8899',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
        NEXT_PUBLIC_USDC_MINT_LOCALNET: 'H8R2RUb9zPZi9C8DVFrERBrhtmzWsUN6kkXLLLdeWQx4',
      };

      const result = validateConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with missing Supabase URL', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'http://127.0.0.1:8899',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
        NEXT_PUBLIC_USDC_MINT_LOCALNET: 'H8R2RUb9zPZi9C8DVFrERBrhtmzWsUN6kkXLLLdeWQx4',
      };

      const result = validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_SUPABASE_URL',
          error: 'Supabase URL is required',
        })
      );
    });

    it('should fail with invalid URL format', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'not-a-url',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
        NEXT_PUBLIC_USDC_MINT_LOCALNET: 'H8R2RUb9zPZi9C8DVFrERBrhtmzWsUN6kkXLLLdeWQx4',
      };

      const result = validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_SUPABASE_URL',
          error: 'Invalid URL format',
        })
      );
    });

    it('should fail with invalid public key', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'http://127.0.0.1:8899',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: 'invalid-public-key',
        NEXT_PUBLIC_USDC_MINT_LOCALNET: 'also-invalid',
      };

      const result = validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_VERITAS_PROGRAM_ID',
          error: 'Invalid Solana public key format',
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_USDC_MINT_LOCALNET',
          error: 'Invalid USDC mint address',
        })
      );
    });

    it('should fail with invalid network', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'testnet', // Invalid
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'http://127.0.0.1:8899',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
      };

      const result = validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_SOLANA_NETWORK',
          error: 'Invalid network selection',
        })
      );
    });

    it('should allow bypass auth in development', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_BYPASS_AUTH: 'true',
        NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'http://127.0.0.1:8899',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
        NEXT_PUBLIC_USDC_MINT_LOCALNET: 'H8R2RUb9zPZi9C8DVFrERBrhtmzWsUN6kkXLLLdeWQx4',
        // Privy not set, but bypass is true
      };

      const result = validateConfig();
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_BYPASS_AUTH',
          error: 'Authentication is bypassed (DEVELOPMENT ONLY)',
        })
      );
    });

    it('should warn about non-standard USDC on mainnet', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'mainnet-beta',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
        NEXT_PUBLIC_USDC_MINT_MAINNET: 'SomeOtherTokenMintAddress111111111111111',
      };

      const result = validateConfig();
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'NEXT_PUBLIC_USDC_MINT_MAINNET',
          error: 'Using non-standard USDC mint on mainnet',
        })
      );
    });
  });

  describe('validateConfigOrThrow', () => {
    it('should not throw with valid config', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'http://127.0.0.1:8899',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
        NEXT_PUBLIC_USDC_MINT_LOCALNET: 'H8R2RUb9zPZi9C8DVFrERBrhtmzWsUN6kkXLLLdeWQx4',
      };

      expect(() => validateConfigOrThrow()).not.toThrow();
    });

    it('should throw with invalid config', () => {
      process.env = {
        // Missing required fields
      };

      expect(() => validateConfigOrThrow()).toThrow(/Configuration validation failed/);
    });
  });

  describe('getConfigSummary', () => {
    it('should return config summary with masked secrets', () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-key',
        PRIVY_APP_SECRET: 'privy-secret',
        NEXT_PUBLIC_PRIVY_APP_ID: 'cmfmujde9004yl50ba40keo4a',
        NEXT_PUBLIC_SOLANA_NETWORK: 'devnet',
        NEXT_PUBLIC_SOLANA_RPC_ENDPOINT: 'https://api.devnet.solana.com',
        NEXT_PUBLIC_VERITAS_PROGRAM_ID: '6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz',
      };

      const summary = getConfigSummary();

      expect(summary.supabase.url).toBe('http://localhost:54321');
      expect(summary.supabase.hasAnonKey).toBe(true);
      expect(summary.supabase.hasServiceKey).toBe(true);
      expect(summary.privy.hasSecret).toBe(true);
      expect(summary.solana.network).toBe('devnet');
      expect(summary.solana.programId).toBe('6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz');
    });
  });
});
