-- resources 수정 이력용 updated_at 컬럼
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

