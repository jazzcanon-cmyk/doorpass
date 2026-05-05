import { test, expect } from "@playwright/test"

test.describe("인증 플로우", () => {
  test("미인증 시 루트는 로그인으로 리다이렉트", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })

  test("로그인 페이지에 카카오 로그인 버튼이 존재", async ({ page }) => {
    await page.goto("/login")
    const kakaoBtn = page.getByRole("button", { name: /카카오/ })
    await expect(kakaoBtn).toBeVisible()
  })

  test("어드민 페이지는 비로그인 접근 불가", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).not.toHaveURL("/admin")
  })
})
