-- 이메일 승인/거부 링크용 고유 토큰 (UUID)
ALTER TABLE pending_approvals
  ADD COLUMN IF NOT EXISTS token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_approvals_token_unique
  ON pending_approvals (token)
  WHERE token IS NOT NULL;

COMMENT ON COLUMN pending_approvals.token IS '이메일 버튼 링크용 UUID; pending일 때만 유효';
