-- JWT(카카오 provider_id / sub / 이메일)로 approved_users 한 행 조회 — SECURITY DEFINER로 RLS 우회
-- kakao_id 컬럼에 예전처럼 이메일을 넣은 행도 JWT 이메일과 매칭합니다.
-- 앱: supabase.rpc('resolve_approved_user_for_me')

CREATE OR REPLACE FUNCTION public.resolve_approved_user_for_me()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(au)::json
  FROM approved_users au
  WHERE (
    au.kakao_id::text = NULLIF(TRIM(auth.jwt() -> 'user_metadata' ->> 'provider_id'), '')
    OR au.kakao_id::text = NULLIF(TRIM(auth.jwt() -> 'user_metadata' ->> 'sub'), '')
    OR (
      au.email IS NOT NULL
      AND TRIM(au.email) <> ''
      AND LOWER(TRIM(au.email)) = LOWER(TRIM(COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'email',
        auth.jwt() ->> 'email',
        ''
      )))
    )
    OR (
      POSITION('@' IN COALESCE(TRIM(au.kakao_id::text), '')) > 0
      AND (
        LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'email', '')))
        OR LOWER(TRIM(au.kakao_id)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
      )
    )
  )
  ORDER BY au.id ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_approved_user_for_me() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_approved_user_for_me() TO authenticated;
