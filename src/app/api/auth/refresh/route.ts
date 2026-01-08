/**
 * POST /api/auth/refresh
 * Access Token 갱신 API
 */

import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import {
  verifyRefreshToken,
  generateAccessToken,
  type UserPayload,
} from '@/lib/auth';

const dbConfig = {
  socketPath: '/var/run/mysqld/mysqld.sock',
  user: 'paca',
  database: 'univjungsi',
  charset: 'utf8mb4',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token이 필요합니다.' },
        { status: 400 }
      );
    }

    // Refresh Token 검증
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 refresh token입니다.' },
        { status: 401 }
      );
    }

    const connection = await mysql.createConnection(dbConfig);

    try {
      // DB에서 세션 확인
      const [sessions] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT * FROM user_sessions
         WHERE user_id = ? AND refresh_token = ? AND expires_at > NOW()`,
        [decoded.userId, refreshToken]
      );

      if (sessions.length === 0) {
        return NextResponse.json(
          { error: '세션이 만료되었습니다. 다시 로그인해주세요.' },
          { status: 401 }
        );
      }

      // 사용자 정보 조회
      const [users] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT u.user_id, u.username, u.name, u.role, u.status,
                u.branch_id, b.branch_name
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.branch_id
         WHERE u.user_id = ? AND u.status = 'active'`,
        [decoded.userId]
      );

      if (users.length === 0) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없거나 비활성 상태입니다.' },
          { status: 401 }
        );
      }

      const user = users[0];

      // 새 Access Token 생성
      const payload: UserPayload = {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        branchId: user.branch_id,
        branchName: user.branch_name,
      };

      const accessToken = generateAccessToken(payload);

      return NextResponse.json({
        success: true,
        accessToken,
        expiresIn: 15 * 60,
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: '토큰 갱신 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
