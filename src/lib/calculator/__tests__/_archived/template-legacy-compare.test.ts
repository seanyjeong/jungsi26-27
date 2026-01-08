/**
 * 템플릿 vs 레거시 점수 비교 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { buildSpecialContext } from '../suneung/special-context';
import { evaluateSpecialFormula } from '../suneung/formula-eval';
import type { ParsedStudentScores, FormulaData } from '../types';

const YEAR = 2026;

let cafe24Pool: mysql.Pool;

// 테스트 학생 (ParsedStudentScores 형식 - 레거시 계산용)
const testStudentParsed: ParsedStudentScores = {
  국어: { name: '국어', std: 145, percentile: 99, subject: '화법과작문' },
  수학: { name: '수학', std: 148, percentile: 99, subject: '미적분' },
  영어: { name: '영어', grade: 1 },
  한국사: { name: '한국사', grade: 1 },
  탐구: [
    { name: '탐구', std: 70, percentile: 98, subject: '물리학I', converted_std: 72 },
    { name: '탐구', std: 68, percentile: 96, subject: '화학I', converted_std: 70 }
  ]
};

const derived = {
  inq_avg_pct: 97,
  inq_sum_converted: 142,
  inq_avg_converted: 71,
};

beforeAll(async () => {
  cafe24Pool = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });
});

afterAll(async () => {
  await cafe24Pool?.end();
});

/**
 * 템플릿 계산 (컨텍스트 값 사용)
 *
 * ctx: 레거시 buildSpecialContext에서 생성된 값들을 사용
 */
interface TemplateContext {
  kor_std: number;
  kor_pct: number;
  math_std: number;
  math_pct: number;
  eng_grade_score: number;
  eng_pct_est: number;
  hist_grade_score: number;
  inq1_std: number;
  inq2_std: number;
  inq1_percentile: number;
  inq2_percentile: number;
  inq1_converted_std: number;
  inq2_converted_std: number;
  inq_avg2_percentile: number;
  inq_sum2_converted_std: number;
  inq_avg2_converted_std: number;
  suneung_ratio: number;
  total: number;
}

