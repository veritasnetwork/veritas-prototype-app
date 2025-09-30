import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateTimingRequest {
  new_duration_seconds: number
  apply_immediately?: boolean
}

interface UpdateTimingResponse {
  updated_duration: number
  next_epoch_start: string
  cron_rescheduled: boolean
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
      new_duration_seconds,
      apply_immediately = false
    }: UpdateTimingRequest = await req.json()

    if (!new_duration_seconds || new_duration_seconds <= 0) {
      return new Response(
        JSON.stringify({
          error: 'new_duration_seconds must be a positive number',
          code: 400
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 1. Get current system configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', [
        'current_epoch',
        'current_epoch_start_time',
        'next_epoch_deadline',
        'cron_job_id',
        'cron_status',
        'epoch_duration_seconds'
      ])

    if (configError) {
      throw new Error(`Failed to get system config: ${configError.message}`)
    }

    const config = Object.fromEntries(configData.map(row => [row.key, row.value]))

    const currentEpoch = parseInt(config.current_epoch || '0')
    const currentTime = new Date()
    let cronRescheduled = false
    let nextEpochStart: string

    // 2. Update epoch duration in config
    await supabaseClient
      .from('system_config')
      .upsert({ key: 'epoch_duration_seconds', value: new_duration_seconds.toString() }, { onConflict: 'key' })

    // 3. Handle immediate application
    if (apply_immediately && config.cron_status === 'active') {
      console.log('Applying timing change immediately')

      // Complete current epoch
      const { error: historyError } = await supabaseClient
        .from('epoch_history')
        .update({
          ended_at: currentTime.toISOString(),
          status: 'completed'
        })
        .eq('epoch_number', currentEpoch)
        .eq('status', 'active')

      if (historyError) {
        console.error('Failed to complete current epoch:', historyError)
      }

      // Start new epoch with new timing
      const nextEpoch = currentEpoch + 1
      const newEpochStart = currentTime
      const newEpochDeadline = new Date(currentTime.getTime() + (new_duration_seconds * 1000))

      // Update system timing
      const configUpdates = [
        { key: 'current_epoch', value: nextEpoch.toString() },
        { key: 'current_epoch_start_time', value: newEpochStart.toISOString() },
        { key: 'next_epoch_deadline', value: newEpochDeadline.toISOString() },
        { key: 'cron_next_run', value: newEpochDeadline.toISOString() }
      ]

      for (const update of configUpdates) {
        await supabaseClient
          .from('system_config')
          .upsert(update, { onConflict: 'key' })
      }

      // Create new epoch history record
      const { error: newHistoryError } = await supabaseClient
        .from('epoch_history')
        .insert({
          epoch_number: nextEpoch,
          started_at: newEpochStart.toISOString(),
          scheduled_duration_seconds: new_duration_seconds,
          cron_triggered: true,
          status: 'active'
        })

      if (newHistoryError) {
        console.error('Failed to create new epoch history:', newHistoryError)
      }

      // Reschedule cron job if we have one
      const cronJobId = config.cron_job_id
      if (cronJobId) {
        // Remove old cron job
        await supabaseClient.rpc('remove_epoch_cron_job', {
          job_name: cronJobId
        })

        // Create new cron job with updated timing
        let cronSchedule: string
        if (new_duration_seconds <= 60) {
          cronSchedule = '* * * * *' // Every minute
        } else if (new_duration_seconds <= 3600) {
          const minutes = Math.floor(new_duration_seconds / 60)
          cronSchedule = `*/${minutes} * * * *`
        } else {
          cronSchedule = '0 * * * *' // Every hour
        }

        const newCronJobId = `epoch-processor-${Date.now()}`
        await supabaseClient.rpc('create_epoch_cron_job', {
          job_name: newCronJobId,
          job_schedule: cronSchedule,
          function_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-epochs-process-cron`
        })

        // Update cron job ID
        await supabaseClient
          .from('system_config')
          .upsert({ key: 'cron_job_id', value: newCronJobId }, { onConflict: 'key' })

        cronRescheduled = true
      }

      nextEpochStart = newEpochStart.toISOString()

    } else {
      // Apply to next epoch cycle
      console.log('Timing change will apply to next epoch cycle')

      if (config.current_epoch_start_time) {
        const currentEpochStart = new Date(config.current_epoch_start_time)
        const nextEpochStartTime = new Date(currentEpochStart.getTime() + (parseInt(config.epoch_duration_seconds || '3600') * 1000))
        nextEpochStart = nextEpochStartTime.toISOString()
      } else {
        nextEpochStart = new Date(currentTime.getTime() + (new_duration_seconds * 1000)).toISOString()
      }
    }

    console.log(`Updated epoch duration to ${new_duration_seconds}s, immediate=${apply_immediately}, reschedule=${cronRescheduled}`)

    // 4. Return success response
    const response: UpdateTimingResponse = {
      updated_duration: new_duration_seconds,
      next_epoch_start: nextEpochStart,
      cron_rescheduled: cronRescheduled,
      current_epoch: currentEpoch
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Update timing error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update epoch timing',
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