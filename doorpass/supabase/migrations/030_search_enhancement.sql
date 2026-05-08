-- ============================================================================
-- 030_search_enhancement.sql
-- 건물 검색 강화: pg_trgm 유사도, search_normalized/search_chosung 컬럼,
-- 자동 동기화 트리거, search_buildings_fuzzy RPC
--
-- ⚠️ 이 파일은 자동 실행되지 않습니다. Supabase SQL Editor에서 직접 실행하세요.
--
-- 후속 작업:
--   1. 본 파일 실행
--   2. 기존 데이터의 search_chosung 컬럼은 NULL이므로,
--      앱에서 일괄 backfill 스크립트 실행 필요 (별도 작업)
-- ============================================================================

-- 1. pg_trgm 확장 (오타 허용용 trigram 유사도)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 검색 컬럼 추가 (멱등)
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS search_normalized TEXT,
  ADD COLUMN IF NOT EXISTS search_chosung    TEXT;

-- 3. 기존 데이터 backfill: search_normalized
--    name + address 결합 후 공백/특수문자 제거 + 소문자
UPDATE public.buildings
SET search_normalized = LOWER(REGEXP_REPLACE(
      COALESCE(name, '') || ' ' || COALESCE(address, ''),
      '[[:space:]\-_.()\[\]]', '', 'g'
    ))
WHERE search_normalized IS NULL;

-- 4. 인덱스
--    trigram GIN: 부분 매칭 + 유사도 검색 가속
CREATE INDEX IF NOT EXISTS idx_buildings_search_normalized_trgm
  ON public.buildings
  USING gin (search_normalized gin_trgm_ops);

--    chosung BTREE: 초성 prefix 매칭
CREATE INDEX IF NOT EXISTS idx_buildings_search_chosung
  ON public.buildings (search_chosung text_pattern_ops);

-- 5. INSERT/UPDATE 시 search_normalized 자동 동기화 트리거
--    (search_chosung은 한글 음절 분해가 PG 표준에 없으므로 앱 레벨에서 채움)
CREATE OR REPLACE FUNCTION public.update_search_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_normalized := LOWER(REGEXP_REPLACE(
    COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.address, ''),
    '[[:space:]\-_.()\[\]]', '', 'g'
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_search_normalized ON public.buildings;
CREATE TRIGGER trg_update_search_normalized
  BEFORE INSERT OR UPDATE OF name, address ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_search_normalized();

-- 6. 유사도 검색 RPC
--    - 정확 prefix 매칭 → 부분 매칭 → trigram 유사도 순으로 정렬
--    - search_term은 호출 측에서 normalizeForSearch 처리한 값 전달
CREATE OR REPLACE FUNCTION public.search_buildings_fuzzy(
  search_term           TEXT,
  similarity_threshold  REAL DEFAULT 0.3,
  max_results           INT  DEFAULT 50
)
RETURNS TABLE (
  id                 INT,
  name               TEXT,
  address            TEXT,
  password           TEXT,
  password_encrypted TEXT,
  lat                FLOAT8,
  lng                FLOAT8,
  memo               TEXT,
  access_type        TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    b.id::INT,
    b.name::TEXT,
    b.address::TEXT,
    b.password::TEXT,
    b.password_encrypted::TEXT,
    b.lat::FLOAT8,
    b.lng::FLOAT8,
    b.memo::TEXT,
    b.access_type::TEXT
  FROM public.buildings b
  WHERE
    b.search_normalized ILIKE '%' || search_term || '%'
    OR similarity(b.search_normalized, search_term) > similarity_threshold
  ORDER BY
    (b.search_normalized ILIKE search_term || '%') DESC,
    (b.search_normalized ILIKE '%' || search_term || '%') DESC,
    similarity(b.search_normalized, search_term) DESC,
    b.address ASC
  LIMIT max_results;
$$;

-- 7. 초성 검색 RPC
--    chosung은 앱에서 채워두므로, 초성 패턴 ILIKE 매칭만 수행
CREATE OR REPLACE FUNCTION public.search_buildings_chosung(
  chosung_query  TEXT,
  max_results    INT DEFAULT 50
)
RETURNS TABLE (
  id                 INT,
  name               TEXT,
  address            TEXT,
  password           TEXT,
  password_encrypted TEXT,
  lat                FLOAT8,
  lng                FLOAT8,
  memo               TEXT,
  access_type        TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    b.id::INT,
    b.name::TEXT,
    b.address::TEXT,
    b.password::TEXT,
    b.password_encrypted::TEXT,
    b.lat::FLOAT8,
    b.lng::FLOAT8,
    b.memo::TEXT,
    b.access_type::TEXT
  FROM public.buildings b
  WHERE b.search_chosung ILIKE '%' || chosung_query || '%'
  ORDER BY
    (b.search_chosung ILIKE chosung_query || '%') DESC,
    b.address ASC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.search_buildings_fuzzy(TEXT, REAL, INT)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_buildings_chosung(TEXT, INT)
  TO anon, authenticated, service_role;
