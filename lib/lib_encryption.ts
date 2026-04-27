// lib/encryption.ts
// ============================================
// 비밀번호 암호화/복호화 유틸리티
// Node.js 내장 crypto 모듈 사용 (추가 설치 불필요)
// ============================================

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('❌ ENCRYPTION_SECRET_KEY가 설정되지 않았거나 너무 짧습니다. .env.local을 확인하세요.');
}

// 키를 버퍼로 변환 (정확히 32바이트)
const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);

/**
 * 비밀번호 암호화
 * @param password - 평문 비밀번호 (예: "1234")
 * @returns 암호화된 문자열
 */
export function encryptPassword(password: string): string {
  try {
    // IV(초기화 벡터) 생성 - 매번 다르게 (보안 강화)
    const iv = crypto.randomBytes(16);
    
    // AES-256-CBC로 암호화
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // IV + 암호화된 데이터를 함께 저장 (복호화 시 필요)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ 암호화 오류:', error);
    throw new Error('비밀번호 암호화에 실패했습니다.');
  }
}

/**
 * 비밀번호 복호화
 * @param encryptedData - 암호화된 문자열
 * @returns 평문 비밀번호 (예: "1234")
 */
export function decryptPassword(encryptedData: string): string {
  try {
    // IV와 암호화된 데이터 분리
    const [ivHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('잘못된 암호화 형식입니다.');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ 복호화 오류:', error);
    throw new Error('비밀번호 복호화에 실패했습니다.');
  }
}

/**
 * 비밀번호 유효성 확인 (암호화되었는지)
 * @param encryptedData - 검증할 문자열
 * @returns true/false
 */
export function isValidEncryptedPassword(encryptedData: string): boolean {
  try {
    const [ivHex, encryptedHex] = encryptedData.split(':');
    return !!(ivHex && encryptedHex && ivHex.length === 32 && encryptedHex.length > 0);
  } catch {
    return false;
  }
}

// 테스트용
if (process.env.NODE_ENV === 'development') {
  console.log('✅ 암호화 시스템 준비 완료');
  // const test = encryptPassword('1234');
  // console.log('암호화됨:', test);
  // console.log('복호화됨:', decryptPassword(test));
}
