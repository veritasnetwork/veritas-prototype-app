-- Add min_new_submissions_for_rebase configuration
-- This controls how many new unique belief submissions are required before allowing a pool rebase

INSERT INTO system_config (key, value, description) VALUES
    ('min_new_submissions_for_rebase', '2', 'Minimum number of new unique belief submissions required since last settlement to allow rebase')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();
