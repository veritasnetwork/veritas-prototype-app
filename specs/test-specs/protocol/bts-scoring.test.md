# BTS Scoring Test Specification

**Status:** ✅ Implementation exists at `/tests/protocol/bts-scoring.test.ts`
**Test Framework:** Deno Test
**Purpose:** Validate Bayesian Truth Serum (BTS) information score calculation for belief markets

## Overview

BTS scoring measures how **informative** each agent's belief submission is by comparing:
- Their belief (p_i) vs leave-one-out belief aggregate (p̄_{-i})
- Their belief (p_i) vs leave-one-out meta aggregate (m̄_{-i})
- Leave-one-out belief aggregate (p̄_{-i}) vs their meta-prediction (m_i)

**Formula:** `s_i = D_KL(p_i || m̄_{-i}) - D_KL(p_i || p̄_{-i}) - D_KL(p̄_{-i} || m_i)`

**Information Score:** `g_i = weight_i × s_i`

## Test Categories

### 1. Core BTS Calculation Tests

#### 1.1 Basic Two Agent Scenario
```typescript
Deno.test("BTS Scoring - Basic Two Agent Scenario", async () => {
  // Agent A: confident in true (0.9), predicts others uncertain (0.6)
  // Agent B: uncertain (0.4), predicts others confident (0.8)

  const request = {
    belief_id: 'test-belief',
    agent_beliefs: {
      'agent-a': 0.9,
      'agent-b': 0.4
    },
    leave_one_out_aggregates: {
      'agent-a': 0.4,  // Without A, aggregate = B's belief
      'agent-b': 0.9   // Without B, aggregate = A's belief
    },
    leave_one_out_meta_aggregates: {
      'agent-a': 0.8,  // Without A, meta = B's meta
      'agent-b': 0.6   // Without B, meta = A's meta
    },
    normalized_weights: {
      'agent-a': 0.5,
      'agent-b': 0.5
    },
    agent_meta_predictions: {
      'agent-a': 0.6,
      'agent-b': 0.8
    }
  };

  const result = await callBTSScoring(request);

  // Verify structure
  assertExists(result.bts_scores);
  assertExists(result.information_scores);
  assertExists(result.winners);
  assertExists(result.losers);

  // Agent A should have positive score (predicted divergence correctly)
  assert(result.bts_scores['agent-a'] > 0,
    "Agent A should have positive BTS score");

  // Information score = weight × BTS score
  assertAlmostEquals(
    result.information_scores['agent-a'],
    0.5 * result.bts_scores['agent-a'],
    1e-6
  );

  // Winners/losers partitioning
  if (result.information_scores['agent-a'] > 0) {
    assert(result.winners.includes('agent-a'));
  }
  if (result.information_scores['agent-b'] < 0) {
    assert(result.losers.includes('agent-b'));
  }
});
```

**Expected:**
- BTS scores calculated for all agents
- Information scores = weight × BTS score
- Correct winners/losers partitioning

#### 1.2 Mathematical Verification
```typescript
Deno.test("BTS Scoring - Mathematical Verification", async () => {
  // Manually calculate expected BTS score and verify

  const pi = 0.7;
  const pBarMinusI = 0.4;
  const mBarMinusI = 0.5;
  const mi = 0.6;

  // Expected BTS score
  const term1 = binaryKLDivergence(pi, mBarMinusI);
  const term2 = binaryKLDivergence(pi, pBarMinusI);
  const term3 = binaryKLDivergence(pBarMinusI, mi);
  const expectedBTS = term1 - term2 - term3;

  const result = await callBTSScoring({
    belief_id: 'test',
    agent_beliefs: { 'agent-a': pi },
    leave_one_out_aggregates: { 'agent-a': pBarMinusI },
    leave_one_out_meta_aggregates: { 'agent-a': mBarMinusI },
    normalized_weights: { 'agent-a': 1.0 },
    agent_meta_predictions: { 'agent-a': mi }
  });

  // Verify calculated score matches manual calculation
  assertAlmostEquals(
    result.bts_scores['agent-a'],
    expectedBTS,
    1e-6,
    "BTS score should match manual calculation"
  );
});
```

**Expected:**
- BTS score matches hand-calculated value

### 2. Multi-Agent Scenarios

