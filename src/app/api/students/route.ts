/**
 * GET /api/students - 학생 목록 조회
 * POST /api/students - 학생 등록
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearId = searchParams.get('year') || '2026';
    const branch = searchParams.get('branch');
    const search = searchParams.get('search');

    let sql = `
      SELECT
        s.student_id, s.year_id, s.branch_name, s.student_name,
        s.school_name, s.gender, s.phone, s.parent_phone,
        s.created_at, s.updated_at
      FROM students s
      WHERE s.year_id = ?
    `;
    const params: (string | number)[] = [yearId];

    if (branch) {
      sql += ` AND s.branch_name = ?`;
      params.push(branch);
    }

    if (search) {
      sql += ` AND s.student_name LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY s.branch_name, s.student_name`;

    const rows = await query(sql, params);

    return NextResponse.json({
      success: true,
      students: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Students API error:', error);
    return NextResponse.json(
      { error: '학생 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

interface CreateStudentRequest {
  year_id?: number;
  branch_name: string;
  student_name: string;
  school_name?: string;
  gender?: '남' | '여';
  phone?: string;
  parent_phone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateStudentRequest;
    const {
      year_id = 2026,
      branch_name,
      student_name,
      school_name,
      gender,
      phone,
      parent_phone,
    } = body;

    if (!branch_name || !student_name) {
      return NextResponse.json(
        { error: 'branch_name과 student_name이 필요합니다.' },
        { status: 400 }
      );
    }

    const conn = await getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO students (year_id, branch_name, student_name, school_name, gender, phone, parent_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [year_id, branch_name, student_name, school_name || null, gender || null, phone || null, parent_phone || null]
      );

      const insertId = (result as { insertId: number }).insertId;

      return NextResponse.json({
        success: true,
        student_id: insertId,
        message: '학생이 등록되었습니다.',
      });
    } finally {
      await conn.end();
    }
  } catch (error) {
    console.error('Create student API error:', error);
    return NextResponse.json(
      { error: '학생 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
