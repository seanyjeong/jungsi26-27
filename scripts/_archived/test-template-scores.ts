/**
 * 템플릿 기반 점수 계산 vs 레거시 특수공식 비교 테스트
 *
 * 목표: 정규화된 템플릿 계산이 기존 특수공식과 동일한 결과를 내는지 검증
 */

import mysql from 'mysql2/promise';
import { evaluateSpecialFormula } from '../src/lib/calculator/suneung/formula-eval.js';
import { buildSpecialContext } from '../src/lib/calculator/suneung/special-context.js';
import { calculateByTemplate, TemplateType, TemplateParams, TemplateContext } from '../src/lib/calculator/templates/index.js';
import { CalculationLog, StudentScores, SubjectScore, FormulaConfig } from '../src/lib/calculator/types.js';

const YEAR = 2026;

// cafe24 DB
const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
});

// 테스트 학생 데이터 (만점형)
const testStudent: StudentScores = {
  korean: { percentile: 99, standardScore: 145 },
  math: { percentile: 99, standardScore: 148 },
  english: { grade: 1, gradeScore: 100 },
  inquiry1: { percentile: 98, standardScore: 70, subject: '물리학I', convertedStd: 72 },
  inquiry2: { percentile: 96, standardScore: 68, subject: '화학I', convertedStd: 70 },
  history: { grade: 1, gradeScore: 10 }
};

interface DepartmentRow {
  U_ID: number;
  대학명: string;
  학과명: string;
  총점: number;
  수능: number;
  국어: string;
  수학: string;
  영어: string;
  탐구: string;
  탐구수: number;
  계산유형: string;
  특수공식: string | null;
  selection_rules: string | null;
  score_config: string | null;
}

/**
 * 특수공식 패턴 분석하여 템플릿 타입 결정
 */
function detectTemplateFromFormula(formula: string, selRules: any): {
  templateType: TemplateType;
  params: TemplateParams;
} | null {
  // 1. top2/top3 패턴
  if (formula.includes('top2_') || formula.includes('top3_')) {
    const match = formula.match(/top(\d)_(avg|sum)/);
    const n = match ? parseInt(match[1]) : 3;
    const method = match && match[2] === 'avg' ? '평균' : '합계';

    // 계수 추출
    const coeffMatch = formula.match(/\*\s*([\d.]+)\s*\)/);
    const baseMatch = formula.match(/\+\s*(\d+)(?:\s*\)|$)/);

    return {
      templateType: 'top_n_select',
      params: {
        선택대상: ['국어', '수학', '영어', '탐구'],
        선택개수: n,
        계산방식: method,
        배수: coeffMatch ? parseFloat(coeffMatch[1]) : 1,
        기본점: baseMatch ? parseInt(baseMatch[1]) : 0
      }
    };
  }

  // 2. 가중 표준점수 합 패턴
  if (/\{kor_std\}\s*\*?\s*[\d.]+/.test(formula) || /\{math_std\}\s*\*?\s*[\d.]+/.test(formula)) {
    const korMatch = formula.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/);
    const mathMatch = formula.match(/\{math_std\}\s*\*?\s*([\d.]+)?/);

    return {
      templateType: 'weighted_std',
      params: {
        국어계수: korMatch ? parseFloat(korMatch[1]) || 1 : 1,
        수학계수: mathMatch ? parseFloat(mathMatch[1]) || 1 : 1,
        탐구계수: 1,
        영어처리방식: formula.includes('eng_grade_score') ? '등급환산추가' : '제외',
        한국사처리: formula.includes('hist_grade_score') ? '등급환산추가' : '제외'
      }
    };
  }

  // 3. select_ranked_weights (selection_rules 기반)
  if (selRules?.type === 'select_ranked_weights') {
    return {
      templateType: 'ranked_weights',
      params: {
        선택대상: selRules.from || ['국어', '수학', '영어', '탐구'],
        가중치: selRules.weights || [0.5, 0.3, 0.2],
        점수유형: '백분위'
      }
    };
  }

  // 4. 정규화 패턴
  if (formula.includes('{kor_max}') || formula.includes('/ 560') || formula.includes('/ 600')) {
    return {
      templateType: 'normalized',
      params: {
        국어배점: 200,
        수학배점: 200,
        탐구배점: 200
      }
    };
  }

  // 5. 국/수 택1
  if (formula.includes('max_kor_math') || formula.includes('top1_math_or_eng')) {
    return {
      templateType: 'max_subject',
      params: {
        택1대상: ['국어', '수학'],
        택1비율: 40,
        영어비율: 30,
        탐구비율: 30
      }
    };
  }

  // 패턴 감지 실패 - 커스텀
  return null;
}

/**
 * 학생 점수를 템플릿 컨텍스트로 변환
 */
function buildTemplateContext(
  student: StudentScores,
  config: { total: number; suneung_ratio: number; kor_max?: number; math_max?: number }
): TemplateContext {
  return {
    kor_pct: student.korean.percentile,
    kor_std: student.korean.standardScore || 0,
    math_pct: student.math.percentile,
    math_std: student.math.standardScore || 0,
    eng_grade: student.english.grade,
    eng_grade_score: student.english.gradeScore || 100,
    inq1_pct: student.inquiry1.percentile,
    inq1_std: student.inquiry1.standardScore || 0,
    inq2_pct: student.inquiry2?.percentile || 0,
    inq2_std: student.inquiry2?.standardScore || 0,
    inq_avg_pct: student.inquiry2
      ? (student.inquiry1.percentile + student.inquiry2.percentile) / 2
      : student.inquiry1.percentile,
    inq_sum_std: (student.inquiry1.standardScore || 0) + (student.inquiry2?.standardScore || 0),
    hist_grade: student.history.grade,
    hist_grade_score: student.history.gradeScore || 10,
    total: config.total,
    suneung_ratio: config.suneung_ratio,
    kor_max: config.kor_max,
    math_max: config.math_max
  };
}

