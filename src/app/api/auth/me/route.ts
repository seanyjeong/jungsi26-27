/**
 * GET /api/auth/me
 * 현재 로그인 사용자 정보 조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { verifyAccessToken, extractBearerToken } from '@/lib/auth';

const dbConfig = {
  socketPath: '/var/run/mysqld/mysqld.sock',
  user: 'paca',
  database: 'univjungsi',
  charset: 'utf8mb4',
};

export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 토큰 검증
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // DB에서 최신 사용자 정보 조회
    const connection = await mysql.createConnection(dbConfig);

    try {
      const [users] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT u.user_id, u.username, u.name, u.role, u.status,
                u.branch_id, b.branch_name, u.phone, u.last_login
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.branch_id
         WHERE u.user_id = ?`,
        [payload.userId]
      );

      if (users.length === 0) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const user = users[0];

      return NextResponse.json({
        success: true,
        user: {
          userId: user.user_id,
          username: user.username,
          name: user.name,
          role: user.role,
          status: user.status,
          branchId: user.branch_id,
          branchName: user.branch_name,
          phone: user.phone,
          lastLogin: user.last_login,
        },
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
