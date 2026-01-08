/**
 * GET /api/universities
 * 대학 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearId = searchParams.get('year') || '2026';
    const region = searchParams.get('region');

    let sql = `
      SELECT DISTINCT u.univ_id, u.univ_name, u.short_name, u.region
      FROM universities u
      JOIN departments d ON u.univ_id = d.univ_id
      WHERE d.year_id = ?
    `;
    const params: (string | number)[] = [yearId];

    if (region) {
      sql += ` AND u.region = ?`;
      params.push(region);
    }

    sql += ` ORDER BY u.univ_name`;

    const rows = await query(sql, params);

    return NextResponse.json({
      success: true,
      universities: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Universities API error:', error);
    return NextResponse.json(
      { error: '대학 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