async function main() {
  console.log('=== 템플릿 점수 검증 테스트 ===\n');

  // 특수공식 학과 조회
  const [rows] = await cafe24Pool.execute<mysql.RowDataPacket[]>(`
    SELECT b.U_ID, b.대학명, b.학과명, r.*
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`특수공식 학과: ${rows.length}개\n`);

  // 통계
  const stats = {
    total: rows.length,
    normalized: 0,  // 정규화 성공
    custom: 0,      // 커스텀 유지
    matched: 0,     // 점수 일치
    mismatched: 0   // 점수 불일치
  };

  const mismatches: Array<{
    uid: number;
    name: string;
    legacy: number;
    template: number;
    diff: number;
  }> = [];

  for (const row of rows as DepartmentRow[]) {
    const uid = row.U_ID;
    const name = `[${uid}] ${row.대학명} - ${row.학과명}`;
    const formula = row.특수공식 || '';
    const selRules = row.selection_rules ? JSON.parse(row.selection_rules) : null;

    // 1. 레거시 방식 계산 (특수공식)
    const legacyLogs: CalculationLog[] = [];
    const legacyConfig: FormulaConfig = {
      totalScore: row.총점,
      suneungRatio: row.수능,
      calculationType: '특수공식',
      specialFormula: formula,
      selectionRules: selRules,
      scoreConfig: row.score_config ? JSON.parse(row.score_config) : null,
      subjects: {
        korean: { ratio: parseFloat(row.국어) || 0, scoreType: 'percentile' },
        math: { ratio: parseFloat(row.수학) || 0, scoreType: 'percentile' },
        english: { ratio: parseFloat(row.영어) || 0, scoreType: 'gradeConvert' },
        inquiry: { ratio: parseFloat(row.탐구) || 0, count: row.탐구수 || 2, scoreType: 'percentile' }
      }
    };

    // 특수공식 컨텍스트 빌드 및 계산
    const specialCtx = buildSpecialContext(testStudent, legacyConfig, {
      maxScores: { korean: 150, math: 150 }
    });
    let legacyScore: number;
    try {
      legacyScore = evaluateSpecialFormula(formula, specialCtx, legacyLogs);
    } catch (err) {
      console.log(`  ${name}: 레거시 계산 오류 - ${err}`);
      stats.custom++;
      continue;
    }

    // 2. 템플릿 감지
    const templateResult = detectTemplateFromFormula(formula, selRules);

    if (!templateResult) {
      // 커스텀 - 정규화 불가
      stats.custom++;
      console.log(`  ${name}: ❌ 커스텀 유지`);
      continue;
    }

    stats.normalized++;

    // 3. 템플릿 방식 계산
    const templateLogs: CalculationLog[] = [];
    const templateCtx = buildTemplateContext(testStudent, {
      total: row.총점,
      suneung_ratio: row.수능,
      kor_max: 150,
      math_max: 150
    });

    let templateScore: number;
    try {
      templateScore = calculateByTemplate(
        templateResult.templateType,
        templateResult.params,
        templateCtx,
        templateLogs
      );
    } catch (err) {
      console.log(`  ${name}: 템플릿 계산 오류 - ${err}`);
      stats.custom++;
      continue;
    }

    // 4. 비교
    const diff = Math.abs(legacyScore - templateScore);
    const threshold = 0.1; // 0.1점 이내 오차 허용

    if (diff <= threshold) {
      stats.matched++;
      console.log(`  ${name}: ✅ 일치 (${legacyScore.toFixed(2)} ≈ ${templateScore.toFixed(2)})`);
    } else {
      stats.mismatched++;
      mismatches.push({
        uid,
        name,
        legacy: legacyScore,
        template: templateScore,
        diff
      });
      console.log(`  ${name}: ⚠️ 불일치 (레거시=${legacyScore.toFixed(2)}, 템플릿=${templateScore.toFixed(2)}, 차이=${diff.toFixed(2)})`);
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log(' 테스트 결과 요약');
  console.log('='.repeat(60));
  console.log(`  총 특수공식: ${stats.total}개`);
  console.log(`  정규화 시도: ${stats.normalized}개`);
  console.log(`  커스텀 유지: ${stats.custom}개`);
  console.log(`  점수 일치: ${stats.matched}개`);
  console.log(`  점수 불일치: ${stats.mismatched}개`);
  console.log(`\n  정규화율: ${((stats.normalized / stats.total) * 100).toFixed(1)}%`);
  console.log(`  정확도: ${((stats.matched / stats.normalized) * 100).toFixed(1)}%`);

  if (mismatches.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log(' 불일치 목록');
    console.log('='.repeat(60));
    for (const m of mismatches) {
      console.log(`  ${m.name}`);
      console.log(`    레거시: ${m.legacy.toFixed(2)}, 템플릿: ${m.template.toFixed(2)}, 차이: ${m.diff.toFixed(2)}`);
    }
  }

  await cafe24Pool.end();
}

main().catch(console.error);
