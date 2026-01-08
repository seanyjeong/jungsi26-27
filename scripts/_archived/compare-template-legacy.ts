/**
 * 템플릿 vs 레거시 점수 비교 검증
 *
 * 기존 특수공식 계산 결과와 템플릿 기반 계산 결과 비교
 */

import mysql from 'mysql2/promise';
import { buildSpecialContext } from '../src/lib/calculator/suneung/special-context';
import { evaluateSpecialFormula } from '../src/lib/calculator/suneung/formula-eval';
import type { StudentScores, FormulaConfig, CalculationLog } from '../src/lib/calculator/types';

const YEAR = 2026;

// cafe24 DB
const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
});

// 테스트 학생 데이터
const testStudent: StudentScores = {
  korean: { percentile: 99, standardScore: 145 },
  math: { percentile: 99, standardScore: 148 },
  english: { grade: 1, gradeScore: 100 },
  inquiry1: { percentile: 98, standardScore: 70, subject: '물리학I', convertedStd: 72 },
  inquiry2: { percentile: 96, standardScore: 68, subject: '화학I', convertedStd: 70 },
  history: { grade: 1, gradeScore: 10 }
};

// 파생값
const derived = {
  inq_avg_pct: (testStudent.inquiry1.percentile + testStudent.inquiry2!.percentile) / 2,
  inq_sum_std: testStudent.inquiry1.standardScore! + testStudent.inquiry2!.standardScore!,
  inq_sum_converted: testStudent.inquiry1.convertedStd! + testStudent.inquiry2!.convertedStd!,
  inq_avg_converted: (testStudent.inquiry1.convertedStd! + testStudent.inquiry2!.convertedStd!) / 2,
  max_math_eng: Math.max(testStudent.math.percentile, testStudent.english.gradeScore!),
};

interface DeptRow {
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
  특수공식: string;
  selection_rules: any;
  score_config: any;
}

/**
 * 템플릿 감지 및 계산
 */
