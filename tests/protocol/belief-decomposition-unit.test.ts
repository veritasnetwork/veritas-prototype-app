/**
 * Unit tests for Binary Belief Decomposition algorithm
 * Tests the core BD logic without requiring Supabase edge functions
 */

import { assertEquals, assert, assertAlmostEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

const EPSILON_PROBABILITY = 1e-10;
const EPSILON_RIDGE = 1e-6;

// Clamp probability to safe range
function clampProbability(p: number): number {
  return Math.max(EPSILON_PROBABILITY, Math.min(1 - EPSILON_PROBABILITY, p))
}

/**
 * Simplified Binary Belief Decomposition for testing
 */
class BinaryBeliefDecomposition {
  beliefs: number[]
  predictions: number[]
  weights: number[]
  agentIds: string[]
  epsilon: number

  prior: number
  W: number[][]
  posterior: number

  constructor(
    beliefs: number[],
    predictions: number[],
    weights: number[],
    agentIds: string[],
    epsilon: number = EPSILON_RIDGE
  ) {
    this.beliefs = beliefs
    this.predictions = predictions
    this.weights = weights
    this.agentIds = agentIds
    this.epsilon = epsilon
    
    this.prior = 0.5
    this.W = [[0.5, 0.5], [0.5, 0.5]]
    this.posterior = 0.5
  }

  private toBinaryDistribution(p: number): [number, number] {
    return [clampProbability(p), clampProbability(1 - p)]
  }

  private estimateW(): void {
    const n = this.beliefs.length
    
    const X: number[][] = this.beliefs.map(p => {
      const dist = this.toBinaryDistribution(p)
      return [dist[0], dist[1]]
    })
    
    const Y: number[][] = this.predictions.map(m => {
      const dist = this.toBinaryDistribution(m)
      return [dist[0], dist[1]]
    })

    const XtX: number[][] = [[0, 0], [0, 0]]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          XtX[j][k] += X[i][j] * X[i][k]
        }
      }
    }

    const XtY: number[][] = [[0, 0], [0, 0]]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          XtY[j][k] += X[i][j] * Y[i][k]
        }
      }
    }

    const regularized: number[][] = [
      [XtX[0][0] - this.epsilon, XtX[0][1]],
      [XtX[1][0], XtX[1][1] - this.epsilon]
    ]

    const det = regularized[0][0] * regularized[1][1] - regularized[0][1] * regularized[1][0]
    
    if (Math.abs(det) < 1e-12) {
      this.W = [[1, 0], [0, 1]]
      return
    }

    const invRegularized: number[][] = [
      [regularized[1][1] / det, -regularized[0][1] / det],
      [-regularized[1][0] / det, regularized[0][0] / det]
    ]

    this.W = [
      [
        invRegularized[0][0] * XtY[0][0] + invRegularized[0][1] * XtY[1][0],
        invRegularized[0][0] * XtY[0][1] + invRegularized[0][1] * XtY[1][1]
      ],
      [
        invRegularized[1][0] * XtY[0][0] + invRegularized[1][1] * XtY[1][0],
        invRegularized[1][0] * XtY[0][1] + invRegularized[1][1] * XtY[1][1]
      ]
    ]
  }

  private estimatePrior(): void {
    // CORRECTED: General formula for left eigenvector
    // p = c / (1 - a + c) works for non-row-stochastic matrices
    const a = this.W[0][0]
    const c = this.W[1][0]
    const denom = 1 - a + c
    
    if (Math.abs(denom) < 1e-12) {
      this.prior = 0.5
      return
    }

    let prior = c / denom
    prior = clampProbability(prior)
    this.prior = prior
  }

  private computePosterior(): void {
    // CORRECTED: Must calculate unnormalized values for BOTH states and normalize
    const n = this.beliefs.length
    
    // Unnormalized value for state 1
    let unnormalized_p1 = 1.0
    for (const belief of this.beliefs) {
      unnormalized_p1 *= clampProbability(belief)
    }
    unnormalized_p1 /= Math.pow(clampProbability(this.prior), n - 1)
    
    // Unnormalized value for state 2
    let unnormalized_p2 = 1.0
    for (const belief of this.beliefs) {
      unnormalized_p2 *= clampProbability(1 - belief)
    }
    unnormalized_p2 /= Math.pow(clampProbability(1 - this.prior), n - 1)
    
    const total = unnormalized_p1 + unnormalized_p2
    if (total < 1e-12) {
      this.posterior = 0.5
      return
    }
    
    this.posterior = clampProbability(unnormalized_p1 / total)
  }

  run(): number {
    if (this.beliefs.length === 0) {
      return 0.5
    }

    if (this.beliefs.length === 1) {
      return clampProbability(this.beliefs[0])
    }

    this.estimateW()
    this.estimatePrior()
    this.computePosterior()

    return this.posterior
  }
}

