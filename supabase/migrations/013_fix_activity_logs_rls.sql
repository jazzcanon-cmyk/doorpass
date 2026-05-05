-- RLS 정책 수정: anon key 폴백 시에도 INSERT 가능하도록
-- (읽기는 여전히 service_role만 허용)

DROP POLICY IF EXISTS "service_role_all_user_activity_logs" ON user_activity_logs;

-- INSERT: 모든 role 허용 (서버 사이드 API 라우트에서만 호출됨)
CREATE POLICY "allow_insert_activity_logs"
  ON user_activity_logs FOR INSERT
  WITH CHECK (true);

-- SELECT: service_role만 허용 (관리자 전용)
CREATE POLICY "service_role_select_activity_logs"
  ON user_activity_logs FOR SELECT
  USING (auth.role() = 'service_role');

-- DELETE/UPDATE: service_role만 허용
CREATE POLICY "service_role_modify_activity_logs"
  ON user_activity_logs FOR DELETE
  USING (auth.role() = 'service_role');
