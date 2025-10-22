/**
 * Tests for Protocol Authority Loading
 *
 * Spec: specs/security/authority-signing.md
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';

// Test keypair data (64 bytes)
const TEST_KEYPAIR_BYTES = [
  174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56,
  222, 53, 138, 189, 224, 216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246,
  198, 240, 137, 75, 108, 29, 40, 140, 35, 229, 115, 102, 102, 99, 53, 17,
  223, 208, 123, 18, 145, 9, 113, 145, 160, 78, 95, 12, 188, 244, 122, 148
];

const TEST_KEY_DIR = path.resolve(__dirname, '../../.test-keys');
const TEST_KEY_PATH = path.join(TEST_KEY_DIR, 'test-authority.json');

describe('loadProtocolAuthority', () => {
  beforeAll(() => {
    // Create test key directory if it doesn't exist
    if (!fs.existsSync(TEST_KEY_DIR)) {
      fs.mkdirSync(TEST_KEY_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test key files
    if (fs.existsSync(TEST_KEY_PATH)) {
      fs.unlinkSync(TEST_KEY_PATH);
    }
  });

  test('should load keypair successfully from valid file', () => {
    // Setup: Write test keypair to file
    fs.writeFileSync(TEST_KEY_PATH, JSON.stringify(TEST_KEYPAIR_BYTES));
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = TEST_KEY_PATH;

    // Execute
    const keypair = loadProtocolAuthority();

    // Verify
    expect(keypair).toBeInstanceOf(Keypair);
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    expect(keypair.secretKey.length).toBe(64);

    // Cleanup
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });

  test('should throw error when PROTOCOL_AUTHORITY_KEY_PATH not set', () => {
    // Ensure env var is not set
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;

    // Execute & Verify
    expect(() => loadProtocolAuthority()).toThrow(
      'PROTOCOL_AUTHORITY_KEY_PATH not set in environment'
    );
  });

  test('should throw error when key file does not exist', () => {
    // Setup: Set path to non-existent file
    const nonExistentPath = path.join(TEST_KEY_DIR, 'non-existent.json');
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = nonExistentPath;

    // Execute & Verify
    expect(() => loadProtocolAuthority()).toThrow(
      `Protocol authority key file not found: ${path.resolve(nonExistentPath)}`
    );

    // Cleanup
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });

  test('should throw error when file contains invalid JSON', () => {
    // Setup: Write invalid JSON to file
    const invalidJsonPath = path.join(TEST_KEY_DIR, 'invalid.json');
    fs.writeFileSync(invalidJsonPath, 'not valid json');
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = invalidJsonPath;

    // Execute & Verify
    expect(() => loadProtocolAuthority()).toThrow(SyntaxError);

    // Cleanup
    fs.unlinkSync(invalidJsonPath);
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });

  test('should throw error when keypair data is invalid', () => {
    // Setup: Write invalid keypair data (wrong length)
    const invalidKeypairPath = path.join(TEST_KEY_DIR, 'invalid-keypair.json');
    fs.writeFileSync(invalidKeypairPath, JSON.stringify([1, 2, 3])); // Too short
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = invalidKeypairPath;

    // Execute & Verify
    expect(() => loadProtocolAuthority()).toThrow();

    // Cleanup
    fs.unlinkSync(invalidKeypairPath);
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });

  test('should handle relative paths correctly', () => {
    // Setup: Write test keypair
    fs.writeFileSync(TEST_KEY_PATH, JSON.stringify(TEST_KEYPAIR_BYTES));

    // Use relative path
    const relativePath = path.relative(process.cwd(), TEST_KEY_PATH);
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = relativePath;

    // Execute
    const keypair = loadProtocolAuthority();

    // Verify
    expect(keypair).toBeInstanceOf(Keypair);

    // Cleanup
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });

  test('should create valid keypair that can sign transactions', () => {
    // Setup: Write test keypair to file
    fs.writeFileSync(TEST_KEY_PATH, JSON.stringify(TEST_KEYPAIR_BYTES));
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = TEST_KEY_PATH;

    // Execute
    const keypair = loadProtocolAuthority();

    // Create a message to sign
    const message = Buffer.from('test message');

    // Sign the message
    const signature = keypair.sign(message);

    // Verify signature is valid
    expect(signature).toBeInstanceOf(Buffer);
    expect(signature.length).toBe(64);

    // Cleanup
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });

  test('should load same keypair consistently across multiple calls', () => {
    // Setup: Write test keypair to file
    fs.writeFileSync(TEST_KEY_PATH, JSON.stringify(TEST_KEYPAIR_BYTES));
    process.env.PROTOCOL_AUTHORITY_KEY_PATH = TEST_KEY_PATH;

    // Execute: Load keypair twice
    const keypair1 = loadProtocolAuthority();
    const keypair2 = loadProtocolAuthority();

    // Verify: Both should have same public key
    expect(keypair1.publicKey.toBase58()).toBe(keypair2.publicKey.toBase58());

    // Cleanup
    delete process.env.PROTOCOL_AUTHORITY_KEY_PATH;
  });
});
