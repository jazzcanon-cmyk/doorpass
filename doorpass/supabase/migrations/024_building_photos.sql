CREATE TABLE IF NOT EXISTS building_photos (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT REFERENCES buildings(id) ON DELETE CASCADE,
  uploader_email TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT DEFAULT 'entrance',
  caption TEXT,
  is_active BOOLEAN DEFAULT true,
  report_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE building_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 읽기" ON building_photos
FOR SELECT USING (is_active = true);

CREATE POLICY "승인된 사용자만 업로드" ON building_photos
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "본인 사진만 삭제" ON building_photos
FOR DELETE TO authenticated
USING (uploader_email = auth.jwt()->>'email');

CREATE INDEX IF NOT EXISTS idx_building_photos_building_id
ON building_photos(building_id);
