/**
 * Single Pool Settlement Service
 *
 * Settles a SINGLE pool based on its belief's BD relevance score.
 * Called on-demand for individual pools (user-triggered or automated).
 *
 * Flow:
 * 1. Fetch pool and belief
 * 2. Get BD relevance score from belief.previous_aggregate
 * 3. Check if pool needs settlement (epoch check)
 * 4. Convert score to Q32.32 fixed-point
 * 5. Call settle_epoch for this pool
 * 6. Events are indexed automatically by event-processor
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey } from "npm:@solana/web3.js@1.95.8";
import { AnchorProvider, Program, BN } from "npm:@coral-xyz/anchor@0.30.1";
import { bs58 } from "npm:@coral-xyz/anchor@0.30.1/dist/cjs/utils/bytes/index.js";
import idl from "../_shared/veritas_curation_idl.json" with { type: "json" };

const Q32_SCALE = 1 << 32; // Q32.32 fixed-point scale

interface SettlementRequest {
  pool_address: string;
  belief_id?: string; // Optional - will fetch from pool if not provided
}

interface SettlementResponse {
  success: boolean;
  pool_address: string;
  belief_id: string;
  bd_score: number;
  previous_epoch: number;
  new_epoch: number;
  tx_signature?: string;
  error?: string;
  message?: string;
}

class SettlementError extends Error {
  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'SettlementError';
  }
}

/**
 * Load protocol authority keypair from environment
 */
function loadProtocolAuthority(): Keypair {
  const authorityKey = Deno.env.get("SOLANA_PROTOCOL_AUTHORITY_PRIVATE_KEY");

  if (!authorityKey) {
    throw new SettlementError("SOLANA_PROTOCOL_AUTHORITY_PRIVATE_KEY not configured");
  }

  try {
    const decoded = bs58.decode(authorityKey);
    return Keypair.fromSecretKey(decoded);
  } catch (error) {
    throw new SettlementError(`Failed to load protocol authority keypair: ${error.message}`);
  }
}

/**
 * Convert BD relevance score [0, 1] to Q32.32 fixed-point
 */
function scoreToQ32(score: number): BN {
  if (score < 0 || score > 1) {
    console.warn(`BD score ${score} out of range [0,1], clamping`);
    score = Math.max(0, Math.min(1, score));
  }

  const scaledScore = Math.floor(score * Q32_SCALE);
  return new BN(scaledScore);
}

/**
 * Settle a single pool
 */
async function settlePool(
  program: Program,
  poolAddress: string,
  bdScore: number,
  authority: Keypair
): Promise<string> {
  const poolPubkey = new PublicKey(poolAddress);
  const scoreQ32 = scoreToQ32(bdScore);

  console.log(`[SETTLE] Pool ${poolAddress}: BD score ${bdScore.toFixed(4)}, Q32=${scoreQ32.toString()}`);

  // Build settle_epoch transaction
  const tx = await program.methods
    .settleEpoch(scoreQ32)
    .accounts({
      contentPool: poolPubkey,
      protocolAuthority: authority.publicKey,
    })
    .signers([authority])
    .rpc();

  return tx;
}

/**
 * Main settlement handler
 */
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse request
    const requestBody: SettlementRequest = await req.json();
    const { pool_address, belief_id: inputBeliefId } = requestBody;

    if (!pool_address) {
      return new Response(
        JSON.stringify({ error: "pool_address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if Solana is configured
    const programId = Deno.env.get("SOLANA_PROGRAM_ID");
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL");

    if (!programId || !rpcUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Solana not configured",
          message: "Settlement requires Solana connection",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SETTLEMENT] Processing pool: ${pool_address}`);

    // Fetch pool deployment
    const { data: pool, error: poolError } = await supabase
      .from("pool_deployments")
      .select("pool_address, belief_id, current_epoch, status")
      .eq("pool_address", pool_address)
      .single();

    if (poolError || !pool) {
      throw new SettlementError(
        `Pool not found: ${pool_address}`,
        { db_error: poolError }
      );
    }

    if (pool.status !== "market_deployed") {
      return new Response(
        JSON.stringify({
          success: false,
          pool_address,
          error: `Pool status is ${pool.status}, must be market_deployed`,
          message: "Cannot settle pool that hasn't been deployed",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const beliefId = inputBeliefId || pool.belief_id;

    if (!beliefId) {
      throw new SettlementError(
        "No belief_id associated with this pool",
        { pool_address }
      );
    }

    // Fetch belief and BD score
    const { data: belief, error: beliefError } = await supabase
      .from("beliefs")
      .select("id, previous_aggregate, status")
      .eq("id", beliefId)
      .single();

    if (beliefError || !belief) {
      throw new SettlementError(
        `Belief not found: ${beliefId}`,
        { db_error: beliefError }
      );
    }

    if (belief.status !== "active") {
      return new Response(
        JSON.stringify({
          success: false,
          pool_address,
          belief_id: beliefId,
          error: `Belief status is ${belief.status}, must be active`,
          message: "Cannot settle pool for inactive belief",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bdScore = belief.previous_aggregate;

    if (bdScore === null || bdScore === undefined) {
      throw new SettlementError(
        `No BD score available for belief ${beliefId}`,
        { belief }
      );
    }

    console.log(`[SETTLEMENT] Belief ${beliefId}: BD score = ${bdScore}`);
    console.log(`[SETTLEMENT] Pool current epoch: ${pool.current_epoch}`);

    // Initialize Solana connection
    const connection = new Connection(rpcUrl, "confirmed");
    const authority = loadProtocolAuthority();

    // Create Anchor provider and program
    const provider = new AnchorProvider(
      connection,
      { publicKey: authority.publicKey, signAllTransactions: async () => [], signTransaction: async () => ({} as any) },
      { commitment: "confirmed" }
    );

    const programPubkey = new PublicKey(programId);
    const program = new Program(idl as any, programPubkey, provider);

    // Settle the pool
    const txSignature = await settlePool(
      program,
      pool_address,
      bdScore,
      authority
    );

    const duration = Date.now() - startTime;
    console.log(`[SETTLEMENT] Pool ${pool_address} settled in ${duration}ms, tx: ${txSignature}`);

    const response: SettlementResponse = {
      success: true,
      pool_address,
      belief_id: beliefId,
      bd_score: bdScore,
      previous_epoch: pool.current_epoch || 0,
      new_epoch: (pool.current_epoch || 0) + 1,
      tx_signature: txSignature,
      message: `Pool settled successfully at epoch ${(pool.current_epoch || 0) + 1}`,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SETTLEMENT] Error:", error);

    if (error instanceof SettlementError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          context: error.context,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Check for specific Solana errors
    let errorMessage = error.message || "Settlement failed";
    let statusCode = 500;

    if (errorMessage.includes("cooldown")) {
      errorMessage = "Settlement cooldown not elapsed. Please wait before settling again.";
      statusCode = 429;
    } else if (errorMessage.includes("InvalidBDScore")) {
      errorMessage = "Invalid BD score value";
      statusCode = 400;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
