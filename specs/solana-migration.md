# Solana Migration Plan

## Overview

Migration from standalone Veritas protocol to Solana-integrated dual-staking system.

**Two Independent Staking Systems:**
1. **Veritas Protocol Stakes** (VeritasCustodian) - For belief submissions, redistributed via protocol
2. **Content Pool Stakes** (ContentPool bonding curves) - For speculation on content relevance

---

## 1. Identity System Refactor

### Current System
- Agents created with arbitrary UUIDs
- Default stake ($100) created from thin air
- Users link to agents via `agent_id`

### New System: Solana Address as Primary Identity

**Flow:**
1. User connects/creates Privy embedded Solana wallet
2. User deposits USDC into VeritasCustodian contract
3. Backend indexes deposit event → creates/updates agent record
4. Agent stake comes from actual deposits (no free money)

**Key Principle:** Solana address IS the agent identity. No separate agent IDs.

### Database Schema Changes

```sql
-- ============================================================================
-- AGENTS TABLE REFACTOR
-- ============================================================================

-- Step 1: Add solana_address column and migrate data (if needed)
ALTER TABLE agents ADD COLUMN solana_address TEXT UNIQUE;

-- Step 2: Drop old primary key and make solana_address the primary key
ALTER TABLE agents DROP CONSTRAINT agents_pkey CASCADE;
ALTER TABLE agents DROP COLUMN id;
ALTER TABLE agents ADD PRIMARY KEY (solana_address);

-- Step 3: Remove free money default
ALTER TABLE agents ALTER COLUMN protocol_stake SET DEFAULT 0;

-- Step 4: Add additional tracking fields
ALTER TABLE agents ADD COLUMN total_deposited NUMERIC DEFAULT 0;
ALTER TABLE agents ADD COLUMN total_withdrawn NUMERIC DEFAULT 0;
ALTER TABLE agents ADD COLUMN last_synced_at TIMESTAMPTZ;

-- ============================================================================
-- UPDATE ALL FOREIGN KEYS TO REFERENCE solana_address
-- ============================================================================

-- Belief submissions
ALTER TABLE belief_submissions
  DROP CONSTRAINT belief_submissions_agent_id_fkey,
  RENAME COLUMN agent_id TO agent_solana_address,
  ALTER COLUMN agent_solana_address TYPE TEXT,
  ADD CONSTRAINT belief_submissions_agent_fkey
    FOREIGN KEY (agent_solana_address) REFERENCES agents(solana_address) ON DELETE CASCADE;

-- Beliefs (creator)
ALTER TABLE beliefs
  DROP CONSTRAINT beliefs_creator_agent_id_fkey,
  RENAME COLUMN creator_agent_id TO creator_solana_address,
  ALTER COLUMN creator_solana_address TYPE TEXT,
  ADD CONSTRAINT beliefs_creator_fkey
    FOREIGN KEY (creator_solana_address) REFERENCES agents(solana_address) ON DELETE SET NULL;

-- Users
ALTER TABLE users
  DROP CONSTRAINT users_agent_id_fkey,
  DROP COLUMN agent_id,
  ADD COLUMN solana_address TEXT UNIQUE NOT NULL REFERENCES agents(solana_address) ON DELETE RESTRICT;

-- Add index for performance
CREATE INDEX idx_users_solana_address ON users(solana_address);
```

---

## 2. New Database Tables

### pool_deployments
**Purpose:** Track ContentPool contracts for beliefs/posts

