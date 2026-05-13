import crypto from 'crypto'

const IS_DEMO = process.env.CODEF_USE_DEMO === 'true'
export const CODEF_API_BASE = IS_DEMO ? 'https://testapi.codef.io' : 'https://api.codef.io'
const CODEF_OAUTH_URL = 'https://oauth.codef.io'

export async function getCodefToken(): Promise<string> {
  const clientId = process.env.CODEF_CLIENT_ID!
  const clientSecret = process.env.CODEF_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${CODEF_OAUTH_URL}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=read',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`CODEF 토큰 발급 실패: ${res.status}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export function encryptRSA(plainText: string): string {
  const publicKeyBase64 = process.env.CODEF_PUBLIC_KEY!
  const pem = ['-----BEGIN PUBLIC KEY-----', publicKeyBase64.match(/.{1,64}/g)?.join('\n') ?? publicKeyBase64, '-----END PUBLIC KEY-----'].join('\n')
  const encrypted = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plainText, 'utf-8'))
  return encrypted.toString('base64')
}

export async function codefRequest<T = unknown>(path: string, body: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch(`${CODEF_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try { return JSON.parse(decodeURIComponent(text)) as T } catch { return JSON.parse(text) as T }
}

export const CARD_ORGS = [
  { code: '0301', name: 'KB국민카드', emoji: '🟡' },
  { code: '0309', name: '신한카드', emoji: '🔵' },
  { code: '0311', name: '삼성카드', emoji: '🔵' },
  { code: '0316', name: '현대카드', emoji: '⚫' },
  { code: '0318', name: '롯데카드', emoji: '🔴' },
  { code: '0307', name: '우리카드', emoji: '🔵' },
  { code: '0313', name: '하나카드', emoji: '🟢' },
  { code: '0324', name: 'NH농협카드', emoji: '🟢' },
  { code: '0325', name: '씨티카드', emoji: '🔵' },
] as const

export type CardOrgCode = typeof CARD_ORGS[number]['code']

export function guessCategory(text: string): string {
  const t = (text ?? '').toLowerCase()
  if (/주유|gs칼텍스|sk에너지|오일|oil|하이오일|알뜰주유/.test(t)) return '유류비'
  if (/정비|카센터|타이어|부품|자동차|오토바이|바이크/.test(t)) return '수리비'
  if (/식당|음식|카페|편의점|마트|치킨|피자|커피|햄버거|분식/.test(t)) return '식비'
  if (/통신|sk텔레콤|kt|lg유플러스|알뜰폰|인터넷/.test(t)) return '통신비'
  return '기타'
}

export function toYYYYMMDD(date: string): string { return date.replace(/-/g, '') }
export function fromYYYYMMDD(date: string): string { return `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` }
