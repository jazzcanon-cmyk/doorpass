# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: buildings.spec.ts >> 건물 검색 >> 검색 탭에서 건물명 검색이 동작
- Location: e2e\buildings.spec.ts:15:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test"
  2  | 
  3  | test.describe("건물 검색", () => {
  4  |   test.beforeEach(async ({ page }) => {
> 5  |     await page.goto("/")
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  6  |     await Promise.race([
  7  |       page.waitForURL("**/login**", { timeout: 20000 }),
  8  |       page.getByRole("button", { name: /내 주변|검색|게시판/ }).first().waitFor({ state: "visible", timeout: 20000 }),
  9  |     ])
  10 |     if (page.url().includes("/login")) {
  11 |       test.skip(true, "로그인 세션이 필요합니다.")
  12 |     }
  13 |   })
  14 | 
  15 |   test("검색 탭에서 건물명 검색이 동작", async ({ page }) => {
  16 |     await page.getByRole("button", { name: /검색/ }).click()
  17 |     const searchInput = page.getByPlaceholder(/건물명|주소/)
  18 |     await expect(searchInput).toBeVisible()
  19 |     await searchInput.fill("아파트")
  20 |     await expect(page.getByText(/아파트|검색 결과|검색해주세요/).first()).toBeVisible()
  21 |   })
  22 | 
  23 |   test("내 주변 탭 버튼이 존재", async ({ page }) => {
  24 |     const nearbyBtn = page.getByRole("button", { name: /내 주변/ })
  25 |     await expect(nearbyBtn).toBeVisible()
  26 |   })
  27 | 
  28 |   test("건물 카드 클릭 시 비밀번호가 표시", async ({ page }) => {
  29 |     await page.getByRole("button", { name: /검색/ }).click()
  30 |     await page.getByPlaceholder(/건물명|주소/).fill("테스트")
  31 |     const firstCard = page.locator("[data-testid='building-card']").first()
  32 |     if (await firstCard.count() > 0) {
  33 |       await firstCard.click()
  34 |       await expect(page.getByText(/비밀번호/)).toBeVisible()
  35 |     }
  36 |   })
  37 | })
  38 | 
  39 | test.describe("건물 API", () => {
  40 |   test("GET /api/buildings 는 미인증 시에도 목록을 주고 비밀번호는 마스킹", async ({ request }) => {
  41 |     const res = await request.get("/api/buildings")
  42 |     expect(res.status()).toBe(200)
  43 |     const body = (await res.json()) as { buildings?: { password: string }[] }
  44 |     expect(Array.isArray(body.buildings)).toBeTruthy()
  45 |     if (body.buildings && body.buildings.length > 0) {
  46 |       for (const b of body.buildings.slice(0, 5)) {
  47 |         expect(b.password).toBe("●●●●")
  48 |       }
  49 |     }
  50 |   })
  51 | 
  52 |   test("POST /api/buildings/update 는 미인증 시 401/403 반환", async ({ request }) => {
  53 |     const res = await request.post("/api/buildings/update", {
  54 |       data: { buildingId: 1, password: "1234" },
  55 |     })
  56 |     expect([401, 403]).toContain(res.status())
  57 |   })
  58 | })
  59 | 
```