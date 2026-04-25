-- resources 테이블 스키마를 코드 인터페이스에 맞게 수정
-- 문제: DB는 category/file_url/link_url 구조, 코드는 resource_type/url 구조로 불일치

ALTER TABLE resources
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS file_url,
  DROP COLUMN IF EXISTS link_url,
  DROP COLUMN IF EXISTS file_name,
  DROP COLUMN IF EXISTS file_size,
  DROP COLUMN IF EXISTS download_count;

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS url text;
