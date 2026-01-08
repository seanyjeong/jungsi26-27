/**
 * GET /api/departments/[deptId]
 * 학과 상세 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deptId: string }> }
) {
  try {
    const { deptId } = await params;

    // 기본 정보
    const [dept] = await query(`
      SELECT 
        d.dept_id, d.dept_name, d.모집군, d.모집인원, d.형태, d.교직, d.단계별, d.year_id,
        u.univ_id, u.univ_name, u.region
      FROM departments d
      JOIN universities u ON d.univ_id = u.univ_id
      WHERE d.dept_id = ?
    `, [deptId]);

    if (!dept) {
      return NextResponse.json(
        { error: '학과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 계산식 설정
    const [formula] = await query(`
      SELECT 
        config_id, total_score, suneung_ratio,
        subjects_config, selection_rules, bonus_rules, special_mode,
        legacy_formula, legacy_uid,
        english_scores, history_scores,
        display_config, calculation_mode
      FROM formula_configs
      WHERE dept_id = ?
    `, [deptId]);

    // 실기 배점표
    const practicalScores = await query(`
      SELECT 종목명, 성별, 기록, 점수
      FROM practical_score_tables
      WHERE dept_id = ?
      ORDER BY 종목명, 성별, 점수 DESC
    `, [deptId]);

    // 탐구 변환표
    const inquiryConv = await query(`
      SELECT 계열, 백분위, 변환표준점수
      FROM inquiry_conv_tables
      WHERE dept_id = ?
      ORDER BY 계열, 백분위 DESC
    `, [deptId]);

    // 특수 실기 규칙
    const [practicalRule] = await query(`
      SELECT rule_type, rule_config
      FROM practical_calc_rules
      WHERE dept_id = ?
    `, [deptId]);

    // JSON 파싱
    const parseJson = (val: unknown) => {
      if (!val) return null;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };

    return NextResponse.json({
      success: true,
      department: {
        ...dept,
        formula: formula ? {
          ...formula,
          subjects_config: parseJson(formula.subjects_config),
          selection_rules: parseJson(formula.selection_rules),
          bonus_rules: parseJson(formula.bonus_rules),
          special_mode: parseJson(formula.special_mode),
          english_scores: parseJson(formula.english_scores),
          history_scores: parseJson(formula.history_scores),
          display_config: parseJson(formula.display_config),
        } : null,
        practical_scores: practicalScores,
        inquiry_conv: inquiryConv,
        practical_rule: practicalRule ? {
          rule_type: practicalRule.rule_type,
          rule_config: parseJson(practicalRule.rule_config),
        } : null,
      },
    });
  } catch (error) {
    console.error('Department detail API error:', error);
    return NextResponse.json(
      { error: '학과 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
