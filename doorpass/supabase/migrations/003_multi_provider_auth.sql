-- 멀티 프로바이더 인증 지원 마이그레이션
-- 카카오 + 구글 로그인 지원을 위해 approved_users 테이블 확장
-- Supabase Dashboard > SQL Editor 에서 실행하세요.

-- =============================================
-- 1. approved_users 테이블 컬럼 추가
-- =============================================

-- 이메일 컬럼 추가 (구글 로그인 식별자로 사용, 카카오도 이메일 지원)
ALTER TABLE approved_users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- 구글 ID 컬럼 추가
ALTER TABLE approved_users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- =============================================
-- 2. 기존 RLS 정책 삭제 후 재생성
-- (kakao_id OR email 양쪽 모두 지원)
-- =============================================

-- buildings 정책 재생성
DROP POLICY IF EXISTS "approved users can read buildings" ON buildings;
DROP POLICY IF EXISTS "admin can insert buildings" ON buildings;
DROP POLICY IF EXISTS "approved users can update buildings" ON buildings;
DROP POLICY IF EXISTS "admin can delete buildings" ON buildings;

CREATE POLICY "approved users can read buildings"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
    )
  );

CREATE POLICY "admin can insert buildings"
  ON buildings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
      AND role = 'admin'
    )
  );

CREATE POLICY "approved users can update buildings"
  ON buildings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
    )
  );

CREATE POLICY "admin can delete buildings"
  ON buildings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
      AND role = 'admin'
    )
  );

-- posts 정책 재생성
DROP POLICY IF EXISTS "approved users can read posts" ON posts;
DROP POLICY IF EXISTS "approved users can insert posts" ON posts;
DROP POLICY IF EXISTS "author or admin can update posts" ON posts;
DROP POLICY IF EXISTS "author or admin can delete posts" ON posts;

CREATE POLICY "approved users can read posts"
  ON posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
    )
  );

CREATE POLICY "approved users can insert posts"
  ON posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
    )
  );

CREATE POLICY "author or admin can update posts"
  ON posts FOR UPDATE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND role = 'admin'
    )
  );

CREATE POLICY "author or admin can delete posts"
  ON posts FOR DELETE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND role = 'admin'
    )
  );

-- comments 정책 재생성
DROP POLICY IF EXISTS "approved users can read comments" ON comments;
DROP POLICY IF EXISTS "approved users can insert comments" ON comments;
DROP POLICY IF EXISTS "admin can delete comments" ON comments;

CREATE POLICY "approved users can read comments"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
    )
  );

CREATE POLICY "approved users can insert comments"
  ON comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND is_active = true
    )
  );

CREATE POLICY "admin can delete comments"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE (
        kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND role = 'admin'
    )
  );

-- approved_users 정책 재생성
DROP POLICY IF EXISTS "users can read own record" ON approved_users;
DROP POLICY IF EXISTS "admin can read all approved_users" ON approved_users;
DROP POLICY IF EXISTS "admin can manage approved_users" ON approved_users;

CREATE POLICY "users can read own record"
  ON approved_users FOR SELECT
  USING (
    kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
    OR email = (auth.jwt() -> 'user_metadata' ->> 'email')
  );

CREATE POLICY "admin can read all approved_users"
  ON approved_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE (
        au.kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR au.email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND au.role = 'admin'
    )
  );

CREATE POLICY "admin can manage approved_users"
  ON approved_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE (
        au.kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        OR au.email = (auth.jwt() -> 'user_metadata' ->> 'email')
      )
      AND au.role = 'admin'
    )
  );
