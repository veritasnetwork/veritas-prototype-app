/**
 * Pool Settlement Service
 *
 * Triggers settlement for pools based on BD (Belief Decomposition) relevance scores.
 * Called by epoch processing after BD scoring completes.
 *
 * Flow:
 * 1. Fetch BD relevance scores for current epoch
 * 2. Map beliefs to pools
 * 3. Convert scores to Q32.32 fixed-point
 * 4. Call settle_epoch for each pool
 * 5. Events are indexed automatically by event-processor
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, Transaction } from "npm:@solana/web3.js@1.95.8";
import { AnchorProvider, Program, BN } from "npm:@coral-xyz/anchor@0.30.1";
import { bs58 } from "npm:@coral-xyz/anchor@0.30.1/dist/cjs/utils/bytes/index.js";
import idl from "../../../solana/veritas-curation/target/idl/veritas_curation.json" with { type: "json" };

const BATCH_SIZE = 10; // Parallel settlement batch size
const Q32_SCALE = 1 << 32; // Q32.32 fixed-point scale

interface SettlementResult {
  success: boolean;
  pool_address: string;
  tx_signature?: string;
  error?: string;
}

interface SettlementResponse {
  epoch: number;
  pools_settled: number;
  pools_failed: number;
  failed_pools: Array<{ pool_address: string; error: string }>;
  successful_pools: Array<{ pool_address: string; tx_signature: string }>;
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
    // Decode base58 private key
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
    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if Solana is configured
    const programId = Deno.env.get("SOLANA_PROGRAM_ID");
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL");

    if (!programId || !rpcUrl) {
      console.warn("[SETTLEMENT] Solana not configured, skipping settlement");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Solana not configured, settlement skipped",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current epoch
    const { data: configData, error: configError } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "current_epoch")
      .single();

    if (configError || !configData) {
      throw new SettlementError(
        `Failed to get current epoch: ${configError?.message || 'No data'}`,
        { db_error: configError }
      );
    }

    const currentEpoch = parseInt(configData.value);
    console.log(`[SETTLEMENT] Epoch ${currentEpoch} starting`);

    // Load beliefs that were processed in epoch processing
    // The previous_aggregate field is updated by BD decomposition during epoch processing
    const { data: beliefs, error: beliefsError } = await supabase
      .from("beliefs")
      .select("id, previous_aggregate")
      .eq("status", "active");

    if (beliefsError) {
      throw new SettlementError(
        `Failed to load beliefs: ${beliefsError.message}`,
        { db_error: beliefsError }
      );
    }

    if (!beliefs || beliefs.length === 0) {
      console.log("[SETTLEMENT] No active beliefs found, skipping");
      return new Response(
        JSON.stringify({
          epoch: currentEpoch,
          pools_settled: 0,
          pools_failed: 0,
          message: "No beliefs to settle",
        } as SettlementResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SETTLEMENT] Found ${beliefs.length} active beliefs`);

    // Map beliefs to pools via pool_deployments.belief_id
    // Only settle pools that haven't been settled this epoch yet
    const beliefIds = beliefs.map(b => b.id);
    const { data: pools, error: poolsError } = await supabase
      .from("pool_deployments")
      .select("pool_address, belief_id, current_epoch, status")
      .in("belief_id", beliefIds)
      .lt("current_epoch", currentEpoch)
      .eq("status", "market_deployed")

    if (poolsError) {
      throw new SettlementError(
        `Failed to load pool deployments: ${poolsError.message}`,
        { db_error: poolsError }
      );
    }

    if (!pools || pools.length === 0) {
      console.log("[SETTLEMENT] No pools found for beliefs, skipping");
      return new Response(
        JSON.stringify({
          epoch: currentEpoch,
          pools_settled: 0,
          pools_failed: 0,
          message: "No pools to settle",
        } as SettlementResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SETTLEMENT] Found ${pools.length} pools to settle (filtered by epoch < ${currentEpoch} and status=market_deployed)`);

    // Initialize Solana connection
    const connection = new Connection(rpcUrl, "confirmed");
    const authority = loadProtocolAuthority();

    // Create Anchor provider and program
    const provider = new AnchorProvider(
      connection,
      { publicKey: authority.publicKey, signAllTransactions: async () => [], signTransaction: async () => ({} as any) },
      { commitment: "confirmed" }
    );

    // Create program with loaded IDL
    const programPubkey = new PublicKey(programId);
    const program = new Program(idl as any, programPubkey, provider);

    // Settle pools in batches
    const results: SettlementResult[] = [];

    for (let i = 0; i < pools.length; i += BATCH_SIZE) {
      const batch = pools.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (pool) => {
          // Find belief for this pool
          const belief = beliefs.find(b => b.id === pool.belief_id);

          if (!belief) {
            throw new Error(`No belief found for pool ${pool.pool_address}`);
          }

          // Use previous_aggregate which was set by epoch processing (BD result)
          const bdScore = belief.previous_aggregate;

          if (bdScore === null || bdScore === undefined) {
            throw new Error(`No BD score for pool ${pool.pool_address} (belief ${belief.id})`);
          }

          const txSignature = await settlePool(
            program,
            pool.pool_address,
            bdScore,
            authority
          );

          return {
            success: true,
            pool_address: pool.pool_address,
            tx_signature: txSignature,
          };
        })
      );

      // Process batch results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const pool = batch[j];

        if (result.status === "fulfilled") {
          results.push(result.value);

          // Record implied relevance after successful settlement
          // Note: After settlement, reserves are scaled by BD score
          // This creates a datapoint showing the "reset" to actual relevance
          try {
            const belief = beliefs.find(b => b.id === pool.belief_id);
            const bdScore = belief?.previous_aggregate;

            if (bdScore !== null && bdScore !== undefined) {
              // Get post_id for this pool
              const { data: poolData } = await supabase
                .from("pool_deployments")
                .select("post_id, vault_balance")
                .eq("pool_address", pool.pool_address)
                .single();

              if (poolData?.post_id) {
                // After settlement, reserves are rebalanced based on BD score
                // impliedRelevance should equal bdScore (market "resets" to truth)
                const totalReserve = poolData.vault_balance || 0;
                const reserveLong = totalReserve * bdScore;
                const reserveShort = totalReserve * (1 - bdScore);

                const { error: impliedInsertError } = await supabase
                  .from("implied_relevance_history")
                  .insert({
                    post_id: poolData.post_id,
                    belief_id: pool.belief_id,
                    implied_relevance: bdScore, // Post-settlement, market equals truth
                    reserve_long: reserveLong,
                    reserve_short: reserveShort,
                    event_type: "rebase",
                    event_reference: result.value.tx_signature,
                    confirmed: false,
                    recorded_by: "server",
                  });

                if (impliedInsertError && impliedInsertError.code !== '23505') {
                  console.error(`[IMPLIED RELEVANCE] Insert error:`, impliedInsertError);
                } else if (!impliedInsertError) {
                  console.log(`[IMPLIED RELEVANCE] Recorded after settlement: ${bdScore.toFixed(4)}`);
                }
              }
            }
          } catch (impliedError) {
            console.error(`[IMPLIED RELEVANCE] Failed to record for ${pool.pool_address}:`, impliedError);
            // Don't fail settlement if implied relevance recording fails
          }
        } else {
          console.error(`[SETTLEMENT] Failed to settle pool ${pool.pool_address}:`, result.reason);
          results.push({
            success: false,
            pool_address: pool.pool_address,
            error: result.reason?.message || "Unknown error",
          });
        }
      }
    }

    // Aggregate results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const duration = Date.now() - startTime;
    console.log(`[SETTLEMENT] Settled ${successful.length}/${pools.length} pools in ${duration}ms`);

    if (failed.length > 0) {
      console.error(`[SETTLEMENT] Failed pools:`, failed.map(f => ({ pool: f.pool_address, error: f.error })));
    }

    const response: SettlementResponse = {
      epoch: currentEpoch,
      pools_settled: successful.length,
      pools_failed: failed.length,
      failed_pools: failed.map(f => ({ pool_address: f.pool_address, error: f.error! })),
      successful_pools: successful.map(s => ({ pool_address: s.pool_address, tx_signature: s.tx_signature! })),
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
          error: error.message,
          context: error.context,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
