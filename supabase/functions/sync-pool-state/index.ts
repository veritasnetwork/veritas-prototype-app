/**
 * Sync Pool State Edge Function
 *
 * Fetches live ICBS pool state from Solana and caches it in pool_deployments table.
 * Updates: supply_long, supply_short, sqrt_price_long_x96, sqrt_price_short_x96, vault_balance
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1.78.0';
import {
  createReadOnlyProgram,
  fetchContentPool,
  getRpcEndpoint,
  getProgramId,
  loadVeritasIDL,
} from '../_shared/solana-client.ts';

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request parameters
    const body = await req.json();
    const { pool_address } = body;

    // If pool_address provided, sync just that pool. Otherwise sync all active pools.
    let query = supabase
      .from('pool_deployments')
      .select('id, pool_address');

    if (pool_address) {
      query = query.eq('pool_address', pool_address);
    } else {
      // Sync all pools that have been deployed (have a pool_address)
      query = query.not('pool_address', 'is', null);
    }

    const { data: pools, error: poolsError } = await query;

    if (poolsError) {
      throw poolsError;
    }

    if (!pools || pools.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pools to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing ${pools.length} pools...`);

    // Initialize Solana program using shared utilities
    const rpcEndpoint = getRpcEndpoint();
    const programId = getProgramId();
    const idl = await loadVeritasIDL();
    const program = createReadOnlyProgram(rpcEndpoint, programId, idl);

    const updates = [];
    const errors = [];

    for (const pool of pools) {
      try {
        // Fetch ContentPool account using shared utility
        const poolAccount = await fetchContentPool(program, pool.pool_address);

        // Update database with cached pool state
        const { error: updateError } = await supabase
          .from('pool_deployments')
          .update({
            supply_long: poolAccount.sLong?.toString() || '0',
            supply_short: poolAccount.sShort?.toString() || '0',
            sqrt_price_long_x96: poolAccount.sqrtPriceLongX96?.toString() || null,
            sqrt_price_short_x96: poolAccount.sqrtPriceShortX96?.toString() || null,
            vault_balance: poolAccount.vaultBalance?.toString() || '0',
            current_epoch: poolAccount.currentEpoch ? Number(poolAccount.currentEpoch) : 0,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', pool.id);

        if (updateError) {
          console.error(`Failed to update pool ${pool.pool_address}:`, updateError);
          errors.push({
            pool_address: pool.pool_address,
            error: updateError.message,
          });
        } else {
          updates.push({
            pool_address: pool.pool_address,
            supply_long: poolAccount.sLong?.toString(),
            supply_short: poolAccount.sShort?.toString(),
          });
        }
      } catch (error) {
        console.error(`Error fetching pool ${pool.pool_address}:`, error);
        errors.push({
          pool_address: pool.pool_address,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Synced ${updates.length} pools`,
        updates,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing pool state:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
