import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to call internal functions
async function callInternalFunction(supabaseUrl: string, serviceKey: string, functionName: string, payload: any) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`${functionName} failed: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // 1. Check if any epoch is overdue for processing
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', ['next_epoch_deadline', 'current_epoch', 'cron_status'])

    if (configError) {
      throw new Error(`Failed to get system config: ${configError.message}`)
    }

    const config = Object.fromEntries(configData.map(row => [row.key, row.value]))

    // 2. Only proceed if cron is active and we have a deadline
    if (config.cron_status !== 'active' || !config.next_epoch_deadline) {
      return new Response(
        JSON.stringify({
          status: 'inactive',
          message: 'Cron not active or no deadline set',
          cron_status: config.cron_status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check if epoch is overdue (with 5-second buffer for precision)
    const currentTime = new Date()
    const deadlineTime = new Date(config.next_epoch_deadline)
    const secondsPastDeadline = Math.floor((currentTime.getTime() - deadlineTime.getTime()) / 1000)

    // 4. Only trigger if we're past deadline (with small buffer)
    if (secondsPastDeadline < -5) {
      return new Response(
        JSON.stringify({
          status: 'waiting',
          message: 'Epoch not yet due',
          seconds_until_deadline: -secondsPastDeadline,
          deadline: deadlineTime.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Trigger epoch processing
    console.log(`Triggering overdue epoch processing (${secondsPastDeadline}s past deadline)`)

    const processingData = await callInternalFunction(
      supabaseUrl,
      serviceKey,
      'protocol-epochs-process-cron',
      {}
    )

    return new Response(
      JSON.stringify({
        status: 'triggered',
        message: 'Overdue epoch processing triggered',
        seconds_past_deadline: secondsPastDeadline,
        processing_result: processingData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Overdue check error:', error)
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Failed to check overdue epochs',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})