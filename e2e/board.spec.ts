import { test, expect } from "@playwright/test"

test.describe("게시판 API", () => {
  test("GET /api/posts 는 미인증 시 401/403 반환", async ({ request }) => {
    const res = await request.get("/api/posts")
    expect([401, 403]).toContain(res.status())
  })

  test("POST /api/posts 는 미인증 시 401/403 반환", async ({ request }) => {
    const res = await request.post("/api/posts", {
      data: { title: "테스트", content: "내용", author: "익명" },
    })
    expect([401, 403]).toContain(res.status())
  })

  test("POST /api/posts/:id/comments 는 미인증 시 401/403 반환", async ({ request }) => {
    const res = await request.post("/api/posts/1/comments", {
      data: { content: "댓글", author: "익명" },
    })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe("게시판 UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await Promise.race([
      page.waitForURL("**/login**", { timeout: 20000 }),
      page.getByRole("button", { name: /내 주변|검색|게시판/ }).first().waitFor({ state: "visible", timeout: 20000 }),
    ])
    if (page.url().includes("/login")) {
      test.skip(true, "로그인 세션이 필요합니다.")
    }
  })

  test("게시판 탭 버튼이 존재", async ({ page }) => {
    const boardBtn = page.getByRole("button", { name: /게시판/ })
    await expect(boardBtn).toBeVisible()
  })

  test("게시판 탭 클릭 시 글쓰기 버튼 표시", async ({ page }) => {
    await page.getByRole("button", { name: /게시판/ }).click()
    const writeBtn = page.getByRole("button", { name: /글쓰기/ })
    await expect(writeBtn).toBeVisible()
  })
})
