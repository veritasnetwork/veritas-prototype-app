# Protocol Authority Signing System

## Overview
Server-side keypair management for protocol operations. Authority keypair signs stake skim transfers and pool settlements. Never exposed to client, loaded from secure filesystem location.

## Context
- **Layer:** Infrastructure / Security
- **Location:** `src/lib/solana/load-authority.ts`
- **Used By:** /api/trades/prepare, pool settlement, admin operations
- **Dependencies:** Node.js fs module, @solana/web3.js
- **Status:** Implemented

---

## High-Level Design

### Flow
1. API endpoint needs protocol authority signature
2. Call `loadProtocolAuthority()`
3. Read keypair from file (env: PROTOCOL_AUTHORITY_KEY_PATH)
4. Parse JSON keypair data
5. Create Keypair instance
6. Use keypair to sign transaction
7. Return signed transaction

### State Changes
None (read-only keypair loading)

### Key Decisions
- **Server-side only:** Never send keypair or private key to client
- **Environment variable for path:** Allows different keys per environment (dev/prod)
- **JSON keypair format:** Standard Solana CLI output format
- **No caching:** Load fresh each time (minimal performance impact)

---

## Implementation

### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `loadProtocolAuthority` | `() => Keypair` | Load keypair from file |

### loadProtocolAuthority

**Signature:**
```typescript
function loadProtocolAuthority(): Keypair
```

**Environment Variable:**
```
PROTOCOL_AUTHORITY_KEY_PATH=solana/veritas-curation/keys/authority.json
```

**Flow:**
1. Read `PROTOCOL_AUTHORITY_KEY_PATH` from environment
2. If not set → throw Error
3. Resolve full file path (relative to project root)
4. Check if file exists → if not, throw Error
5. Read file contents as UTF-8 string
6. Parse JSON to get byte array
7. Create Keypair from secret key bytes
8. Return Keypair

**File Format:**
```json
[
  1, 2, 3, ..., 64  // 64 bytes: 32 secret + 32 public
]
```

**Example:**
```typescript
const authority = loadProtocolAuthority();
// authority.publicKey: PublicKey
// authority.secretKey: Uint8Array (64 bytes)
```

### Usage in Transaction Signing

**In /api/trades/prepare:**
```typescript
import { loadProtocolAuthority } from '@/lib/solana/load-authority';

// Build transaction with skim instruction
const authority = loadProtocolAuthority();

// Add authority as signer to skim instruction
transaction.partialSign(authority);

// Return partially-signed transaction
return { transaction: transaction.serialize().toString('base64') };
```

---

## Security Considerations

### Key Storage

**Development:**
- Location: `solana/veritas-curation/keys/authority.json`
- Permissions: `chmod 600` (read/write owner only)
- .gitignore: **MUST** be ignored (already in .gitignore)

**Production:**
- Location: Secure secrets management system (e.g., AWS Secrets Manager, HashiCorp Vault)
- Injected as environment variable at deploy time
- File permissions: Minimal (only app process can read)
- Backup: Encrypted backup in secure location

### Access Control

**Who can use:**
- Server-side API routes only
- Never exposed via API response
- Never logged (even in errors)

**Where used:**
- Trade preparation (stake skim signing)
- Pool settlement (on-chain settlement transactions)
- Admin operations (emergency actions)

### Key Rotation

**Process:**
1. Generate new keypair: `solana-keygen new --outfile new-authority.json`
2. Update on-chain program authority to new pubkey
3. Wait for all pending transactions to complete
4. Update `PROTOCOL_AUTHORITY_KEY_PATH` to new file
5. Restart application
6. Archive old keypair securely (for audit trail)

**Frequency:** Recommended quarterly or after security incident

---

## Error Handling