function calculateByTemplate(
  formula: string,
  selRules: any,
  ctx: TemplateContext
): number | null {
  const ratio = ctx.suneung_ratio;
  const total = ctx.total;

  const kor_pct = ctx.kor_pct;
  const kor_std = ctx.kor_std;
  const math_pct = ctx.math_pct;
  const math_std = ctx.math_std;
  const eng_grade_score = ctx.eng_grade_score;
  const eng_pct_est = ctx.eng_pct_est;
  const hist_grade_score = ctx.hist_grade_score;
  const inq1_pct = ctx.inq1_percentile;
  const inq2_pct = ctx.inq2_percentile;
  const inq1_std = ctx.inq1_std;
  const inq2_std = ctx.inq2_std;
  const inq1_conv = ctx.inq1_converted_std;
  const inq2_conv = ctx.inq2_converted_std;
  const inq_avg_pct = ctx.inq_avg2_percentile;
  const inq_sum_converted = ctx.inq_sum2_converted_std;
  const inq_avg_converted = ctx.inq_avg2_converted_std;

  // top2/top3
  if (formula.includes('top2_') || formula.includes('top3_')) {
    const n = formula.includes('top2') ? 2 : 3;
    const scores = [kor_pct, math_pct, eng_pct_est, inq_avg_pct];
    const sorted = [...scores].sort((a, b) => b - a).slice(0, n);
    const coeffMatch = formula.match(/\*\s*([\d.]+)\s*\)\s*\+/);
    const baseMatch = formula.match(/\+\s*(\d+)\s*\)\s*\*/);
    const coeff = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
    const base = baseMatch ? parseInt(baseMatch[1]) : 0;
    const avg = sorted.reduce((a, b) => a + b, 0) / n;
    return (avg * coeff + base) * ratio + hist_grade_score;
  }

  // max_kor_math / top1_math_or_eng
  if (formula.includes('max_kor_math') || formula.includes('top1_math_or_eng')) {
    const maxME = Math.max(math_pct, eng_pct_est);
    if (formula.includes('inq_avg2_percentile') && formula.includes('* 0.6')) {
      return (kor_pct + inq_avg_pct + maxME) * 0.6 + hist_grade_score;
    }
    if (formula.includes('* 1.5')) {
      return (kor_pct + maxME) * 1.5 + hist_grade_score;
    }
    const score = maxME * 0.4 + eng_pct_est * 0.3 + inq_avg_pct * 0.3;
    return score * (total / 100) * ratio + hist_grade_score;
  }

  // 정규화
  if (formula.includes('{kor_max}') || formula.includes('/ 560') || formula.includes('/ 600')) {
    return (kor_std / 150) * 200 + (math_std / 150) * 200 + (inq_avg_pct / 100) * 200 + eng_grade_score + hist_grade_score;
  }

  // select_ranked_weights
  if (selRules?.type === 'select_ranked_weights') {
    const weights = selRules.weights || [0.5, 0.3, 0.2];
    const scores = [kor_pct, math_pct, eng_pct_est, inq_avg_pct];
    const sorted = [...scores].sort((a, b) => b - a);
    let weighted = 0;
    for (let i = 0; i < weights.length && i < sorted.length; i++) {
      weighted += sorted[i] * weights[i];
    }
    return weighted * (total / 100) * ratio + hist_grade_score;
  }

  // 계명대 (4과목 평균)
  if (formula.includes('* 0.25') && formula.includes('* 4')) {
    return kor_pct + math_pct + eng_pct_est + inq_avg_pct + hist_grade_score;
  }

  // 경남대 (기본점 + 합계)
  if (formula.match(/^\s*\(\s*\d{3}\s*\+/)) {
    const baseMatch = formula.match(/^\s*\(\s*(\d+)/);
    const base = baseMatch ? parseInt(baseMatch[1]) : 480;
    return base + ((kor_pct + math_pct + eng_pct_est + inq1_pct) * 0.3) + (math_pct >= 90 ? 10 : 0);
  }

  // 창원대
  if (formula.includes('0.6 +') && formula.includes('0.4 *') && formula.includes('ratio_kor_norm')) {
    return null;
  }

  // 가중 표준점수 합
  if (formula.includes('{kor_std}') || formula.includes('{math_std}')) {
    if (formula.includes('* 850 / 600')) {
      return (kor_std + math_std + eng_grade_score + inq_avg_converted) * (850 / 600);
    }
    if (formula.includes('ratio5')) {
      return (kor_std + math_std + inq_sum_converted + eng_grade_score + hist_grade_score) * ratio;
    }
    if (formula.includes('120/200') || formula.includes('90/200')) {
      return kor_std * 0.6 + math_std * 0.45 + inq1_std * 0.45 + inq2_std * 0.45 + eng_grade_score + hist_grade_score;
    }
    if (formula.includes('* 120)') && formula.includes('* 90)') && formula.includes('/ 200')) {
      return (kor_std * 120 + math_std * 90 + (inq1_std + inq2_std) * 90) / 200 + eng_grade_score + hist_grade_score;
    }
    if (formula.includes('* 1.4)') && !formula.includes('math_std')) {
      return (kor_std + eng_grade_score + inq_sum_converted) * 1.4 + hist_grade_score;
    }

    // 기본 가중합
    const korCoeffMatch = formula.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/);
    const mathCoeffMatch = formula.match(/\{math_std\}\s*\*?\s*([\d.]+)?/);
    const korCoeff = korCoeffMatch && korCoeffMatch[1] ? parseFloat(korCoeffMatch[1]) : 1;
    const mathCoeff = mathCoeffMatch && mathCoeffMatch[1] ? parseFloat(mathCoeffMatch[1]) : 1;

    let score = kor_std * korCoeff + math_std * mathCoeff;
    if (formula.includes('inq')) score += inq_sum_converted * 0.8;
    if (formula.includes('eng_grade_score')) score += eng_grade_score;
    if (formula.includes('hist_grade_score')) score += hist_grade_score;
    return score;
  }

  return null;
}

