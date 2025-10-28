-- Add min_new_submissions_for_rebase configuration if it doesn't exist
-- This config was referenced in 20251024000010 but never created

INSERT INTO system_config (key, value, description)
VALUES (
    'min_new_submissions_for_rebase',
    '4',
    'Minimum number of new unique belief submissions required since last settlement to allow rebase (increased from 2 to 4 for better data quality)'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;
