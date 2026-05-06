-- ============================================================================
-- 028_feedbacks.sql
-- 피드백 시스템 (의견 보내기 + 비밀번호 오류 신고)
--
-- ⚠️ 이 파일은 자동 실행되지 않습니다. Supabase SQL Editor에서 직접 실행하세요.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id            SERIAL PRIMARY KEY,
  user_email    TEXT NOT NULL,
  user_name     TEXT,
  category      TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('bug', 'feature', 'complaint', 'password_error', 'general')),
  building_id   INTEGER,
  building_name TEXT,
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reading', 'resolved', 'rejected')),
  admin_reply   TEXT,
  replied_at    TIMESTAMPTZ,
  replied_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 본인 이력 조회용
CREATE INDEX IF NOT EXISTS feedbacks_user_email_idx
  ON public.feedbacks (user_email, created_at DESC);

-- 관리자 목록(상태/분류 필터)용
CREATE INDEX IF NOT EXISTS feedbacks_status_created_idx
  ON public.feedbacks (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_category_created_idx
  ON public.feedbacks (category, created_at DESC);

-- 일일 제출 횟수 카운트 빠르게 (스팸 방지 5/일)
CREATE INDEX IF NOT EXISTS feedbacks_user_today_idx
  ON public.feedbacks (user_email, created_at);

-- 부관리자가 자기 대리점의 비밀번호 오류만 조회할 때 building_id 룩업
CREATE INDEX IF NOT EXISTS feedbacks_building_id_idx
  ON public.feedbacks (building_id)
  WHERE building_id IS NOT NULL;

-- RLS: API가 service_role(supabaseAdmin)을 사용하므로 활성화만
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
