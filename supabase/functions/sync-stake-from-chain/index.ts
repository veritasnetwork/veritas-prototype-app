import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.87.6";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

/**
 * Manual Stake Sync Edge Function
 *
 * Reads user's on-chain custodian balance and updates database
 *
 * POST /functions/v1/sync-stake-from-chain
 * {
 *   "agent_id": "uuid",
 *   "solana_address": "wallet_address"
 * }
 */

const SOLANA_RPC = Deno.env.get("SOLANA_RPC_ENDPOINT") || "https://api.devnet.solana.com";
const PROGRAM_ID = Deno.env.get("SOLANA_PROGRAM_ID")!;

interface SyncRequest {
  agent_id: string;
  solana_address: string;
}

// Helper to derive custodian PDA
function getCustodianPDA(programId: PublicKey, owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("custodian"), owner.toBuffer()],
    programId
  );
  return pda;
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // Parse request
    const { agent_id, solana_address }: SyncRequest = await req.json();

    if (!agent_id || !solana_address) {
      return new Response(
        JSON.stringify({ error: "Missing agent_id or solana_address" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing stake for agent ${agent_id} (${solana_address})`);

    // Initialize Solana connection
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const programId = new PublicKey(PROGRAM_ID);
    const ownerPubkey = new PublicKey(solana_address);

    // Derive custodian PDA
    const custodianPDA = getCustodianPDA(programId, ownerPubkey);

    console.log(`Custodian PDA: ${custodianPDA.toBase58()}`);

    // Fetch custodian account
    const accountInfo = await connection.getAccountInfo(custodianPDA);

    if (!accountInfo) {
      return new Response(
        JSON.stringify({
          error: "Custodian account not found on-chain",
          message: "User needs to initialize custodian first",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse custodian account data
    // Account layout (from Rust struct):
    // - owner: Pubkey (32 bytes)
    // - protocol_authority: Pubkey (32 bytes)
    // - usdc_vault: Pubkey (32 bytes)
    // - total_deposited: u64 (8 bytes)
    // - total_withdrawn: u64 (8 bytes)
    // - is_paused: bool (1 byte)
    // - bump: u8 (1 byte)

    const data = accountInfo.data;

    // Skip discriminator (8 bytes) if using Anchor
    const offset = 8;

    // Read total_deposited (at offset 8 + 32 + 32 + 32 = 104)
    const totalDepositedOffset = offset + 96;
    const totalDeposited = data.readBigUInt64LE(totalDepositedOffset);

    // Read total_withdrawn (at offset 104 + 8 = 112)
    const totalWithdrawnOffset = totalDepositedOffset + 8;
    const totalWithdrawn = data.readBigUInt64LE(totalWithdrawnOffset);

    // Calculate current balance (deposited - withdrawn, in micro-USDC)
    const balanceMicroUsdc = Number(totalDeposited - totalWithdrawn);
    const balanceUsdc = balanceMicroUsdc / 1_000_000;

    console.log(`On-chain balance: ${balanceUsdc} USDC`);
    console.log(`Total deposited: ${Number(totalDeposited) / 1_000_000} USDC`);
    console.log(`Total withdrawn: ${Number(totalWithdrawn) / 1_000_000} USDC`);

    // Update database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: result, error: dbError } = await supabase.rpc(
      "sync_agent_stake_from_chain",
      {
        p_agent_id: agent_id,
        p_solana_address: solana_address,
        p_onchain_balance: balanceUsdc,
      }
    );

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Database update failed", details: dbError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Also update total_deposited and total_withdrawn for tracking
    const { error: updateError } = await supabase
      .from("agents")
      .update({
        total_deposited: Number(totalDeposited) / 1_000_000,
        total_withdrawn: Number(totalWithdrawn) / 1_000_000,
      })
      .eq("id", agent_id);

    if (updateError) {
      console.error("Failed to update totals:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent_id,
        solana_address,
        custodian_pda: custodianPDA.toBase58(),
        balance_usdc: balanceUsdc,
        total_deposited_usdc: Number(totalDeposited) / 1_000_000,
        total_withdrawn_usdc: Number(totalWithdrawn) / 1_000_000,
        synced_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