// Tests
Deno.test("BD Unit - Single agent returns their belief", () => {
  const bd = new BinaryBeliefDecomposition(
    [0.7],
    [0.6],
    [1.0],
    ["agent1"]
  )
  
  const result = bd.run()
  assertEquals(result, 0.7, "Single agent should return their exact belief")
})

Deno.test("BD Unit - Empty returns neutral", () => {
  const bd = new BinaryBeliefDecomposition(
    [],
    [],
    [],
    []
  )
  
  const result = bd.run()
  assertEquals(result, 0.5, "Empty should return neutral 0.5")
})

Deno.test("BD Unit - Two identical beliefs", () => {
  const bd = new BinaryBeliefDecomposition(
    [0.6, 0.6],
    [0.5, 0.5],
    [0.5, 0.5],
    ["agent1", "agent2"]
  )
  
  const result = bd.run()
  console.log("Two identical beliefs result:", result, "prior:", bd.prior)
  
  // Identical beliefs should aggregate close to the shared belief
  assert(result > 0.5 && result < 0.7, `Expected result near 0.6, got ${result}`)
})

Deno.test("BD Unit - Two opposite beliefs", () => {
  const bd = new BinaryBeliefDecomposition(
    [0.3, 0.7],
    [0.4, 0.6],
    [0.5, 0.5],
    ["agent1", "agent2"]
  )
  
  const result = bd.run()
  console.log("Two opposite beliefs result:", result, "prior:", bd.prior)
  
  // Should produce a valid probability
  assert(result > 0 && result < 1, `Expected valid probability, got ${result}`)
})

Deno.test("BD Unit - Three agents with varying beliefs", () => {
  const bd = new BinaryBeliefDecomposition(
    [0.2, 0.5, 0.8],
    [0.3, 0.5, 0.7],
    [0.33, 0.33, 0.34],
    ["agent1", "agent2", "agent3"]
  )
  
  const result = bd.run()
  console.log("Three agents result:", result, "prior:", bd.prior)
  
  // Should produce a valid probability
  assert(result > 0 && result < 1, `Expected valid probability, got ${result}`)
  
  // Prior should be reasonable
  assert(bd.prior > 0 && bd.prior < 1, `Expected valid prior, got ${bd.prior}`)
})

Deno.test("BD Unit - W matrix is computed", () => {
  const bd = new BinaryBeliefDecomposition(
    [0.4, 0.6],
    [0.5, 0.5],
    [0.5, 0.5],
    ["agent1", "agent2"]
  )
  
  bd.run()
  
  console.log("W matrix:", bd.W)
  
  // W should be 2x2
  assertEquals(bd.W.length, 2)
  assertEquals(bd.W[0].length, 2)
  assertEquals(bd.W[1].length, 2)
  
  // All entries should be finite
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(isFinite(bd.W[i][j]), `W[${i}][${j}] should be finite`)
    }
  }
})

Deno.test("BD Unit - Beliefs with divergent meta-predictions", () => {
  // Agents have similar beliefs but very different meta-predictions
  const bd = new BinaryBeliefDecomposition(
    [0.5, 0.5],
    [0.2, 0.8],  // Very different meta-predictions
    [0.5, 0.5],
    ["agent1", "agent2"]
  )
  
  const result = bd.run()
  console.log("Divergent meta-predictions result:", result, "prior:", bd.prior)
  
  // Should still produce valid result
  assert(result > 0 && result < 1, `Expected valid probability, got ${result}`)
  
  // With identical beliefs, result should be near 0.5
  assertAlmostEquals(result, 0.5, 0.15, "Result should be near 0.5 for identical beliefs")
})

Deno.test("BD Unit - Extreme beliefs", () => {
  const bd = new BinaryBeliefDecomposition(
    [0.01, 0.99],  // Extreme beliefs
    [0.1, 0.9],
    [0.5, 0.5],
    ["agent1", "agent2"]
  )
  
  const result = bd.run()
  console.log("Extreme beliefs result:", result, "prior:", bd.prior)
  
  // Should handle extremes without error
  assert(result > 0 && result < 1, `Expected valid probability, got ${result}`)
})

Deno.test("BD Unit - Many agents consensus", () => {
  // 5 agents all agree on ~0.7
  const bd = new BinaryBeliefDecomposition(
    [0.68, 0.72, 0.70, 0.69, 0.71],
    [0.65, 0.70, 0.68, 0.72, 0.69],
    [0.2, 0.2, 0.2, 0.2, 0.2],
    ["agent1", "agent2", "agent3", "agent4", "agent5"]
  )
  
  const result = bd.run()
  console.log("Five agent consensus result:", result, "prior:", bd.prior)
  
  // With consensus, should aggregate near the shared belief
  assert(result > 0.6 && result < 0.8, `Expected result near 0.7, got ${result}`)
})

console.log("\n=== Binary Belief Decomposition Unit Tests Complete ===\n")

