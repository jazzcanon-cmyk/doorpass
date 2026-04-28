-- 사용자 활동 로그 테이블
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    text        NOT NULL,
  activity_type text        NOT NULL,
  activity_data jsonb       NOT NULL DEFAULT '{}',
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ual_email      ON user_activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_ual_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_type       ON user_activity_logs(activity_type);

-- service_role(supabaseAdmin)만 접근 허용
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_user_activity_logs"
  ON user_activity_logs FOR ALL
  USING (auth.role() = 'service_role');
