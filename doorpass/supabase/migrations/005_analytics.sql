-- user_activities 테이블 생성 (없을 경우)
CREATE TABLE IF NOT EXISTS user_activities (
  id            bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  activity_type text        NOT NULL,
  data          jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS 비활성화: 익명 추적 허용 (notices/resources와 동일 방식)
ALTER TABLE user_activities DISABLE ROW LEVEL SECURITY;

-- popular_searches 뷰: 검색어별 횟수
CREATE OR REPLACE VIEW popular_searches AS
SELECT
  data->>'query'   AS query,
  COUNT(*)::bigint AS search_count
FROM user_activities
WHERE activity_type = 'search'
  AND data->>'query' IS NOT NULL
GROUP BY data->>'query'
ORDER BY search_count DESC;

-- popular_buildings 뷰: 건물별 조회 횟수
CREATE OR REPLACE VIEW popular_buildings AS
SELECT
  data->>'buildingId'   AS building_id,
  data->>'buildingName' AS building_name,
  COUNT(*)::bigint      AS view_count
FROM user_activities
WHERE activity_type = 'building_view'
  AND data->>'buildingId' IS NOT NULL
GROUP BY data->>'buildingId', data->>'buildingName'
ORDER BY view_count DESC;
