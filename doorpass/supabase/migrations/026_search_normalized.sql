-- 공백 제거 정규화 검색 함수
-- 검색어와 주소/이름 양쪽에서 공백을 제거한 뒤 ILIKE 매칭
CREATE OR REPLACE FUNCTION search_buildings_normalized(search_text text)
RETURNS TABLE (
  id                 int,
  name               text,
  address            text,
  password           text,
  password_encrypted text,
  lat                float8,
  lng                float8,
  memo               text,
  access_type        text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    id::int,
    name::text,
    address::text,
    password::text,
    password_encrypted::text,
    lat::float8,
    lng::float8,
    memo::text,
    access_type::text
  FROM buildings
  WHERE
    REPLACE(COALESCE(name,    ''), ' ', '') ILIKE '%' || REPLACE(search_text, ' ', '') || '%'
    OR
    REPLACE(COALESCE(address, ''), ' ', '') ILIKE '%' || REPLACE(search_text, ' ', '') || '%'
  ORDER BY address
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION search_buildings_normalized(text) TO anon, authenticated, service_role;
