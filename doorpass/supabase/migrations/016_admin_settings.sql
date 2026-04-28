-- 016_admin_settings.sql
-- 관리자 알림 설정 저장 (key-value boolean)

CREATE TABLE IF NOT EXISTS admin_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   TEXT UNIQUE NOT NULL,
  setting_value BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_key
  ON admin_settings(setting_key);

INSERT INTO admin_settings (setting_key, setting_value)
VALUES
  ('new_user_notification',    true),
  ('card_notification',        true),
  ('comment_notification',     true),
  ('new_signup_notification',  true)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can view admin_settings"   ON admin_settings;
DROP POLICY IF EXISTS "admins can update admin_settings" ON admin_settings;

CREATE POLICY "admins can view admin_settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE email = auth.email()
        AND role = 'admin'
    )
  );

CREATE POLICY "admins can update admin_settings"
  ON admin_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE email = auth.email()
        AND role = 'admin'
    )
  );
