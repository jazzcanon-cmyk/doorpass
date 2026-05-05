-- 차단 목록(blocklist): JWT로 매칭되는 approved_users 행이 있고 is_active=false일 때만 거부.
-- 그 외 인증된 사용자는 buildings/posts/comments 조회·일반 쓰기 가능.
-- 관리자 전용 작업은 여전히 role=admin 이고 is_active=true 인 경우만 허용.

-- buildings
DROP POLICY IF EXISTS "approved users can read buildings" ON buildings;
DROP POLICY IF EXISTS "admin can insert buildings" ON buildings;
DROP POLICY IF EXISTS "approved users can update buildings" ON buildings;
DROP POLICY IF EXISTS "admin can delete buildings" ON buildings;

CREATE POLICY "authenticated read buildings unless blocked"
  ON buildings FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = false
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
          OR (
            POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
            AND (
              LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
              OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
            )
          )
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

CREATE POLICY "authenticated update buildings unless blocked"
  ON buildings FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = false
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
          OR (
            POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
            AND (
              LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
              OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
            )
          )
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

CREATE POLICY "authenticated read posts unless blocked"
  ON posts FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = false
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
          OR (
            POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
            AND (
              LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
              OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
            )
          )
        )
    )
  );

CREATE POLICY "authenticated insert posts unless blocked"
  ON posts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = false
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
          OR (
            POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
            AND (
              LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
              OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
            )
          )
        )
    )
  );

CREATE POLICY "author or admin can update posts"
  ON posts FOR UPDATE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
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

CREATE POLICY "author or admin can delete posts"
  ON posts FOR DELETE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
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

-- comments
DROP POLICY IF EXISTS "approved users can read comments" ON comments;
DROP POLICY IF EXISTS "approved users can insert comments" ON comments;
DROP POLICY IF EXISTS "admin can delete comments" ON comments;

CREATE POLICY "authenticated read comments unless blocked"
  ON comments FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = false
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
          OR (
            POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
            AND (
              LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
              OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
            )
          )
        )
    )
  );

CREATE POLICY "authenticated insert comments unless blocked"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.is_active = false
        AND (
          au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
          OR au.kakao_id::text = NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() -> 'user_metadata' ->> 'email'))
          OR (au.email IS NOT NULL AND au.email = (auth.jwt() ->> 'email'))
          OR (
            POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
            AND (
              LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
              OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
            )
          )
        )
    )
  );

CREATE POLICY "admin can delete comments"
  ON comments FOR DELETE
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
