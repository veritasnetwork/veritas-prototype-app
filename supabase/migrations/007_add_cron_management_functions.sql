-- PostgreSQL functions for cron job management
-- Based on specs/edge-function-specs/03-epoch-cron-management.md

-- Function to create fallback polling job (runs every minute to check for overdue epochs)
CREATE OR REPLACE FUNCTION create_fallback_polling_job() RETURNS TEXT AS $$
DECLARE
  service_role_key TEXT;
  supabase_url TEXT;
BEGIN
  -- Get service role key and URL
  SELECT COALESCE(
    current_setting('app.service_role_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  ) INTO service_role_key;

  SELECT COALESCE(
    current_setting('app.supabase_url', true),
    'http://kong:8000'
  ) INTO supabase_url;

  BEGIN
    PERFORM cron.schedule(
      'epoch-fallback-poller',
      '*/1 * * * *', -- Every minute
      format('
        SELECT net.http_post(
          url := %L,
          headers := %L::jsonb,
          body := %L::jsonb
        );',
        supabase_url || '/functions/v1/protocol-epochs-check-overdue',
        jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key,
          'Content-Type', 'application/json'
        ),
        '{}'::jsonb
      )
    );

    RAISE NOTICE 'Created fallback polling job for epoch processing';
    RETURN 'Fallback polling job created successfully';

  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create fallback polling job: %', SQLERRM;
      RETURN format('Failed to create fallback polling job: %s', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create epoch processing cron job (Supabase compatible)
CREATE OR REPLACE FUNCTION create_epoch_cron_job(
  job_name TEXT,
  job_schedule TEXT,
  function_url TEXT
) RETURNS TEXT AS $$
DECLARE
  service_role_key TEXT;
  job_id BIGINT;
BEGIN
  -- Get service role key from environment or use local development default
  SELECT COALESCE(
    current_setting('app.service_role_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  ) INTO service_role_key;

  -- For Supabase, we need to construct the URL properly for remote deployment
  -- Use pg_net extension for HTTP requests in Supabase environment
  BEGIN
    SELECT cron.schedule(
      job_name,
      job_schedule,
      format('
        SELECT net.http_post(
          url := %L,
          headers := %L::jsonb,
          body := %L::jsonb
        );',
        function_url,
        jsonb_build_object(
          'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('app.service_role_key', true)),
          'Content-Type', 'application/json',
          'User-Agent', 'Supabase-Cron/1.0'
        ),
        '{}'::jsonb
      )
    ) INTO job_id;

    RAISE NOTICE 'Created Supabase cron job: % (ID: %) with schedule: %', job_name, job_id, job_schedule;
    RETURN format('Job created successfully: %s (ID: %s)', job_name, job_id);

  EXCEPTION
    WHEN OTHERS THEN
      -- For local development or environments without pg_cron
      RAISE NOTICE 'Failed to create cron job % (pg_cron/pg_net not available): %', job_name, SQLERRM;
      RETURN format('Failed to create job %s: %s', job_name, SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove epoch processing cron job
CREATE OR REPLACE FUNCTION remove_epoch_cron_job(
  job_name TEXT
) RETURNS void AS $$
BEGIN
  -- Use pg_cron to unschedule the job
  BEGIN
    PERFORM cron.unschedule(job_name);
    RAISE NOTICE 'Removed cron job: %', job_name;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail - job might not exist or pg_cron might not be available
      RAISE NOTICE 'Failed to remove cron job % (might not exist or pg_cron not available): %', job_name, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current epoch status for API endpoints
CREATE OR REPLACE FUNCTION get_epoch_status()
RETURNS TABLE (
  current_epoch INTEGER,
  epoch_start_time TIMESTAMP WITH TIME ZONE,
  time_remaining_seconds INTEGER,
  next_deadline TIMESTAMP WITH TIME ZONE,
  cron_status TEXT,
  processing_enabled BOOLEAN
) AS $$
DECLARE
  config_row RECORD;
  start_time TIMESTAMP WITH TIME ZONE;
  deadline TIMESTAMP WITH TIME ZONE;
  duration_sec INTEGER;
BEGIN
  -- Get all config values in one query
  SELECT
    MAX(CASE WHEN key = 'current_epoch' THEN value::INTEGER END) as curr_epoch,
    MAX(CASE WHEN key = 'current_epoch_start_time' THEN value::TIMESTAMP WITH TIME ZONE END) as start_tm,
    MAX(CASE WHEN key = 'next_epoch_deadline' THEN value::TIMESTAMP WITH TIME ZONE END) as deadline_tm,
    MAX(CASE WHEN key = 'epoch_duration_seconds' THEN value::INTEGER END) as duration,
    MAX(CASE WHEN key = 'cron_status' THEN value END) as cron_stat
  INTO config_row
  FROM system_config
  WHERE key IN (
    'current_epoch',
    'current_epoch_start_time',
    'next_epoch_deadline',
    'epoch_duration_seconds',
    'cron_status'
  );

  -- Calculate time remaining
  start_time := COALESCE(config_row.start_tm, NOW());
  deadline := COALESCE(config_row.deadline_tm, start_time + INTERVAL '1 hour');
  duration_sec := GREATEST(0, EXTRACT(EPOCH FROM (deadline - NOW()))::INTEGER);

  -- Return results
  current_epoch := COALESCE(config_row.curr_epoch, 0);
  epoch_start_time := start_time;
  time_remaining_seconds := duration_sec;
  next_deadline := deadline;
  cron_status := COALESCE(config_row.cron_stat, 'stopped');
  processing_enabled := true;  -- Processing is enabled when cron is running

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;