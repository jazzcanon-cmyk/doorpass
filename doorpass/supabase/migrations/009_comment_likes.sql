-- 댓글 좋아요 기능 추가

-- 1. comments 테이블에 like_count 컬럼 추가
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- 2. comment_likes 테이블 신규 생성
CREATE TABLE IF NOT EXISTS comment_likes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id integer     NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

-- 3. RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read comment_likes"
  ON comment_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated insert comment_likes"
  ON comment_likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "owner delete comment_likes"
  ON comment_likes FOR DELETE
  USING (user_id = auth.uid()::text);
