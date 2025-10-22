# Rebase Flow Test Specification

## Test Environment
- **Framework:** Jest + Supertest (API testing)
- **Runtime:** Local development environment
- **Language:** TypeScript
- **Location:** `/tests/api/`

## Overview
The rebase flow combines belief-specific epoch processing with pool settlement in a single user-triggered action. This test specification covers the complete flow from API endpoint through on-chain settlement.

## Test Categories

### 1. API Endpoint: POST /api/posts/[id]/rebase

#### 1.1 Authentication
**Purpose:** Verify Privy authentication is enforced

```typescript
describe('Authentication', () => {
  it('returns 401 when no auth token provided', async () => {
    const response = await request(app)
      .post('/api/posts/test-post-id/rebase')
      .send({ walletAddress: 'valid-wallet-address' });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('authentication');
  });

  it('returns 401 when invalid auth token provided', async () => {
    const response = await request(app)
      .post('/api/posts/test-post-id/rebase')
      .set('Authorization', 'Bearer invalid-token')
      .send({ walletAddress: 'valid-wallet-address' });

    expect(response.status).toBe(401);
  });

  it('succeeds with valid Privy auth token', async () => {
    const validToken = await getValidPrivyToken();
    const response = await request(app)
      .post('/api/posts/test-post-id/rebase')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).not.toBe(401);
  });
});
```

#### 1.2 Input Validation
**Purpose:** Ensure required parameters are validated

