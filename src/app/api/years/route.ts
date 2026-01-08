/**
 * GET /api/years
 * 연도 목록 조회
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query(`
      SELECT year_id, is_active, data_copied_from, created_at
      FROM year_configs
      ORDER BY year_id DESC
    `);

    return NextResponse.json({
      success: true,
      years: rows,
    });
  } catch (error) {
    console.error('Years API error:', error);
    return NextResponse.json(
      { error: '연도 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