function calculateByTemplate(formula: string, selRules: any, config: { total: number; suneung_ratio: number }): number | null {
  const { total, suneung_ratio } = config;
  const ratio = suneung_ratio / 100;

  const kor_pct = testStudent.korean.percentile;
  const kor_std = testStudent.korean.standardScore!;
  const math_pct = testStudent.math.percentile;
  const math_std = testStudent.math.standardScore!;
  const eng_grade_score = testStudent.english.gradeScore!;
  const inq1_pct = testStudent.inquiry1.percentile;
  const inq1_std = testStudent.inquiry1.standardScore!;
  const inq1_conv = testStudent.inquiry1.convertedStd!;
  const inq2_pct = testStudent.inquiry2!.percentile;
  const inq2_std = testStudent.inquiry2!.standardScore!;
  const inq2_conv = testStudent.inquiry2!.convertedStd!;
  const hist_grade_score = testStudent.history.gradeScore!;

  // 1. top2/top3 패턴
  if (formula.includes('top2_') || formula.includes('top3_')) {
    const n = formula.includes('top2') ? 2 : 3;
    const scores = [kor_pct, math_pct, eng_grade_score, derived.inq_avg_pct];
    const sorted = [...scores].sort((a, b) => b - a).slice(0, n);

    const coeffMatch = formula.match(/\*\s*([\d.]+)\s*\)\s*\+/);
    const baseMatch = formula.match(/\+\s*(\d+)\s*\)\s*\*/);
    const coeff = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
    const base = baseMatch ? parseInt(baseMatch[1]) : 0;

    const avg = sorted.reduce((a, b) => a + b, 0) / n;
    return (avg * coeff + base) * ratio + hist_grade_score;
  }

  // 2. max_kor_math / top1_math_or_eng
  if (formula.includes('max_kor_math') || formula.includes('top1_math_or_eng')) {
    const maxME = Math.max(math_pct, eng_grade_score);

    if (formula.includes('inq_avg2_percentile') && formula.includes('* 0.6')) {
      return (kor_pct + derived.inq_avg_pct + maxME) * 0.6 + hist_grade_score;
    }
    if (formula.includes('* 1.5')) {
      return (kor_pct + maxME) * 1.5 + hist_grade_score;
    }

    const score = maxME * 0.4 + eng_grade_score * 0.3 + derived.inq_avg_pct * 0.3;
    return score * (total / 100) * ratio + hist_grade_score;
  }

  // 3. 정규화 (kor_max)
  if (formula.includes('{kor_max}') || formula.includes('/ 560') || formula.includes('/ 600')) {
    const korNorm = (kor_std / 150) * 200;
    const mathNorm = (math_std / 150) * 200;
    const inqNorm = (derived.inq_avg_pct / 100) * 200;
    return korNorm + mathNorm + inqNorm + eng_grade_score + hist_grade_score;
  }

  // 4. select_ranked_weights
  if (selRules?.type === 'select_ranked_weights') {
    const weights = selRules.weights || [0.5, 0.3, 0.2];
    const scores = [kor_pct, math_pct, eng_grade_score, derived.inq_avg_pct];
    const sorted = [...scores].sort((a, b) => b - a);

    let weighted = 0;
    for (let i = 0; i < weights.length && i < sorted.length; i++) {
      weighted += sorted[i] * weights[i];
    }
    return weighted * (total / 100) * ratio + hist_grade_score;
  }

  // 5. 4과목 평균 (계명대)
  if (formula.includes('* 0.25') && formula.includes('* 4')) {
    const sum = kor_pct + math_pct + 100 + derived.inq_avg_pct; // eng_pct_est = 100
    return sum + hist_grade_score;
  }

  // 6. 기본점 + 합계 (경남대)
  if (formula.match(/^\s*\(\s*\d{3}\s*\+/)) {
    const baseMatch = formula.match(/^\s*\(\s*(\d+)/);
    const base = baseMatch ? parseInt(baseMatch[1]) : 480;
    const sum = kor_pct + math_pct + 100 + inq1_pct;
    const bonus = math_pct >= 90 ? 10 : 0;
    return base + (sum * 0.3) + bonus;
  }

  // 7. 창원대 특수
  if (formula.includes('0.6 +') && formula.includes('0.4 *') && formula.includes('ratio_kor_norm')) {
    return null; // 커스텀
  }

  // 8. 가중 표준점수 합
  if (formula.includes('{kor_std}') || formula.includes('{math_std}')) {
    // 연세대
    if (formula.includes('* 850 / 600')) {
      const sum = kor_std + math_std + eng_grade_score + derived.inq_avg_converted;
      return sum * (850 / 600);
    }

    // ratio5 (중앙대)
    if (formula.includes('ratio5')) {
      const sum = kor_std + math_std + derived.inq_sum_converted + eng_grade_score + hist_grade_score;
      return sum * ratio;
    }

    // 충남대 비실기
    if (formula.includes('120/200') || formula.includes('90/200')) {
      return kor_std * 0.6 + math_std * 0.45 + inq1_std * 0.45 + inq2_std * 0.45 + eng_grade_score + hist_grade_score;
    }

    // 충남대 체육교육과
    if (formula.includes('* 120)') && formula.includes('* 90)') && formula.includes('/ 200')) {
      return (kor_std * 120 + math_std * 90 + (inq1_std + inq2_std) * 90) / 200 + eng_grade_score + hist_grade_score;
    }

    // 경북대 체육학부
    if (formula.includes('* 1.4)') && !formula.includes('math_std')) {
      return (kor_std + eng_grade_score + derived.inq_sum_converted) * 1.4 + hist_grade_score;
    }

    // 기본 가중합
    const korCoeffMatch = formula.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/);
    const mathCoeffMatch = formula.match(/\{math_std\}\s*\*?\s*([\d.]+)?/);

    const korCoeff = korCoeffMatch && korCoeffMatch[1] ? parseFloat(korCoeffMatch[1]) : 1;
    const mathCoeff = mathCoeffMatch && mathCoeffMatch[1] ? parseFloat(mathCoeffMatch[1]) : 1;

    let score = kor_std * korCoeff + math_std * mathCoeff;

    if (formula.includes('inq')) {
      score += derived.inq_sum_converted * 0.8;
    }
    if (formula.includes('eng_grade_score')) score += eng_grade_score;
    if (formula.includes('hist_grade_score')) score += hist_grade_score;

    return score;
  }

  return null;
}

