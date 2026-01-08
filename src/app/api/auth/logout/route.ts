/**
 * POST /api/auth/logout
 * 로그아웃 API
 */

import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

    if (refreshToken) {
      const connection = await mysql.createConnection(dbConfig);

      try {
        // 세션 삭제
        await connection.execute(
          `DELETE FROM user_sessions WHERE refresh_token = ?`,
          [refreshToken]
        );
      } finally {
        await connection.end();
      }
    }

    return NextResponse.json({ success: true, message: '로그아웃되었습니다.' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
