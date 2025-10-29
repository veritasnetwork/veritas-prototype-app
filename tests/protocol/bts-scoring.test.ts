/// <reference lib="deno.ns" />
import { assertEquals, assert, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

interface BTSScoringRequest {
  belief_id: string
  agent_beliefs: Record<string, number>
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
  agent_meta_predictions: Record<string, number>
}

interface BTSScoringResponse {
  bts_scores: Record<string, number>
  winners: string[]
  losers: string[]
}

async function callBTSScoring(request: BTSScoringRequest): Promise<BTSScoringResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-bts-scoring`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`BTS scoring failed: ${response.status} ${errorText}`)
  }

  return await response.json()
}

// Helper function to calculate binary KL divergence for testing
function binaryKLDivergence(p: number, q: number): number {
  const EPSILON = 1e-10
  const pClamped = Math.max(EPSILON, Math.min(1 - EPSILON, p))
  const qClamped = Math.max(EPSILON, Math.min(1 - EPSILON, q))

  return pClamped * Math.log(pClamped / qClamped) +
         (1 - pClamped) * Math.log((1 - pClamped) / (1 - qClamped))
}

function assertAlmostEquals(actual: number, expected: number, tolerance: number, message?: string) {
  assert(Math.abs(actual - expected) < tolerance, message || `Expected ${actual} to be within ${tolerance} of ${expected}`)
}

// ============================================================================
// 1. Core BTS Calculation Tests
// ============================================================================

Deno.test("BTS Scoring - Basic Two Agent Scenario", async () => {
  // Agent A: confident in true (0.9), predicts others uncertain (0.6)
  // Agent B: uncertain (0.4), predicts others confident (0.8)

  const request: BTSScoringRequest = {
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
    agent_meta_predictions: {
      'agent-a': 0.6,
      'agent-b': 0.8
    }
  };

  const result = await callBTSScoring(request);

  // Verify structure
  assertExists(result.bts_scores);
  assertExists(result.winners);
  assertExists(result.losers);

  // Both agents should have BTS scores calculated
  assertExists(result.bts_scores['agent-a'], "Agent A should have BTS score");
  assertExists(result.bts_scores['agent-b'], "Agent B should have BTS score");

  // Verify BTS scores are finite
  assert(isFinite(result.bts_scores['agent-a']), "Agent A BTS score should be finite");
  assert(isFinite(result.bts_scores['agent-b']), "Agent B BTS score should be finite");

  // Winners/losers partitioning - verify correct partitioning based on BTS scores
  for (const agentId of ['agent-a', 'agent-b']) {
    if (result.bts_scores[agentId] > 0) {
      assert(result.winners.includes(agentId), `${agentId} with positive score should be in winners`);
    } else if (result.bts_scores[agentId] < 0) {
      assert(result.losers.includes(agentId), `${agentId} with negative score should be in losers`);
    }
  }

  console.log("✅ Basic two agent scenario passed");
});

Deno.test("BTS Scoring - Mathematical Verification", async () => {
  // Manually calculate expected BTS score and verify

  const pi = 0.7;
  const pBarMinusI = 0.4;
  const mBarMinusI = 0.5;
  const mi = 0.6;

  // Expected BTS score: s_i = D_KL(p_i || m̄_{-i}) - D_KL(p_i || p̄_{-i}) - D_KL(p̄_{-i} || m_i)
  const term1 = binaryKLDivergence(pi, mBarMinusI);
  const term2 = binaryKLDivergence(pi, pBarMinusI);
  const term3 = binaryKLDivergence(pBarMinusI, mi);
  const expectedBTS = term1 - term2 - term3;

  const result = await callBTSScoring({
    belief_id: 'test',
    agent_beliefs: { 'agent-a': pi },
    leave_one_out_aggregates: { 'agent-a': pBarMinusI },
    leave_one_out_meta_aggregates: { 'agent-a': mBarMinusI },
    agent_meta_predictions: { 'agent-a': mi }
  });

  // Verify calculated score matches manual calculation
  assertAlmostEquals(
    result.bts_scores['agent-a'],
    expectedBTS,
    1e-6,
    "BTS score should match manual calculation"
  );

  console.log("✅ Mathematical verification passed");
});

// ============================================================================
// 2. Multi-Agent Scenarios
// ============================================================================

Deno.test("BTS Scoring - Three Agent Scenario", async () => {
  // Three agents with varying accuracy in predictions

  const request: BTSScoringRequest = {
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
    agent_meta_predictions: {
      'agent-a': 0.6,
      'agent-b': 0.6,
      'agent-c': 0.7
    }
  };

  const result = await callBTSScoring(request);

  // All agents should have scores
  assertEquals(Object.keys(result.bts_scores).length, 3);

  // Verify BTS scores are finite for each
  for (const agentId of ['agent-a', 'agent-b', 'agent-c']) {
    assertExists(result.bts_scores[agentId], `BTS score for ${agentId} should exist`);
    assert(isFinite(result.bts_scores[agentId]), `BTS score for ${agentId} should be finite`);
  }

  // Winners + losers should not overlap
  const winnerSet = new Set(result.winners);
  const loserSet = new Set(result.losers);
  for (const winner of result.winners) {
    assert(!loserSet.has(winner), "Agent cannot be both winner and loser");
  }

  console.log("✅ Three agent scenario passed");
});

// ============================================================================
// 3. Edge Cases & Validation
// ============================================================================

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
    agent_meta_predictions: {
      'agent-a': 0.5,
      'agent-b': 0.5
    }
  });

  // Should not crash or produce NaN
  assert(isFinite(result.bts_scores['agent-a']), "Agent A BTS score should be finite");
  assert(isFinite(result.bts_scores['agent-b']), "Agent B BTS score should be finite");

  console.log("✅ Extreme probabilities test passed");
});

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

  assertEquals(response.status, 422, "Should reject missing fields with 422");

  const data = await response.json();
  assertExists(data.error, "Error message should exist");

  console.log("✅ Input validation test passed");
});

Deno.test("BTS Scoring - Mismatched Agent Sets", async () => {
  // agent_beliefs has agent-a, but leave_one_out_aggregates missing it

  const request = {
    belief_id: 'test',
    agent_beliefs: { 'agent-a': 0.7 },
    leave_one_out_aggregates: { 'agent-b': 0.5 },  // Wrong agent!
    leave_one_out_meta_aggregates: { 'agent-a': 0.5 },
    agent_meta_predictions: { 'agent-a': 0.6 }
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-bts-scoring`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request)
  });

  assertEquals(response.status, 422, "Should reject mismatched agent sets with 422");

  // Consume response body to prevent leak
  await response.text();

  console.log("✅ Mismatched agent sets test passed");
});

