-- 0004: allow anonymous community reports.
-- BUILD-CONTRACT §7: POST /corrections and POST /suggest are anonymous + rate-limited
-- (reporter identity travels in the payload, not as an account). The v1.1 check-in
-- flow still records user_id when a session exists.

ALTER TABLE app.user_reports ALTER COLUMN user_id DROP NOT NULL;
