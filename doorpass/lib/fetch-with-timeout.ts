/**
 * 외부 API 호출 timeout 래퍼.
 * AbortSignal.timeout은 만료 시 TimeoutError(name='TimeoutError')를 throw한다.
 * 호출자는 try/catch로 감싸서 fire-and-forget 정책을 유지할 것.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error(`[fetchWithTimeout] timeout after ${timeoutMs}ms: ${url}`)
    }
    throw error
  }
}