| Error | Condition | Message |
|-------|-----------|---------|
| Missing Env Var | `PROTOCOL_AUTHORITY_KEY_PATH` not set | "PROTOCOL_AUTHORITY_KEY_PATH not set in environment" |
| File Not Found | Key file doesn't exist at path | "Protocol authority key file not found: {path}" |
| Invalid JSON | File is not valid JSON | JSON.parse() throws SyntaxError |
| Invalid Keypair | JSON doesn't contain valid 64-byte array | Keypair.fromSecretKey() throws |

**All errors are thrown** (not caught) - calling code must handle

---

## Edge Cases

| Condition | Handling |
|-----------|----------|
| Relative path in env var | Resolved with path.resolve() from project root |
| File permissions too open | No check (relies on OS-level security) |
| Corrupted keypair file | Throws error, transaction preparation fails |
| Wrong keypair (mismatched pubkey) | On-chain transaction fails with signature verification error |

---

## Deployment Considerations

### Environment Setup

**Local Development:**
```bash
# .env.local
PROTOCOL_AUTHORITY_KEY_PATH=solana/veritas-curation/keys/authority.json
```

**Production:**
```bash
# Set via secrets management
export PROTOCOL_AUTHORITY_KEY_PATH=/run/secrets/protocol-authority.json

# Or use cloud-specific injection
# AWS: Retrieved from Secrets Manager and written to ephemeral location
# K8s: Mounted from Secret volume
```

### Key Generation

**Initial setup:**
```bash
cd solana/veritas-curation
mkdir -p keys
solana-keygen new --no-bip39-passphrase --outfile keys/authority.json

# Secure the key
chmod 600 keys/authority.json

# Get public key for on-chain program initialization
solana-keygen pubkey keys/authority.json
```

### Deployment Checklist

- [ ] Generate production keypair (separate from dev)
- [ ] Store in secrets management system
- [ ] Set PROTOCOL_AUTHORITY_KEY_PATH environment variable
- [ ] Verify file permissions (600 or stricter)
- [ ] Initialize on-chain program with authority pubkey
- [ ] Backup keypair to encrypted storage
- [ ] Document key rotation procedures
- [ ] Set up monitoring for failed authority signatures

---

## Monitoring and Alerts

### Metrics to Track

- **Authority signature failures:** Count of failed signatures
- **Key load errors:** Count of loadProtocolAuthority() errors
- **Unauthorized access attempts:** File access logs

### Alerts

**High Priority:**
- Authority key file not found (immediate outage)
- Repeated signature verification failures (wrong key?)
- Unexpected file permission changes

**Medium Priority:**
- High rate of authority signature usage (unusual activity?)

---

## Testing

### Critical Paths
1. Load keypair successfully → Returns valid Keypair
2. Missing env var → Throws specific error
3. File not found → Throws specific error
4. Invalid JSON → Throws parse error
5. Sign transaction → Signature verifies on-chain

### Test Implementation
- **Test Spec:** `specs/test-specs/security/authority-signing.test.md`
- **Test Code:** `tests/lib/load-authority.test.ts`

### Validation
- Unit test with mock file system
- Integration test with real keypair (test environment)
- Verify signature with @solana/web3.js
- Test error cases (missing file, invalid JSON)

---

## Audit Trail

### Logging

**DO log:**
- Authority pubkey (for verification)
- Transactions signed (tx signature)
- Errors (without revealing private key)

**DO NOT log:**
- Private key bytes
- File contents
- Secret key in any form

**Example:**
```typescript
console.log('Authority loaded:', authority.publicKey.toBase58());
console.log('Signed transaction:', txSignature);
console.error('Failed to load authority:', error.message); // NOT error.stack with file contents
```

---

## References
- Code: `src/lib/solana/load-authority.ts`
- Used in: `app/api/trades/prepare/route.ts:78`
- Keypair Format: [Solana CLI Docs](https://docs.solana.com/cli/wallets/paper)
- Related: `specs/architecture/trading-flow.md`, `specs/architecture/stake-system.md`
