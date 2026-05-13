CREATE TABLE IF NOT EXISTS codef_connections (
  id bigserial PRIMARY KEY,
  user_id int8 NOT NULL REFERENCES approved_users(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  organization text NOT NULL,
  connected_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, service_type)
);
ALTER TABLE codef_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "서비스롤 전체접근" ON codef_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
