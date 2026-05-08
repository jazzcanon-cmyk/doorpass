-- ============================================================================
-- 031_attendance_system.sql
-- 출석 체크 + 룰렛 보상 시스템
--
-- ⚠️ 이 파일은 자동 실행되지 않습니다. Supabase SQL Editor에서 직접 실행하세요.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id                BIGSERIAL PRIMARY KEY,
  user_email        TEXT NOT NULL,
  check_in_date     DATE NOT NULL,
  consecutive_days  INT  NOT NULL DEFAULT 1,
  reward_points     INT  NOT NULL,
  is_bonus_day      BOOLEAN NOT NULL DEFAULT FALSE,
  reward_type       TEXT NOT NULL
    CHECK (reward_type IN ('common', 'rare', 'epic', 'jackpot', 'bonus_7day', 'bonus_30day')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date
  ON public.attendance_logs (user_email, check_in_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_consecutive
  ON public.attendance_logs (user_email, consecutive_days DESC);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 인증 사용자는 자기 출석 기록을 읽을 수 있음
DROP POLICY IF EXISTS authenticated_read_own_attendance ON public.attendance_logs;
CREATE POLICY authenticated_read_own_attendance
  ON public.attendance_logs
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = user_email);

-- INSERT/UPDATE/DELETE는 service_role(supabaseAdmin)에서만 처리.
-- 별도 정책을 만들지 않으면 anon/authenticated 는 차단되므로 안전.
