CREATE OR REPLACE FUNCTION add_user_points(
  p_email TEXT,
  p_action TEXT,
  p_points INT,
  p_building_id INT DEFAULT NULL,
  p_building_name TEXT DEFAULT NULL,
  p_daily_limit INT DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_total INT;
  v_new_total INT;
  v_prev_total INT;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_today_total
  FROM point_logs
  WHERE email = p_email
    AND created_at >= date_trunc('day', NOW());

  IF v_today_total >= p_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'reason', 'daily_limit');
  END IF;

  INSERT INTO point_logs (email, action, points, building_id, building_name)
  VALUES (p_email, p_action, p_points, p_building_id, p_building_name);

  INSERT INTO user_points (email, total_points, updated_at)
  VALUES (p_email, p_points, NOW())
  ON CONFLICT (email) DO UPDATE
  SET total_points = user_points.total_points + p_points,
      updated_at = NOW()
  RETURNING total_points INTO v_new_total;

  SELECT total_points - p_points INTO v_prev_total
  FROM user_points WHERE email = p_email;

  RETURN jsonb_build_object(
    'success', true,
    'points', p_points,
    'newTotal', v_new_total,
    'prevTotal', v_prev_total
  );
END;
$$;
