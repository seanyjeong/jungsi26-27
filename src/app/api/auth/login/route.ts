/**
 * POST /api/auth/login
 * 로그인 API
 */

import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import {
  verifyPassword,
  generateTokenPair,
  getRefreshTokenExpiry,
  type UserPayload,
} from '@/lib/auth';
import { dbConfig } from '@/lib/db';

interface LoginRequest {
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    // 입력 검증
    if (!username || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // DB 연결
    const connection = await mysql.createConnection(dbConfig);

    try {
      // 사용자 조회
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT u.user_id, u.username, u.password_hash, u.name, u.role, u.status,
                u.branch_id, b.branch_name
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.branch_id
         WHERE u.username = ?`,
        [username]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
          { status: 401 }
        );
      }

      const user = rows[0];

      // 상태 확인
      if (user.status === 'pending') {
        return NextResponse.json(
          { error: '승인 대기 중인 계정입니다.' },
          { status: 403 }
        );
      }

      if (user.status === 'blocked') {
        return NextResponse.json(
          { error: '차단된 계정입니다.' },
          { status: 403 }
        );
      }

      // 비밀번호 검증
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
          { status: 401 }
        );
      }

      // 토큰 생성
      const payload: UserPayload = {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        branchId: user.branch_id,
        branchName: user.branch_name,
      };

      const tokens = generateTokenPair(payload);

      // Refresh Token DB 저장
      const expiry = getRefreshTokenExpiry();
      await connection.execute(
        `INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)`,
        [user.user_id, tokens.refreshToken, expiry]
      );

      // 마지막 로그인 시간 업데이트
      await connection.execute(
        `UPDATE users SET last_login = NOW() WHERE user_id = ?`,
        [user.user_id]
      );

      return NextResponse.json({
        success: true,
        user: {
          userId: user.user_id,
          username: user.username,
          name: user.name,
          role: user.role,
          branchId: user.branch_id,
          branchName: user.branch_name,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
