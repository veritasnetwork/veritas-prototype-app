/**
 * Database Boundary Validation
 *
 * Runtime validation to ensure unit consistency at database boundaries.
 * This module catches unit conversion errors before they corrupt the database.
 */

import { AtomicUnits, DisplayUnits, MicroUSDC, isAtomicUnits, isDisplayUnits, isMicroUSDC } from './units';

export interface PoolDeploymentRecord {
  pool_address: string;
  s_long_supply: number;
  s_short_supply: number;
  vault_balance: number;
  r_long?: number;
  r_short?: number;
  sqrt_price_long_x96?: string;
  sqrt_price_short_x96?: string;
}

/**
 * Validates that pool deployment data is in correct atomic units
 * before database insertion/update
 */
export function validatePoolDeploymentUnits(record: Partial<PoolDeploymentRecord>): void {
  const errors: string[] = [];

  // Check s_long_supply
  if (record.s_long_supply !== undefined) {
    if (!Number.isInteger(record.s_long_supply)) {
      errors.push(`s_long_supply must be integer (atomic units), got: ${record.s_long_supply}`);
    }
    if (record.s_long_supply < 0) {
      errors.push(`s_long_supply cannot be negative: ${record.s_long_supply}`);
    }
    // Suspicious if it's less than 1000 (probably display units mistakenly passed)
    if (record.s_long_supply > 0 && record.s_long_supply < 1000) {
      console.warn(`⚠️ WARNING: s_long_supply=${record.s_long_supply} looks like display units (too small for atomic)`);
    }
  }

  // Check s_short_supply
  if (record.s_short_supply !== undefined) {
    if (!Number.isInteger(record.s_short_supply)) {
      errors.push(`s_short_supply must be integer (atomic units), got: ${record.s_short_supply}`);
    }
    if (record.s_short_supply < 0) {
      errors.push(`s_short_supply cannot be negative: ${record.s_short_supply}`);
    }
    // Suspicious if it's less than 1000 (probably display units mistakenly passed)
    if (record.s_short_supply > 0 && record.s_short_supply < 1000) {
      console.warn(`⚠️ WARNING: s_short_supply=${record.s_short_supply} looks like display units (too small for atomic)`);
    }
  }

  // Check vault_balance (should be micro-USDC)
  if (record.vault_balance !== undefined) {
    if (!Number.isInteger(record.vault_balance)) {
      errors.push(`vault_balance must be integer (micro-USDC), got: ${record.vault_balance}`);
    }
    if (record.vault_balance < 0) {
      errors.push(`vault_balance cannot be negative: ${record.vault_balance}`);
    }
  }

  // Check r_long and r_short (virtual reserves in micro-USDC)
  if (record.r_long !== undefined) {
    if (!Number.isInteger(record.r_long)) {
      errors.push(`r_long must be integer (micro-USDC), got: ${record.r_long}`);
    }
    if (record.r_long < 0) {
      errors.push(`r_long cannot be negative: ${record.r_long}`);
    }
  }

  if (record.r_short !== undefined) {
    if (!Number.isInteger(record.r_short)) {
      errors.push(`r_short must be integer (micro-USDC), got: ${record.r_short}`);
    }
    if (record.r_short < 0) {
      errors.push(`r_short cannot be negative: ${record.r_short}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Pool deployment unit validation failed:\n${errors.join('\n')}`);
  }
}

export interface TradeRecord {
  usdc_amount?: number;
  token_amount?: number;
  s_long_before?: number;
  s_short_before?: number;
  s_long_after?: number;
  s_short_after?: number;
  r_long_after?: number;
  r_short_after?: number;
}

/**
 * Validates trade record units before database insertion
 */
export function validateTradeUnits(record: Partial<TradeRecord>): void {
  const errors: string[] = [];

  // USDC amounts should be in decimal (not atomic)
  if (record.usdc_amount !== undefined) {
    if (record.usdc_amount < 0) {
      errors.push(`usdc_amount cannot be negative: ${record.usdc_amount}`);
    }
    // Suspicious if it's > 10,000 (probably atomic units mistakenly passed)
    if (record.usdc_amount > 10_000) {
      console.warn(`⚠️ WARNING: usdc_amount=${record.usdc_amount} looks like atomic units (too large for USDC)`);
    }
  }

  // Token amounts should be in decimal (not atomic)
  if (record.token_amount !== undefined) {
    if (record.token_amount < 0) {
      errors.push(`token_amount cannot be negative: ${record.token_amount}`);
    }
    // Suspicious if it's > 10,000 (probably atomic units mistakenly passed)
    if (record.token_amount > 10_000) {
      console.warn(`⚠️ WARNING: token_amount=${record.token_amount} looks like atomic units (too large for tokens)`);
    }
  }

  // Supply snapshots should be in DISPLAY units for trades table
  const supplyFields = ['s_long_before', 's_short_before', 's_long_after', 's_short_after'] as const;
  for (const field of supplyFields) {
    const value = record[field];
    if (value !== undefined) {
      if (value < 0) {
        errors.push(`${field} cannot be negative: ${value}`);
      }
      // These are stored as DISPLAY units in trades table
      // Suspicious if > 1,000,000 (probably atomic units)
      if (value > 1_000_000) {
        console.warn(`⚠️ WARNING: ${field}=${value} looks like atomic units (too large for display units)`);
      }
    }
  }

  // Virtual reserves should be in micro-USDC (atomic)
  const reserveFields = ['r_long_after', 'r_short_after'] as const;
  for (const field of reserveFields) {
    const value = record[field];
    if (value !== undefined) {
      if (!Number.isInteger(value)) {
        errors.push(`${field} must be integer (micro-USDC), got: ${value}`);
      }
      if (value < 0) {
        errors.push(`${field} cannot be negative: ${value}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Trade unit validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Wraps a Supabase update/insert with unit validation
 */
export function validateAndUpdate<T extends PoolDeploymentRecord | TradeRecord>(
  tableName: 'pool_deployments' | 'trades',
  record: Partial<T>
): Partial<T> {
  // Validate based on table
  if (tableName === 'pool_deployments') {
    validatePoolDeploymentUnits(record as Partial<PoolDeploymentRecord>);
  } else if (tableName === 'trades') {
    validateTradeUnits(record as Partial<TradeRecord>);
  }

  return record;
}

/**
 * Helper to detect probable unit confusion
 */
export function detectUnitConfusion(
  value: number,
  expectedType: 'atomic' | 'display' | 'microUsdc'
): string | null {
  if (expectedType === 'atomic') {
    // Atomic values should be large integers
    if (!Number.isInteger(value)) {
      return `Expected integer for atomic units, got decimal: ${value}`;
    }
    if (value > 0 && value < 100) {
      return `Value ${value} suspiciously small for atomic units (might be display units?)`;
    }
  } else if (expectedType === 'display') {
    // Display values are typically small decimals or moderate integers
    if (value > 10_000_000) {
      return `Value ${value} suspiciously large for display units (might be atomic units?)`;
    }
  } else if (expectedType === 'microUsdc') {
    // Micro-USDC should be integers
    if (!Number.isInteger(value)) {
      return `Expected integer for micro-USDC, got decimal: ${value}`;
    }
    if (value > 0 && value < 1000) {
      return `Value ${value} suspiciously small for micro-USDC (might be USDC decimal?)`;
    }
  }

  return null;
}