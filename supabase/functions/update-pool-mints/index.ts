/**
 * Update Pool Mints Edge Function
 *
 * Updates pool_deployments table with derived LONG and SHORT mint addresses.
 * These addresses are deterministically derived from the content_id (post_id).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1.78.0';
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const programId = Deno.env.get('VERITAS_PROGRAM_ID') || 'CuRATjKbbxKDHPShtDvh8L8J7rY7kqRmjXVQWhYSd3nk';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pool deployments that don't have mint addresses yet
    const { data: pools, error: poolsError } = await supabase
      .from('pool_deployments')
      .select('id, post_id, pool_address')
      .or('long_mint_address.is.null,short_mint_address.is.null');

    if (poolsError) {
      throw poolsError;
    }

    if (!pools || pools.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pools need mint address updates' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pools.length} pools needing mint address updates`);

    const programPubkey = new PublicKey(programId);
    const updates = [];

    for (const pool of pools) {
      // Convert UUID post_id to content_id PublicKey
      const postIdBytes = Buffer.from(pool.post_id.replace(/-/g, ''), 'hex');
      const postIdBytes32 = Buffer.alloc(32);
      postIdBytes.copy(postIdBytes32, 0);
      const contentId = new PublicKey(postIdBytes32);

      // Derive LONG mint PDA
      const [longMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('long_mint'), contentId.toBuffer()],
        programPubkey
      );

      // Derive SHORT mint PDA
      const [shortMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('short_mint'), contentId.toBuffer()],
        programPubkey
      );

      // Update the pool deployment record
      const { error: updateError } = await supabase
        .from('pool_deployments')
        .update({
          long_mint_address: longMintPda.toBase58(),
          short_mint_address: shortMintPda.toBase58(),
        })
        .eq('id', pool.id);

      if (updateError) {
        console.error(`Failed to update pool ${pool.id}:`, updateError);
      } else {
        updates.push({
          pool_id: pool.id,
          post_id: pool.post_id,
          long_mint: longMintPda.toBase58(),
          short_mint: shortMintPda.toBase58(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Updated ${updates.length} pools with mint addresses`,
        updates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating pool mints:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});