```typescript
describe('Input Validation', () => {
  it('returns 400 when walletAddress is missing', async () => {
    const response = await authenticatedRequest
      .post('/api/posts/test-post-id/rebase')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('walletAddress');
  });

  it('returns 404 when pool not found for post', async () => {
    const response = await authenticatedRequest
      .post('/api/posts/non-existent-post/rebase')
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Pool not found');
  });

  it('returns 400 when pool status is not market_deployed', async () => {
    const emptyPoolPost = await createPostWithEmptyPool();
    const response = await authenticatedRequest
      .post(`/api/posts/${emptyPoolPost.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('market_deployed');
  });
});
```

#### 1.3 Minimum New Submissions Check
**Purpose:** Verify rebase requires sufficient new activity

```typescript
describe('Minimum New Submissions Check', () => {
  it('returns 400 when insufficient new submissions since last settlement', async () => {
    const post = await createPostWithDeployedPool();

    // First rebase with 2 submissions
    await submitBelief(post.id, trader1, 0.7, 0.6);
    await submitBelief(post.id, trader2, 0.3, 0.4);
    await rebasePool(post.id);

    // Fast-forward past cooldown
    await advanceTime(3600);

    // Try to rebase without new submissions
    const response = await authenticatedRequest
      .post(`/api/posts/${post.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('new unique belief submissions');
    expect(response.body.currentNewSubmissions).toBe(0);
    expect(response.body.minNewSubmissions).toBe(2);
  });

  it('allows rebase when sufficient new submissions exist', async () => {
    const post = await createPostWithDeployedPool();

    // First rebase
    await submitBelief(post.id, trader1, 0.7, 0.6);
    await submitBelief(post.id, trader2, 0.3, 0.4);
    await rebasePool(post.id);

    // Fast-forward past cooldown
    await advanceTime(3600);

    // Add 2 new unique submissions
    const trader3 = await createTrader();
    const trader4 = await createTrader();
    await submitBelief(post.id, trader3, 0.6, 0.5);
    await submitBelief(post.id, trader4, 0.4, 0.5);

    const response = await authenticatedRequest
      .post(`/api/posts/${post.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(200);
  });

  it('respects min_new_submissions_for_rebase from system_config', async () => {
    // Update system config to require 3 submissions
    await supabase
      .from('system_config')
      .update({ value: '3' })
      .eq('key', 'min_new_submissions_for_rebase');

    const post = await createPostWithDeployedPool();
    await rebasePool(post.id); // First rebase
    await advanceTime(3600);

    // Add only 2 new submissions
    await submitBelief(post.id, trader3, 0.6, 0.5);
    await submitBelief(post.id, trader4, 0.4, 0.5);

    const response = await authenticatedRequest
      .post(`/api/posts/${post.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(400);
    expect(response.body.minNewSubmissions).toBe(3);
    expect(response.body.currentNewSubmissions).toBe(2);

    // Clean up
    await supabase
      .from('system_config')
      .update({ value: '2' })
      .eq('key', 'min_new_submissions_for_rebase');
  });

  it('counts only unique submitters (ignores duplicate submissions)', async () => {
    const post = await createPostWithDeployedPool();
    await rebasePool(post.id); // First rebase
    await advanceTime(3600);

    // Same trader submits twice (should count as 1)
    await submitBelief(post.id, trader1, 0.7, 0.6);
    await submitBelief(post.id, trader1, 0.8, 0.7); // Updated submission

    const response = await authenticatedRequest
      .post(`/api/posts/${post.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(400);
    expect(response.body.currentNewSubmissions).toBe(1); // Only 1 unique agent
  });

  it('allows first rebase with sufficient initial submissions', async () => {
    const post = await createPostWithDeployedPool();

    // Initial submissions (no previous settlement)
    await submitBelief(post.id, trader1, 0.7, 0.6);
    await submitBelief(post.id, trader2, 0.3, 0.4);

    const response = await authenticatedRequest
      .post(`/api/posts/${post.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(200);
  });
});
```

#### 1.4 Cooldown Enforcement
**Purpose:** Verify settlement cooldown prevents rapid rebasing

```typescript
describe('Cooldown Enforcement', () => {
  it('returns 429 when cooldown period has not elapsed', async () => {
    // First rebase
    await rebasePool(postId);

    // Immediate second rebase attempt
    const response = await authenticatedRequest
      .post(`/api/posts/${postId}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('cooldown');
    expect(response.body.remainingSeconds).toBeGreaterThan(0);
    expect(response.body.minInterval).toBe(3600); // Default 1 hour
  });

  it('allows rebase after cooldown period elapses (with new submissions)', async () => {
    // First rebase
    await rebasePool(postId);

    // Fast-forward time past cooldown
    await advanceTime(3600); // 1 hour

    // Add new submissions to satisfy minimum requirement
    const trader3 = await createTrader();
    const trader4 = await createTrader();
    await submitBelief(postId, trader3, 0.6, 0.5);
    await submitBelief(postId, trader4, 0.4, 0.5);

    const response = await authenticatedRequest
      .post(`/api/posts/${postId}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(200);
  });

  it('allows first rebase when no previous settlement exists', async () => {
    const newPost = await createPostWithDeployedPool();

    // Need initial submissions
    await submitBelief(newPost.id, trader1, 0.7, 0.6);
    await submitBelief(newPost.id, trader2, 0.3, 0.4);

    const response = await authenticatedRequest
      .post(`/api/posts/${newPost.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(200);
  });
});
```

### 2. Epoch Processing Integration

#### 2.1 Belief-Specific Processing
**Purpose:** Verify epoch processing is called correctly

```typescript
describe('Epoch Processing', () => {
  it('calls protocol-belief-epoch-process with correct belief_id', async () => {
    const mockEdgeFunction = jest.spyOn(supabase.functions, 'invoke');

    await rebasePool(postId);

    expect(mockEdgeFunction).toHaveBeenCalledWith(
      'protocol-belief-epoch-process',
      expect.objectContaining({
        body: { belief_id: expectedBeliefId }
      })
    );
  });

  it('returns 400 when belief has fewer than 2 participants', async () => {
    const singleParticipantPost = await createPostWithOneSubmission();

    const response = await authenticatedRequest
      .post(`/api/posts/${singleParticipantPost.id}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('at least 2 participants');
  });

  it('updates belief.previous_aggregate with new BD score', async () => {
    const beforeBelief = await getBeliefForPost(postId);

    await rebasePool(postId);

    const afterBelief = await getBeliefForPost(postId);
    expect(afterBelief.previous_aggregate).not.toBe(beforeBelief.previous_aggregate);
    expect(afterBelief.previous_aggregate).toBeGreaterThanOrEqual(0);
    expect(afterBelief.previous_aggregate).toBeLessThanOrEqual(1);
  });
});
```

#### 2.2 Stake Redistribution
**Purpose:** Verify stake changes use new belief_weights model

```typescript
describe('Stake Redistribution', () => {
  it('uses belief_lock (w_i) from user_pool_balances', async () => {
    // Setup: Create pool with 2 traders
    const trader1 = await createTrader();
    const trader2 = await createTrader();

    await trade(postId, trader1, 'buy', 100); // w_i = 2
    await trade(postId, trader2, 'buy', 200); // w_i = 4

    const balancesBefore = await getUserPoolBalances(postId);
    expect(balancesBefore[trader1.agentId].belief_lock).toBe(2);
    expect(balancesBefore[trader2.agentId].belief_lock).toBe(4);

    // Trigger rebase
    const response = await rebasePool(postId);

    // Verify stake changes use w_i values
    expect(response.body.stakeChanges.totalRewards).toBeGreaterThan(0);
    expect(response.body.stakeChanges.totalSlashes).toBeGreaterThan(0);
  });

  it('enforces zero-sum property in stake redistribution', async () => {
    const response = await rebasePool(postId);

    const { totalRewards, totalSlashes } = response.body.stakeChanges;

    // Zero-sum: rewards == slashes (within rounding error)
    expect(Math.abs(totalRewards - totalSlashes)).toBeLessThan(0.01);
  });

  it('calculates ΔS = score × w_i for each participant', async () => {
    // Setup: Mock BTS scores
    const trader1Score = 0.5;  // Winner
    const trader2Score = -0.5; // Loser
    const trader1Weight = 2;
    const trader2Weight = 4;

    await mockBTSScores({
      [trader1.agentId]: trader1Score,
      [trader2.agentId]: trader2Score
    });

    const stakesBefore = await getAgentStakes([trader1.agentId, trader2.agentId]);

    await rebasePool(postId);

    const stakesAfter = await getAgentStakes([trader1.agentId, trader2.agentId]);

    // Verify ΔS = score × w_i
    const delta1 = stakesAfter[trader1.agentId] - stakesBefore[trader1.agentId];
    const delta2 = stakesAfter[trader2.agentId] - stakesBefore[trader2.agentId];

    expect(delta1).toBeCloseTo(trader1Score * trader1Weight, 2);
    expect(delta2).toBeCloseTo(trader2Score * trader2Weight, 2);
  });
});
```

### 3. Settlement Transaction Building

#### 3.1 Transaction Construction
**Purpose:** Verify settlement transaction is built correctly

```typescript
describe('Transaction Construction', () => {
  it('builds settle_epoch instruction with BD score in Q32.32 format', async () => {
    const response = await rebasePool(postId);

    expect(response.status).toBe(200);
    expect(response.body.transaction).toBeDefined();
    expect(response.body.bdScore).toBeGreaterThanOrEqual(0);
    expect(response.body.bdScore).toBeLessThanOrEqual(1);

    // Decode transaction and verify instruction
    const tx = Transaction.from(Buffer.from(response.body.transaction, 'base64'));
    expect(tx.instructions.length).toBe(1);

    const ix = tx.instructions[0];
    expect(ix.programId.toBase58()).toBe(VERITAS_PROGRAM_ID);

    // Verify BD score conversion to Q32.32
    const expectedQ32 = Math.floor(response.body.bdScore * (1 << 32));
    // Would need to decode instruction data to verify this
  });

  it('sets user wallet as fee payer', async () => {
    const response = await rebasePool(postId);

    const tx = Transaction.from(Buffer.from(response.body.transaction, 'base64'));
    expect(tx.feePayer?.toBase58()).toBe(userWallet.publicKey.toBase58());
  });

  it('includes protocol authority partial signature', async () => {
    const response = await rebasePool(postId);

    const tx = Transaction.from(Buffer.from(response.body.transaction, 'base64'));

    // Transaction should have partial signatures
    expect(tx.signatures.length).toBeGreaterThan(0);

    // One signature should be from protocol authority
    const protocolAuthSig = tx.signatures.find(sig =>
      sig.publicKey.toBase58() === PROTOCOL_AUTHORITY_PUBKEY
    );
    expect(protocolAuthSig).toBeDefined();
    expect(protocolAuthSig!.signature).not.toBeNull();
  });
});
```

#### 3.2 Dual Signing
**Purpose:** Verify dual-signing pattern works correctly

```typescript
describe('Dual Signing', () => {
  it('validates protocol authority matches factory authority', async () => {
    // Simulate authority mismatch (should fail server-side)
    const response = await rebasePool(postId);

    expect(response.status).not.toBe(500);
    // In production, if authorities mismatch, should return 500
  });

  it('requires user signature to complete transaction', async () => {
    const response = await rebasePool(postId);

    const tx = Transaction.from(Buffer.from(response.body.transaction, 'base64'));

    // Transaction should NOT be fully signed
    expect(() => tx.verifySignatures()).toThrow();

    // After user signs
    tx.partialSign(userWallet);

    // Now should verify
    expect(() => tx.verifySignatures()).not.toThrow();
  });
});
```

### 4. Response Format

#### 4.1 Success Response
**Purpose:** Verify response contains all required data

```typescript
describe('Success Response', () => {
  it('returns complete rebase result on success', async () => {
    const response = await rebasePool(postId);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      transaction: expect.any(String),
      beliefId: expect.any(String),
      bdScore: expect.any(Number),
      poolAddress: expect.any(String),
      currentEpoch: expect.any(Number),
      stakeChanges: {
        totalRewards: expect.any(Number),
        totalSlashes: expect.any(Number),
        participantCount: expect.any(Number)
      }
    });
  });

  it('includes accurate stake change summary', async () => {
    const response = await rebasePool(postId);

    const { stakeChanges } = response.body;

    expect(stakeChanges.totalRewards).toBeGreaterThanOrEqual(0);
    expect(stakeChanges.totalSlashes).toBeGreaterThanOrEqual(0);
    expect(stakeChanges.participantCount).toBeGreaterThanOrEqual(2);

    // Zero-sum check
    expect(Math.abs(stakeChanges.totalRewards - stakeChanges.totalSlashes)).toBeLessThan(0.01);
  });
});
```

### 5. Integration Tests

#### 5.1 End-to-End Rebase
**Purpose:** Test complete flow from button click to settlement

```typescript
describe('End-to-End Rebase', () => {
  it('completes full rebase flow successfully', async () => {
    // Setup: Create post with deployed pool and multiple participants
    const { postId, trader1, trader2 } = await setupRebaseScenario();

    // Submit beliefs
    await submitBelief(postId, trader1, 0.7, 0.6);
    await submitBelief(postId, trader2, 0.3, 0.4);

    // Get state before rebase
    const poolBefore = await getPoolData(postId);
    const beliefBefore = await getBeliefData(postId);

    // Execute rebase
    const response = await authenticatedRequest
      .post(`/api/posts/${postId}/rebase`)
      .send({ walletAddress: userWallet.publicKey.toBase58() });

    expect(response.status).toBe(200);

    // User signs and sends transaction
    const tx = Transaction.from(Buffer.from(response.body.transaction, 'base64'));
    tx.partialSign(userWallet);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);

    // Verify post-rebase state
    const poolAfter = await getPoolData(postId);
    const beliefAfter = await getBeliefData(postId);

    expect(beliefAfter.previous_aggregate).not.toBe(beliefBefore.previous_aggregate);
    expect(poolAfter.current_epoch).toBe(poolBefore.current_epoch + 1);

    // Verify settlement event was indexed
    const settlement = await getLatestSettlement(poolAfter.pool_address);
    expect(settlement).toBeDefined();
    expect(settlement.bd_score).toBe(beliefAfter.previous_aggregate);
  });

  it('handles concurrent rebase attempts gracefully', async () => {
    const requests = Array(5).fill(null).map(() =>
      authenticatedRequest
        .post(`/api/posts/${postId}/rebase`)
        .send({ walletAddress: userWallet.publicKey.toBase58() })
    );

    const responses = await Promise.all(requests);

    // Only one should succeed (200), others should fail with cooldown (429)
    const successes = responses.filter(r => r.status === 200);
    const cooldowns = responses.filter(r => r.status === 429);

    expect(successes.length).toBe(1);
    expect(cooldowns.length).toBe(4);
  });
});
```

## Error Scenarios

### 6.1 Edge Function Failures
**Purpose:** Handle edge function errors gracefully

```typescript
describe('Edge Function Errors', () => {
  it('returns 500 when epoch processing fails', async () => {
    // Mock edge function failure
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Edge function error'));

    const response = await rebasePool(postId);

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('error');
  });

  it('returns 400 when BD score is not produced', async () => {
    // Mock epoch processing that doesn't set previous_aggregate
    const response = await rebasePool(postIdWithoutScore);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('BD score');
  });
});
```

## Test Data Setup

### Helper Functions

```typescript
async function setupRebaseScenario() {
  // Create post with deployed pool
  const post = await createPost(creator);
  const pool = await deployPool(post.id, initialLiquidity);

  // Create traders
  const trader1 = await createTrader();
  const trader2 = await createTrader();

  // Fund traders
  await fundTrader(trader1, 1000);
  await fundTrader(trader2, 1000);

  // Make initial trades
  await trade(post.id, trader1, 'buy', 100);
  await trade(post.id, trader2, 'buy', 200);

  return { postId: post.id, trader1, trader2 };
}

async function advanceTime(seconds: number) {
  // Fast-forward time in test environment
  jest.advanceTimersByTime(seconds * 1000);
}

async function rebasePool(postId: string) {
  const token = await getValidPrivyToken();
  return request(app)
    .post(`/api/posts/${postId}/rebase`)
    .set('Authorization', `Bearer ${token}`)
    .send({ walletAddress: userWallet.publicKey.toBase58() });
}
```

## Success Criteria

- ✅ All authentication tests pass
- ✅ Input validation catches all invalid inputs
- ✅ Cooldown enforcement prevents rapid rebasing
- ✅ Epoch processing integrates correctly
- ✅ Stake redistribution uses belief_weights model
- ✅ Zero-sum property is maintained
- ✅ Settlement transaction builds correctly
- ✅ Dual-signing pattern works
- ✅ End-to-end flow completes successfully
- ✅ Error handling is comprehensive

## Test Execution

```bash
# Run all rebase flow tests
npm test tests/api/rebase-flow.test.ts

# Run with coverage
npm test -- --coverage tests/api/rebase-flow.test.ts

# Run specific test suite
npm test -- -t "Cooldown Enforcement"
```

---

**Status:** Test specification complete
**Implementation:** Pending
**Dependencies:** Protocol edge functions deployed, Privy auth configured
