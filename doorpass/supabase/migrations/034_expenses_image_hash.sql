-- expenses 테이블에 image_hash 컬럼 추가 (SMS OCR 중복 방지용)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS image_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_image_hash
  ON expenses (user_id, image_hash)
  WHERE image_hash IS NOT NULL;
