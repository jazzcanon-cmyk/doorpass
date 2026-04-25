-- user_activities 테이블 생성 (없을 경우)
CREATE TABLE IF NOT EXISTS user_activities (
  id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  action_type text        NOT NULL,
  target_type text,
  target_id   text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS 비활성화: 익명 추적 허용 (notices/resources와 동일 방식)
ALTER TABLE user_activities DISABLE ROW LEVEL SECURITY;

-- popular_searches 뷰: 검색어별 횟수
CREATE OR REPLACE VIEW popular_searches AS
SELECT
  metadata->>'query' AS query,
  COUNT(*)::bigint   AS search_count
FROM user_activities
WHERE action_type = 'search'
  AND metadata->>'query' IS NOT NULL
GROUP BY metadata->>'query'
ORDER BY search_count DESC;

-- popular_buildings 뷰: 건물별 조회 횟수
CREATE OR REPLACE VIEW popular_buildings AS
SELECT
  metadata->>'buildingId'   AS building_id,
  metadata->>'buildingName' AS building_name,
  COUNT(*)::bigint          AS view_count
FROM user_activities
WHERE action_type = 'building_view'
  AND metadata->>'buildingId' IS NOT NULL
GROUP BY metadata->>'buildingId', metadata->>'buildingName'
ORDER BY view_count DESC;