```sql
CREATE TABLE pool_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,

    -- Solana addresses
    pool_address TEXT NOT NULL UNIQUE,
    usdc_vault_address TEXT NOT NULL,
    token_mint_address TEXT NOT NULL,

    -- Deployment info
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_by_address TEXT REFERENCES agents(solana_address),
    deployment_tx_signature TEXT UNIQUE,

    -- Curve parameters (cached from chain)
    k_quadratic NUMERIC NOT NULL,
    reserve_cap NUMERIC NOT NULL,
    linear_slope NUMERIC NOT NULL,
    virtual_liquidity NUMERIC NOT NULL,

    -- Current state (synced from chain)
    token_supply NUMERIC DEFAULT 0,
    reserve NUMERIC DEFAULT 0,
    last_synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_pool_deployments_belief ON pool_deployments(belief_id);
CREATE UNIQUE INDEX idx_pool_deployments_post ON pool_deployments(post_id);
CREATE INDEX idx_pool_deployments_deployed_by ON pool_deployments(deployed_by_address);
```

### custodian_deposits
**Purpose:** Index deposit events to credit agent stakes

```sql
CREATE TABLE custodian_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event data
    depositor_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time TIMESTAMPTZ,
    slot BIGINT,

    -- Indexing metadata
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_credited BOOLEAN DEFAULT FALSE,
    credited_at TIMESTAMPTZ,

    -- Foreign key (nullable for deposits before agent exists)
    CONSTRAINT fk_depositor FOREIGN KEY (depositor_address)
      REFERENCES agents(solana_address) ON DELETE SET NULL
);

CREATE INDEX idx_deposits_depositor ON custodian_deposits(depositor_address);
CREATE INDEX idx_deposits_pending ON custodian_deposits(agent_credited) WHERE NOT agent_credited;
CREATE INDEX idx_deposits_block_time ON custodian_deposits(block_time);
```

### custodian_withdrawals
**Purpose:** Track withdrawal requests and execution

```sql
CREATE TABLE custodian_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Request details
    agent_solana_address TEXT NOT NULL REFERENCES agents(solana_address) ON DELETE CASCADE,
    amount_usdc NUMERIC NOT NULL,
    recipient_address TEXT NOT NULL,

    -- Request tracking
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by_user_id UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')) DEFAULT 'pending',

    -- Execution tracking
    tx_signature TEXT UNIQUE,
    processed_at TIMESTAMPTZ,
    block_time TIMESTAMPTZ,

    -- Rejection/failure tracking
    rejection_reason TEXT,
    failure_reason TEXT
);

CREATE INDEX idx_withdrawals_agent ON custodian_withdrawals(agent_solana_address);
CREATE INDEX idx_withdrawals_status ON custodian_withdrawals(status);
CREATE INDEX idx_withdrawals_requested_at ON custodian_withdrawals(requested_at);
```

---

## 3. Beliefs Table Additions

**Purpose:** Support pool penalty/reward calculations during epoch processing

```sql
-- Relevance tracking
ALTER TABLE beliefs ADD COLUMN delta_relevance NUMERIC;  -- Δr = current - previous

-- Certainty from learning assessment (NOT uncertainty)
ALTER TABLE beliefs ADD COLUMN certainty NUMERIC CHECK (certainty >= 0 AND certainty <= 1);

-- Note: previous_aggregate already exists in spec (used to calculate delta_relevance)
```

**Epoch Processing Updates:**

Current epoch processing outputs aggregate belief. We need to also output:
1. **Certainty** - From learning assessment step
2. **Delta Relevance** - Calculated as `current_aggregate - previous_aggregate`

**Pool Redistribution Formula:**
- **Penalty calculation**: `penalty_rate = delta_relevance × certainty` (capped at 10%)
- **Reward distribution**: Normalize positive (Δr × certainty) values to probability simplex

---

## 4. Content Pool Creation Flow

### User Journey: From Post to Speculation Market

**Step 1: Post Creation (No Pool Required)**
- Any user with Solana address can create a post
- Posts exist independently without pools
- No belief market exists yet

**Step 2: First Speculator Triggers Pool Deployment**

When someone wants to speculate on a post, the UI must:

1. **Check if pool exists** for this post
   - Query `pool_deployments` by `post_id`
   - If exists, proceed to buy shares

