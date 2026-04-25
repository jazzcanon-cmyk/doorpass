-- RLS 정책 마이그레이션
-- 적용 방법: Supabase Dashboard > SQL Editor 에서 실행하거나
--            supabase db push 명령으로 적용
--
-- 주의: 현재 API 라우트는 anon key를 사용하므로 아래 정책 적용 전
--       각 라우트가 supabase/ssr createServerClient (쿠키 기반 JWT)를
--       사용하도록 마이그레이션 필요. service_role 키를 쓰는 라우트는 RLS 우회.

-- =============================================
-- 1. buildings 테이블
-- =============================================
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자(approved_users에 is_active=true)만 조회 가능
CREATE POLICY "approved users can read buildings"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
    )
  );

-- 어드민만 등록 가능
CREATE POLICY "admin can insert buildings"
  ON buildings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
        AND role = 'admin'
    )
  );

-- 승인된 사용자 모두 수정 가능
CREATE POLICY "approved users can update buildings"
  ON buildings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
    )
  );

-- 어드민만 삭제 가능
CREATE POLICY "admin can delete buildings"
  ON buildings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
        AND role = 'admin'
    )
  );

-- =============================================
-- 2. posts 테이블
-- =============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자 모두 조회 가능
CREATE POLICY "approved users can read posts"
  ON posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
    )
  );

-- 승인된 사용자 모두 작성 가능
CREATE POLICY "approved users can insert posts"
  ON posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
    )
  );

-- 작성자 본인 또는 어드민만 수정 가능
CREATE POLICY "author or admin can update posts"
  ON posts FOR UPDATE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND role = 'admin'
    )
  );

-- 작성자 본인 또는 어드민만 삭제 가능
CREATE POLICY "author or admin can delete posts"
  ON posts FOR DELETE
  USING (
    author = (auth.jwt() -> 'user_metadata' ->> 'name')
    OR EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND role = 'admin'
    )
  );

-- =============================================
-- 3. comments 테이블
-- =============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자 모두 조회 가능
CREATE POLICY "approved users can read comments"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
    )
  );

-- 승인된 사용자 모두 작성 가능
CREATE POLICY "approved users can insert comments"
  ON comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND is_active = true
    )
  );

-- 어드민만 삭제 가능
CREATE POLICY "admin can delete comments"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM approved_users
      WHERE kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND role = 'admin'
    )
  );

-- =============================================
-- 4. approved_users 테이블
-- =============================================
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;

-- 본인 정보만 조회 가능
CREATE POLICY "users can read own record"
  ON approved_users FOR SELECT
  USING (
    kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
  );

-- 어드민은 모든 레코드 조회 가능
CREATE POLICY "admin can read all approved_users"
  ON approved_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND au.role = 'admin'
    )
  );

-- 어드민만 등록/수정/삭제 가능
CREATE POLICY "admin can manage approved_users"
  ON approved_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM approved_users au
      WHERE au.kakao_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
        AND au.role = 'admin'
    )
  );

-- =============================================
-- 5. calendar_memos 테이블
-- =============================================
ALTER TABLE calendar_memos ENABLE ROW LEVEL SECURITY;

-- 본인 메모만 접근 가능 (user_id 컬럼이 auth.uid()와 일치하는 경우)
CREATE POLICY "users can manage own calendar memos"
  ON calendar_memos FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
