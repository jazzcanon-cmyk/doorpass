-- ============================================
-- DOORPASS: 비밀번호 암호화 + 수정 이력 로깅
-- ============================================

-- 1. pgcrypto 확장 활성화 (암호화/복호화 함수)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 기존 buildings 테이블에 암호화 컬럼 추가
-- 주의: 기존 password 컬럼이 있다면 먼저 백업하세요!
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP DEFAULT NOW();

-- 3. 기존 평문 비밀번호를 암호화로 변환
-- (현재 데이터가 있다면 실행)
UPDATE buildings 
SET password_encrypted = pgp_sym_encrypt(
  password, 
  'your-secret-encryption-key-change-this'  -- ⚠️ 반드시 변경하세요!
)
WHERE password IS NOT NULL 
  AND password_encrypted IS NULL;

-- 4. 암호화가 완료되면 기존 평문 컬럼 삭제 (선택사항)
-- ALTER TABLE buildings DROP COLUMN password;

-- 5. 컬럼명 변경 (선택사항) - 더 깔끔함
-- ALTER TABLE buildings RENAME COLUMN password_encrypted TO password;
-- ALTER TABLE buildings RENAME COLUMN password_updated_at TO password_updated_at;

-- ============================================
-- 수정 이력 로깅 (감시)
-- ============================================

-- 6. 비밀번호 수정 이력 테이블
CREATE TABLE IF NOT EXISTS password_edit_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  editor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  editor_name TEXT,  -- 기사 이름 (사용자 삭제 시 기록만 남음)
  old_password_encrypted TEXT,  -- 변경 전
  new_password_encrypted TEXT,  -- 변경 후
  edited_at TIMESTAMP DEFAULT NOW(),
  editor_ip TEXT,
  change_reason TEXT,  -- 왜 바꿨는지 (선택)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. 인덱스 추가 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_password_history_building 
ON password_edit_history(building_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_history_editor 
ON password_edit_history(editor_id, edited_at DESC);

-- ============================================
-- 자동 로깅 트리거 (비밀번호 변경 시 자동 기록)
-- ============================================

-- 8. 트리거 함수 생성
CREATE OR REPLACE FUNCTION log_password_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 비밀번호가 실제로 변경되었을 때만 로깅
  IF OLD.password_encrypted IS DISTINCT FROM NEW.password_encrypted THEN
    INSERT INTO password_edit_history (
      building_id,
      editor_id,
      editor_name,
      old_password_encrypted,
      new_password_encrypted,
      editor_ip
    ) VALUES (
      NEW.id,
      auth.uid(),
      COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = auth.uid()), 'Unknown'),
      OLD.password_encrypted,
      NEW.password_encrypted,
      current_setting('app.client_ip', true)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 트리거 생성
DROP TRIGGER IF NOT EXISTS password_change_trigger ON buildings;
CREATE TRIGGER password_change_trigger
AFTER UPDATE OF password_encrypted ON buildings
FOR EACH ROW
EXECUTE FUNCTION log_password_change();

-- ============================================
-- 복호화 함수 (앱에서 사용)
-- ============================================

-- 10. 비밀번호 복호화 함수
CREATE OR REPLACE FUNCTION decrypt_password(encrypted_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    encrypted_text::bytea,
    'your-secret-encryption-key-change-this'  -- ⚠️ 동일한 키 사용!
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- RLS (행 수준 보안) - 선택사항
-- ============================================

-- 11. password_edit_history 테이블 RLS 활성화 (감사용)
ALTER TABLE password_edit_history ENABLE ROW LEVEL SECURITY;

-- 지점장(admin)만 이력 조회 가능
CREATE POLICY "Admins can view password history"
ON password_edit_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================
-- 확인 쿼리
-- ============================================
-- 암호화된 비밀번호 확인:
-- SELECT id, building_name, password_encrypted FROM buildings LIMIT 5;

-- 복호화해서 확인:
-- SELECT id, building_name, decrypt_password(password_encrypted) as password FROM buildings LIMIT 5;

-- 수정 이력 확인:
-- SELECT * FROM password_edit_history ORDER BY edited_at DESC LIMIT 10;
