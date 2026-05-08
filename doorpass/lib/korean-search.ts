const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const

const NOISE_PATTERN = /[\s\-_.()\[\]]/g

export function extractChosung(text: string): string {
  if (!text) return ""
  let result = ""
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00
      const idx = Math.floor(offset / 588)
      result += CHOSUNG[idx]
    } else if (code >= 0x3131 && code <= 0x314e) {
      result += char
    } else {
      result += char
    }
  }
  return result
}

export function isChosungOnly(query: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(query.trim())
}

export function normalizeForSearch(text: string): string {
  if (!text) return ""
  return text.toLowerCase().replace(NOISE_PATTERN, "")
}

export function buildSearchChosung(name: string | null | undefined, address: string | null | undefined): string {
  const combined = `${name ?? ""} ${address ?? ""}`.trim()
  if (!combined) return ""
  return extractChosung(combined).replace(NOISE_PATTERN, "")
}
