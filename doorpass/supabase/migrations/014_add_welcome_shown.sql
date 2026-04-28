-- 신규 가입자 환영 팝업 표시 여부 컬럼 추가
ALTER TABLE approved_users
ADD COLUMN IF NOT EXISTS welcome_shown BOOLEAN DEFAULT false;
