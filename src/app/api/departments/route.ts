/**
 * GET /api/departments
 * 학과 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearId = searchParams.get('year') || '2026';
    const univId = searchParams.get('univ');
    const gun = searchParams.get('gun'); // 가, 나, 다

    let sql = `
      SELECT 
        d.dept_id, d.dept_name, d.모집군, d.모집인원, d.형태, d.교직, d.단계별,
        u.univ_id, u.univ_name,
        f.total_score, f.suneung_ratio, f.legacy_formula,
        f.display_config
      FROM departments d
      JOIN universities u ON d.univ_id = u.univ_id
      LEFT JOIN formula_configs f ON d.dept_id = f.dept_id
      WHERE d.year_id = ?
    `;
    const params: (string | number)[] = [yearId];

    if (univId) {
      sql += ` AND d.univ_id = ?`;
      params.push(univId);
    }

    if (gun) {
      sql += ` AND d.모집군 = ?`;
      params.push(gun);
    }

    sql += ` ORDER BY u.univ_name, d.dept_name`;

    const rows = await query(sql, params);

    // display_config JSON 파싱
    const departments = rows.map((row: Record<string, unknown>) => ({
      ...row,
      display_config: row.display_config 
        ? (typeof row.display_config === 'string' 
            ? JSON.parse(row.display_config) 
            : row.display_config)
        : null,
    }));

    return NextResponse.json({
      success: true,
      departments,
      count: departments.length,
    });
  } catch (error) {
    console.error('Departments API error:', error);
    return NextResponse.json(
      { error: '학과 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
