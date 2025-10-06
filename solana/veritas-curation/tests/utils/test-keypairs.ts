import { Keypair } from "@solana/web3.js";
import * as crypto from "crypto";

// Deterministic keypair generation for test stability
function deterministicKeypair(seed: string): Keypair {
  const hash = crypto.createHash('sha256').update(seed).digest();
  return Keypair.fromSeed(hash);
}

// Singleton keypairs shared across all tests
export const TEST_FACTORY_AUTHORITY = deterministicKeypair("test-factory-authority-v1");
export const TEST_POOL_AUTHORITY = deterministicKeypair("test-pool-authority-v1");