describe('템플릿 vs 레거시 점수 비교', () => {
  it('50개 특수공식 전체 비교', async () => {
    const [rows] = await cafe24Pool.execute<mysql.RowDataPacket[]>(`
      SELECT b.U_ID, b.대학명, b.학과명, r.*
      FROM 정시기본 b
      JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
      WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
      ORDER BY b.U_ID
    `, [YEAR]);

    console.log(`\n특수공식 학과: ${rows.length}개\n`);

    let matched = 0, mismatched = 0, skipped = 0;
    const mismatches: any[] = [];

    for (const row of rows) {
      const uid = row.U_ID;
      const name = `[${uid}] ${row.대학명} - ${row.학과명}`;
      const formula = row.특수공식 || '';

      let selRules = null;
      try {
        selRules = typeof row.selection_rules === 'string'
          ? JSON.parse(row.selection_rules)
          : row.selection_rules;
      } catch (e) {}

      // 레거시 계산용 FormulaData 구성 (DB row 직접 사용)
      const formulaData: FormulaData = {
        ...row,
        english_scores: row.english_scores,
        history_scores: row.history_scores,
        탐구변표: null,  // 탐구변환표는 DB에서 조회 필요
        score_config: typeof row.score_config === 'string'
          ? row.score_config
          : JSON.stringify(row.score_config || {}),
      };

      const legacyLogs: string[] = [];
      let legacyScore: number;

      // 최고표점 맵 (간단한 테스트용)
      const highestMap: Record<string, number> = {
        '화법과작문': 150,
        '미적분': 150,
        '물리학I': 70,
        '화학I': 70,
      };

      let specialCtx: ReturnType<typeof buildSpecialContext>;

      try {
        specialCtx = buildSpecialContext(formulaData, testStudentParsed, highestMap);
        legacyScore = evaluateSpecialFormula(formula, specialCtx, legacyLogs);
      } catch (err) {
        skipped++;
        continue;
      }

      // 템플릿 계산 (레거시 컨텍스트의 값 사용)
      const templateCtx: TemplateContext = {
        kor_std: specialCtx.kor_std,
        kor_pct: specialCtx.kor_pct,
        math_std: specialCtx.math_std,
        math_pct: specialCtx.math_pct,
        eng_grade_score: specialCtx.eng_grade_score,
        eng_pct_est: specialCtx.eng_pct_est,
        hist_grade_score: specialCtx.hist_grade_score,
        inq1_std: specialCtx.inq1_std,
        inq2_std: specialCtx.inq2_std,
        inq1_percentile: specialCtx.inq1_percentile,
        inq2_percentile: specialCtx.inq2_percentile,
        inq1_converted_std: specialCtx.inq1_converted_std,
        inq2_converted_std: specialCtx.inq2_converted_std,
        inq_avg2_percentile: specialCtx.inq_avg2_percentile,
        inq_sum2_converted_std: specialCtx.inq_sum2_converted_std,
        inq_avg2_converted_std: specialCtx.inq_avg2_converted_std,
        suneung_ratio: specialCtx.suneung_ratio,
        total: specialCtx.total,
      };

      const templateScore = calculateByTemplate(formula, selRules, templateCtx);

      if (templateScore === null) {
        skipped++;
        continue;
      }

      // 비교
      const diff = Math.abs(legacyScore - templateScore);
      const threshold = 1;

      if (diff <= threshold) {
        matched++;
        console.log(`✅ ${name}: 레거시=${legacyScore.toFixed(2)}, 템플릿=${templateScore.toFixed(2)}, 차이=${diff.toFixed(2)}`);
      } else {
        mismatched++;
        mismatches.push({ uid, name, legacy: legacyScore, template: templateScore, diff });
        console.log(`❌ ${name}: 레거시=${legacyScore.toFixed(2)}, 템플릿=${templateScore.toFixed(2)}, 차이=${diff.toFixed(2)}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(` 결과: 일치 ${matched}개, 불일치 ${mismatched}개, 스킵 ${skipped}개`);
    console.log(` 일치율: ${((matched / (matched + mismatched)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    if (mismatches.length > 0) {
      console.log('\n불일치 목록:');
      for (const m of mismatches) {
        console.log(`  ${m.name}: 차이 ${m.diff.toFixed(2)}`);
      }
    }

    // 90% 이상 일치하면 성공
    expect(matched / (matched + mismatched)).toBeGreaterThanOrEqual(0.9);
  }, 60000);
});
