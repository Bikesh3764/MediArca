-- MediArca live Auth data repair
-- Root cause: manually seeded auth.users rows had NULL token fields.
-- Supabase Auth scans these fields as strings during password sign-in and returns
-- `Database error querying schema` when they are NULL.

WITH candidates AS (
    SELECT id
    FROM auth.users
    WHERE confirmation_token IS NULL
       OR email_change IS NULL
       OR email_change_token_new IS NULL
       OR recovery_token IS NULL
    LIMIT 1000
)
UPDATE auth.users AS u
SET confirmation_token = COALESCE(u.confirmation_token, ''),
    email_change = COALESCE(u.email_change, ''),
    email_change_token_new = COALESCE(u.email_change_token_new, ''),
    recovery_token = COALESCE(u.recovery_token, '')
FROM candidates AS c
WHERE u.id = c.id
RETURNING u.id, u.email;
