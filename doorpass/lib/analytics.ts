// Fire-and-forget client-side analytics — never throws, never blocks the UI

async function track(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
      keepalive: true,
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[Analytics] track failed HTTP ${res.status}:`, text)
    } else {
      console.log(`[Analytics] tracked OK: ${type}`, data)
    }
  } catch (err) {
    console.error("[Analytics] fetch error:", err)
  }
}

export function trackSearch(query: string, results: number): void {
  if (query.trim().length < 2) return
  track("search", { query: query.trim(), results })
  console.log(`[Analytics] search: "${query}" (${results}건)`)
}

export function trackBuildingView(buildingId: string, buildingName: string): void {
  track("building_view", { buildingId, buildingName })
  console.log(`[Analytics] building_view: ${buildingName}`)
}

export function trackPostView(postId: number, postTitle: string): void {
  track("post_view", { postId, postTitle })
  console.log(`[Analytics] post_view: "${postTitle}"`)
}

export function trackButtonClick(buttonName: string): void {
  track("button_click", { buttonName })
  console.log(`[Analytics] click: ${buttonName}`)
}

export function trackPageView(pagePath: string): void {
  track("page_view", { pagePath })
  console.log(`[Analytics] page_view: ${pagePath}`)
}
