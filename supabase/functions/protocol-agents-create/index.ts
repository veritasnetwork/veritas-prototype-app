import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { initial_stake } = await req.json();

    // Validate initial_stake if provided
    if (initial_stake !== undefined) {
      if (typeof initial_stake !== 'number' || initial_stake <= 0) {
        return new Response(
          JSON.stringify({ error: 'initial_stake must be a positive number' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Resolve initial stake amount
    let resolvedStake = initial_stake;
    if (resolvedStake === undefined) {
      const { data: systemConfig } = await supabaseClient
        .from('system_config')
        .select('value')
        .eq('key', 'initial_agent_stake')
        .single();

      resolvedStake = parseFloat(systemConfig?.value || '100.0');
    }

    // Create agent record
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .insert({
        total_stake: resolvedStake
      })
      .select('id, total_stake')
      .single();

    if (agentError) {
      throw new Error(`Failed to create agent: ${agentError.message}`);
    }

    return new Response(
      JSON.stringify({
        agent_id: agent.id,
        total_stake: agent.total_stake
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Agent creation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});