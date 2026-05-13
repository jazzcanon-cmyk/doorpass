# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> 인증 플로우 >> 미인증 시 루트는 로그인으로 리다이렉트
- Location: e2e\auth.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
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
  3  | test.describe("인증 플로우", () => {
  4  |   test("미인증 시 루트는 로그인으로 리다이렉트", async ({ page }) => {
> 5  |     await page.goto("/")
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  6  |     await expect(page).toHaveURL(/\/login/)
  7  |   })
  8  | 
  9  |   test("로그인 페이지에 카카오 로그인 버튼이 존재", async ({ page }) => {
  10 |     await page.goto("/login")
  11 |     const kakaoBtn = page.getByRole("button", { name: /카카오/ })
  12 |     await expect(kakaoBtn).toBeVisible()
  13 |   })
  14 | 
  15 |   test("어드민 페이지는 비로그인 접근 불가", async ({ page }) => {
  16 |     await page.goto("/admin")
  17 |     await expect(page).not.toHaveURL("/admin")
  18 |   })
  19 | })
  20 | 
```