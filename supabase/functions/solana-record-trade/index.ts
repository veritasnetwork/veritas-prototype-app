import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('[EDGE FUNCTION] solana-record-trade started');

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[EDGE FUNCTION] Authorization header present:', !!authHeader);

    if (!authHeader) {
      console.error('[EDGE FUNCTION] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[EDGE FUNCTION] Token extracted (first 20 chars):', token.substring(0, 20) + '...');

    // Skip JWT verification for now - user is already authenticated on client
    // TODO: Implement proper JWT verification when moving to production
    console.log('[EDGE FUNCTION] Skipping JWT verification (development mode)');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const {
      user_id,
      pool_address,
      post_id,
      wallet_address,
      trade_type,
      token_amount,
      usdc_amount,
      token_supply_after,
      reserve_after,
      k_quadratic,
      tx_signature
    } = body;

    // Validate required fields
    if (!user_id || !pool_address || !post_id || !wallet_address || !trade_type ||
        !token_amount || !usdc_amount || !token_supply_after || !reserve_after ||
        k_quadratic === undefined || !tx_signature) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: [
            'user_id', 'pool_address', 'post_id', 'wallet_address',
            'trade_type', 'token_amount', 'usdc_amount', 'token_supply_after',
            'reserve_after', 'k_quadratic', 'tx_signature'
          ]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate trade_type
    if (trade_type !== 'buy' && trade_type !== 'sell') {
      return new Response(
        JSON.stringify({ error: 'trade_type must be "buy" or "sell"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amounts are positive
    const tokenAmt = parseFloat(token_amount);
    const usdcAmt = parseFloat(usdc_amount);
    const supplyAfter = parseFloat(token_supply_after);
    const reserveAfter = parseFloat(reserve_after);

    if (tokenAmt <= 0 || usdcAmt <= 0 || supplyAfter < 0 || reserveAfter < 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amounts: must be positive (or >= 0 for after states)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Recording ${trade_type} trade:`, {
      user_id,
      pool_address,
      token_amount,
      usdc_amount,
      tx_signature
    });

    // Insert trade (trigger will update user_pool_balances automatically)
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        user_id,
        pool_address,
        post_id,
        wallet_address,
        trade_type,
        token_amount,
        usdc_amount,
        token_supply_after,
        reserve_after,
        k_quadratic,
        tx_signature,
        recorded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert trade:', error);

      // Check for duplicate tx_signature
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Trade already recorded (duplicate tx_signature)' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Trade recorded successfully:', trade.id);

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        trade_id: trade.id,
        recorded_at: trade.recorded_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Record trade error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
