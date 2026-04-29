-- Extend existing user_activity_logs for richer activity tracking
-- NOTE: table already exists from earlier migrations (012/013)

ALTER TABLE IF EXISTS user_activity_logs
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- Additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_ual_page_url ON user_activity_logs(page_url);

-- Keep admin-readable policy for JWT-authenticated admins (optional with service_role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_logs'
      AND policyname = 'admins can view user activity logs'
  ) THEN
    CREATE POLICY "admins can view user activity logs"
      ON user_activity_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM approved_users
          WHERE email = auth.jwt() ->> 'email'
            AND role = 'admin'
        )
      );
  END IF;
END
$$;

COMMENT ON TABLE user_activity_logs IS '사용자 활동 추적 로그';
COMMENT ON COLUMN user_activity_logs.activity_type IS 'building_view, search, page_view, password_decrypt, login, logout';
COMMENT ON COLUMN user_activity_logs.activity_data IS 'JSON 형태의 상세 정보 (building_id, keyword 등)';
