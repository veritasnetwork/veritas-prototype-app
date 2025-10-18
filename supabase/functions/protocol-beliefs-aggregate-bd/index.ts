import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants from configuration spec
const EPSILON_PROBABILITY = 1e-10
const EPSILON_RIDGE = 1e-6  // Ridge regularization for BD

interface BeliefsAggregateRequest {
  belief_id: string
  weights: Record<string, number>
  alpha?: number  // Weighting parameter for scoring (default 0.5)
  lambda?: number // Lambda parameter for scoring (default 0.5)
}

interface BeliefsAggregateResponse {
  pre_mirror_descent_aggregate: number
  jensen_shannon_disagreement_entropy: number
  normalized_disagreement_entropy: number
  certainty: number
  agent_meta_predictions: Record<string, number>
  active_agent_indicators: string[]
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
  bd_prior: number  // BD-specific: common prior p̃
  bd_scores: Record<string, number>  // BD-specific: agent scores from scoring mechanism
}

// Clamp probability to safe range
function clampProbability(p: number): number {
  return Math.max(EPSILON_PROBABILITY, Math.min(1 - EPSILON_PROBABILITY, p))
}

// Binary entropy function H(p) = -p*log2(p) - (1-p)*log2(1-p)
function binaryEntropy(p: number): number {
  if (p <= EPSILON_PROBABILITY || p >= 1 - EPSILON_PROBABILITY) {
    return 0
  }
  return -(p * Math.log2(p)) - ((1 - p) * Math.log2(1 - p))
}

/**
 * Binary-Optimized Belief Decomposition (BD)
 * 
 * Adapted from McCoy & Prelec for binary beliefs where m=2 states.
 * This simplifies the matrix operations significantly.
 * 
 * Key concepts:
 * - Each binary belief p is treated as distribution [p, 1-p]
 * - Estimates common prior and local expectations
 * - Uses ridge regression for numerical stability
 */
class BinaryBeliefDecomposition {
  beliefs: number[]           // Binary beliefs (p)
  predictions: number[]       // Meta-predictions (m)
  weights: number[]           // Epistemic weights (w) - kept for consistency, not used in core BD
  agentIds: string[]         // For mapping back to results
  alpha: number              // Scoring parameter
  lambda: number             // Scoring parameter
  epsilon: number            // Ridge regularization

  // Results
  prior: number              // Common prior p̃
  W: number[][]             // 2x2 local expectations matrix
  posterior: number         // Full information posterior
  scores: Record<string, number>  // Agent scores from scoring mechanism

  constructor(
    beliefs: number[],
    predictions: number[],
    weights: number[],
    agentIds: string[],
    alpha: number = 0.5,
    lambda: number = 0.5,
    epsilon: number = EPSILON_RIDGE
  ) {
    this.beliefs = beliefs
    this.predictions = predictions
    this.weights = weights
    this.agentIds = agentIds
    this.alpha = alpha
    this.lambda = lambda
    this.epsilon = epsilon
    
    this.prior = 0.5  // Will be estimated
    this.W = [[0.5, 0.5], [0.5, 0.5]]  // Will be estimated
    this.posterior = 0.5  // Will be computed
    this.scores = {}  // Will be computed
  }

  /**
   * Convert binary belief to 2-state distribution
   */
  private toBinaryDistribution(p: number): [number, number] {
    return [clampProbability(p), clampProbability(1 - p)]
  }

