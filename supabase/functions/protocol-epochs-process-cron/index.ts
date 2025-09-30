import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CronProcessingResponse {
  triggered_by_cron: boolean
  timing_valid: boolean
  processing_executed: boolean
  next_epoch: number
  processed_beliefs: any[]
  expired_beliefs: string[]
  errors: string[]
  timing_info: {
    current_time: string
    deadline_time: string
    seconds_past_deadline: number
  }
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

  const processingStartTime = new Date()
  console.log(`Cron-triggered epoch processing started at ${processingStartTime.toISOString()}`)

  try {
    // Initialize Supabase client with service role for cron operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // 1. Get current system configuration for timing validation
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', [
        'current_epoch',
        'next_epoch_deadline',
        'epoch_duration_seconds'
      ])

    if (configError) {
      throw new Error(`Failed to get system config: ${configError.message}`)
    }

    const config = Object.fromEntries(configData.map(row => [row.key, row.value]))

    // 2. If this function is called, cron is active - proceed with timing check

    // 3. Validate timing requirements
    const currentTime = new Date()
    const deadlineTime = new Date(config.next_epoch_deadline || currentTime.toISOString())
    const secondsPastDeadline = Math.floor((currentTime.getTime() - deadlineTime.getTime()) / 1000)

    // Create timing info object
    const timing_info = {
      current_time: currentTime.toISOString(),
      deadline_time: deadlineTime.toISOString(),
      seconds_past_deadline: secondsPastDeadline
    }
    const timingValid = currentTime >= deadlineTime

    console.log(`Timing check: current=${currentTime.toISOString()}, deadline=${deadlineTime.toISOString()}, past_deadline=${secondsPastDeadline}s`)

    const timingInfo = {
      current_time: currentTime.toISOString(),
      deadline_time: deadlineTime.toISOString(),
      seconds_past_deadline: secondsPastDeadline
    }

    // 4. Since epochs are now minute-aligned, timing should be exact
    if (!timingValid) {
      console.log(`Timing not yet valid, skipping processing (${-secondsPastDeadline}s until deadline)`)
      console.log(`Note: This should not happen with minute-aligned epochs`)

      return new Response(
        JSON.stringify({
          triggered_by_cron: true,
          timing_valid: false,
          processing_executed: false,
          message: 'Deadline not yet reached - check epoch alignment',
          timing_info
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 5. Record cron trigger in system config
    await supabaseClient
      .from('system_config')
      .upsert({ key: 'cron_last_run', value: processingStartTime.toISOString() }, { onConflict: 'key' })

    // 6. Execute standard epoch processing
    const currentEpoch = parseInt(config.current_epoch || '0')
    console.log(`Executing epoch processing for epoch ${currentEpoch}`)

    const processingData = await callInternalFunction(
      supabaseUrl,
      serviceKey,
      'protocol-epochs-process',
      { current_epoch: currentEpoch }
    )

    console.log(`Epoch processing completed: ${processingData.processed_beliefs.length} processed, ${processingData.expired_beliefs.length} expired`)

    // 7. Update timing fields for next epoch and schedule next cron job
    const nextEpoch = processingData.next_epoch
    const durationSeconds = parseInt(config.epoch_duration_seconds || '3600')
    const nextEpochStart = new Date()
    const nextEpochDeadline = new Date(nextEpochStart.getTime() + (durationSeconds * 1000))

    // For precise timing, schedule cron job to run every minute during the deadline minute
    // Then the function will check if it's past the exact deadline time
    const nextCronJobId = `epoch-processor-${Date.now()}`
    const deadlineMinute = nextEpochDeadline.getMinutes()
    const deadlineHour = nextEpochDeadline.getHours()
    const deadlineDay = nextEpochDeadline.getDate()
    const deadlineMonth = nextEpochDeadline.getMonth() + 1

    // Schedule to run at the deadline minute (will check precise timing internally)
    const nextCronSchedule = `${deadlineMinute} ${deadlineHour} ${deadlineDay} ${deadlineMonth} *`

    console.log(`Scheduling next cron job: ${nextCronJobId} for ${nextEpochDeadline.toISOString()}`)
    console.log(`Next cron schedule: ${nextCronSchedule} (will validate precise timing internally)`)

    const { data: nextCronResult, error: nextCronError } = await supabaseClient.rpc('create_epoch_cron_job', {
      job_name: nextCronJobId,
      job_schedule: nextCronSchedule,
      function_url: `${supabaseUrl}/functions/v1/protocol-epochs-process-cron`
    })

    if (nextCronError) {
      console.error('Failed to schedule next cron job:', nextCronError)
    } else {
      console.log('Next cron job scheduled successfully:', nextCronResult)
    }

    const timingUpdates = [
      { key: 'current_epoch_start_time', value: nextEpochStart.toISOString() },
      { key: 'next_epoch_deadline', value: nextEpochDeadline.toISOString() },
      { key: 'cron_next_run', value: nextEpochDeadline.toISOString() },
      { key: 'cron_job_id', value: nextCronJobId }
    ]

    for (const update of timingUpdates) {
      await supabaseClient
        .from('system_config')
        .upsert(update, { onConflict: 'key' })
    }

    // 8. Record comprehensive history metrics
    const processingCompletedTime = new Date()
    const processingDurationMs = processingCompletedTime.getTime() - processingStartTime.getTime()

    // Update current epoch history with completion
    const { error: historyError } = await supabaseClient
      .from('epoch_history')
      .update({
        ended_at: processingCompletedTime.toISOString(),
        actual_duration_seconds: Math.floor((processingCompletedTime.getTime() - deadlineTime.getTime()) / 1000),
        processing_triggered_at: processingStartTime.toISOString(),
        processing_completed_at: processingCompletedTime.toISOString(),
        processing_duration_ms: processingDurationMs,
        beliefs_processed: processingData.processed_beliefs.length,
        beliefs_expired: processingData.expired_beliefs.length,
        cron_triggered: true,
        status: 'completed'
      })
      .eq('epoch_number', currentEpoch)
      .eq('status', 'active')

    if (historyError) {
      console.error('Failed to update epoch history:', historyError)
    }

    // Create new epoch history record
    const { error: newHistoryError } = await supabaseClient
      .from('epoch_history')
      .insert({
        epoch_number: nextEpoch,
        started_at: nextEpochStart.toISOString(),
        scheduled_duration_seconds: durationSeconds,
        cron_triggered: true,
        status: 'active'
      })

    if (newHistoryError) {
      console.error('Failed to create new epoch history:', newHistoryError)
    }

    console.log(`Cron processing completed successfully: epoch ${currentEpoch} → ${nextEpoch}, duration=${processingDurationMs}ms`)

    // 9. Return comprehensive processing summary
    const response: CronProcessingResponse = {
      triggered_by_cron: true,
      timing_valid: true,
      processing_executed: true,
      next_epoch: nextEpoch,
      processed_beliefs: processingData.processed_beliefs,
      expired_beliefs: processingData.expired_beliefs,
      errors: processingData.errors || [],
      timing_info
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Cron epoch processing error:', error)

    // Record error in history if possible
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const { data: epochData } = await supabaseClient
        .from('system_config')
        .select('value')
        .eq('key', 'current_epoch')
        .single()

      const currentEpoch = parseInt(epochData?.value || '0')

      await supabaseClient
        .from('epoch_history')
        .update({
          ended_at: new Date().toISOString(),
          processing_triggered_at: processingStartTime.toISOString(),
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: new Date().getTime() - processingStartTime.getTime(),
          cron_triggered: true,
          status: 'failed'
        })
        .eq('epoch_number', currentEpoch)
        .eq('status', 'active')

    } catch (historyError) {
      console.error('Failed to record error in history:', historyError)
    }

    return new Response(
      JSON.stringify({
        triggered_by_cron: true,
        timing_valid: true,
        processing_executed: false,
        error: 'Cron epoch processing failed',
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