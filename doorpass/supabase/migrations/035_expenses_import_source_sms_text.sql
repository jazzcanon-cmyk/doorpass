-- expenses.import_source check constraint에 'sms_text' 허용값 추가
-- 카드문자 텍스트 붙여넣기 방식 지원 (이미지 캡처 방식 sms_ocr은 하위 호환 유지)

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_import_source_check;

ALTER TABLE expenses
ADD CONSTRAINT expenses_import_source_check
CHECK (import_source IN ('ocr', 'manual', 'statement', 'sms_ocr', 'sms_text'));
