-- Update min_new_submissions_for_rebase to 2
UPDATE system_config
SET value = '2',
    description = 'Minimum number of new unique belief submissions required since last settlement to allow rebase'
WHERE key = 'min_new_submissions_for_rebase';