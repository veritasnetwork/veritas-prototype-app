/**
 * Privy Server-Side Authentication
 *
 * Provides helpers for verifying Privy JWT tokens in API routes
 * Uses jose library for fast JWT verification instead of Privy SDK
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verify a Privy JWT token and return the user ID
 * Uses jose library for faster verification (same as /api/auth/status)
 *
 * @param token - The JWT token from the Authorization header
 * @returns The Privy user ID if valid, null if invalid
 */
export async function verifyPrivyToken(token: string): Promise<string | null> {
  try {
    // Mock auth bypass (for local dev when Privy is down)
    if (token === 'mock-jwt-token' && process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true') {
      const mockWalletAddress = process.env.MOCK_WALLET_ADDRESS ||
        process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS ||
        'Gv9DB9frBw9XgVeThDvCALwHuvnYDopZ12Jt4rquqBhi';
      const mockUserId = 'mock-user-' + mockWalletAddress;
      console.log('[verifyPrivyToken] 🔓 Mock JWT accepted, returning mock user ID:', mockUserId);
      return mockUserId;
    }

    const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

    if (!PRIVY_APP_ID) {
      console.error('[verifyPrivyToken] Missing PRIVY_APP_ID');
      return null;
    }

    // Try JWKS verification first (faster)
    try {
      const JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`;
      console.log('[verifyPrivyToken] Fetching JWKS from:', JWKS_URL);

      const JWKS = createRemoteJWKSet(new URL(JWKS_URL), {
        timeoutDuration: 5000, // 5 second timeout
        cooldownDuration: 10000, // Cache for 10 seconds
      });

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: 'privy.io',
        audience: PRIVY_APP_ID,
      });

      const userId = payload.sub as string;

      if (!userId) {
        console.error('[verifyPrivyToken] Missing user ID in JWT payload');
        return null;
      }

      console.log('[verifyPrivyToken] ✅ Token verified via JWKS, user ID:', userId);
      return userId;
    } catch (jwksError: any) {
      console.error('[verifyPrivyToken] JWKS verification failed:', jwksError.message);

      // Fallback: Try Privy API verification with app secret
      if (PRIVY_APP_SECRET) {
        console.log('[verifyPrivyToken] Trying fallback verification via Privy API...');
        try {
          const response = await fetch('https://auth.privy.io/api/v1/verification/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'privy-app-id': PRIVY_APP_ID,
              'Authorization': `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
            },
            body: JSON.stringify({ token }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[verifyPrivyToken] Privy API verification failed:', response.status, errorText);
            return null;
          }

          const data = await response.json();
          console.log('[verifyPrivyToken] ✅ Token verified via Privy API, user ID:', data.userId);
          return data.userId;
        } catch (apiError: any) {
          console.error('[verifyPrivyToken] Privy API verification error:', apiError.message);
          return null;
        }
      }

      console.error('[verifyPrivyToken] No fallback available, verification failed');
      return null;
    }
  } catch (error: any) {
    console.error('[verifyPrivyToken] Unexpected error:', error.message);
    return null;
  }
}

/**
 * Extract and verify the Privy token from an Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The Privy user ID if valid, null if invalid or missing
 */
export async function verifyAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  return verifyPrivyToken(token);
}
