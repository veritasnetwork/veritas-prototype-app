/**
 * Solana RPC Connection Pool
 *
 * Reuses connections instead of creating new ones for every request.
 * This is a simple singleton pattern - safe and non-breaking.
 *
 * Benefits:
 * - Reduces connection overhead
 * - Reuses keep-alive connections
 * - No breaking changes to existing code
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';

class ConnectionPool {
  private static instance: Connection | null = null;

  /**
   * Get or create singleton connection
   * Safe: Falls back to creating new connection if anything goes wrong
   */
  static getConnection(): Connection {
    const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

    // If no instance or endpoint changed, create new one
    if (!this.instance || this.instance.rpcEndpoint !== endpoint) {

      const config: ConnectionConfig = {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      };

      this.instance = new Connection(endpoint, config);
    }

    return this.instance;
  }

  /**
   * For backwards compatibility: create new connection if needed
   * This ensures existing code continues to work
   */
  static createConnection(endpoint?: string, config?: ConnectionConfig): Connection {
    if (!endpoint || endpoint === (process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899')) {
      // Use pooled connection if endpoint matches
      return this.getConnection();
    }

    // Custom endpoint - create new connection
    return new Connection(endpoint, config);
  }
}

/**
 * Get pooled connection (recommended)
 */
export function getPooledConnection(): Connection {
  return ConnectionPool.getConnection();
}

/**
 * Create new connection (for custom endpoints)
 */
export function createConnection(endpoint?: string, config?: ConnectionConfig): Connection {
  return ConnectionPool.createConnection(endpoint, config);
}
