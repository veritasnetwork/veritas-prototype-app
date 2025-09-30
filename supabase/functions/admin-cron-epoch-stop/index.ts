import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StopCronRequest {
  complete_current_epoch?: boolean
}

interface StopCronResponse {
  status: string
  final_epoch: number
  stopped_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for admin functions
    )

    // Parse request body
    const {
      complete_current_epoch = true
    }: StopCronRequest = await req.json() || {}

    // 1. Get current system configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', [
        'current_epoch',
        'cron_job_id',
        'cron_status'
      ])

    if (configError) {
      throw new Error(`Failed to get system config: ${configError.message}`)
    }

    const config = Object.fromEntries(configData.map(row => [row.key, row.value]))

    // 2. Check if cron is currently active
    if (config.cron_status !== 'active') {
      return new Response(
        JSON.stringify({
          error: 'Cron scheduling is not currently active',
          code: 400
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const currentEpoch = parseInt(config.current_epoch || '0')
    const cronJobId = config.cron_job_id
    const stoppedAt = new Date()

    // 3. Remove cron job if it exists
    if (cronJobId) {
      const { error: cronError } = await supabaseClient.rpc('remove_epoch_cron_job', {
        job_name: cronJobId
      })

      if (cronError) {
        console.error('Failed to remove cron job:', cronError)
        // Continue without failing - cron job might not exist or be removable
      }
    }

    // 4. Update system configuration
    const configUpdates = [
      { key: 'cron_status', value: 'stopped' },
      { key: 'cron_last_run', value: stoppedAt.toISOString() },
      { key: 'cron_next_run', value: '' }
    ]

    for (const update of configUpdates) {
      await supabaseClient
        .from('system_config')
        .upsert(update, { onConflict: 'key' })
    }

    // 5. Handle current epoch completion
    if (complete_current_epoch) {
      // Mark current epoch history as completed if it exists
      const { error: historyError } = await supabaseClient
        .from('epoch_history')
        .update({
          ended_at: stoppedAt.toISOString(),
          status: 'completed'
        })
        .eq('epoch_number', currentEpoch)
        .eq('status', 'active')

      if (historyError) {
        console.error('Failed to update epoch history:', historyError)
        // Continue without failing
      }
    } else {
      // Mark current epoch as failed/stopped
      const { error: historyError } = await supabaseClient
        .from('epoch_history')
        .update({
          ended_at: stoppedAt.toISOString(),
          status: 'failed'
        })
        .eq('epoch_number', currentEpoch)
        .eq('status', 'active')

      if (historyError) {
        console.error('Failed to update epoch history:', historyError)
        // Continue without failing
      }
    }

    console.log(`Stopped cron scheduling: job_id=${cronJobId}, final_epoch=${currentEpoch}`)

    // 6. Return success response
    const response: StopCronResponse = {
      status: 'stopped',
      final_epoch: currentEpoch,
      stopped_at: stoppedAt.toISOString()
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Stop cron error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to stop cron scheduling',
        details: error.message,
        code: 500
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})