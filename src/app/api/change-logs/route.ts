/**
 * GET /api/change-logs
 * 변경 이력 조회 API
 * 
 * Query Parameters:
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 20, 최대: 100)
 * - table_name: 테이블명 필터 (예: formula_configs, practical_score_tables)
 * - action: 액션 필터 (INSERT, UPDATE, DELETE)
 * - changed_by: 변경자 필터
 * - from: 시작일 (YYYY-MM-DD)
 * - to: 종료일 (YYYY-MM-DD)
 * - dept_id: 학과 ID 필터 (record_id가 dept_id인 경우)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ChangeLog {
  log_id: number;
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: object | null;
  new_values: object | null;
  changed_by: string | null;
  changed_at: string;
}

interface CountResult {
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    
    const tableName = searchParams.get('table_name');
    const action = searchParams.get('action');
    const changedBy = searchParams.get('changed_by');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const deptId = searchParams.get('dept_id');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (tableName) {
      conditions.push('table_name = ?');
      params.push(tableName);
    }

    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }

    if (changedBy) {
      conditions.push('changed_by = ?');
      params.push(changedBy);
    }

    if (fromDate) {
      conditions.push('changed_at >= ?');
      params.push(`${fromDate} 00:00:00`);
    }

    if (toDate) {
      conditions.push('changed_at <= ?');
      params.push(`${toDate} 23:59:59`);
    }

    if (deptId) {
      conditions.push('record_id = ?');
      params.push(parseInt(deptId));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<(CountResult & import('mysql2').RowDataPacket)[]>(
      `SELECT COUNT(*) as total FROM change_logs ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    const logs = await query<(ChangeLog & import('mysql2').RowDataPacket)[]>(
      `SELECT log_id, table_name, record_id, action, old_values, new_values, changed_by, changed_at
       FROM change_logs
       ${whereClause}
       ORDER BY changed_at DESC, log_id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const deptIds = [...new Set(logs.map(log => log.record_id))];
    let deptMap: Map<number, { univ_name: string; dept_name: string }> = new Map();
    
    if (deptIds.length > 0) {
      const deptRows = await query<({ dept_id: number; univ_name: string; dept_name: string } & import('mysql2').RowDataPacket)[]>(
        `SELECT d.dept_id, u.univ_name, d.dept_name
         FROM departments d
         JOIN universities u ON d.univ_id = u.univ_id
         WHERE d.dept_id IN (${deptIds.map(() => '?').join(',')})`,
        deptIds
      );
      deptMap = new Map(deptRows.map(row => [row.dept_id, { univ_name: row.univ_name, dept_name: row.dept_name }]));
    }

    const data = logs.map(log => {
      const deptInfo = deptMap.get(log.record_id);
      return {
        log_id: log.log_id,
        table_name: log.table_name,
        record_id: log.record_id,
        action: log.action,
        old_values: log.old_values,
        new_values: log.new_values,
        changed_by: log.changed_by,
        changed_at: log.changed_at,
        dept_info: deptInfo || null,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });

  } catch (error) {
    console.error('Change logs API error:', error);
    return NextResponse.json(
      { error: '변경 이력 조회 중 오류가 발생했습니다.', details: String(error) },
      { status: 500 }
    );
  }
}
