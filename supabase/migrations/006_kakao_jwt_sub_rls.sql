-- 카카오: JWT의 user_metadata.provider_id 대신 sub에만 숫자 ID가 오는 경우가 있어
-- RLS가 본인 행(approved_users) 및 승인 EXISTS를 통과하지 못하던 문제를 수정합니다.
-- Supabase SQL Editor에서 실행하거나 supabase db push 로 적용하세요.

-- JWT에서 카카오 계정과 매칭할 식별자 (둘 중 비어 있지 않은 값과 kakao_id 비교)
-- buildings / posts / comments 의 approved_users EXISTS 절에 공통 사용

-- buildings
DROP POLICY IF EXISTS "approved users can read buildings" ON buildings;
DROP POLICY IF EXISTS "admin can insert buildings" ON buildings;
DROP POLICY IF EXISTS "approved users can update buildings" ON buildings;
DROP POLICY IF EXISTS "admin can delete buildings" ON buildings;

CREATE POLICY "approved users can read buildings"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "admin can insert buildings"
  ON buildings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true AND au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "approved users can update buildings"
  ON buildings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "admin can delete buildings"
  ON buildings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true AND au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

-- posts
DROP POLICY IF EXISTS "approved users can read posts" ON posts;
DROP POLICY IF EXISTS "approved users can insert posts" ON posts;
DROP POLICY IF EXISTS "author or admin can update posts" ON posts;
DROP POLICY IF EXISTS "author or admin can delete posts" ON posts;

CREATE POLICY "approved users can read posts"
  ON posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "approved users can insert posts"
  ON posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "author or admin can update posts"
  ON posts FOR UPDATE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "author or admin can delete posts"
  ON posts FOR DELETE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

-- comments
DROP POLICY IF EXISTS "approved users can read comments" ON comments;
DROP POLICY IF EXISTS "approved users can insert comments" ON comments;
DROP POLICY IF EXISTS "admin can delete comments" ON comments;

CREATE POLICY "approved users can read comments"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "approved users can insert comments"
  ON comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = true
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "admin can delete comments"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

-- approved_users (로그인 직후 본인 행 조회 + 관리자)
DROP POLICY IF EXISTS "users can read own record" ON approved_users;
DROP POLICY IF EXISTS "admin can read all approved_users" ON approved_users;
DROP POLICY IF EXISTS "admin can manage approved_users" ON approved_users;

CREATE POLICY "users can read own record"
  ON approved_users FOR SELECT
  USING (
    kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
    OR kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
    OR (email IS NOT NULL AND email = (auth.jwt() -> 'user_metadata' ->> 'email'))
    OR (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
  );

CREATE POLICY "admin can read all approved_users"
  ON approved_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );

CREATE POLICY "admin can manage approved_users"
  ON approved_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.role = 'admin'
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
        )
    )
  );
