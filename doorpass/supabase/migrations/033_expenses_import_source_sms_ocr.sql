-- expenses.import_source check constraint에 'sms_ocr' 허용값 추가
-- SMS 카드문자 OCR 기능 지원

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_import_source_check;

ALTER TABLE expenses
ADD CONSTRAINT expenses_import_source_check
CHECK (import_source IN ('ocr', 'manual', 'statement', 'sms_ocr'));
