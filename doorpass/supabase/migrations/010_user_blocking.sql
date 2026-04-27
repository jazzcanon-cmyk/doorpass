-- 사용자 차단 기능 추가

ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS is_blocked   BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_by   TEXT;
