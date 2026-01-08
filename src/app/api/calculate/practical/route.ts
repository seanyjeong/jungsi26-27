/**
 * POST /api/calculate/practical
 * 실기 점수 계산
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  calculatePracticalScore,
  type PracticalFormulaData,
  type StudentPracticalData,
  type PracticalScoreRecord,
  type PracticalMode,
} from '@/lib/calculator';

interface CalculateRequest {
  dept_id: number;
  student_practical: StudentPracticalData;
  year_id?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CalculateRequest;
    const { dept_id, student_practical, year_id = 2026 } = body;

    if (!dept_id || !student_practical) {
      return NextResponse.json(
        { error: 'dept_id와 student_practical이 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 학과 실기 설정 조회
    const formulaRows = await query(`
      SELECT
        f.config_id, f.dept_id, f.legacy_uid,
        f.practical_mode, f.practical_total, f.practical_base_score, f.practical_fail_rule,
        f.practical_special_config
      FROM formula_configs f
      JOIN departments d ON f.dept_id = d.dept_id
      WHERE f.dept_id = ? AND d.year_id = ?
    `, [dept_id, year_id]);

    if (formulaRows.length === 0) {
      return NextResponse.json(
        { error: '해당 학과의 실기 설정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const row = formulaRows[0] as Record<string, unknown>;

    // 2. 실기 배점표 조회
    const scoreRows = await query(`
      SELECT 종목명, 성별, 기록, 점수 as 배점
      FROM practical_scores
      WHERE dept_id = ?
      ORDER BY 종목명, 성별, 점수 DESC
    `, [dept_id]);

    const practicalScores: PracticalScoreRecord[] = (scoreRows as Array<Record<string, unknown>>).map(s => ({
      종목명: s.종목명 as string,
      성별: s.성별 as '남' | '여' | '공통',
      기록: s.기록 as string | number,
      배점: s.배점 as string | number,
    }));

    // 3. 특수 규칙 조회
    const ruleRows = await query(`
      SELECT rule_type, rule_config
      FROM practical_calc_rules
      WHERE dept_id = ?
    `, [dept_id]);

    let specialConfig: Record<string, unknown> | undefined;
    if (ruleRows.length > 0) {
      const rule = ruleRows[0] as Record<string, unknown>;
      specialConfig = typeof rule.rule_config === 'string'
        ? JSON.parse(rule.rule_config)
        : rule.rule_config as Record<string, unknown>;
    }

    // 기존 practical_special_config도 확인
    if (!specialConfig && row.practical_special_config) {
      specialConfig = typeof row.practical_special_config === 'string'
        ? JSON.parse(row.practical_special_config)
        : row.practical_special_config as Record<string, unknown>;
    }

    // PracticalFormulaData 변환
    const formulaData: PracticalFormulaData = {
      U_ID: row.legacy_uid as number | undefined,
      dept_id: row.dept_id as number,
      실기모드: (row.practical_mode || 'basic') as PracticalMode,
      실기총점: Number(row.practical_total) || 0,
      기본점수: Number(row.practical_base_score) || 0,
      미달처리: (row.practical_fail_rule || '0점') as '0점' | '최하점',
      실기배점: practicalScores,
      실기특수설정: specialConfig,
    };

    // 4. 점수 계산
    const result = calculatePracticalScore(formulaData, student_practical);

    return NextResponse.json({
      success: true,
      result: {
        totalScore: result.totalScore,
        breakdown: result.breakdown,
      },
      calculationLog: result.calculationLog,
    });
  } catch (error) {
    console.error('Calculate practical API error:', error);
    return NextResponse.json(
      { error: '실기 점수 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
