-- ============================================================================
-- 027_point_exchanges.sql
-- GS 상품권 등 포인트 교환 시스템
--
-- ⚠️ 이 파일은 자동 실행되지 않습니다. Supabase SQL Editor에서 직접 실행하세요.
--
-- 이전 단순 스키마(email, points, status)에서 풀 스키마로 교체합니다.
-- 기존 데이터가 중요하면 먼저 백업하세요:
--   CREATE TABLE point_exchanges_legacy AS SELECT * FROM point_exchanges;
-- ============================================================================

-- 기존 테이블 제거 (스키마 호환 안 됨)
DROP TABLE IF EXISTS public.point_exchanges CASCADE;

-- 본 테이블
CREATE TABLE public.point_exchanges (
  id           SERIAL PRIMARY KEY,
  user_email   TEXT NOT NULL,
  user_name    TEXT,
  points_used  INTEGER NOT NULL DEFAULT 10000,
  reward_type  TEXT NOT NULL DEFAULT 'gs_gift_card_10000',
  reward_name  TEXT NOT NULL DEFAULT 'GS상품권 1만원',
  receive_method TEXT NOT NULL DEFAULT 'visit'  -- 'visit' | 'mobile'
    CHECK (receive_method IN ('visit', 'mobile')),
  status       TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'completed' | 'rejected'
    CHECK (status IN ('pending', 'completed', 'rejected')),
  admin_memo   TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by TEXT
);

CREATE INDEX point_exchanges_user_email_idx
  ON public.point_exchanges (user_email);
CREATE INDEX point_exchanges_status_requested_idx
  ON public.point_exchanges (status, requested_at DESC);

-- RLS: 서비스 키만 접근 (API 라우트가 supabaseAdmin 으로 처리)
ALTER TABLE public.point_exchanges ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RPC: request_point_exchange
-- 포인트 확인 + 차감 + 교환 행 생성 + point_logs 기록을 단일 트랜잭션 내에서 수행.
-- 같은 사용자에게 pending 상태가 있으면 거부.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_point_exchange(
  p_email   TEXT,
  p_name    TEXT,
  p_method  TEXT,
  p_points  INTEGER DEFAULT 10000,
  p_reward_type TEXT DEFAULT 'gs_gift_card_10000',
  p_reward_name TEXT DEFAULT 'GS상품권 1만원'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current   INTEGER;
  v_new_total INTEGER;
  v_pending   INTEGER;
  v_id        INTEGER;
BEGIN
  IF p_method NOT IN ('visit', 'mobile') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_method');
  END IF;

  -- 진행 중인 신청 있는지 (중복 방지)
  SELECT COUNT(*) INTO v_pending
  FROM public.point_exchanges
  WHERE user_email = p_email AND status = 'pending';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pending_exists');
  END IF;

  -- 잠금하며 현재 포인트 조회
  SELECT total_points INTO v_current
  FROM public.user_points
  WHERE email = p_email
  FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_points_row');
  END IF;

  IF v_current < p_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient',
      'current', v_current
    );
  END IF;

  v_new_total := v_current - p_points;

  UPDATE public.user_points
  SET total_points = v_new_total,
      updated_at   = NOW()
  WHERE email = p_email;

  INSERT INTO public.point_logs (email, action, points, building_name)
  VALUES (p_email, 'exchange', -p_points, p_reward_name);

  INSERT INTO public.point_exchanges (
    user_email, user_name, points_used,
    reward_type, reward_name, receive_method, status
  )
  VALUES (
    p_email, p_name, p_points,
    p_reward_type, p_reward_name, p_method, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'points_used', p_points,
    'remaining', v_new_total
  );
END;
$$;

-- ============================================================================
-- RPC: process_point_exchange
-- 관리자가 신청을 처리. approve → 'completed'.
-- reject → 'rejected' + 포인트 환불 + point_logs 환불 기록.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_point_exchange(
  p_id     INTEGER,
  p_action TEXT,        -- 'approve' | 'reject'
  p_admin  TEXT,
  p_memo   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email      TEXT;
  v_status     TEXT;
  v_points     INTEGER;
  v_reward     TEXT;
  v_new_total  INTEGER;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_action');
  END IF;

  SELECT user_email, status, points_used, reward_name
    INTO v_email, v_status, v_points, v_reward
  FROM public.point_exchanges
  WHERE id = p_id
  FOR UPDATE;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_processed');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.point_exchanges
    SET status       = 'completed',
        admin_memo   = COALESCE(p_memo, admin_memo),
        processed_at = NOW(),
        processed_by = p_admin
    WHERE id = p_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', p_id,
      'status', 'completed',
      'user_email', v_email
    );
  END IF;

  -- reject: 포인트 환불
  INSERT INTO public.user_points (email, total_points, updated_at)
  VALUES (v_email, v_points, NOW())
  ON CONFLICT (email) DO UPDATE
  SET total_points = user_points.total_points + v_points,
      updated_at   = NOW()
  RETURNING total_points INTO v_new_total;

  INSERT INTO public.point_logs (email, action, points, building_name)
  VALUES (v_email, 'exchange_refund', v_points, v_reward || ' (반려 환불)');

  UPDATE public.point_exchanges
  SET status       = 'rejected',
      admin_memo   = COALESCE(p_memo, admin_memo),
      processed_at = NOW(),
      processed_by = p_admin
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_id,
    'status', 'rejected',
    'user_email', v_email,
    'refunded', v_points,
    'new_total', v_new_total
  );
END;
$$;

-- ============================================================================
-- 권한: API는 service_role(=supabaseAdmin)을 사용하므로 별도 GRANT 불필요.
-- 클라이언트에서 직접 호출하려면 GRANT EXECUTE ... TO authenticated; 필요.
-- ============================================================================
