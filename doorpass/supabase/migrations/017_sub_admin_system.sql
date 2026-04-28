-- 017_sub_admin_system.sql
-- 부관리자(sub_admin) 시스템 + 건물 region/uploaded_by 추적

-- buildings: 지역, 업로더 추적
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS region      TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

CREATE INDEX IF NOT EXISTS idx_buildings_region
  ON buildings(region);
CREATE INDEX IF NOT EXISTS idx_buildings_uploaded_by
  ON buildings(uploaded_by);

-- approved_users: 부관리자 담당 지역
ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS managed_region TEXT;

CREATE INDEX IF NOT EXISTS idx_approved_users_managed_region
  ON approved_users(managed_region);

-- 역할은 015 마이그레이션의 role 컬럼을 그대로 사용:
--   admin / sub_admin / editor / driver
