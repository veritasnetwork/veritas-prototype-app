-- Setup for Supabase Remote Cron Deployment
-- This migration ensures proper configuration for pg_cron on Supabase hosted platform

-- Enable required extensions for remote HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions for cron jobs to make HTTP requests
-- Note: On Supabase, these permissions are typically handled automatically

-- Create a function to validate cron environment
CREATE OR REPLACE FUNCTION validate_cron_environment()
RETURNS TABLE (
  extension_name TEXT,
  is_available BOOLEAN,
  version TEXT
) AS $$
BEGIN
  -- Check pg_cron
  RETURN QUERY
  SELECT
    'pg_cron'::TEXT,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'),
    COALESCE((SELECT extversion FROM pg_extension WHERE extname = 'pg_cron'), 'not installed')::TEXT;

  -- Check pg_net
  RETURN QUERY
  SELECT
    'pg_net'::TEXT,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net'),
    COALESCE((SELECT extversion FROM pg_extension WHERE extname = 'pg_net'), 'not installed')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add environment configuration for remote deployment
INSERT INTO system_config (key, value) VALUES
  ('deployment_environment', 'supabase'),
  ('cron_max_concurrent_jobs', '8'),
  ('cron_max_job_duration_minutes', '10')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Create a function to get the proper function URL for the current environment
CREATE OR REPLACE FUNCTION get_function_url(function_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
  deployment_env TEXT;
BEGIN
  -- Get the deployment environment
  SELECT value INTO deployment_env
  FROM system_config
  WHERE key = 'deployment_environment';

  -- For Supabase remote, the URL will be set via environment variable
  -- For local development, use localhost
  IF deployment_env = 'supabase' THEN
    -- On Supabase remote, SUPABASE_URL env var contains the project URL
    base_url := current_setting('app.supabase_url', true);
    IF base_url IS NULL OR base_url = '' THEN
      -- Fallback: construct from project reference if available
      base_url := 'https://' || current_setting('app.project_ref', true) || '.supabase.co';
    END IF;
  ELSE
    -- Local development
    base_url := 'http://127.0.0.1:54321';
  END IF;

  RETURN base_url || '/functions/v1/' || function_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the cron job creation function to use environment-aware URLs
CREATE OR REPLACE FUNCTION create_epoch_cron_job_v2(
  job_name TEXT,
  job_schedule TEXT,
  function_name TEXT DEFAULT 'protocol-epochs-process-cron'
) RETURNS TEXT AS $$
DECLARE
  service_role_key TEXT;
  job_id BIGINT;
  function_url TEXT;
BEGIN
  -- Get the proper function URL for current environment
  SELECT get_function_url(function_name) INTO function_url;

  -- Get service role key from environment
  SELECT current_setting('app.service_role_key', true) INTO service_role_key;

  -- Create the cron job
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

    RAISE NOTICE 'Created cron job: % (ID: %) calling %', job_name, job_id, function_url;
    RETURN format('Job created successfully: %s (ID: %s) -> %s', job_name, job_id, function_url);

  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create cron job %: %', job_name, SQLERRM;
      RETURN format('Failed to create job %s: %s', job_name, SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;