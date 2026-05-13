# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board.spec.ts >> 게시판 UI >> 게시판 탭 버튼이 존재
- Location: e2e\board.spec.ts:36:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test"
  2  | 
  3  | test.describe("게시판 API", () => {
  4  |   test("GET /api/posts 는 미인증 시 401/403 반환", async ({ request }) => {
  5  |     const res = await request.get("/api/posts")
  6  |     expect([401, 403]).toContain(res.status())
  7  |   })
  8  | 
  9  |   test("POST /api/posts 는 미인증 시 401/403 반환", async ({ request }) => {
  10 |     const res = await request.post("/api/posts", {
  11 |       data: { title: "테스트", content: "내용", author: "익명" },
  12 |     })
  13 |     expect([401, 403]).toContain(res.status())
  14 |   })
  15 | 
  16 |   test("POST /api/posts/:id/comments 는 미인증 시 401/403 반환", async ({ request }) => {
  17 |     const res = await request.post("/api/posts/1/comments", {
  18 |       data: { content: "댓글", author: "익명" },
  19 |     })
  20 |     expect([401, 403]).toContain(res.status())
  21 |   })
  22 | })
  23 | 
  24 | test.describe("게시판 UI", () => {
  25 |   test.beforeEach(async ({ page }) => {
> 26 |     await page.goto("/")
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  27 |     await Promise.race([
  28 |       page.waitForURL("**/login**", { timeout: 20000 }),
  29 |       page.getByRole("button", { name: /내 주변|검색|게시판/ }).first().waitFor({ state: "visible", timeout: 20000 }),
  30 |     ])
  31 |     if (page.url().includes("/login")) {
  32 |       test.skip(true, "로그인 세션이 필요합니다.")
  33 |     }
  34 |   })
  35 | 
  36 |   test("게시판 탭 버튼이 존재", async ({ page }) => {
  37 |     const boardBtn = page.getByRole("button", { name: /게시판/ })
  38 |     await expect(boardBtn).toBeVisible()
  39 |   })
  40 | 
  41 |   test("게시판 탭 클릭 시 글쓰기 버튼 표시", async ({ page }) => {
  42 |     await page.getByRole("button", { name: /게시판/ }).click()
  43 |     const writeBtn = page.getByRole("button", { name: /글쓰기/ })
  44 |     await expect(writeBtn).toBeVisible()
  45 |   })
  46 | })
  47 | 
```