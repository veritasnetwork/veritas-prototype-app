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

    const { count = 1, prefix = 'VERITAS', description } = await req.json();

    if (count < 1 || count > 100) {
      return new Response(
        JSON.stringify({ error: 'Count must be between 1 and 100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const codes = [];

    for (let i = 0; i < count; i++) {
      // Generate unique invite code
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const timestamp = Date.now().toString(36).substring(-4).toUpperCase();
      const code = `${prefix}-${randomPart}-${timestamp}`;

      // Insert into database
      const { data, error } = await supabaseClient
        .from('invite_codes')
        .insert({
          code,
          status: 'unused',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invite code:', error);
        continue;
      }

      codes.push(data);
    }

    return new Response(
      JSON.stringify({
        success: true,
        codes: codes.map(c => ({
          code: c.code,
          status: c.status,
          created_at: c.created_at
        })),
        count: codes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Invite code generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});