#### 2.1 Three Agent Scenario
```typescript
Deno.test("BTS Scoring - Three Agent Scenario", async () => {
  // Three agents with varying accuracy in predictions

  const request = {
    belief_id: 'test-belief',
    agent_beliefs: {
      'agent-a': 0.8,
      'agent-b': 0.5,
      'agent-c': 0.3
    },
    leave_one_out_aggregates: {
      'agent-a': 0.4,  // (0.5 + 0.3) / 2
      'agent-b': 0.55, // (0.8 + 0.3) / 2
      'agent-c': 0.65  // (0.8 + 0.5) / 2
    },
    leave_one_out_meta_aggregates: {
      'agent-a': 0.55,
      'agent-b': 0.60,
      'agent-c': 0.65
    },
    normalized_weights: {
      'agent-a': 1/3,
      'agent-b': 1/3,
      'agent-c': 1/3
    },
    agent_meta_predictions: {
      'agent-a': 0.6,
      'agent-b': 0.6,
      'agent-c': 0.7
    }
  };

  const result = await callBTSScoring(request);

  // All agents should have scores
  assertEquals(Object.keys(result.bts_scores).length, 3);
  assertEquals(Object.keys(result.information_scores).length, 3);

  // Verify information score formula for each
  for (const agentId of ['agent-a', 'agent-b', 'agent-c']) {
    assertAlmostEquals(
      result.information_scores[agentId],
      (1/3) * result.bts_scores[agentId],
      1e-6
    );
  }

  // Winners + losers should not overlap
  const winnerSet = new Set(result.winners);
  const loserSet = new Set(result.losers);
  for (const winner of result.winners) {
    assert(!loserSet.has(winner), "Agent cannot be both winner and loser");
  }
});
```

**Expected:**
- Scores for all 3 agents
- No overlap between winners and losers
- Information scores correctly weighted

### 3. Edge Cases & Validation

#### 3.1 Extreme Probabilities
```typescript
Deno.test("BTS Scoring - Edge Case: Extreme Probabilities", async () => {
  // Near-boundary values (0.001, 0.999)

  const result = await callBTSScoring({
    belief_id: 'test',
    agent_beliefs: {
      'agent-a': 0.001,
      'agent-b': 0.999
    },
    leave_one_out_aggregates: {
      'agent-a': 0.999,
      'agent-b': 0.001
    },
    leave_one_out_meta_aggregates: {
      'agent-a': 0.5,
      'agent-b': 0.5
    },
    normalized_weights: {
      'agent-a': 0.5,
      'agent-b': 0.5
    },
    agent_meta_predictions: {
      'agent-a': 0.5,
      'agent-b': 0.5
    }
  });

  // Should not crash or produce NaN
  assert(isFinite(result.bts_scores['agent-a']));
  assert(isFinite(result.bts_scores['agent-b']));
  assert(isFinite(result.information_scores['agent-a']));
  assert(isFinite(result.information_scores['agent-b']));
});
```

**Expected:**
- No NaN or Infinity values
- Clamping prevents numerical issues

