/**
 * JWT 인증 모듈
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 환경 변수 또는 기본값
const JWT_SECRET = process.env.JWT_SECRET || 'univjungsi-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'univjungsi-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';  // 15분
const REFRESH_TOKEN_EXPIRY = '7d';  // 7일

export interface UserPayload {
  userId: number;
  username: string;
  role: 'admin' | 'manager' | 'staff';
  branchId?: number;
  branchName?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // seconds
}

/**
 * Access Token 생성
 */
export function generateAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Refresh Token 생성
 */
export function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Access + Refresh Token 쌍 생성
 */
export function generateTokenPair(payload: UserPayload): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload.userId);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,  // 15분 (초)
  };
}

/**
 * Access Token 검증
 */
export function verifyAccessToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Refresh Token 검증
 */
export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Authorization 헤더에서 토큰 추출
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Refresh Token 만료 시간 계산 (DB 저장용)
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);  // 7일 후
  return expiry;
}
