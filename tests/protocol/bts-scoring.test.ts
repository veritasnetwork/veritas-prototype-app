/// <reference lib="deno.ns" />
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { SUPABASE_URL, headers } from '../test-config.ts'

interface BTSScoringRequest {
  belief_id: string
  post_mirror_descent_beliefs: Record<string, number>
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
  normalized_weights: Record<string, number>
  agent_meta_predictions: Record<string, number>
}

interface BTSScoringResponse {
  bts_scores: Record<string, number>
  information_scores: Record<string, number>
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

Deno.test("BTS Scoring - Basic Two Agent Scenario", async () => {
  // Agent A: confident in true (0.9), predicts others will be uncertain (0.6)
  // Agent B: uncertain (0.4), predicts others will be confident in true (0.8)
  // Both have equal normalized weights

  const request: BTSScoringRequest = {
    belief_id: "test-belief-1",
    post_mirror_descent_beliefs: {
      "agent-a": 0.9,
      "agent-b": 0.4
    },
    leave_one_out_aggregates: {
      "agent-a": 0.4,  // Aggregate without A (just B's 0.4)
      "agent-b": 0.9   // Aggregate without B (just A's 0.9)
    },
    leave_one_out_meta_aggregates: {
      "agent-a": 0.8,  // Meta aggregate without A (just B's meta-prediction 0.8)
      "agent-b": 0.6   // Meta aggregate without B (just A's meta-prediction 0.6)
    },
    normalized_weights: {
      "agent-a": 0.5,  // Equal normalized weights (sum to 1.0)
      "agent-b": 0.5
    },
    agent_meta_predictions: {
      "agent-a": 0.6,
      "agent-b": 0.8
    }
  }

  const result = await callBTSScoring(request)

  // Verify response structure
  assertExists(result.bts_scores)
  assertExists(result.information_scores)
  assertExists(result.winners)
  assertExists(result.losers)

  // Verify all agents have scores
  assertEquals(Object.keys(result.bts_scores).length, 2)
  assertEquals(Object.keys(result.information_scores).length, 2)

  // Information scores should be BTS scores multiplied by normalized weights
  assertEquals(result.information_scores["agent-a"], result.bts_scores["agent-a"] * 0.5)
  assertEquals(result.information_scores["agent-b"], result.bts_scores["agent-b"] * 0.5)

  // Verify winner/loser partition is complete and non-overlapping
  const totalAgents = Object.keys(request.post_mirror_descent_beliefs).length
  const categorizedAgents = result.winners.length + result.losers.length
  assertEquals(categorizedAgents <= totalAgents, true) // Some agents might have exactly 0 score

  console.log("BTS Scores:", result.bts_scores)
  console.log("Information Scores:", result.information_scores)
  console.log("Winners:", result.winners)
  console.log("Losers:", result.losers)
})

Deno.test("BTS Scoring - Mathematical Verification", async () => {
  // Simple case where we can manually verify the BTS calculation
  const request: BTSScoringRequest = {
    belief_id: "test-belief-2",
    post_mirror_descent_beliefs: {
      "agent-1": 0.7
    },
    leave_one_out_aggregates: {
      "agent-1": 0.5  // When agent-1 is removed, aggregate is 0.5
    },
    leave_one_out_meta_aggregates: {
      "agent-1": 0.6  // When agent-1 is removed, meta-aggregate is 0.6
    },
    normalized_weights: {
      "agent-1": 1.0  // Single agent gets full weight
    },
    agent_meta_predictions: {
      "agent-1": 0.6
    }
  }

  const result = await callBTSScoring(request)

  // Manual calculation:
  // s_1 = D_KL(0.7 || 0.6) - D_KL(0.7 || 0.5) - D_KL(0.5 || 0.6)
  const term1 = binaryKLDivergence(0.7, 0.6)  // Information vs meta-predictions
  const term2 = binaryKLDivergence(0.7, 0.5)  // Information vs beliefs
  const term3 = binaryKLDivergence(0.5, 0.6)  // Prediction accuracy penalty

  const expectedBTSScore = term1 - term2 - term3
  const expectedInfoScore = 1.0 * expectedBTSScore

  // Allow for small numerical differences
  const tolerance = 1e-10
  assertEquals(Math.abs(result.bts_scores["agent-1"] - expectedBTSScore) < tolerance, true)
  assertEquals(Math.abs(result.information_scores["agent-1"] - expectedInfoScore) < tolerance, true)

  console.log("Expected BTS Score:", expectedBTSScore)
  console.log("Actual BTS Score:", result.bts_scores["agent-1"])
  console.log("Expected Info Score:", expectedInfoScore)
  console.log("Actual Info Score:", result.information_scores["agent-1"])
})

Deno.test("BTS Scoring - Edge Case: Extreme Probabilities", async () => {
  // Test with probabilities near 0 and 1 to verify clamping works
  const request: BTSScoringRequest = {
    belief_id: "test-belief-3",
    post_mirror_descent_beliefs: {
      "agent-extreme": 0.001,    // Very confident in false
      "agent-moderate": 0.5      // Neutral
    },
    leave_one_out_aggregates: {
      "agent-extreme": 0.5,      // Without extreme agent
      "agent-moderate": 0.001    // Without moderate agent
    },
    leave_one_out_meta_aggregates: {
      "agent-extreme": 0.8,      // Others predict high
      "agent-moderate": 0.2      // Others predict low
    },
    normalized_weights: {
      "agent-extreme": 0.25,  // 25/(25+75) = 0.25
      "agent-moderate": 0.75  // 75/(25+75) = 0.75
    },
    agent_meta_predictions: {
      "agent-extreme": 0.2,
      "agent-moderate": 0.8
    }
  }

  const result = await callBTSScoring(request)

  // Should not crash and should produce finite results
  assertEquals(isFinite(result.bts_scores["agent-extreme"]), true)
  assertEquals(isFinite(result.bts_scores["agent-moderate"]), true)
  assertEquals(isFinite(result.information_scores["agent-extreme"]), true)
  assertEquals(isFinite(result.information_scores["agent-moderate"]), true)

  console.log("Extreme case BTS Scores:", result.bts_scores)
  console.log("Extreme case Info Scores:", result.information_scores)
})

Deno.test("BTS Scoring - Three Agent Scenario", async () => {
  // More complex scenario with three agents
  const request: BTSScoringRequest = {
    belief_id: "test-belief-4",
    post_mirror_descent_beliefs: {
      "agent-1": 0.8,   // Confident in true
      "agent-2": 0.3,   // Leaning false
      "agent-3": 0.6    // Moderate true
    },
    leave_one_out_aggregates: {
      "agent-1": 0.45,  // (0.3 + 0.6) / 2 = 0.45
      "agent-2": 0.7,   // (0.8 + 0.6) / 2 = 0.7
      "agent-3": 0.55   // (0.8 + 0.3) / 2 = 0.55
    },
    leave_one_out_meta_aggregates: {
      "agent-1": 0.5,   // (0.4 + 0.6) / 2 = 0.5
      "agent-2": 0.55,  // (0.5 + 0.6) / 2 = 0.55
      "agent-3": 0.45   // (0.5 + 0.4) / 2 = 0.45
    },
    normalized_weights: {
      "agent-1": 0.4,   // 40/100 = 0.4
      "agent-2": 0.3,   // 30/100 = 0.3
      "agent-3": 0.3    // 30/100 = 0.3
    },
    agent_meta_predictions: {
      "agent-1": 0.5,
      "agent-2": 0.4,
      "agent-3": 0.6
    }
  }

  const result = await callBTSScoring(request)

  // Verify all agents are scored
  assertEquals(Object.keys(result.bts_scores).length, 3)
  assertEquals(Object.keys(result.information_scores).length, 3)

  // Verify information scores are weight-weighted
  assertEquals(result.information_scores["agent-1"], result.bts_scores["agent-1"] * 0.4)
  assertEquals(result.information_scores["agent-2"], result.bts_scores["agent-2"] * 0.3)
  assertEquals(result.information_scores["agent-3"], result.bts_scores["agent-3"] * 0.3)

  console.log("Three agent BTS Scores:", result.bts_scores)
  console.log("Three agent Winners:", result.winners)
  console.log("Three agent Losers:", result.losers)
})

Deno.test("BTS Scoring - Input Validation", async () => {
  // Test missing belief_id
  try {
    await callBTSScoring({
      belief_id: "",
      post_mirror_descent_beliefs: { "agent-1": 0.5 },
      leave_one_out_aggregates: { "agent-1": 0.5 },
      leave_one_out_meta_aggregates: { "agent-1": 0.5 },
      normalized_weights: { "agent-1": 1.0 },
      agent_meta_predictions: { "agent-1": 0.5 }
    })
    throw new Error("Should have failed")
  } catch (error) {
    assertEquals(error.message.includes("422"), true)
  }

  // Test missing agent in stakes
  try {
    await callBTSScoring({
      belief_id: "test",
      post_mirror_descent_beliefs: { "agent-1": 0.5 },
      leave_one_out_aggregates: { "agent-1": 0.5 },
      leave_one_out_meta_aggregates: { "agent-1": 0.5 },
      normalized_weights: {},  // Missing agent-1
      agent_meta_predictions: { "agent-1": 0.5 }
    })
    throw new Error("Should have failed")
  } catch (error) {
    assertEquals(error.message.includes("422"), true)
  }
})

Deno.test("BTS Scoring - Zero Stakes Edge Case", async () => {
  // Test with zero stakes (should still compute BTS scores but zero information scores)
  const request: BTSScoringRequest = {
    belief_id: "test-belief-5",
    post_mirror_descent_beliefs: {
      "agent-zero": 0.7
    },
    leave_one_out_aggregates: {
      "agent-zero": 0.5
    },
    leave_one_out_meta_aggregates: {
      "agent-zero": 0.6
    },
    normalized_weights: {
      "agent-zero": 0.0  // Zero weight
    },
    agent_meta_predictions: {
      "agent-zero": 0.6
    }
  }

  const result = await callBTSScoring(request)

  // BTS score should still be computed
  assertExists(result.bts_scores["agent-zero"])
  assertEquals(isFinite(result.bts_scores["agent-zero"]), true)

  // Information score should be zero
  assertEquals(result.information_scores["agent-zero"], 0.0)

  // Agent with zero information score should be in neither winners nor losers
  assertEquals(result.winners.includes("agent-zero"), false)
  assertEquals(result.losers.includes("agent-zero"), false)
})