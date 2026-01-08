/**
 * POST /api/calculate/suneung
 * 수능 점수 계산
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  calculateScoreWithConv,
  safeParse,
  type FormulaData,
  type StudentScores,
  type HighestScoreMap,
} from '@/lib/calculator';

interface CalculateRequest {
  dept_id: number;
  student_scores: StudentScores;
  year_id?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CalculateRequest;
    const { dept_id, student_scores, year_id = 2026 } = body;

    if (!dept_id || !student_scores) {
      return NextResponse.json(
        { error: 'dept_id와 student_scores가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 학과 공식 데이터 조회
    const formulaRows = await query(`
      SELECT
        f.config_id, f.dept_id, f.total_score, f.suneung_ratio,
        f.subjects_config, f.selection_rules, f.bonus_rules,
        f.special_mode, f.legacy_formula, f.legacy_uid,
        f.english_scores, f.history_scores,
        d.year_id
      FROM formula_configs f
      JOIN departments d ON f.dept_id = d.dept_id
      WHERE f.dept_id = ? AND d.year_id = ?
    `, [dept_id, year_id]);

    if (formulaRows.length === 0) {
      return NextResponse.json(
        { error: '해당 학과의 계산식을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const row = formulaRows[0] as Record<string, unknown>;

    // subjects_config JSON 파싱
    const subjectsConfig = safeParse<Record<string, { ratio?: number; count?: number; mode?: string }>>(
      row.subjects_config, {}
    ) || {};

    // FormulaData 변환
    const formulaData: FormulaData = {
      U_ID: row.legacy_uid as number | undefined,
      dept_id: row.dept_id as number,
      학년도: row.year_id as number,
      총점: Number(row.total_score) || 1000,
      수능: Number(row.suneung_ratio) || 100,
      국어: Number(subjectsConfig.korean?.ratio) || 0,
      수학: Number(subjectsConfig.math?.ratio) || 0,
      영어: Number(subjectsConfig.english?.ratio) || 0,
      탐구: Number(subjectsConfig.inquiry?.ratio) || 0,
      탐구수: subjectsConfig.inquiry?.count || 2,
      한국사: Number(subjectsConfig.history?.ratio) || 0,
      selection_rules: row.selection_rules as string | undefined,
      bonus_rules: row.bonus_rules as string | undefined,
      english_scores: row.english_scores as string | undefined,
      history_scores: row.history_scores as string | undefined,
      계산유형: row.legacy_formula ? '특수공식' : '기본비율',
      특수공식: row.legacy_formula as string | undefined,
    };

    // 2. 최고표점 조회
    const highestRows = await query(`
      SELECT 과목명, 최고점
      FROM highest_scores
      WHERE year_id = ? AND 모형 = '수능'
    `, [year_id]);

    const highestMap: HighestScoreMap = {};
    for (const h of highestRows as Array<{ 과목명: string; 최고점: number }>) {
      highestMap[h.과목명] = h.최고점;
    }

    // 3. 탐구 변환표 조회 (학과별)
    const convMap: { 사탐: Record<string, number>; 과탐: Record<string, number> } = {
      사탐: {},
      과탐: {},
    };

    try {
      const convRows = await query(`
        SELECT 계열, 백분위, 변환표준점수
        FROM inquiry_conv_tables
        WHERE dept_id = ?
      `, [dept_id]);

      for (const c of convRows as Array<{ 계열: string; 백분위: number; 변환표준점수: number }>) {
        if (c.계열 === '사탐') {
          convMap.사탐[String(c.백분위)] = Number(c.변환표준점수);
        } else if (c.계열 === '과탐') {
          convMap.과탐[String(c.백분위)] = Number(c.변환표준점수);
        }
      }

      // 변환표가 있으면 formulaData에 주입
      if (Object.keys(convMap.사탐).length > 0 || Object.keys(convMap.과탐).length > 0) {
        formulaData.탐구변표 = convMap;
      }
    } catch {
      // 변환표가 없어도 계산 가능
    }

    // 4. 점수 계산
    const logs: string[] = [];
    const result = calculateScoreWithConv(
      formulaData,
      student_scores,
      convMap,
      (msg) => logs.push(msg),
      Object.keys(highestMap).length > 0 ? highestMap : null
    );

    return NextResponse.json({
      success: true,
      result: {
        totalScore: result.totalScore,
        breakdown: result.breakdown,
      },
      calculationLog: result.calculationLog,
    });
  } catch (error) {
    console.error('Calculate suneung API error:', error);
    return NextResponse.json(
      { error: '수능 점수 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
