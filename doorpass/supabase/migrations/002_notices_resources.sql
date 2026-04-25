-- notices 테이블 생성
CREATE TABLE IF NOT EXISTS notices (
  id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title       text        NOT NULL,
  content     text        NOT NULL,
  author      text        NOT NULL DEFAULT '관리자',
  is_important boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- resources 테이블 생성
CREATE TABLE IF NOT EXISTS resources (
  id            bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title         text        NOT NULL,
  description   text,
  resource_type text        NOT NULL DEFAULT 'link',
  url           text,
  author        text        NOT NULL DEFAULT '관리자',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- notices: 누구나 읽기, 쓰기, 삭제 가능 (anon key 사용 중이므로 RLS 비활성화)
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;

-- resources: 누구나 읽기, 쓰기, 삭제 가능 (anon key 사용 중이므로 RLS 비활성화)
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