#### 3.2 Input Validation
```typescript
Deno.test("BTS Scoring - Input Validation", async () => {
  // Missing required fields
  const invalidRequest = {
    belief_id: 'test',
    // Missing agent_beliefs, etc.
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-bts-scoring`, {
    method: 'POST',
    headers,
    body: JSON.stringify(invalidRequest)
  });

  assertEquals(response.status, 422, "Should reject missing fields");

  const data = await response.json();
  assertExists(data.error);
});
```

**Expected:**
- Returns 422 for missing required fields
- Error message indicates what's missing

#### 3.3 Mismatched Agent Sets
```typescript
Deno.test("BTS Scoring - Mismatched Agent Sets", async () => {
  // agent_beliefs has agent-a, but leave_one_out_aggregates missing it

  const request = {
    belief_id: 'test',
    agent_beliefs: { 'agent-a': 0.7 },
    leave_one_out_aggregates: { 'agent-b': 0.5 },  // Wrong agent!
    leave_one_out_meta_aggregates: { 'agent-a': 0.5 },
    normalized_weights: { 'agent-a': 1.0 },
    agent_meta_predictions: { 'agent-a': 0.6 }
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-bts-scoring`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request)
  });

  assertEquals(response.status, 422, "Should reject mismatched agent sets");
});
```

**Expected:**
- Validates all agents have all required data
- Returns 422 for mismatched sets

#### 3.4 Zero Weights Edge Case
```typescript
Deno.test("BTS Scoring - Zero Stakes Edge Case", async () => {
  // Agent with zero weight

  const result = await callBTSScoring({
    belief_id: 'test',
    agent_beliefs: { 'agent-a': 0.7 },
    leave_one_out_aggregates: { 'agent-a': 0.5 },
    leave_one_out_meta_aggregates: { 'agent-a': 0.5 },
    normalized_weights: { 'agent-a': 0.0 },  // Zero weight
    agent_meta_predictions: { 'agent-a': 0.6 }
  });

  // BTS score calculated normally
  assertExists(result.bts_scores['agent-a']);

  // Information score should be 0 (weight × BTS = 0 × anything = 0)
  assertEquals(result.information_scores['agent-a'], 0);

  // Should not be in winners or losers (score = 0)
  assert(!result.winners.includes('agent-a'));
  assert(!result.losers.includes('agent-a'));
});
```

**Expected:**
- BTS score calculated even with zero weight
- Information score = 0
- Agent excluded from winners/losers

### 4. Winners/Losers Partitioning

#### 4.1 Partition Correctness
```typescript
Deno.test("BTS Scoring - Winners and Losers Partition", async () => {
  const result = await callBTSScoring({
    agent_beliefs: {
      'positive': 0.8,
      'negative': 0.2,
      'neutral': 0.5
    },
    // ... setup to produce positive, negative, neutral scores
  });

  // Verify partitioning
  for (const winner of result.winners) {
    assert(result.information_scores[winner] > 0,
      "Winners must have positive information scores");
  }

  for (const loser of result.losers) {
    assert(result.information_scores[loser] < 0,
      "Losers must have negative information scores");
  }

  // Neutral agents (score = 0) should be in neither
  for (const agentId in result.information_scores) {
    if (result.information_scores[agentId] === 0) {
      assert(!result.winners.includes(agentId));
      assert(!result.losers.includes(agentId));
    }
  }
});
```

### 5. Integration with Decomposition

#### 5.1 Decomposition → BTS Pipeline
```typescript
Deno.test("BTS Scoring - Integration with Decomposition Output", async () => {
  // First run decomposition
  const decompResult = await callSupabaseFunction('protocol-beliefs-decompose/decompose', {
    belief_id: beliefId,
    weights
  });

  // Verify decomposition returns required fields
  assertExists(decompResult.leave_one_out_aggregates,
    "Decomposition must return leave_one_out_aggregates for BTS");
  assertExists(decompResult.leave_one_out_meta_aggregates,
    "Decomposition must return leave_one_out_meta_aggregates for BTS");

  // Now run BTS with decomposition output
  const btsResult = await callBTSScoring({
    belief_id: beliefId,
    agent_beliefs: agentBeliefs,
    leave_one_out_aggregates: decompResult.leave_one_out_aggregates,
    leave_one_out_meta_aggregates: decompResult.leave_one_out_meta_aggregates,
    normalized_weights: weights,
    agent_meta_predictions: decompResult.agent_meta_predictions
  });

  // Should succeed without errors
  assertExists(btsResult.bts_scores);
  assertExists(btsResult.information_scores);
});
```

**Expected:**
- Decomposition output can be directly passed to BTS scoring
- No missing or undefined values
- Pipeline works end-to-end

## Success Criteria

### Must Pass
- ✅ BTS scores calculated for all agents
- ✅ Information scores = weight × BTS score
- ✅ Winners have positive information scores
- ✅ Losers have negative information scores
- ✅ Neutral agents (score = 0) in neither winners nor losers
- ✅ No NaN or Infinity in outputs
- ✅ Input validation rejects missing/invalid data
- ✅ **Works with decomposition output** (critical integration test)

### Should Pass
- ✅ Mathematically correct BTS formula implementation
- ✅ Handles extreme probabilities (0.001, 0.999) without crashing
- ✅ Zero-weight agents handled correctly

## Binary KL Divergence Helper

All tests use this helper for verification:

```typescript
function binaryKLDivergence(p: number, q: number): number {
  const EPSILON = 1e-10;
  const pClamped = Math.max(EPSILON, Math.min(1 - EPSILON, p));
  const qClamped = Math.max(EPSILON, Math.min(1 - EPSILON, q));

  return pClamped * Math.log(pClamped / qClamped) +
         (1 - pClamped) * Math.log((1 - pClamped) / (1 - qClamped));
}
```

## Running Tests

```bash
# Run all BTS scoring tests
deno test tests/protocol/bts-scoring.test.ts --allow-net --allow-env

# Run specific test
deno test tests/protocol/bts-scoring.test.ts --allow-net --allow-env --filter "Mathematical Verification"
```

---

**Last Updated:** 2025-01-27
**Implementation:** `/tests/protocol/bts-scoring.test.ts`