2. **If no pool exists, create it** (multi-transaction flow):

   **Transaction 1: Create Veritas Belief (Off-chain)**
   - Edge function: `create-belief`
   - Creates belief record in `beliefs` table
   - Returns `belief_id`

   **Transaction 2: Deploy ContentPool (On-chain)**
   - Edge function: `deploy-content-pool`
   - Calls PoolFactory.create_pool
   - Creates pool PDA and token mint
   - Returns pool address

   **Transaction 3: Record Deployment (Off-chain)**
   - Edge function: `record-pool-deployment`
   - Inserts into `pool_deployments` table
   - Links `post_id`, `belief_id`, and `pool_address`

3. **Buy shares AND submit belief** (combined requirement):
   - User must do BOTH simultaneously (UI enforced):
     - Buy pool tokens (on-chain transaction)
     - Submit belief (p, m) to Veritas protocol (off-chain)
   - This is a UI/serverside requirement, not smart contract

**Edge Function: `deploy-content-pool`**

```typescript
// POST /api/deploy-content-pool
{
  post_id: UUID,
  user_solana_address: string,
  initial_k_quadratic?: number,  // Optional, uses default if not provided
  reserve_cap?: number,           // Optional, uses default if not provided
}

// Returns:
{
  belief_id: UUID,
  pool_address: string,
  token_mint_address: string,
  usdc_vault_address: string,
  tx_signature: string
}
```

**Implementation Steps:**
1. Validate post exists and has no pool yet
2. Create belief record in `beliefs` table
3. Build and send pool creation transaction to Solana
4. Wait for confirmation
5. Record deployment in `pool_deployments` table
6. Return pool addresses to UI

---

## 5. Removal of Tag System

### Tables to Remove
- ❌ `tags`
- ❌ `post_tags`
- ❌ `user_tag_preferences`

### Specs to Update
- ❌ Remove tag references from data-structures specs
- ❌ Remove Phase 5 & 6 from CLAUDE.md roadmap
- ❌ Update any edge function specs that mention tags

**Rationale:** Tag-based relevance markets and AI algorithm are out of scope for initial integration.

---

## 6. Backend Services Required

### Service 1: Deposit Event Indexer

**Architecture:** Helius Webhooks → Supabase Edge Functions → PostgreSQL

**Purpose:** Monitor VeritasCustodian for deposits and credit agent stakes

**Implementation:** See [Indexer Architecture Spec](/specs/solana-specs/indexer-architecture.md) for complete details

