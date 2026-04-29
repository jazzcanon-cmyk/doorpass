-- Multi-branch system

-- 1) branches
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  manager_email TEXT,
  manager_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) seed branches
INSERT INTO branches (id, name, region, manager_email)
VALUES
  ('sinjeong', '신정대리점', '울산', 'jazzcanon@gmail.com'),
  ('samsan', '삼산대리점', '울산', NULL),
  ('namgu', '남구대리점', '울산', NULL),
  ('haeundae', '해운대대리점', '부산', NULL),
  ('seomyeon', '서면대리점', '부산', NULL),
  ('suseong', '수성대리점', '대구', NULL)
ON CONFLICT (id) DO NOTHING;

-- 3) approved_users extensions
ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;

-- 4) buildings extension
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);

-- 5) backfill legacy rows
UPDATE approved_users
SET branch_id = 'sinjeong'
WHERE branch_id IS NULL;

UPDATE buildings
SET branch_id = 'sinjeong'
WHERE branch_id IS NULL;

-- 6) indexes
CREATE INDEX IF NOT EXISTS idx_approved_users_branch ON approved_users(branch_id);
CREATE INDEX IF NOT EXISTS idx_buildings_branch ON buildings(branch_id);
CREATE INDEX IF NOT EXISTS idx_branches_region ON branches(region);

-- 7) pending_approvals
CREATE TABLE IF NOT EXISTS pending_approvals (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT,
  selected_branch_id TEXT REFERENCES branches(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_branch ON pending_approvals(selected_branch_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);

-- 8) login_history
CREATE TABLE IF NOT EXISTS login_history (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(user_email);

-- 9) RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'branches' AND policyname = '누구나 대리점 조회 가능'
  ) THEN
    CREATE POLICY "누구나 대리점 조회 가능"
      ON branches FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pending_approvals' AND policyname = '본인 승인 요청 조회'
  ) THEN
    CREATE POLICY "본인 승인 요청 조회"
      ON pending_approvals FOR SELECT
      TO authenticated
      USING (user_email = auth.jwt() ->> 'email');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pending_approvals' AND policyname = '관리자는 승인 요청 조회 가능'
  ) THEN
    CREATE POLICY "관리자는 승인 요청 조회 가능"
      ON pending_approvals FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM approved_users
          WHERE email = auth.jwt() ->> 'email'
          AND (
            role = 'admin'
            OR (role = 'sub_admin' AND branch_id = pending_approvals.selected_branch_id)
          )
        )
      );
  END IF;
END
$$;

-- 10) comments
COMMENT ON TABLE branches IS '대리점 정보';
COMMENT ON TABLE pending_approvals IS '회원 승인 대기';
COMMENT ON TABLE login_history IS '로그인 기록';