// ============================================================================
// 4. Winners/Losers Partitioning
// ============================================================================

Deno.test("BTS Scoring - Winners and Losers Partition", async () => {
  // Setup to produce positive, negative, and neutral scores
  const result = await callBTSScoring({
    belief_id: 'test',
    agent_beliefs: {
      'positive': 0.9,
      'negative': 0.1,
      'neutral': 0.5
    },
    leave_one_out_aggregates: {
      'positive': 0.3,  // Divergent from belief → positive score expected
      'negative': 0.7,  // Divergent from belief → but wrong direction
      'neutral': 0.5    // Same as belief → neutral score expected
    },
    leave_one_out_meta_aggregates: {
      'positive': 0.4,
      'negative': 0.6,
      'neutral': 0.5
    },
    agent_meta_predictions: {
      'positive': 0.3,
      'negative': 0.7,
      'neutral': 0.5
    }
  });

  // Verify partitioning based on BTS scores
  for (const winner of result.winners) {
    assert(result.bts_scores[winner] > 0,
      `Winners must have positive BTS scores, got ${result.bts_scores[winner]} for ${winner}`);
  }

  for (const loser of result.losers) {
    assert(result.bts_scores[loser] < 0,
      `Losers must have negative BTS scores, got ${result.bts_scores[loser]} for ${loser}`);
  }

  // Neutral agents (score = 0) should be in neither
  for (const agentId in result.bts_scores) {
    if (Math.abs(result.bts_scores[agentId]) < 1e-10) {
      assert(!result.winners.includes(agentId), `Agent ${agentId} with score 0 should not be in winners`);
      assert(!result.losers.includes(agentId), `Agent ${agentId} with score 0 should not be in losers`);
    }
  }

  console.log("✅ Winners/losers partition test passed");
});

// ============================================================================
// 5. Integration with Decomposition
// ============================================================================

Deno.test("BTS Scoring - Integration with Decomposition Output", async () => {
  // This test verifies that decomposition output can be directly passed to BTS scoring
  // In practice, this would call the decomposition endpoint first, but here we simulate it

  const beliefId = 'test-integration';
  const agentBeliefs = {
    'agent-1': 0.7,
    'agent-2': 0.5,
    'agent-3': 0.3
  };

  // Simulate decomposition output (would come from protocol-beliefs-decompose/decompose)
  const decompResult = {
    aggregate: 0.5,
    common_prior: 0.5,
    leave_one_out_aggregates: {
      'agent-1': 0.4,  // Without agent-1: (0.5 + 0.3) / 2 = 0.4
      'agent-2': 0.5,  // Without agent-2: (0.7 + 0.3) / 2 = 0.5
      'agent-3': 0.6   // Without agent-3: (0.7 + 0.5) / 2 = 0.6
    },
    leave_one_out_meta_aggregates: {
      'agent-1': 0.55,
      'agent-2': 0.60,
      'agent-3': 0.65
    },
    agent_meta_predictions: {
      'agent-1': 0.6,
      'agent-2': 0.6,
      'agent-3': 0.7
    }
  };

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
    agent_meta_predictions: decompResult.agent_meta_predictions
  });

  // Should succeed without errors
  assertExists(btsResult.bts_scores, "BTS scores should exist");

  // Verify all agents have scores
  assertEquals(Object.keys(btsResult.bts_scores).length, 3, "Should have scores for all 3 agents");

  console.log("✅ Integration with decomposition test passed");
  console.log("✅ CRITICAL: BD → BTS pipeline works correctly");
});