**High-level flow:**
1. User deposits USDC into VeritasCustodian vault
2. Helius detects USDC transfer and sends webhook to edge function
3. Edge function parses event and:
   - Inserts record into `custodian_deposits`
   - Upserts agent (creates if doesn't exist)
   - Credits `protocol_stake` via database function
   - Marks deposit as credited

**Key components:**
- **Helius Webhook:** Monitors custodian vault address for USDC transfers
- **Edge Function:** `helius-deposits` - Processes webhook and updates database
- **Database Function:** `increment_agent_stake` - Atomically credits stake

**Why Helius?**
- ✅ Real-time event-driven (no polling)
- ✅ Runs entirely on Supabase (no extra infrastructure)
- ✅ Reliable with automatic retries
- ✅ Cost-effective (~$0.001 per event)

### Service 2: Pool Deployment Service

**Purpose:** Create ContentPools via PoolFactory when users want to speculate

**Responsibilities:**
- Validate post exists and has no pool
- Create belief record
- Build pool creation transaction
- Submit to Solana and wait for confirmation
- Record deployment in `pool_deployments`

### Service 3: Epoch-to-Solana Bridge

**Purpose:** Trigger pool penalty/reward transactions after Veritas epoch processing

```typescript
// Pseudocode
async function processPoolRedistribution(epoch: number) {
  // 1. Get all pools with beliefs that have delta_relevance and certainty
  const pools = await db.pool_deployments
    .join('beliefs', 'beliefs.id', 'pool_deployments.belief_id')
    .select('pool_deployments.*, beliefs.delta_relevance, beliefs.certainty')
    .whereNotNull('beliefs.delta_relevance')
    .whereNotNull('beliefs.certainty');

  // 2. Calculate penalty/reward amounts
  const adjustments = pools.map(pool => {
    const impact = pool.delta_relevance * pool.certainty;

    if (impact < 0) {
      // Penalty (capped at 10%)
      const penaltyRate = Math.min(Math.abs(impact), 0.10);
      const penaltyAmount = pool.reserve * penaltyRate;
      return { pool, penalty: penaltyAmount, reward: 0 };
    } else if (impact > 0) {
      // Reward (calculated after all penalties collected)
      return { pool, penalty: 0, impact };
    } else {
      // No change
      return { pool, penalty: 0, reward: 0 };
    }
  });

  // 3. Phase 1: Collect penalties
  const penalties = adjustments.filter(a => a.penalty > 0);
  const totalPenalties = penalties.reduce((sum, a) => sum + a.penalty, 0);

  await Promise.all(
    penalties.map(({ pool, penalty }) =>
      contentPoolProgram.methods
        .applyPoolPenalty(new BN(penalty * 1_000_000))
        .accounts({
          pool: new PublicKey(pool.pool_address),
          treasury: treasuryPDA,
          poolUsdcVault: new PublicKey(pool.usdc_vault_address),
          treasuryUsdcVault: treasuryVaultAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          authority: authorityKeypair.publicKey
        })
        .rpc()
    )
  );

  // 4. Phase 2: Distribute rewards (normalize impacts to simplex)
  const rewards = adjustments.filter(a => a.impact > 0);
  const totalImpact = rewards.reduce((sum, a) => sum + a.impact, 0);

  if (totalImpact > 0) {
    await Promise.all(
      rewards.map(({ pool, impact }) => {
        const rewardAmount = (totalPenalties * impact) / totalImpact;

        return contentPoolProgram.methods
          .applyPoolReward(new BN(rewardAmount * 1_000_000))
          .accounts({
            pool: new PublicKey(pool.pool_address),
            treasury: treasuryPDA,
            poolUsdcVault: new PublicKey(pool.usdc_vault_address),
            treasuryUsdcVault: treasuryVaultAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authorityKeypair.publicKey
          })
          .rpc();
      })
    );
  }
}
```

---

## 7. Epoch Processing Chain Updates

### Current Chain
1. Belief Expiration Check
2. Process Updates (add/update/remove submissions)
3. Belief Aggregation
4. Mirror Descent
5. Learning Assessment
6. BTS Scoring
7. Stake Redistribution
8. Submission Status Update

### Required Addition

**Step 8.5: Calculate Delta Relevance & Certainty for Pools**

```typescript
// After stake redistribution, before ending epoch
async function calculatePoolMetrics(beliefs: Belief[]) {
  for (const belief of beliefs) {
    // Delta relevance = current aggregate - previous aggregate
    const deltaRelevance = belief.current_aggregate - belief.previous_aggregate;

    // Certainty comes from learning assessment step
    // (already calculated, just need to persist it)

    await db.beliefs
      .where({ id: belief.id })
      .update({
        delta_relevance: deltaRelevance,
        certainty: belief.certainty  // From learning assessment
      });
  }
}
```

**Step 9: Trigger Pool Redistribution**

```typescript
// After all Veritas processing complete
await processPoolRedistribution(currentEpoch);
```

---

## 8. User Requirements

### To Create User Account
- **Required:** Privy embedded Solana wallet
- Wallet address becomes user identity
- No deposit required to create account

### To Create Posts
- **Required:** User account with Solana address
- No deposit required
- Posts exist independently

### To Participate in Veritas Protocol (Submit Beliefs)
- **Required:** Deposit USDC into VeritasCustodian
- **UI Check:** Before allowing belief submission, verify deposit has been indexed:
  1. User clicks "Submit Belief"
  2. UI checks if `agents` table has record with sufficient stake
  3. If no agent or insufficient stake → Show "Deposit Required" modal
  4. User deposits via custodian
  5. UI polls database (or uses real-time subscription) until deposit indexed
  6. Once indexed, enable belief submission

**Deposit Verification Flow:**
```typescript
// In belief submission UI
async function verifyStakeBeforeSubmission(solanaAddress: string, requiredStake: number) {
  const { data: agent } = await supabase
    .from('agents')
    .select('protocol_stake')
    .eq('solana_address', solanaAddress)
    .single();

  if (!agent || agent.protocol_stake < requiredStake) {
    // Show deposit modal
    showDepositModal({
      required: requiredStake,
      current: agent?.protocol_stake || 0
    });
    return false;
  }

  return true;
}
```

**Real-time Deposit Detection:**
```typescript
// After user deposits, subscribe to changes
const subscription = supabase
  .channel('agent-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'agents',
    filter: `solana_address=eq.${userAddress}`
  }, (payload) => {
    if (payload.new.protocol_stake >= requiredStake) {
      // Deposit indexed! Enable belief submission
      closeDepositModal();
      enableBeliefSubmission();
    }
  })
  .subscribe();
```

**Why this works:**
- Helius webhook typically indexes deposits in < 1 second
- User sees near-instant confirmation
- No need for manual "Check Balance" button
- Prevents belief submission without stake (database constraint also enforces this)

### To Speculate on Content Pools
- **Required:**
  1. Wallet with USDC balance
  2. If pool doesn't exist, trigger pool deployment
  3. Buy pool tokens (on-chain)
  4. Submit belief (p, m) to Veritas protocol (off-chain) - **UI enforced requirement**

**Key Point:** Buying pool shares requires ALSO submitting belief to protocol. This is enforced by UI/serverside, not smart contract.

---

## 9. Migration Checklist

### Database
- [ ] Create migration script for agent identity refactor
- [ ] Create `pool_deployments` table
- [ ] Create `custodian_deposits` table
- [ ] Create `custodian_withdrawals` table
- [ ] Add `delta_relevance` and `certainty` to `beliefs` table
- [ ] Remove `tags`, `post_tags`, `user_tag_preferences` tables
- [ ] Update all foreign key constraints

### Backend Services
- [ ] Implement deposit event indexer
- [ ] Implement pool deployment edge function
- [ ] Implement epoch-to-Solana bridge
- [ ] Update epoch processing to output certainty and delta_relevance
- [ ] Implement withdrawal request/execution flow

### Frontend
- [ ] Update user creation to require Privy Solana wallet
- [ ] Add deposit UI for VeritasCustodian
- [ ] Add withdrawal request UI
- [ ] Implement pool deployment flow (multi-transaction)
- [ ] Enforce buy shares + submit belief requirement
- [ ] Display pool state (token supply, reserve, price)

### Smart Contracts (Already Implemented)
- [x] VeritasCustodian contract
- [x] PoolFactory contract
- [x] ContentPool contract
- [x] ProtocolTreasury contract

---

## 10. Open Questions

1. **Migration Strategy:** How do we migrate existing agents/users to Solana addresses?
   - Option A: Require all users to connect wallet and deposit again
   - Option B: Create mapping and airdrop existing stakes (requires manual process)

2. **Minimum Deposit Amount:** What's minimum to participate in Veritas?
   - Current default: $100
   - With real deposits: Maybe $10 minimum?

3. **Pool Deployment Permissions:** Who can deploy pools?
   - Option A: Anyone (permissionless)
   - Option B: Only post creator
   - Option C: Anyone who wants to speculate (current proposal)

4. **Belief Submission Without Pool:** Can users submit beliefs on posts without pools?
   - Currently: Yes (beliefs can exist without pools)
   - This maintains separation of concerns

5. **Pool Deployment Costs:** Who pays for pool deployment transaction?
   - First speculator pays gas fees
   - Pool creator gets recorded in `deployed_by_address`
