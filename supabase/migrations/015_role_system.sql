-- 015_role_system.sql
-- 역할 기반 권한 시스템 (admin / editor / driver) + 권한 요청 테이블

-- approved_users.role 컬럼 보강 (이미 있는 환경에서도 안전)
ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'driver';

-- 역할 종류
--   admin  : 모든 권한
--   editor : 건물 정보 수정/삭제 가능 (신뢰 사용자)
--   driver : 조회만 가능 (일반 사용자)

CREATE INDEX IF NOT EXISTS idx_approved_users_role
  ON approved_users(role);

-- 운영 시드: 초기 admin 지정
UPDATE approved_users
   SET role = 'admin'
 WHERE email = 'jazzcanon@gmail.com'
   AND (role IS NULL OR role <> 'admin');

-- 권한 요청 테이블
CREATE TABLE IF NOT EXISTS role_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email      TEXT NOT NULL,
  user_name       TEXT,
  requested_role  TEXT DEFAULT 'editor',
  reason          TEXT,
  status          TEXT DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_by     TEXT,                    -- 처리한 관리자 이메일
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_requests_user_email
  ON role_requests(user_email);
CREATE INDEX IF NOT EXISTS idx_role_requests_status
  ON role_requests(status);

-- RLS: 사용자는 자기 요청만 조회/생성, 관리자는 전체 조회
ALTER TABLE role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own role_requests"   ON role_requests;
DROP POLICY IF EXISTS "users can insert own role_requests" ON role_requests;
DROP POLICY IF EXISTS "admins can view all role_requests"  ON role_requests;

CREATE POLICY "users can view own role_requests"
  ON role_requests FOR SELECT
  USING (auth.email() = user_email);

CREATE POLICY "users can insert own role_requests"
  ON role_requests FOR INSERT
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "admins can view all role_requests"
  ON role_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE email = auth.email()
        AND role = 'admin'
    )
  );
