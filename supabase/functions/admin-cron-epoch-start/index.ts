import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StartCronRequest {
  epoch_duration_seconds?: number
  immediate_start?: boolean
}

interface StartCronResponse {
  cron_job_id: string
  next_epoch_deadline: string
  status: string
  current_epoch: number
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
      epoch_duration_seconds,
      immediate_start = false
    }: StartCronRequest = await req.json() || {}

    // 1. Get current system configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', [
        'epoch_duration_seconds',
        'current_epoch',
        'cron_status'
      ])

    if (configError) {
      throw new Error(`Failed to get system config: ${configError.message}`)
    }

    const config = Object.fromEntries(configData.map(row => [row.key, row.value]))

    // 2. Starting cron means enabling epoch processing - no additional checks needed

    // 3. Check if cron is already running
    if (config.cron_status === 'active') {
      return new Response(
        JSON.stringify({
          error: 'Cron scheduling is already active',
          code: 400
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 4. Validate and set duration (must be multiple of 60 seconds)
    let durationSeconds = epoch_duration_seconds || parseInt(config.epoch_duration_seconds || '3600')

    // Ensure minimum 60 seconds and round to nearest minute
    durationSeconds = Math.max(60, Math.ceil(durationSeconds / 60) * 60)

    const currentEpoch = parseInt(config.current_epoch || '0')

    // 5. Calculate timing aligned to minute boundaries
    const currentTime = new Date()

    // Start at the beginning of the current minute (round down to current minute boundary)
    const epochStartTime = new Date(Math.floor(currentTime.getTime() / 60000) * 60000)

    const nextEpochDeadline = new Date(epochStartTime.getTime() + (durationSeconds * 1000))

    // 6. Generate unique cron job ID
    const cronJobId = `epoch-processor-${Date.now()}`

    // 7. Create cron job to run at the exact deadline time
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const functionUrl = `${supabaseUrl}/functions/v1/protocol-epochs-process-cron`

    // Calculate the exact cron schedule for the deadline
    const deadlineMinute = nextEpochDeadline.getMinutes()
    const deadlineHour = nextEpochDeadline.getHours()
    const deadlineDay = nextEpochDeadline.getDate()
    const deadlineMonth = nextEpochDeadline.getMonth() + 1 // JS months are 0-based

    // Create cron expression to run at the exact deadline time
    const cronSchedule = `${deadlineMinute} ${deadlineHour} ${deadlineDay} ${deadlineMonth} *`

    console.log(`Creating cron job: ${cronJobId} to run at ${nextEpochDeadline.toISOString()}`)
    console.log(`Cron schedule: ${cronSchedule}`)

    const { data: cronResult, error: cronError } = await supabaseClient.rpc('create_epoch_cron_job', {
      job_name: cronJobId,
      job_schedule: cronSchedule,
      function_url: functionUrl
    })

    if (cronError) {
      console.error('Failed to create cron job:', cronError)
      // Continue without failing - we can still process manually
    } else {
      console.log('Cron job creation result:', cronResult)
    }


    // 8. Update system configuration
    const configUpdates = [
      { key: 'current_epoch_start_time', value: epochStartTime.toISOString() },
      { key: 'next_epoch_deadline', value: nextEpochDeadline.toISOString() },
      { key: 'cron_job_id', value: cronJobId },
      { key: 'cron_status', value: 'active' },
      { key: 'cron_next_run', value: nextEpochDeadline.toISOString() },
      { key: 'epoch_duration_seconds', value: durationSeconds.toString() }
    ]

    for (const update of configUpdates) {
      await supabaseClient
        .from('system_config')
        .upsert(update, { onConflict: 'key' })
    }

    // 9. Insert initial epoch history record
    const { error: historyError } = await supabaseClient
      .from('epoch_history')
      .insert({
        epoch_number: currentEpoch,
        started_at: epochStartTime.toISOString(),
        scheduled_duration_seconds: durationSeconds,
        cron_triggered: true,
        status: 'active'
      })

    if (historyError) {
      console.error('Failed to create epoch history:', historyError)
      // Continue without failing
    }

    console.log(`Started cron scheduling: job_id=${cronJobId}, duration=${durationSeconds}s`)

    // 10. Return success response
    const response: StartCronResponse = {
      cron_job_id: cronJobId,
      next_epoch_deadline: nextEpochDeadline.toISOString(),
      status: 'started',
      current_epoch: currentEpoch
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Start cron error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to start cron scheduling',
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