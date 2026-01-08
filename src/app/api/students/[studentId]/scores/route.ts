/**
 * GET /api/students/[studentId]/scores - 학생 성적 조회
 * PUT /api/students/[studentId]/scores - 학생 성적 저장/수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const rows = await query(`
      SELECT
        score_id, student_id,
        국어_선택과목, 국어_표준점수, 국어_백분위, 국어_등급,
        수학_선택과목, 수학_표준점수, 수학_백분위, 수학_등급,
        영어_등급, 한국사_등급,
        탐구1_과목명, 탐구1_표준점수, 탐구1_백분위, 탐구1_등급,
        탐구2_과목명, 탐구2_표준점수, 탐구2_백분위, 탐구2_등급,
        practical_records,
        created_at, updated_at
      FROM student_scores
      WHERE student_id = ?
    `, [studentId]);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        scores: null,
        message: '등록된 성적이 없습니다.',
      });
    }

    const row = rows[0] as Record<string, unknown>;

    // practical_records JSON 파싱
    if (row.practical_records && typeof row.practical_records === 'string') {
      row.practical_records = JSON.parse(row.practical_records);
    }

    return NextResponse.json({
      success: true,
      scores: row,
    });
  } catch (error) {
    console.error('Get student scores API error:', error);
    return NextResponse.json(
      { error: '학생 성적 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

interface UpdateScoresRequest {
  국어_선택과목?: string;
  국어_표준점수?: number;
  국어_백분위?: number;
  국어_등급?: number;
  수학_선택과목?: string;
  수학_표준점수?: number;
  수학_백분위?: number;
  수학_등급?: number;
  영어_등급?: number;
  한국사_등급?: number;
  탐구1_과목명?: string;
  탐구1_표준점수?: number;
  탐구1_백분위?: number;
  탐구1_등급?: number;
  탐구2_과목명?: string;
  탐구2_표준점수?: number;
  탐구2_백분위?: number;
  탐구2_등급?: number;
  practical_records?: Record<string, unknown>[];
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    const body = (await request.json()) as UpdateScoresRequest;

    // 학생 존재 여부 확인
    const studentRows = await query(`SELECT student_id FROM students WHERE student_id = ?`, [studentId]);
    if (studentRows.length === 0) {
      return NextResponse.json(
        { error: '학생을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 기존 성적 확인
    const existingRows = await query(`SELECT score_id FROM student_scores WHERE student_id = ?`, [studentId]);
    const isUpdate = existingRows.length > 0;

    const conn = await getConnection();
    try {
      const practicalRecordsJson = body.practical_records
        ? JSON.stringify(body.practical_records)
        : null;

      if (isUpdate) {
        // UPDATE
        await conn.execute(`
          UPDATE student_scores SET
            국어_선택과목 = ?,
            국어_표준점수 = ?,
            국어_백분위 = ?,
            국어_등급 = ?,
            수학_선택과목 = ?,
            수학_표준점수 = ?,
            수학_백분위 = ?,
            수학_등급 = ?,
            영어_등급 = ?,
            한국사_등급 = ?,
            탐구1_과목명 = ?,
            탐구1_표준점수 = ?,
            탐구1_백분위 = ?,
            탐구1_등급 = ?,
            탐구2_과목명 = ?,
            탐구2_표준점수 = ?,
            탐구2_백분위 = ?,
            탐구2_등급 = ?,
            practical_records = ?
          WHERE student_id = ?
        `, [
          body.국어_선택과목 ?? null,
          body.국어_표준점수 ?? null,
          body.국어_백분위 ?? null,
          body.국어_등급 ?? null,
          body.수학_선택과목 ?? null,
          body.수학_표준점수 ?? null,
          body.수학_백분위 ?? null,
          body.수학_등급 ?? null,
          body.영어_등급 ?? null,
          body.한국사_등급 ?? null,
          body.탐구1_과목명 ?? null,
          body.탐구1_표준점수 ?? null,
          body.탐구1_백분위 ?? null,
          body.탐구1_등급 ?? null,
          body.탐구2_과목명 ?? null,
          body.탐구2_표준점수 ?? null,
          body.탐구2_백분위 ?? null,
          body.탐구2_등급 ?? null,
          practicalRecordsJson,
          studentId,
        ]);

        return NextResponse.json({
          success: true,
          message: '성적이 수정되었습니다.',
        });
      } else {
        // INSERT
        await conn.execute(`
          INSERT INTO student_scores (
            student_id,
            국어_선택과목, 국어_표준점수, 국어_백분위, 국어_등급,
            수학_선택과목, 수학_표준점수, 수학_백분위, 수학_등급,
            영어_등급, 한국사_등급,
            탐구1_과목명, 탐구1_표준점수, 탐구1_백분위, 탐구1_등급,
            탐구2_과목명, 탐구2_표준점수, 탐구2_백분위, 탐구2_등급,
            practical_records
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          studentId,
          body.국어_선택과목 ?? null,
          body.국어_표준점수 ?? null,
          body.국어_백분위 ?? null,
          body.국어_등급 ?? null,
          body.수학_선택과목 ?? null,
          body.수학_표준점수 ?? null,
          body.수학_백분위 ?? null,
          body.수학_등급 ?? null,
          body.영어_등급 ?? null,
          body.한국사_등급 ?? null,
          body.탐구1_과목명 ?? null,
          body.탐구1_표준점수 ?? null,
          body.탐구1_백분위 ?? null,
          body.탐구1_등급 ?? null,
          body.탐구2_과목명 ?? null,
          body.탐구2_표준점수 ?? null,
          body.탐구2_백분위 ?? null,
          body.탐구2_등급 ?? null,
          practicalRecordsJson,
        ]);

        return NextResponse.json({
          success: true,
          message: '성적이 등록되었습니다.',
        });
      }
    } finally {
      await conn.end();
    }
  } catch (error) {
    console.error('Update student scores API error:', error);
    return NextResponse.json(
      { error: '학생 성적 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
