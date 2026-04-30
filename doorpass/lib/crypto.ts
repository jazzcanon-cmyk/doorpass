// lib/crypto.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const SECRET_KEY = process.env.ENCRYPTION_KEY! // 32글자 비밀 키

// 비밀번호 암호화 (저장할 때)
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

// 비밀번호 복호화 (화면에 보여줄 때)
export function decrypt(encryptedText: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString()
}

// 이미 암호화된 값인지 확인 (마이그레이션용)
export function isEncrypted(text: string): boolean {
  return text.includes(':') && text.split(':')[0].length === 32
}