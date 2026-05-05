-- approved_users에 kakao_id 컬럼 및 인덱스 추가
ALTER TABLE approved_users ADD COLUMN IF NOT EXISTS kakao_id TEXT;
CREATE INDEX IF NOT EXISTS idx_approved_users_kakao_id ON approved_users(kakao_id);