async function main() {
  console.log('=== 템플릿 vs 레거시 점수 비교 검증 ===\n');

  // 특수공식 조회
  const [rows] = await cafe24Pool.execute<mysql.RowDataPacket[]>(`
    SELECT b.U_ID, b.대학명, b.학과명, r.*
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`특수공식 학과: ${rows.length}개\n`);

  const results: Array<{
    uid: number;
    name: string;
    legacy: number;
    template: number | null;
    diff: number | null;
    match: boolean;
  }> = [];

  let matched = 0;
  let mismatched = 0;
  let skipped = 0;

  for (const row of rows as DeptRow[]) {
    const uid = row.U_ID;
    const name = `[${uid}] ${row.대학명} - ${row.학과명}`;
    const formula = row.특수공식 || '';

    let selRules = null;
    try {
      selRules = typeof row.selection_rules === 'string'
        ? JSON.parse(row.selection_rules)
        : row.selection_rules;
    } catch (e) {}

    let scoreConfig = null;
    try {
      scoreConfig = typeof row.score_config === 'string'
        ? JSON.parse(row.score_config)
        : row.score_config;
    } catch (e) {}

    // 1. 레거시 계산
    const legacyConfig: FormulaConfig = {
      totalScore: row.총점,
      suneungRatio: row.수능,
      calculationType: '특수공식',
      specialFormula: formula,
      selectionRules: selRules,
      scoreConfig: scoreConfig,
      subjects: {
        korean: { ratio: parseFloat(row.국어) || 0, scoreType: 'percentile' },
        math: { ratio: parseFloat(row.수학) || 0, scoreType: 'percentile' },
        english: { ratio: parseFloat(row.영어) || 0, scoreType: 'gradeConvert' },
        inquiry: { ratio: parseFloat(row.탐구) || 0, count: row.탐구수 || 2, scoreType: 'percentile' }
      }
    };

    const legacyLogs: CalculationLog[] = [];
    let legacyScore: number;

    try {
      const specialCtx = buildSpecialContext(testStudent, legacyConfig, {
        maxScores: { korean: 150, math: 150 }
      });
      legacyScore = evaluateSpecialFormula(formula, specialCtx, legacyLogs);
    } catch (err) {
      console.log(`⚠️ ${name}: 레거시 계산 오류`);
      skipped++;
      continue;
    }

    // 2. 템플릿 계산
    const templateScore = calculateByTemplate(formula, selRules, {
      total: row.총점,
      suneung_ratio: row.수능
    });

    if (templateScore === null) {
      console.log(`⏭️ ${name}: 커스텀 (템플릿 미지원)`);
      results.push({ uid, name, legacy: legacyScore, template: null, diff: null, match: false });
      skipped++;
      continue;
    }

    // 3. 비교
    const diff = Math.abs(legacyScore - templateScore);
    const threshold = 1; // 1점 오차 허용
    const isMatch = diff <= threshold;

    if (isMatch) {
      matched++;
      console.log(`✅ ${name}`);
      console.log(`   레거시: ${legacyScore.toFixed(2)}, 템플릿: ${templateScore.toFixed(2)}, 차이: ${diff.toFixed(2)}`);
    } else {
      mismatched++;
      console.log(`❌ ${name}`);
      console.log(`   레거시: ${legacyScore.toFixed(2)}, 템플릿: ${templateScore.toFixed(2)}, 차이: ${diff.toFixed(2)}`);
    }

    results.push({ uid, name, legacy: legacyScore, template: templateScore, diff, match: isMatch });
  }

  // 요약
  console.log('\n' + '='.repeat(70));
  console.log(' 비교 결과 요약');
  console.log('='.repeat(70));
  console.log(`  총 학과: ${rows.length}개`);
  console.log(`  일치 (1점 이내): ${matched}개`);
  console.log(`  불일치: ${mismatched}개`);
  console.log(`  스킵/커스텀: ${skipped}개`);
  console.log(`\n  일치율: ${((matched / (matched + mismatched)) * 100).toFixed(1)}%`);

  // 불일치 목록
  if (mismatched > 0) {
    console.log('\n' + '='.repeat(70));
    console.log(' 불일치 상세');
    console.log('='.repeat(70));
    for (const r of results.filter(r => r.template !== null && !r.match)) {
      console.log(`\n${r.name}`);
      console.log(`  레거시: ${r.legacy.toFixed(2)}`);
      console.log(`  템플릿: ${r.template!.toFixed(2)}`);
      console.log(`  차이: ${r.diff!.toFixed(2)}`);
    }
  }

  await cafe24Pool.end();
}

main().catch(console.error);
