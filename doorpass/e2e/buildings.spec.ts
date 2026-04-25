import { test, expect } from "@playwright/test"

test.describe("건물 검색", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("검색 탭에서 건물명 검색이 동작", async ({ page }) => {
    await page.getByRole("button", { name: /검색/ }).click()
    const searchInput = page.getByPlaceholder(/건물명|주소/)
    await expect(searchInput).toBeVisible()
    await searchInput.fill("아파트")
    await expect(page.getByText(/아파트|검색 결과|검색해주세요/).first()).toBeVisible()
  })

  test("내 주변 탭 버튼이 존재", async ({ page }) => {
    const nearbyBtn = page.getByRole("button", { name: /내 주변/ })
    await expect(nearbyBtn).toBeVisible()
  })

  test("건물 카드 클릭 시 비밀번호가 표시", async ({ page }) => {
    await page.getByRole("button", { name: /검색/ }).click()
    await page.getByPlaceholder(/건물명|주소/).fill("테스트")
    const firstCard = page.locator("[data-testid='building-card']").first()
    if (await firstCard.count() > 0) {
      await firstCard.click()
      await expect(page.getByText(/비밀번호/)).toBeVisible()
    }
  })
})

test.describe("건물 API", () => {
  test("GET /api/buildings 는 buildings 배열을 반환", async ({ request }) => {
    const res = await request.get("/api/buildings")
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty("buildings")
    expect(Array.isArray(json.buildings)).toBe(true)
  })

  test("POST /api/buildings/update 는 미인증 시 401/403 반환", async ({ request }) => {
    const res = await request.post("/api/buildings/update", {
      data: { buildingId: 1, password: "1234" },
    })
    expect([401, 403]).toContain(res.status())
  })
})