  /**
   * Estimate W matrix using ridge regression for binary case
   * 
   * For binary beliefs, we construct:
   * X matrix: n x 2 where each row is [p_i, 1-p_i]
   * Y matrix: n x 2 where each row is [m_i, 1-m_i]
   * 
   * W = (X^T X - εI)^(-1) X^T Y
   * 
   * Made parameterized to support leave-one-out calculations
   */
  private estimateW(beliefs: number[], predictions: number[]): number[][] {
    const n = beliefs.length
    
    // Construct X and Y matrices (n x 2)
    const X: number[][] = beliefs.map(p => {
      const dist = this.toBinaryDistribution(p)
      return [dist[0], dist[1]]
    })
    
    const Y: number[][] = predictions.map(m => {
      const dist = this.toBinaryDistribution(m)
      return [dist[0], dist[1]]
    })

    // Compute X^T X (2x2 matrix)
    const XtX: number[][] = [
      [0, 0],
      [0, 0]
    ]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          XtX[j][k] += X[i][j] * X[i][k]
        }
      }
    }

    // Compute X^T Y (2x2 matrix)
    const XtY: number[][] = [
      [0, 0],
      [0, 0]
    ]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          XtY[j][k] += X[i][j] * Y[i][k]
        }
      }
    }

    // Ridge regularization: (X^T X - εI)
    const regularized: number[][] = [
      [XtX[0][0] - this.epsilon, XtX[0][1]],
      [XtX[1][0], XtX[1][1] - this.epsilon]
    ]

    // Invert 2x2 matrix
    const det = regularized[0][0] * regularized[1][1] - regularized[0][1] * regularized[1][0]
    
    if (Math.abs(det) < 1e-12) {
      // Singular matrix, use fallback
      console.warn('Singular matrix in W estimation, using identity')
      return [[1, 0], [0, 1]]
    }

    const invRegularized: number[][] = [
      [regularized[1][1] / det, -regularized[0][1] / det],
      [-regularized[1][0] / det, regularized[0][0] / det]
    ]

    // W = inv(X^T X - εI) * X^T Y
    return [
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

  /**
   * Find common prior (left unit eigenvector of W)
   * For 2x2 matrix, this can be computed analytically
   * 
   * Made parameterized to support leave-one-out calculations
   */
  private estimatePrior(W: number[][]): number {
    // For 2x2 matrix W = [[a, b], [c, d]], the left eigenvector for eigenvalue 1
    // satisfies: [p, 1-p] * W = [p, 1-p]
    // This gives: p*a + (1-p)*c = p
    // Solving: p = c / (1 - a + c)
    // 
    // NOTE: This is the GENERAL formula that does NOT assume row-stochastic W.
    // The ridge regression means W may not be row-stochastic, so we must use this.
    
    const a = W[0][0]
    const c = W[1][0]

    // General analytical solution for left eigenvector
    const denom = 1 - a + c
    
    if (Math.abs(denom) < 1e-12) {
      // Degenerate case, use uniform
      return 0.5
    }

    return clampProbability(c / denom)
  }

  /**
   * Compute full information posterior
   * 
   * For binary case: f(w=1) ∝ ∏(x_r) / p̃^(n-1)
   * 
   * IMPORTANT: The formula gives unnormalized probabilities for BOTH states.
   * We must compute both and normalize.
   */
  private computePosterior(): void {
    const n = this.beliefs.length
    
    // Calculate unnormalized value for state 1 (belief = true)
    // U₁ = ∏(p_i) / p̃^(n-1)
    let unnormalized_p1 = 1.0
    for (const belief of this.beliefs) {
      unnormalized_p1 *= clampProbability(belief)
    }
    const priorPower1 = Math.pow(clampProbability(this.prior), n - 1)
    
    if (priorPower1 < 1e-12) {
      this.posterior = 0.5  // Fallback to uniform
      return
    }
    unnormalized_p1 /= priorPower1
    
    // Calculate unnormalized value for state 2 (belief = false)
    // U₂ = ∏(1-p_i) / (1-p̃)^(n-1)
    let unnormalized_p2 = 1.0
    for (const belief of this.beliefs) {
      unnormalized_p2 *= clampProbability(1 - belief)
    }
    const priorPower2 = Math.pow(clampProbability(1 - this.prior), n - 1)
    
    if (priorPower2 < 1e-12) {
      this.posterior = 0.5  // Fallback to uniform
      return
    }
    unnormalized_p2 /= priorPower2
    
    // Normalize: P(state=1) = U₁ / (U₁ + U₂)
    const total = unnormalized_p1 + unnormalized_p2
    
    if (total < 1e-12) {
      this.posterior = 0.5  // Fallback if both are zero
      return
    }
    
    this.posterior = clampProbability(unnormalized_p1 / total)
  }

  /**
   * Proper scoring rule: Negative KL Divergence for binary outcomes
   * 
   * Returns the score for predicting q when the target is p.
   * Higher scores are better.
   */
  private properScoringRule(target: number, prediction: number): number {
    const p = clampProbability(target)
    const q = clampProbability(prediction)
    
    // If target and prediction are identical, divergence is 0
    if (Math.abs(p - q) < 1e-12) {
      return 0
    }
    
    // KL(p || q) = p * log2(p/q) + (1-p) * log2((1-p)/(1-q))
    const kl = p * Math.log2(p / q) + (1 - p) * Math.log2((1 - p) / (1 - q))
    
    // Return negative KL (higher is better)
    return -kl
  }

  /**
   * Compute scores for each agent based on the BD scoring mechanism
   * 
   * Formula from paper:
   * V_i = α*S(x̄^(-i), y_i) + (1-α)*S(x̄^(-i), ŷ_i) + λ*S(y_i, ŷ_i) - S(x̄^(-i), p̃^(-i))
   * 
   * Where:
   * - x̄^(-i) = average belief excluding agent i
   * - y_i = agent i's prediction
   * - ŷ_i = implied prediction from agent i's belief and LOO W matrix
   * - p̃^(-i) = LOO prior
   * - S = proper scoring rule (negative KL divergence)
   */
  private computeScores(): void {
    if (this.beliefs.length <= 1) {
      // Can't score with <= 1 agent
      this.agentIds.forEach(id => this.scores[id] = NaN)
      return
    }

    for (let i = 0; i < this.agentIds.length; i++) {
      const agentId = this.agentIds[i]
      const agentBelief = this.beliefs[i]
      const agentPrediction = this.predictions[i]

      // Create leave-one-out dataset
      const looBeliefs = this.beliefs.filter((_, idx) => idx !== i)
      const looPredictions = this.predictions.filter((_, idx) => idx !== i)

      // Get LOO prior and W
      const looW = this.estimateW(looBeliefs, looPredictions)
      const looPrior = this.estimatePrior(looW)

      // Calculate x̄^(-i) (simple average of others' beliefs)
      const x_bar_minus_i = looBeliefs.reduce((sum, b) => sum + b, 0) / looBeliefs.length

      // Calculate implied prediction ŷ_i = x_i * W^(-i)
      // For binary: ŷ_i = belief * W[0][0] + (1-belief) * W[1][0]
      const impliedPrediction = agentBelief * looW[0][0] + (1 - agentBelief) * looW[1][0]

      // Calculate score components from the paper's formula
      const score1 = this.alpha * this.properScoringRule(x_bar_minus_i, agentPrediction)
      const score2 = (1 - this.alpha) * this.properScoringRule(x_bar_minus_i, impliedPrediction)
      const score3 = this.lambda * this.properScoringRule(agentPrediction, impliedPrediction)
      const side_payment = this.properScoringRule(x_bar_minus_i, looPrior)

      this.scores[agentId] = score1 + score2 + score3 - side_payment
    }
  }

  /**
   * Run the full BD pipeline
   */
  run(): number {
    if (this.beliefs.length === 0) {
      return 0.5  // Neutral
    }

    if (this.beliefs.length === 1) {
      // Single agent: posterior = their belief
      this.scores[this.agentIds[0]] = NaN  // Can't score single agent
      return clampProbability(this.beliefs[0])
    }

    // Multi-agent case
    this.W = this.estimateW(this.beliefs, this.predictions)
    this.prior = this.estimatePrior(this.W)
    this.computePosterior()
    this.computeScores()  // Also compute agent scores

    return this.posterior
  }

  /**
   * Calculate leave-one-out aggregates for BTS scoring
   */
  leaveOneOut(): { aggregates: Record<string, number>, metaAggregates: Record<string, number> } {
    const aggregates: Record<string, number> = {}
    const metaAggregates: Record<string, number> = {}

    for (let excludeIdx = 0; excludeIdx < this.beliefs.length; excludeIdx++) {
      // Filter out the excluded agent
      const looBeliefs = this.beliefs.filter((_, idx) => idx !== excludeIdx)
      const looPredictions = this.predictions.filter((_, idx) => idx !== excludeIdx)
      const looWeights = this.weights.filter((_, idx) => idx !== excludeIdx)
      const looAgentIds = this.agentIds.filter((_, idx) => idx !== excludeIdx)

      if (looBeliefs.length === 0) {
        aggregates[this.agentIds[excludeIdx]] = 0.5
        metaAggregates[this.agentIds[excludeIdx]] = 0.5
        continue
      }

      // Run BD on leave-one-out set
      const looBD = new BinaryBeliefDecomposition(
        looBeliefs,
        looPredictions,
        looWeights,
        looAgentIds,
        this.alpha,
        this.lambda,
        this.epsilon
      )
      
      const looAggregate = looBD.run()
      aggregates[this.agentIds[excludeIdx]] = looAggregate

      // For meta predictions, use simple weighted average (not BD)
      let metaSum = 0
      let weightSum = 0
      for (let i = 0; i < looPredictions.length; i++) {
        metaSum += looWeights[i] * looPredictions[i]
        weightSum += looWeights[i]
      }
      metaAggregates[this.agentIds[excludeIdx]] = weightSum > 0 
        ? clampProbability(metaSum / weightSum) 
        : 0.5
    }

    return { aggregates, metaAggregates }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Parse request body
    const { belief_id, weights, alpha = 0.5, lambda = 0.5 }: BeliefsAggregateRequest = await req.json()

    // 1. Validate inputs
    if (!belief_id || belief_id.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'belief_id is required', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!weights || Object.keys(weights).length === 0) {
      return new Response(
        JSON.stringify({ error: 'weights object is required and must be non-empty', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify weights sum to 1.0
    const weightsSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    if (Math.abs(weightsSum - 1.0) > EPSILON_PROBABILITY) {
      return new Response(
        JSON.stringify({ error: 'Weights must sum to 1.0', code: 400 }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Load submissions from current epoch
    const { data: currentEpochData } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single()

    const currentEpoch = parseInt(currentEpochData?.value || '0')

    // Load latest submission from each agent
    const { data: submissions, error: submissionsError } = await supabaseClient
      .from('belief_submissions')
      .select('agent_id, belief, meta_prediction, is_active, epoch')
      .eq('belief_id', belief_id)
      .order('epoch', { ascending: false })

    if (submissionsError) {
      console.error('Failed to load submissions:', submissionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to load submissions', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Group by agent_id and take the latest submission for each
    const latestSubmissions: Record<string, any> = {}
    for (const submission of (submissions || [])) {
      if (!latestSubmissions[submission.agent_id] || submission.epoch > latestSubmissions[submission.agent_id].epoch) {
        latestSubmissions[submission.agent_id] = submission
      }
    }
    const filteredSubmissions = Object.values(latestSubmissions)

    if (!filteredSubmissions || filteredSubmissions.length === 0) {
      console.log(`No submissions found for belief ${belief_id} - returning neutral defaults`)
      return new Response(
        JSON.stringify({
          pre_mirror_descent_aggregate: 0.5,
          jensen_shannon_disagreement_entropy: 0.0,
          normalized_disagreement_entropy: 0.0,
          certainty: 0.0,
          agent_meta_predictions: {},
          active_agent_indicators: [],
          leave_one_out_aggregates: {},
          leave_one_out_meta_aggregates: {},
          bd_prior: 0.5
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Prepare data for BD algorithm
    const agentIds: string[] = []
    const beliefs: number[] = []
    const predictions: number[] = []
    const weightValues: number[] = []
    const agentMetaPredictions: Record<string, number> = {}
    const activeAgentIndicators: string[] = []

    for (const submission of filteredSubmissions) {
      const agentId = submission.agent_id

      // Verify agent_id has weight
      if (!(agentId in weights)) {
        return new Response(
          JSON.stringify({ error: 'Missing weight for participant agent', code: 504 }),
          {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      agentIds.push(agentId)
      beliefs.push(clampProbability(submission.belief))
      predictions.push(clampProbability(submission.meta_prediction))
      weightValues.push(weights[agentId])
      
      agentMetaPredictions[agentId] = submission.meta_prediction

      if (submission.is_active) {
        activeAgentIndicators.push(agentId)
      }
    }

    // 4. Run Belief Decomposition
    const bd = new BinaryBeliefDecomposition(
      beliefs,
      predictions,
      weightValues,
      agentIds,
      alpha,
      lambda
    )

    const aggregate = bd.run()

    // 5. Calculate Jensen-Shannon disagreement entropy (using aggregate)
    let hAvg = 0.0
    for (let i = 0; i < beliefs.length; i++) {
      const entropy = binaryEntropy(beliefs[i])
      hAvg += weightValues[i] * entropy
    }

    const hAgg = binaryEntropy(aggregate)
    let jensenShannonDisagreement = hAgg - hAvg
    jensenShannonDisagreement = Math.max(0, jensenShannonDisagreement)
    const normalizedDisagreementEntropy = Math.min(1.0, jensenShannonDisagreement)
    const certainty = 1.0 - normalizedDisagreementEntropy

    // 6. Calculate leave-one-out aggregates for BTS scoring
    const { aggregates: leaveOneOutAggregates, metaAggregates: leaveOneOutMetaAggregates } = bd.leaveOneOut()

    // 7. Return aggregation results
    const response: BeliefsAggregateResponse = {
      pre_mirror_descent_aggregate: aggregate,
      jensen_shannon_disagreement_entropy: jensenShannonDisagreement,
      normalized_disagreement_entropy: normalizedDisagreementEntropy,
      certainty: certainty,
      agent_meta_predictions: agentMetaPredictions,
      active_agent_indicators: activeAgentIndicators,
      leave_one_out_aggregates: leaveOneOutAggregates,
      leave_one_out_meta_aggregates: leaveOneOutMetaAggregates,
      bd_prior: bd.prior,  // BD-specific: common prior
      bd_scores: bd.scores  // BD-specific: agent scores from scoring mechanism
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 500, details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

