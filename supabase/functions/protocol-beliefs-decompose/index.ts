import { createClient } from "jsr:@supabase/supabase-js@2";

const EPSILON_PROBABILITY = 1e-10;
const RIDGE_EPSILON = 1e-5;
const MIN_PARTICIPANTS = 2;
const MAX_CONDITION_NUMBER = 1000;
const MATRIX_STOCHASTIC_TOLERANCE = 1e-6;
const QUALITY_THRESHOLD = 0.3;

interface DecompositionInput {
  belief_id: string;
  weights: Record<string, number>;
}

interface DecompositionOutput {
  aggregate: number;
  common_prior: number;
  local_expectations_matrix: {
    w11: number;
    w12: number;
    w21: number;
    w22: number;
  };
  jensen_shannon_disagreement_entropy: number;
  normalized_disagreement_entropy: number;
  certainty: number;
  agent_meta_predictions: Record<string, number>;
  active_agent_indicators: string[];
  decomposition_quality: number;
}

interface LeaveOneOutInput {
  belief_id: string;
  exclude_agent_id: string;
  weights: Record<string, number>;
}

interface LeaveOneOutOutput {
  leave_one_out_aggregate: number;
  leave_one_out_prior: number;
  leave_one_out_meta_aggregate: number;
}

class DecompositionError extends Error {
  constructor(public statusCode: number, message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'DecompositionError';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function computeConditionNumber(W: { w11: number; w12: number; w21: number; w22: number }): number {
  const a = W.w11;
  const b = W.w12;
  const c = W.w21;
  const d = W.w22;

  const trace = a + d;
  const det = a * d - b * c;
  const discriminant = trace * trace - 4 * det;

  if (discriminant < 0) {
    console.warn(`Negative discriminant in condition number calculation: ${discriminant}`);
    return MAX_CONDITION_NUMBER;
  }

  const sqrtDisc = Math.sqrt(discriminant);
  const lambda1 = (trace + sqrtDisc) / 2;
  const lambda2 = (trace - sqrtDisc) / 2;

  if (Math.abs(lambda2) < EPSILON_PROBABILITY) {
    console.warn(`Near-zero eigenvalue in condition number: λ2=${lambda2}, det=${det}`);
    return MAX_CONDITION_NUMBER;
  }

  return Math.abs(lambda1 / lambda2);
}

function validateMatrix(W: { w11: number; w12: number; w21: number; w22: number }): void {
  // Check for NaN or Infinity
  const values = [W.w11, W.w12, W.w21, W.w22];
  if (values.some(v => !isFinite(v) || isNaN(v))) {
    throw new DecompositionError(
      500,
      `Matrix contains invalid values. W11=${W.w11}, W12=${W.w12}, W21=${W.w21}, W22=${W.w22}`,
      { matrix: W }
    );
  }

  // Check row-stochastic property
  const row0Sum = W.w11 + W.w12;
  const row1Sum = W.w21 + W.w22;

  if (Math.abs(row0Sum - 1.0) > MATRIX_STOCHASTIC_TOLERANCE ||
      Math.abs(row1Sum - 1.0) > MATRIX_STOCHASTIC_TOLERANCE) {
    console.warn(
      `Matrix not perfectly row-stochastic. Row 0 sum: ${row0Sum}, Row 1 sum: ${row1Sum}. ` +
      `Tolerance: ${MATRIX_STOCHASTIC_TOLERANCE}`
    );
    // Don't throw - this can happen due to clamping, will renormalize
  }

  // Check probability bounds
  if (values.some(v => v < 0 || v > 1)) {
    throw new DecompositionError(
      500,
      `Matrix elements outside [0,1] range. W11=${W.w11}, W12=${W.w12}, W21=${W.w21}, W22=${W.w22}`,
      { matrix: W }
    );
  }
}

function renormalizeMatrix(W: { w11: number; w12: number; w21: number; w22: number }): void {
  const row0Sum = W.w11 + W.w12;
  const row1Sum = W.w21 + W.w22;

  if (row0Sum > 0) {
    W.w11 = W.w11 / row0Sum;
    W.w12 = W.w12 / row0Sum;
  }

  if (row1Sum > 0) {
    W.w21 = W.w21 / row1Sum;
    W.w22 = W.w22 / row1Sum;
  }

  console.log(`Matrix renormalized. New sums: Row0=${W.w11 + W.w12}, Row1=${W.w21 + W.w22}`);
}

function validateInvariants(
  aggregate: number,
  commonPrior: number,
  certainty: number,
  decompositionQuality: number,
  beliefs: number[],
  metaPredictions: number[],
  orderedWeights: number[]
): void {
  // Output invariants
  if (!isFinite(aggregate) || isNaN(aggregate)) {
    throw new DecompositionError(500, `Numerical instability detected: aggregate is ${aggregate} at output validation`);
  }
  if (!isFinite(commonPrior) || isNaN(commonPrior)) {
    throw new DecompositionError(500, `Numerical instability detected: commonPrior is ${commonPrior} at output validation`);
  }
  if (aggregate <= 0 || aggregate >= 1) {
    throw new DecompositionError(500, `Output invariant violated: aggregate ${aggregate} not in (0,1)`);
  }
  if (commonPrior <= 0 || commonPrior >= 1) {
    throw new DecompositionError(500, `Output invariant violated: commonPrior ${commonPrior} not in (0,1)`);
  }
  if (certainty < 0 || certainty > 1) {
    throw new DecompositionError(500, `Output invariant violated: certainty ${certainty} not in [0,1]`);
  }
  if (decompositionQuality < 0 || decompositionQuality > 1) {
    throw new DecompositionError(500, `Output invariant violated: decompositionQuality ${decompositionQuality} not in [0,1]`);
  }

  // Data invariants
  if (beliefs.length !== metaPredictions.length || beliefs.length !== orderedWeights.length) {
    throw new DecompositionError(
      500,
      `Data invariant violated: length(beliefs)=${beliefs.length}, length(metaPredictions)=${metaPredictions.length}, length(orderedWeights)=${orderedWeights.length}`
    );
  }
}

async function performDecomposition(
  supabase: any,
  belief_id: string,
  weights: Record<string, number>,
  excludeAgentId?: string
): Promise<DecompositionOutput | LeaveOneOutOutput> {
  // Get current epoch
  const { data: configData, error: configError } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", "current_epoch")
    .single();

  if (configError || !configData) {
    throw new DecompositionError(
      500,
      `Failed to get current epoch: ${configError?.message || 'No data returned'}`,
      { db_error: configError }
    );
  }

  const currentEpoch = parseInt(configData.value);

  // Load submissions
  let submissionsQuery = supabase
    .from("belief_submissions")
    .select("agent_id, belief, meta_prediction, is_active")
    .eq("belief_id", belief_id)
    .eq("epoch", currentEpoch);

  if (excludeAgentId) {
    submissionsQuery = submissionsQuery.neq("agent_id", excludeAgentId);
  }

  const { data: submissions, error: submissionsError } = await submissionsQuery;

  if (submissionsError) {
    throw new DecompositionError(
      500,
      `Failed to load submissions: ${submissionsError.message}`,
      { db_error: submissionsError, belief_id, epoch: currentEpoch }
    );
  }

  if (!submissions || submissions.length === 0) {
    throw new DecompositionError(
      404,
      `No submissions found for belief_id ${belief_id} in epoch ${currentEpoch}`,
      { belief_id, epoch: currentEpoch }
    );
  }

  if (submissions.length < MIN_PARTICIPANTS) {
    // Return defaults for insufficient participants in leave-one-out
    if (excludeAgentId) {
      console.log(`Leave-one-out: Insufficient participants after exclusion (${submissions.length} < ${MIN_PARTICIPANTS}). Returning defaults.`);
      return {
        leave_one_out_aggregate: 0.5,
        leave_one_out_prior: 0.5,
        leave_one_out_meta_aggregate: 0.5,
      };
    }
    throw new DecompositionError(
      409,
      `Insufficient participants for decomposition: ${submissions.length} < ${MIN_PARTICIPANTS}. Need at least 2 agents with non-zero weights.`,
      { count: submissions.length, required: MIN_PARTICIPANTS }
    );
  }

  // Extract belief and meta-prediction vectors
  const beliefs: number[] = [];
  const metaPredictions: number[] = [];
  const orderedWeights: number[] = [];
  const agentMetaPredictions: Record<string, number> = {};
  const activeAgentIndicators: string[] = [];
  let clampedCount = 0;

  for (const submission of submissions) {
    const weight = weights[submission.agent_id];
    if (!weight) continue; // Skip agents with zero weight

    const originalBelief = submission.belief;
    const originalMeta = submission.meta_prediction;

    const clampedBelief = clamp(submission.belief, EPSILON_PROBABILITY, 1 - EPSILON_PROBABILITY);
    const clampedMeta = clamp(submission.meta_prediction, EPSILON_PROBABILITY, 1 - EPSILON_PROBABILITY);

    if (originalBelief !== clampedBelief || originalMeta !== clampedMeta) {
      clampedCount++;
    }

    beliefs.push(clampedBelief);
    metaPredictions.push(clampedMeta);
    orderedWeights.push(weight);

    agentMetaPredictions[submission.agent_id] = clampedMeta;
    if (submission.is_active) {
      activeAgentIndicators.push(submission.agent_id);
    }
  }

  if (clampedCount > 0) {
    console.warn(`Clamped ${clampedCount} probability values to [${EPSILON_PROBABILITY}, ${1-EPSILON_PROBABILITY}] range`);
  }

  const n = beliefs.length;
  if (n < MIN_PARTICIPANTS) {
    throw new DecompositionError(
      409,
      `After filtering by weights, only ${n} participants remain (need ≥${MIN_PARTICIPANTS})`,
      { filtered_count: n, required: MIN_PARTICIPANTS }
    );
  }

  // Validate data invariants
  if (beliefs.length !== metaPredictions.length || beliefs.length !== orderedWeights.length) {
    throw new DecompositionError(
      500,
      `Data invariant violated during extraction`,
      { beliefs_len: beliefs.length, meta_len: metaPredictions.length, weights_len: orderedWeights.length }
    );
  }

  // Estimate local expectations matrix W (weighted regression)
  let sumW = 0, sumWB = 0, sumWM = 0, sumWB2 = 0, sumWBM = 0;

  for (let i = 0; i < n; i++) {
    const w = orderedWeights[i];
    const b = beliefs[i];
    const m = metaPredictions[i];

    sumW += w;
    sumWB += w * b;
    sumWM += w * m;
    sumWB2 += w * b * b;
    sumWBM += w * b * m;
  }

  // Ridge regression with regularization
  const variance = sumWB2 - (sumWB * sumWB / sumW);
  const denominator = variance + RIDGE_EPSILON;

  if (variance < RIDGE_EPSILON * 10) {
    console.warn(`Matrix near-singular: variance ${variance.toExponential(3)} < ${(RIDGE_EPSILON * 10).toExponential(3)}. Using ridge regularization with epsilon=${RIDGE_EPSILON}`);
  }

  // Matrix elements (for binary case)
  // Clamp one element per row, then compute complement to maintain row-stochastic property
  const w11_raw = (sumWBM - (sumWB * sumWM / sumW)) / denominator;
  const w21_raw = (sumWM - w11_raw * sumWB) / sumW;

  const W = {
    w11: clamp(w11_raw, 0, 1),
    w12: 0, // Will be computed from w11
    w21: clamp(w21_raw, 0, 1),
    w22: 0, // Will be computed from w21
  };

  // Compute complements to guarantee row-stochastic property
  W.w12 = 1 - W.w11;
  W.w22 = 1 - W.w21;

  // Validate matrix
  try {
    validateMatrix(W);
  } catch (error) {
    if (error instanceof DecompositionError) {
      throw error; // Re-throw critical errors
    }
  }

  // No renormalization needed - rows are guaranteed to sum to 1 by construction

  // Extract common prior (stationary distribution)
  const denomPrior = W.w21 + (1 - W.w11);
  if (Math.abs(denomPrior) < EPSILON_PROBABILITY) {
    throw new DecompositionError(
      500,
      `Cannot compute stationary distribution. Denominator near zero: ${denomPrior}`,
      { w11: W.w11, w21: W.w21 }
    );
  }

  const prior_raw = W.w21 / denomPrior;
  const commonPrior = clamp(prior_raw, EPSILON_PROBABILITY, 1 - EPSILON_PROBABILITY);

  if (!isFinite(commonPrior) || isNaN(commonPrior)) {
    throw new DecompositionError(500, `Numerical instability detected: commonPrior is ${commonPrior} at prior extraction`);
  }

  // Calculate weighted aggregate with prior correction
  let logProduct = 0;
  let effectiveN = 0;

  for (let i = 0; i < n; i++) {
    logProduct += orderedWeights[i] * Math.log(beliefs[i]);
    effectiveN += orderedWeights[i];
  }

  // Compute aggregate in log space for numerical stability
  const logAggregate = logProduct - effectiveN * Math.log(commonPrior);

  // Normalize (for binary case)
  let logComplement = 0;
  for (let i = 0; i < n; i++) {
    logComplement += orderedWeights[i] * Math.log(1 - beliefs[i]);
  }
  logComplement -= effectiveN * Math.log(1 - commonPrior);

  // Use log-sum-exp trick to avoid overflow/underflow
  // aggregate / (aggregate + complement) = 1 / (1 + exp(logComplement - logAggregate))
  // This avoids computing exp() of very large numbers
  let aggregate_raw: number;

  if (!isFinite(logAggregate) || !isFinite(logComplement)) {
    throw new DecompositionError(
      500,
      `Numerical instability in log computation: logAggregate=${logAggregate}, logComplement=${logComplement}`,
      { logAggregate, logComplement }
    );
  }

  // Compute using log-sum-exp trick for numerical stability
  const logDiff = logComplement - logAggregate;

  if (logDiff > 700) {
    // logComplement >> logAggregate, so aggregate ≈ 0
    aggregate_raw = EPSILON_PROBABILITY;
  } else if (logDiff < -700) {
    // logAggregate >> logComplement, so aggregate ≈ 1
    aggregate_raw = 1 - EPSILON_PROBABILITY;
  } else {
    // Normal case: use stable formula
    aggregate_raw = 1 / (1 + Math.exp(logDiff));
  }

  const finalAggregate = clamp(aggregate_raw, EPSILON_PROBABILITY, 1 - EPSILON_PROBABILITY);

  if (!isFinite(finalAggregate) || isNaN(finalAggregate)) {
    throw new DecompositionError(500, `Numerical instability detected: aggregate is ${finalAggregate} at aggregate computation`);
  }

  // For leave-one-out, return simplified output
  if (excludeAgentId) {
    let metaSum = 0;
    for (let i = 0; i < n; i++) {
      metaSum += orderedWeights[i] * metaPredictions[i];
    }

    return {
      leave_one_out_aggregate: finalAggregate,
      leave_one_out_prior: commonPrior,
      leave_one_out_meta_aggregate: clamp(metaSum, EPSILON_PROBABILITY, 1 - EPSILON_PROBABILITY),
    };
  }

  // Calculate decomposition quality metric
  const conditionNumber = computeConditionNumber(W);
  const matrixHealth = 1 / (1 + Math.log10(Math.max(1, conditionNumber)));

  // Check prediction accuracy
  let predictionError = 0;
  for (let i = 0; i < n; i++) {
    const predictedMeta = beliefs[i] * W.w11 + (1 - beliefs[i]) * W.w21;
    predictionError += Math.abs(predictedMeta - metaPredictions[i]);
  }
  const avgPredictionError = predictionError / n;
  const predictionAccuracy = 1 - avgPredictionError;

  const decompositionQuality = 0.7 * matrixHealth + 0.3 * predictionAccuracy;

  // Log quality warnings
  if (conditionNumber > MAX_CONDITION_NUMBER) {
    console.warn(
      `Matrix condition number ${conditionNumber.toFixed(0)} exceeds recommended threshold ${MAX_CONDITION_NUMBER}. ` +
      `Decomposition quality: ${decompositionQuality.toFixed(3)}`
    );
  }

  if (avgPredictionError > 0.3) {
    console.warn(
      `Matrix prediction error ${predictionError.toFixed(3)} is high. ` +
      `Average per-agent error: ${avgPredictionError.toFixed(3)}. ` +
      `Decomposition quality: ${decompositionQuality.toFixed(3)}`
    );
  }

  // Calculate disagreement entropy metrics
  const H_avg = orderedWeights.reduce((sum, w, i) =>
    sum + w * binaryEntropy(beliefs[i]), 0);
  const H_agg = binaryEntropy(finalAggregate);

  const D_JS = Math.max(0, H_agg - H_avg);
  const D_JS_norm = Math.min(1.0, D_JS);
  const certainty = 1.0 - D_JS_norm;

  // Validate all invariants
  validateInvariants(finalAggregate, commonPrior, certainty, decompositionQuality, beliefs, metaPredictions, orderedWeights);

  return {
    aggregate: finalAggregate,
    common_prior: commonPrior,
    local_expectations_matrix: W,
    jensen_shannon_disagreement_entropy: D_JS,
    normalized_disagreement_entropy: D_JS_norm,
    certainty: certainty,
    agent_meta_predictions: agentMetaPredictions,
    active_agent_indicators: activeAgentIndicators,
    decomposition_quality: decompositionQuality,
  };
}

Deno.serve(async (req) => {
  try {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (path === "decompose") {
      const input: DecompositionInput = await req.json();

      // Enhanced input validation
      if (!input.belief_id) {
        throw new DecompositionError(422, "belief_id is required");
      }
      if (typeof input.belief_id !== "string" || input.belief_id.trim() === "") {
        throw new DecompositionError(422, "belief_id must be a non-empty string");
      }

      if (!input.weights) {
        throw new DecompositionError(422, "weights object is required");
      }
      if (typeof input.weights !== "object" || Array.isArray(input.weights)) {
        throw new DecompositionError(422, "weights must be an object mapping agent_id to numeric weight");
      }
      if (Object.keys(input.weights).length === 0) {
        throw new DecompositionError(422, "weights must contain at least one agent");
      }

      // Validate weight values
      for (const [agentId, weight] of Object.entries(input.weights)) {
        if (typeof weight !== "number" || !isFinite(weight) || isNaN(weight)) {
          throw new DecompositionError(400, `Weight for agent ${agentId} is NaN or Infinity`, { agent_id: agentId, weight });
        }
        if (weight < 0) {
          throw new DecompositionError(400, `All weights must be non-negative, agent ${agentId} has weight ${weight}`, { agent_id: agentId, weight });
        }
      }

      // Verify weight normalization
      const weightSum = Object.values(input.weights).reduce((sum, w) => sum + w, 0);
      if (Math.abs(weightSum - 1.0) > EPSILON_PROBABILITY) {
        throw new DecompositionError(400, `Weights must sum to 1.0, got ${weightSum}`, { weight_sum: weightSum });
      }

      const result = await performDecomposition(supabase, input.belief_id, input.weights);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (path === "leave-one-out-decompose") {
      const input: LeaveOneOutInput = await req.json();

      // Enhanced input validation
      if (!input.belief_id || typeof input.belief_id !== "string" || input.belief_id.trim() === "") {
        throw new DecompositionError(422, "belief_id must be a non-empty string");
      }

      if (!input.exclude_agent_id || typeof input.exclude_agent_id !== "string" || input.exclude_agent_id.trim() === "") {
        throw new DecompositionError(422, "exclude_agent_id must be a non-empty string");
      }

      if (!input.weights || typeof input.weights !== "object" || Array.isArray(input.weights)) {
        throw new DecompositionError(422, "weights must be an object mapping agent_id to numeric weight");
      }

      // Verify excluded agent not in weights
      if (input.weights[input.exclude_agent_id]) {
        throw new DecompositionError(
          400,
          `Excluded agent ${input.exclude_agent_id} must not be in weights object`,
          { excluded_agent: input.exclude_agent_id }
        );
      }

      // Validate weight values
      for (const [agentId, weight] of Object.entries(input.weights)) {
        if (typeof weight !== "number" || !isFinite(weight) || isNaN(weight)) {
          throw new DecompositionError(400, `Weight for agent ${agentId} is NaN or Infinity`, { agent_id: agentId, weight });
        }
        if (weight < 0) {
          throw new DecompositionError(400, `All weights must be non-negative, agent ${agentId} has weight ${weight}`, { agent_id: agentId, weight });
        }
      }

      // Re-normalize weights
      const weightSum = Object.values(input.weights).reduce((sum, w) => sum + w, 0);
      const normalizedWeights: Record<string, number> = {};

      if (weightSum > 0) {
        for (const [agentId, weight] of Object.entries(input.weights)) {
          normalizedWeights[agentId] = weight / weightSum;
        }
      } else {
        throw new DecompositionError(400, "Sum of weights is zero after excluding agent", { weight_sum: weightSum });
      }

      const result = await performDecomposition(
        supabase,
        input.belief_id,
        normalizedWeights,
        input.exclude_agent_id
      ) as LeaveOneOutOutput;

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new DecompositionError(404, "Invalid endpoint");
    }

  } catch (error) {
    console.error("Decomposition error:", error);

    // Handle custom DecompositionError
    if (error instanceof DecompositionError) {
      const errorResponse: any = { error: error.message };
      if (error.context) {
        errorResponse.context = error.context;
      }

      return new Response(
        JSON.stringify(errorResponse),
        {
          status: error.statusCode,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Handle generic errors
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );
  }
});